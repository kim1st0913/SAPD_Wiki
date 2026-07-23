"""Owned-process supervisor for the isolated Web-development MCP Sidecar."""

from __future__ import annotations

import http.client
import json
import os
import secrets
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Mapping

from .control_models import GatewayActionError
from .control_store import ControlStore


def _iso(value: float | None) -> str | None:
    if value is None:
        return None
    return datetime.fromtimestamp(value, UTC).isoformat().replace("+00:00", "Z")


class DevSidecarSupervisor:
    """Own exactly one child process and never terminates an unowned listener."""

    def __init__(
        self,
        *,
        configured_port: int = 28775,
        runtime_root: Path | None = None,
        startup_timeout_seconds: float = 12.0,
        authorization_timeout_seconds: int = 120,
        cleanup_on_close: bool = True,
    ) -> None:
        if not 1024 <= configured_port <= 65535:
            raise ValueError("configured_port must be between 1024 and 65535")
        if not 1.0 <= startup_timeout_seconds <= 60.0:
            raise ValueError("startup timeout is outside the allowed range")
        if not 1 <= authorization_timeout_seconds <= 600:
            raise ValueError("authorization timeout is outside the allowed range")
        if runtime_root is None:
            runtime_root = Path(tempfile.mkdtemp(prefix="sapd-mcp-web-"))
        candidate = Path(runtime_root)
        if not candidate.is_absolute() or candidate.is_symlink():
            raise ValueError("runtime_root must be an explicit absolute non-symlink path")
        candidate.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.runtime_root = candidate.resolve(strict=True)
        os.chmod(self.runtime_root, 0o700)
        self._cleanup_on_close = cleanup_on_close
        self._startup_timeout_seconds = startup_timeout_seconds
        self._authorization_timeout_seconds = authorization_timeout_seconds
        self._configured_port = configured_port
        self._lock = threading.RLock()
        self._process: subprocess.Popen[bytes] | None = None
        self._log_handle: Any = None
        self._desired_state = "disabled"
        self._service_state = "stopped"
        self._state_version = 0
        self._recoverable_error: dict[str, str] | None = None
        self._prepared_resets: dict[str, tuple[float, str]] = {}
        self._last_checked_at: float | None = None
        self._last_success_at: float | None = None
        self._closed = False
        self._write_runtime_secret("verifier-key.bin")
        self._write_runtime_secret("audit-period-key.bin")
        self._write_runtime_secret("cursor-key.bin")
        verifier_key = (self.runtime_root / "verifier-key.bin").read_bytes()
        self._store = ControlStore(
            self.runtime_root / "control" / "control.sqlite3",
            verifier_key=verifier_key,
        )
        self._external_signature = self._store_signature()

    @property
    def configured_port(self) -> int:
        return self._configured_port

    @property
    def ca_path(self) -> Path:
        return self.runtime_root / "tls" / "dev-ca.pem"

    @property
    def process(self) -> subprocess.Popen[bytes] | None:
        return self._process

    def _write_runtime_secret(self, name: str) -> None:
        path = self.runtime_root / name
        if path.exists():
            if path.is_symlink() or path.stat().st_mode & 0o077:
                raise ValueError("runtime secret permissions are unsafe")
            return
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            os.write(descriptor, secrets.token_bytes(48))
        finally:
            os.close(descriptor)

    @staticmethod
    def _require_version(expected: int, current: int) -> None:
        if expected != current:
            raise GatewayActionError(
                "STATE_VERSION_CONFLICT",
                current_state_version=current,
            )

    @staticmethod
    def _port_available(port: int) -> bool:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                probe.bind(("127.0.0.1", port))
            except OSError:
                return False
        return True

    def _tls_ready(self) -> bool:
        if not self.ca_path.is_file():
            return False
        context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH, cafile=self.ca_path)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        connection = http.client.HTTPSConnection(
            "127.0.0.1",
            self._configured_port,
            timeout=0.8,
            context=context,
        )
        try:
            connection.request("GET", "/.well-known/oauth-protected-resource/mcp")
            response = connection.getresponse()
            response.read()
            return response.status == 200
        except (OSError, ssl.SSLError, http.client.HTTPException):
            return False
        finally:
            connection.close()

    def _lease_path(self) -> Path:
        return self.runtime_root / "sidecar.lease.json"

    def _write_lease(self) -> None:
        process = self._process
        if process is None:
            return
        path = self._lease_path()
        path.write_text(
            json.dumps(
                {
                    "pid": process.pid,
                    "configured_port": self._configured_port,
                    "created_at": time.time(),
                },
                separators=(",", ":"),
                sort_keys=True,
            ),
            encoding="utf-8",
        )
        os.chmod(path, 0o600)

    def _remove_lease(self) -> None:
        try:
            self._lease_path().unlink()
        except FileNotFoundError:
            pass

    def _cleanup_tls(self) -> None:
        tls_root = self.runtime_root / "tls"
        if tls_root.exists():
            shutil.rmtree(tls_root)

    def _terminate_owned_process(self) -> None:
        process = self._process
        if process is None:
            self._remove_lease()
            return
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        self._process = None
        self._remove_lease()
        if self._log_handle is not None:
            self._log_handle.close()
            self._log_handle = None

    def _refresh_process_state(self) -> None:
        process = self._process
        if process is None or process.poll() is None:
            return
        self._process = None
        self._remove_lease()
        if self._log_handle is not None:
            self._log_handle.close()
            self._log_handle = None
        if self._desired_state == "enabled" and self._service_state != "error":
            self._service_state = "error"
            self._recoverable_error = {
                "code": "SIDECAR_EXITED",
                "recovery_action": "retry_service",
            }
            self._state_version += 1

    def _store_signature(self) -> str:
        pending = self._store.list_authorization_requests()
        clients = self._store.list_client_summaries()
        audit = self._store.read_audit(limit=1000)
        return json.dumps(
            {
                "pending": pending,
                "clients": clients,
                "audit_count": len(audit),
                "last_event": audit[0]["occurred_at"] if audit else None,
            },
            ensure_ascii=True,
            sort_keys=True,
            separators=(",", ":"),
        )

    def _sync_external_version(self) -> None:
        signature = self._store_signature()
        if signature != self._external_signature:
            self._external_signature = signature
            self._state_version += 1

    def _clients(self) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        for client in self._store.list_client_summaries():
            result.append(
                {
                    **client,
                    "authorized_at": _iso(client["authorized_at"]),
                    "last_used_at": _iso(client["last_used_at"]),
                }
            )
        return result

    def _authorization_requests(self) -> list[dict[str, Any]]:
        return [
            {
                **request,
                "created_at": _iso(request["created_at"]),
                "expires_at": _iso(request["expires_at"]),
            }
            for request in self._store.list_authorization_requests()
        ]

    def _diagnostics(self) -> dict[str, Any]:
        if self._service_state == "ready":
            tls_ready = self._tls_ready()
            checks = [
                {
                    "check_id": "sidecar_process",
                    "status": "pass",
                    "error_code": None,
                    "recovery_action": None,
                },
                {
                    "check_id": "loopback_tls",
                    "status": "pass" if tls_ready else "fail",
                    "error_code": None if tls_ready else "TLS_UNAVAILABLE",
                    "recovery_action": None if tls_ready else "retry_service",
                },
            ]
        elif self._service_state == "error":
            checks = [
                {
                    "check_id": "sidecar_process",
                    "status": "fail",
                    "error_code": self._recoverable_error["code"] if self._recoverable_error else "SIDECAR_UNAVAILABLE",
                    "recovery_action": "retry_service",
                }
            ]
        else:
            checks = [
                {
                    "check_id": "sidecar_process",
                    "status": "unknown",
                    "error_code": None,
                    "recovery_action": "start_service",
                }
            ]
        return {
            "overall_state": "ready" if checks and all(item["status"] == "pass" for item in checks) else "blocked" if any(item["status"] == "fail" for item in checks) else "unknown",
            "last_checked_at": _iso(self._last_checked_at),
            "checks": checks,
        }

    def read_snapshot(self) -> Mapping[str, Any]:
        with self._lock:
            self._refresh_process_state()
            self._sync_external_version()
            pending = self._authorization_requests()
            clients = self._clients()
            active_clients = [item for item in clients if item["status"] == "authorized"]
            audit_events = self._store.read_audit(limit=1000)
            last_event = audit_events[0]["occurred_at"] if audit_events else None
            tool_events = [item["occurred_at"] for item in audit_events if item["event_type"] == "TOOL_CALL"]
            last_success = max(tool_events) if tool_events else self._last_success_at
            authorization_state = "pending" if pending else "authorized" if active_clients else "revoked" if clients else "no_clients"
            return {
                "state_version": self._state_version,
                "status": {
                    "desired_state": self._desired_state,
                    "service_state": self._service_state,
                    "authorization_state": authorization_state,
                    "activity_state": "recent" if tool_events else "idle" if active_clients else "never",
                    "knowledge_state": "ready",
                    "audit_state": "ready",
                    "last_success_at": _iso(last_success),
                    "recoverable_error": self._recoverable_error,
                },
                "settings": {
                    "enabled": self._desired_state == "enabled",
                    "configured_port": self._configured_port,
                    "release_channel": "dev",
                    "canonical_resource": f"https://127.0.0.1:{self._configured_port}/mcp",
                    "control_capabilities": {
                        "service_control": True,
                        "client_revocation": True,
                        "audit_clear": True,
                        "native_reset_confirmation": False,
                        "port_configuration": True,
                        "authorization_decision": True,
                        "diagnostic_check": True,
                        "web_reset_confirmation": True,
                    },
                },
                "authorization_requests": pending,
                "clients": clients,
                "audit": {
                    "enabled": True,
                    "state": "ready",
                    "retention_days": 30,
                    "retention_bytes": 20 * 1024 * 1024,
                    "event_count": len(audit_events),
                    "last_event_at": _iso(last_event),
                },
                "diagnostics": self._diagnostics(),
            }

    @staticmethod
    def _action_result(state_version: int, changed: bool = True) -> dict[str, Any]:
        return {
            "state_version": state_version,
            "result": "completed",
            "changed": changed,
        }

    def start_service(self, *, request_id: str, expected_state_version: int) -> Mapping[str, Any]:
        del request_id
        with self._lock:
            self._refresh_process_state()
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            if self._process is not None and self._process.poll() is None:
                return self._action_result(self._state_version, changed=False)
            if not self._port_available(self._configured_port):
                self._desired_state = "enabled"
                self._service_state = "error"
                self._recoverable_error = {
                    "code": "PORT_IN_USE",
                    "recovery_action": "change_port",
                }
                self._state_version += 1
                raise GatewayActionError(
                    "ACTION_REJECTED",
                    current_state_version=self._state_version,
                )
            self._cleanup_tls()
            self._desired_state = "enabled"
            self._service_state = "starting"
            self._recoverable_error = None
            self._state_version += 1
            log_path = self.runtime_root / "sidecar.log"
            self._log_handle = open(log_path, "ab", buffering=0)
            os.chmod(log_path, 0o600)
            self._process = subprocess.Popen(
                [
                    sys.executable,
                    "-m",
                    "sapd_wiki.local_mcp.dev_sidecar",
                    "--runtime-root",
                    str(self.runtime_root),
                    "--port",
                    str(self._configured_port),
                    "--authorization-timeout-seconds",
                    str(self._authorization_timeout_seconds),
                ],
                stdin=subprocess.DEVNULL,
                stdout=self._log_handle,
                stderr=self._log_handle,
                close_fds=True,
            )
            self._write_lease()
            deadline = time.monotonic() + self._startup_timeout_seconds
            while time.monotonic() < deadline:
                if self._process.poll() is not None:
                    break
                if self._tls_ready():
                    self._service_state = "ready"
                    self._last_success_at = time.time()
                    self._state_version += 1
                    return self._action_result(self._state_version)
                time.sleep(0.05)
            self._terminate_owned_process()
            self._service_state = "error"
            self._recoverable_error = {
                "code": "SIDECAR_START_FAILED",
                "recovery_action": "retry_service",
            }
            self._state_version += 1
            raise GatewayActionError(
                "ACTION_REJECTED",
                current_state_version=self._state_version,
            )

    def stop_service(self, *, request_id: str, expected_state_version: int) -> Mapping[str, Any]:
        del request_id
        with self._lock:
            self._refresh_process_state()
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            changed = self._process is not None or self._service_state != "stopped"
            self._service_state = "stopping" if changed else "stopped"
            if changed:
                self._state_version += 1
            self._terminate_owned_process()
            self._cleanup_tls()
            self._desired_state = "disabled"
            self._service_state = "stopped"
            self._recoverable_error = None
            if changed:
                self._state_version += 1
            return self._action_result(self._state_version, changed=changed)

    def retry_service(self, *, request_id: str, expected_state_version: int) -> Mapping[str, Any]:
        with self._lock:
            self._refresh_process_state()
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            if self._process is not None:
                self._terminate_owned_process()
            self._service_state = "stopped"
            self._desired_state = "disabled"
            self._recoverable_error = None
            return self.start_service(
                request_id=request_id,
                expected_state_version=self._state_version,
            )

    def update_port(
        self,
        *,
        configured_port: int,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]:
        del request_id
        if not 1024 <= configured_port <= 65535:
            raise GatewayActionError("ACTION_REJECTED")
        with self._lock:
            self._refresh_process_state()
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            if self._service_state != "stopped" or self._process is not None:
                raise GatewayActionError("ACTION_REJECTED")
            changed = configured_port != self._configured_port
            if changed:
                self._store.revoke_all()
                self._configured_port = configured_port
                self._state_version += 1
                self._external_signature = self._store_signature()
            return self._action_result(self._state_version, changed=changed)

    def decide_authorization(
        self,
        *,
        authorization_request_id: str,
        allow: bool,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]:
        del request_id
        with self._lock:
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            if not self._store.decide_authorization_request(
                authorization_request_id,
                allow=allow,
            ):
                raise GatewayActionError("ACTION_REJECTED")
            self._state_version += 1
            self._external_signature = self._store_signature()
            return self._action_result(self._state_version)

    def check_service(self, *, request_id: str, expected_state_version: int) -> Mapping[str, Any]:
        del request_id
        with self._lock:
            self._refresh_process_state()
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            self._last_checked_at = time.time()
            self._state_version += 1
            return self._action_result(self._state_version)

    def revoke_client(
        self,
        *,
        client_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]:
        del request_id
        with self._lock:
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            changed = self._store.revoke_client(client_id) > 0
            if changed:
                self._state_version += 1
                self._external_signature = self._store_signature()
            return self._action_result(self._state_version, changed=changed)

    def clear_audit(self, *, request_id: str, expected_state_version: int) -> Mapping[str, Any]:
        del request_id
        with self._lock:
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            changed = self._store.clear_audit() > 0
            if changed:
                self._state_version += 1
                self._external_signature = self._store_signature()
            return self._action_result(self._state_version, changed=changed)

    def prepare_reset(
        self,
        *,
        audit_disposition: str,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]:
        del request_id
        if audit_disposition not in {"retain", "clear"}:
            raise GatewayActionError("ACTION_REJECTED")
        with self._lock:
            self._refresh_process_state()
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            now = time.time()
            self._prepared_resets = {
                reset_id: prepared
                for reset_id, prepared in self._prepared_resets.items()
                if prepared[0] > now
            }
            reset_id = f"reset:{secrets.token_urlsafe(24)}"
            expires_at = now + 120
            self._prepared_resets[reset_id] = (
                expires_at,
                audit_disposition,
            )
            self._state_version += 1
            return {
                **self._action_result(self._state_version),
                "reset_id": reset_id,
                "expires_at": _iso(expires_at),
                "effects": [
                    "stop_service",
                    "revoke_all_clients",
                    "delete_managed_secrets",
                    (
                        "clear_audit"
                        if audit_disposition == "clear"
                        else "retain_audit"
                    ),
                ],
                "confirmation_mode": "web",
            }

    def _rotate_runtime_secrets(self) -> None:
        self._store.close()
        for name in (
            "verifier-key.bin",
            "audit-period-key.bin",
            "cursor-key.bin",
        ):
            path = self.runtime_root / name
            try:
                path.unlink()
            except FileNotFoundError:
                pass
            self._write_runtime_secret(name)
        verifier_key = (self.runtime_root / "verifier-key.bin").read_bytes()
        self._store = ControlStore(
            self.runtime_root / "control" / "control.sqlite3",
            verifier_key=verifier_key,
        )

    def confirm_web_reset(
        self,
        *,
        reset_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]:
        del request_id
        with self._lock:
            self._refresh_process_state()
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            prepared = self._prepared_resets.get(reset_id)
            if prepared is None or prepared[0] <= time.time():
                self._prepared_resets.pop(reset_id, None)
                raise GatewayActionError("ACTION_REJECTED")
            self._terminate_owned_process()
            self._cleanup_tls()
            self._store.reset_authorization_state(
                clear_audit=prepared[1] == "clear"
            )
            self._rotate_runtime_secrets()
            self._prepared_resets.pop(reset_id, None)
            self._desired_state = "disabled"
            self._service_state = "stopped"
            self._recoverable_error = None
            self._last_checked_at = None
            self._last_success_at = None
            self._state_version += 1
            self._external_signature = self._store_signature()
            return self._action_result(self._state_version)

    @staticmethod
    def _not_available(**_kwargs: Any) -> Mapping[str, Any]:
        raise GatewayActionError("DESKTOP_CAPABILITY_REQUIRED")

    confirm_reset = _not_available

    def close(self) -> None:
        with self._lock:
            if self._closed:
                return
            if self._process is not None:
                self._terminate_owned_process()
            self._cleanup_tls()
            self._store.close()
            for name in ("verifier-key.bin", "audit-period-key.bin", "cursor-key.bin"):
                path = self.runtime_root / name
                try:
                    path.unlink()
                except FileNotFoundError:
                    pass
            self._closed = True
            if self._cleanup_on_close and self.runtime_root.exists():
                shutil.rmtree(self.runtime_root)

    def __enter__(self) -> "DevSidecarSupervisor":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()
