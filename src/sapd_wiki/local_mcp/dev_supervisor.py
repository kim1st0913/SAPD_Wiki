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
from hashlib import sha256
from pathlib import Path
from typing import Any, Callable, Mapping

from .certificate_identity import CertificateIdentityError, CertificateIdentityStore
from .certificate_lifecycle import (
    CertificateLifecycle,
    CertificateLifecycleError,
)
from .certificate_trust import (
    CertificateTrustError,
    CurrentUserTrustAdapter,
    FakeCurrentUserTrustAdapter,
)
from .control_models import GatewayActionError
from .control_store import ControlStore, ControlStoreError
from .platform_secrets import (
    FakeMacOSDataProtectionKeychainProvider,
    FakeWindowsDpapiCurrentUserProvider,
    MacOSWebDevKeychainSecretProvider,
    WindowsDpapiCurrentUserProvider,
)
from .macos_current_user_trust import MacOSCurrentUserTrustAdapter
from .path_security import (
    PathSecurityError,
    assert_secure_regular_file,
    ensure_secure_directory,
    protect_regular_file,
)
from .secret_transport import (
    ParentSecretChannel,
    WindowsParentSecretChannel,
    create_parent_secret_channel,
)
from .tls import (
    KEY_PASSPHRASE_IPC_UNSAFE,
    SecretProvider,
    TLSIdentityError,
)
from .windows_current_user_trust import (
    WindowsCurrentUserRootTrustAdapter,
    WindowsWinCryptCurrentUserRootBridge,
)


RESERVED_STABLE_PREVIEW_PORT = 5173
AUTOMATIC_RESTART_BACKOFF_SECONDS = (1.0, 2.0, 5.0, 10.0, 30.0)
AUDIT_DISPLAY_LIMIT = 30
AUDIT_GROUP_WINDOW_SECONDS = 24 * 60 * 60
AUDIT_GROUPABLE_EVENT_TYPES = frozenset({"TOKEN_REFRESHED", "TOOL_CALL"})


def _iso(value: float | None) -> str | None:
    if value is None:
        return None
    return datetime.fromtimestamp(value, UTC).isoformat().replace("+00:00", "Z")


def _sum_nullable(left: int | None, right: int | None) -> int | None:
    if left is None or right is None:
        return None
    return int(left) + int(right)


def _audit_group_key(item: Mapping[str, Any]) -> tuple[str, str, str, str | None] | None:
    event_type = str(item["event_type"])
    if event_type not in AUDIT_GROUPABLE_EVENT_TYPES or item["result_code"] != "OK":
        return None
    return (
        event_type,
        str(item["client_id"] or ""),
        str(item["result_code"]),
        str(item["tool_name"] or "") if event_type == "TOOL_CALL" else None,
    )


def _project_grouped_audit_events(
    events: list[Mapping[str, Any]],
) -> list[dict[str, Any]]:
    """Merge low-risk repeat events without collapsing any security boundary."""

    groups: list[dict[str, Any]] = []
    active_groups: dict[
        tuple[str, str, str, str | None],
        dict[str, Any],
    ] = {}
    for item in events:
        occurred_at = float(item["occurred_at"])
        projected = {
            "occurred_at": _iso(occurred_at),
            "first_occurred_at": _iso(occurred_at),
            "last_occurred_at": _iso(occurred_at),
            "occurrence_count": 1,
            "event_type": item["event_type"],
            "client_id": item["client_id"],
            "tool_name": item["tool_name"],
            "result_code": item["result_code"],
            "returned_count": item["returned_count"],
            "duration_ms": item["duration_ms"],
            "_group_key": _audit_group_key(item),
            "_latest_epoch": occurred_at,
        }
        group_key = projected["_group_key"]
        previous = active_groups.get(group_key) if group_key is not None else None
        can_merge = (
            previous is not None
            and float(previous["_latest_epoch"]) - occurred_at
            <= AUDIT_GROUP_WINDOW_SECONDS
        )
        if not can_merge:
            groups.append(projected)
            if group_key is None:
                active_groups.clear()
            else:
                active_groups[group_key] = projected
            continue
        previous["first_occurred_at"] = projected["first_occurred_at"]
        previous["occurrence_count"] = int(previous["occurrence_count"]) + 1
        previous["returned_count"] = _sum_nullable(
            previous["returned_count"],
            projected["returned_count"],
        )
        previous["duration_ms"] = _sum_nullable(
            previous["duration_ms"],
            projected["duration_ms"],
        )
    for group in groups:
        group.pop("_group_key", None)
        group.pop("_latest_epoch", None)
    return groups


def _sidecar_command_prefix(python_executable: str) -> list[str]:
    if getattr(sys, "frozen", False):
        return [python_executable, "--mcp-sidecar"]
    return [
        python_executable,
        "-m",
        "sapd_wiki.local_mcp.dev_sidecar",
    ]


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
        python_executable: str | Path | None = None,
        base_database: str | Path | None = None,
        certificate_identity_root: Path | None = None,
        certificate_secret_provider: SecretProvider | None = None,
        certificate_trust_adapter: CurrentUserTrustAdapter | None = None,
        platform_integration_enabled: bool = False,
        auto_restore_enabled: bool = False,
        certificate_profile: str = "dev",
        secret_channel_factory: Callable[
            [], ParentSecretChannel | WindowsParentSecretChannel
        ] | None = None,
    ) -> None:
        if not 1024 <= configured_port <= 65535:
            raise ValueError("configured_port must be between 1024 and 65535")
        if configured_port == RESERVED_STABLE_PREVIEW_PORT:
            raise ValueError("port 5173 is reserved for the stable SAPD Wiki preview")
        if not 1.0 <= startup_timeout_seconds <= 60.0:
            raise ValueError("startup timeout is outside the allowed range")
        if not 1 <= authorization_timeout_seconds <= 600:
            raise ValueError("authorization timeout is outside the allowed range")
        if runtime_root is None:
            runtime_root = Path(tempfile.mkdtemp(prefix="sapd-mcp-web-"))
        candidate = Path(runtime_root)
        try:
            self.runtime_root = ensure_secure_directory(
                candidate,
                require_fixed_windows_mcp_root=(
                    platform_integration_enabled and os.name == "nt"
                ),
            )
        except (OSError, PathSecurityError) as exc:
            raise ValueError(
                "runtime_root must be a protected absolute MCP path"
            ) from exc
        self._require_fixed_windows_runtime_root = bool(
            platform_integration_enabled and os.name == "nt"
        )
        self._cleanup_on_close = cleanup_on_close
        self._auto_restore_enabled = bool(auto_restore_enabled)
        self._startup_timeout_seconds = startup_timeout_seconds
        self._authorization_timeout_seconds = authorization_timeout_seconds
        self._configured_port = configured_port
        executable = Path(python_executable or sys.executable)
        if not executable.is_absolute() or not executable.is_file() or not os.access(executable, os.X_OK):
            raise ValueError("python_executable must be an existing executable absolute path")
        self._python_executable = str(executable)
        self._base_database: Path | None = None
        if base_database is not None:
            base_candidate = Path(base_database)
            if (
                not base_candidate.is_absolute()
                or base_candidate.is_symlink()
                or not base_candidate.is_file()
            ):
                raise ValueError(
                    "base_database must be an existing absolute non-symlink file"
                )
            self._base_database = base_candidate.resolve(strict=True)
        self._lock = threading.RLock()
        self._process: subprocess.Popen[bytes] | None = None
        self._log_handle: Any = None
        self._desired_state = "disabled"
        self._service_state = "stopped"
        self._state_version = 0
        self._recoverable_error: dict[str, str] | None = None
        self._reconnect_attempt = 0
        self._next_reconnect_at: float | None = None
        self._prepared_resets: dict[str, tuple[float, str]] = {}
        self._prepared_certificate_actions: dict[str, dict[str, Any]] = {}
        self._last_checked_at: float | None = None
        self._last_success_at: float | None = None
        self._closed = False
        self._write_runtime_secret("verifier-key.bin")
        self._write_runtime_secret("audit-period-key.bin")
        self._write_runtime_secret("cursor-key.bin")
        verifier_path = self.runtime_root / "verifier-key.bin"
        try:
            assert_secure_regular_file(verifier_path)
        except PathSecurityError as exc:
            raise ValueError("runtime secret permissions are unsafe") from exc
        verifier_key = verifier_path.read_bytes()
        self._store = ControlStore(
            self.runtime_root / "control" / "control.sqlite3",
            verifier_key=verifier_key,
        )
        preferences = (
            self._store.load_runtime_preferences()
            if self._auto_restore_enabled
            else None
        )
        if preferences is not None:
            persisted_port = int(preferences["configured_port"])
            if persisted_port == RESERVED_STABLE_PREVIEW_PORT:
                raise ControlStoreError("RUNTIME_PREFERENCES_INVALID")
            self._configured_port = persisted_port
            self._desired_state = str(preferences["desired_state"])
        else:
            self._store.save_runtime_preferences(
                desired_state=self._desired_state,
                configured_port=self._configured_port,
            )
        self._instance_id = self._runtime_identifier(
            "instance-id.txt",
            prefix="sapd-wiki-",
        )
        self._runtime_id = self._runtime_identifier(
            "runtime-id.txt",
            prefix="runtime-",
        )
        identity_candidate = (
            Path(certificate_identity_root)
            if certificate_identity_root is not None
            else self.runtime_root / "managed-certificate-dev"
        )
        if platform_integration_enabled and os.name == "nt":
            try:
                identity_candidate = ensure_secure_directory(
                    identity_candidate,
                    require_fixed_windows_mcp_root=True,
                )
            except (OSError, PathSecurityError) as exc:
                raise ValueError(
                    "certificate_identity_root must be a protected MCP path"
                ) from exc
        fake_device_binding = sha256(
            str(identity_candidate.absolute()).encode("utf-8")
        ).hexdigest()
        self._certificate_secret_provider = (
            certificate_secret_provider
            or (
                MacOSWebDevKeychainSecretProvider(
                    mutation_enabled=True,
                )
                if platform_integration_enabled and os.name != "nt"
                else
                WindowsDpapiCurrentUserProvider(
                    identity_candidate / "dpapi-secrets",
                    mutation_enabled=True,
                )
                if platform_integration_enabled and os.name == "nt"
                else
                FakeWindowsDpapiCurrentUserProvider(
                    device_binding=fake_device_binding
                )
                if os.name == "nt"
                else FakeMacOSDataProtectionKeychainProvider(
                    device_binding=fake_device_binding
                )
            )
        )
        self._secret_channel_factory = (
            secret_channel_factory or create_parent_secret_channel
        )
        self._certificate_identity = CertificateIdentityStore(
            identity_candidate,
            secret_provider=self._certificate_secret_provider,
            profile=certificate_profile,
        )
        if certificate_trust_adapter is not None:
            self._certificate_trust = certificate_trust_adapter
        elif platform_integration_enabled and os.name != "nt":
            self._certificate_trust = MacOSCurrentUserTrustAdapter(
                runtime_root=self.runtime_root / "trust-staging",
                mutation_enabled=True,
                managed_fingerprints=lambda: {
                    item.ca_fingerprint_sha256
                    for item in self._certificate_identity.list_generation_manifests()
                },
            )
        elif platform_integration_enabled and os.name == "nt":
            self._certificate_trust = WindowsCurrentUserRootTrustAdapter(
                bridge=WindowsWinCryptCurrentUserRootBridge(),
                mutation_enabled=True,
                managed_fingerprints=lambda: {
                    item.ca_fingerprint_sha256
                    for item in self._certificate_identity.list_generation_manifests()
                },
            )
        else:
            self._certificate_trust = FakeCurrentUserTrustAdapter()
        self._certificate_lifecycle = CertificateLifecycle(
            identity=self._certificate_identity,
            trust=self._certificate_trust,
        )
        self._certificate_lifecycle.recover()
        self._external_signature = self._store_signature()
        self._monitor_stop = threading.Event()
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop,
            name="sapd-mcp-certificate-monitor",
            daemon=True,
        )
        if self._auto_restore_enabled and self._desired_state == "enabled":
            self._next_reconnect_at = time.monotonic()
        self._monitor_thread.start()

    @property
    def configured_port(self) -> int:
        return self._configured_port

    @property
    def ca_path(self) -> Path:
        try:
            return self._certificate_identity.active_identity_files().ca_path
        except CertificateIdentityError:
            return self.runtime_root / "managed-certificate-unavailable-ca.pem"

    @property
    def process(self) -> subprocess.Popen[bytes] | None:
        return self._process

    @property
    def runtime_id(self) -> str:
        """Non-secret persistent identity for release-bound MCP evidence."""
        return self._runtime_id

    def _write_runtime_secret(self, name: str) -> None:
        path = self.runtime_root / name
        if path.exists():
            try:
                assert_secure_regular_file(path)
            except PathSecurityError as exc:
                raise ValueError(
                    "runtime secret permissions are unsafe"
                ) from exc
            return
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            os.write(descriptor, secrets.token_bytes(48))
        finally:
            os.close(descriptor)
        try:
            protect_regular_file(path)
        except PathSecurityError as exc:
            raise ValueError("runtime secret permissions are unsafe") from exc

    def _runtime_identifier(self, name: str, *, prefix: str) -> str:
        path = self.runtime_root / name
        if path.exists():
            try:
                assert_secure_regular_file(path)
            except PathSecurityError as exc:
                raise ValueError(
                    "runtime identifier permissions are unsafe"
                ) from exc
            value = path.read_text(encoding="ascii").strip()
            if not value.startswith(prefix) or not 8 <= len(value) <= 160:
                raise ValueError("runtime identifier is invalid")
            return value
        value = f"{prefix}{secrets.token_urlsafe(24)}"
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            os.write(descriptor, value.encode("ascii"))
        finally:
            os.close(descriptor)
        try:
            protect_regular_file(path)
        except PathSecurityError as exc:
            raise ValueError("runtime identifier permissions are unsafe") from exc
        return value

    def _persist_runtime_preferences(self) -> None:
        self._store.save_runtime_preferences(
            desired_state=self._desired_state,
            configured_port=self._configured_port,
        )

    def _cancel_automatic_restart(self) -> None:
        self._reconnect_attempt = 0
        self._next_reconnect_at = None

    def _schedule_automatic_restart(self, *, immediate: bool = False) -> None:
        if not self._auto_restore_enabled or self._desired_state != "enabled":
            self._next_reconnect_at = None
            return
        if immediate:
            delay = 0.0
        else:
            index = min(
                self._reconnect_attempt,
                len(AUTOMATIC_RESTART_BACKOFF_SECONDS) - 1,
            )
            delay = AUTOMATIC_RESTART_BACKOFF_SECONDS[index]
            self._reconnect_attempt += 1
        self._next_reconnect_at = time.monotonic() + delay

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
            if self._log_handle is not None:
                self._log_handle.close()
                self._log_handle = None
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
            self._schedule_automatic_restart()
            self._state_version += 1

    def _store_signature(self) -> str:
        pending = self._store.list_authorization_requests()
        clients = self._store.list_client_summaries()
        audit = self._store.read_audit(limit=1000)
        certificate = self._certificate_projection()
        return json.dumps(
            {
                "pending": pending,
                "clients": clients,
                "audit_count": len(audit),
                "last_event": audit[0]["occurred_at"] if audit else None,
                "certificate": {
                    key: certificate.get(key)
                    for key in (
                        "state",
                        "reason_code",
                        "generation_id",
                        "ca_fingerprint_sha256",
                        "operation",
                        "cleanup_pending",
                    )
                },
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

    def _certificate_projection(self) -> dict[str, Any]:
        lifecycle = self._certificate_lifecycle.projection()
        try:
            manifest = self._certificate_identity.load_manifest()
        except CertificateIdentityError as exc:
            failure_lifecycle = {
                **lifecycle,
                "forced_state": "recovery_required",
                "forced_reason_code": exc.code,
                "forced_next_action": "certificate_reset",
            }
            return self._certificate_identity.public_state(
                trust_installed=False,
                trust_backend=self._certificate_trust.backend,
                secret_backend=getattr(
                    self._certificate_secret_provider,
                    "backend",
                    "in_memory_test_only",
                ),
                trust_policy=self._certificate_trust.policy,
                **failure_lifecycle,
            )
        if manifest is None:
            return self._certificate_identity.public_state(
                trust_installed=False,
                trust_backend=self._certificate_trust.backend,
                secret_backend=getattr(
                    self._certificate_secret_provider,
                    "backend",
                    "in_memory_test_only",
                ),
                trust_policy=self._certificate_trust.policy,
                **lifecycle,
            )
        try:
            inspection = self._certificate_trust.inspect_target(
                self._certificate_identity.trust_target(manifest)
            )
        except (CertificateTrustError, CertificateIdentityError) as exc:
            failure_lifecycle = {
                **lifecycle,
                "forced_state": "recovery_required",
                "forced_reason_code": getattr(
                    exc,
                    "code",
                    "CERTIFICATE_TRUST_STORE_UNAVAILABLE",
                ),
                "forced_next_action": "certificate_reset",
            }
            return self._certificate_identity.public_state(
                trust_installed=False,
                trust_backend=self._certificate_trust.backend,
                secret_backend=getattr(
                    self._certificate_secret_provider,
                    "backend",
                    "in_memory_test_only",
                ),
                trust_policy=self._certificate_trust.policy,
                **failure_lifecycle,
            )
        return self._certificate_identity.public_state(
            trust_installed=inspection.installed,
            trust_conflict=inspection.conflict,
            trust_backend=inspection.backend,
            secret_backend=getattr(
                self._certificate_secret_provider,
                "backend",
                "in_memory_test_only",
            ),
            trust_policy=inspection.policy,
            trust_verified_at=inspection.verified_at,
            **lifecycle,
        )

    def _enforce_runtime_certificate_state(self) -> None:
        if self._process is None or self._process.poll() is not None:
            return
        certificate = self._certificate_projection()
        if certificate["state"] in {"valid", "expiring", "renewal_required"}:
            return
        self._terminate_owned_process()
        self._cleanup_tls()
        self._desired_state = "enabled"
        self._service_state = "error"
        self._recoverable_error = {
            "code": "CERTIFICATE_RUNTIME_INVALID",
            "recovery_action": "configure_certificate",
        }
        self._state_version += 1

    def _monitor_loop(self) -> None:
        while not self._monitor_stop.wait(1.0):
            with self._lock:
                if self._closed:
                    return
                self._refresh_process_state()
                self._enforce_runtime_certificate_state()
                self._attempt_automatic_restore()

    def _attempt_automatic_restore(self) -> None:
        if (
            not self._auto_restore_enabled
            or self._desired_state != "enabled"
            or self._process is not None
            or self._next_reconnect_at is None
            or time.monotonic() < self._next_reconnect_at
        ):
            return
        error_code = (
            self._recoverable_error.get("code")
            if self._recoverable_error is not None
            else None
        )
        if error_code not in {None, "SIDECAR_EXITED", "SIDECAR_START_FAILED"}:
            self._next_reconnect_at = None
            return
        self._next_reconnect_at = None
        try:
            self.start_service(
                request_id="automatic-runtime-restore",
                expected_state_version=self._state_version,
            )
        except GatewayActionError:
            current_code = (
                self._recoverable_error.get("code")
                if self._recoverable_error is not None
                else None
            )
            if current_code in {"SIDECAR_EXITED", "SIDECAR_START_FAILED"}:
                self._schedule_automatic_restart()

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
            self._enforce_runtime_certificate_state()
            self._sync_external_version()
            pending = self._authorization_requests()
            clients = self._clients()
            active_clients = [item for item in clients if item["status"] == "authorized"]
            audit_events = self._store.read_audit(
                limit=self._store.audit_max_events
            )
            audit_event_count = self._store.count_audit()
            displayed_audit_count = min(audit_event_count, AUDIT_DISPLAY_LIMIT)
            last_event = audit_events[0]["occurred_at"] if audit_events else None
            tool_events = [item["occurred_at"] for item in audit_events if item["event_type"] == "TOOL_CALL"]
            last_success = max(tool_events) if tool_events else self._last_success_at
            authorization_state = "pending" if pending else "authorized" if active_clients else "revoked" if clients else "no_clients"
            return {
                "state_version": self._state_version,
                "status": {
                    "desired_state": self._desired_state,
                    "service_state": self._service_state,
                    "reconnect_state": (
                        "recovering"
                        if self._service_state == "starting"
                        and self._reconnect_attempt > 0
                        else "scheduled"
                        if self._next_reconnect_at is not None
                        else "idle"
                    ),
                    "reconnect_attempt": self._reconnect_attempt,
                    "authorization_state": authorization_state,
                    "activity_state": "recent" if tool_events else "idle" if active_clients else "never",
                    "knowledge_state": "ready",
                    "audit_state": "ready",
                    "last_success_at": _iso(last_success),
                    "recoverable_error": self._recoverable_error,
                },
                "settings": {
                    "enabled": self._desired_state == "enabled",
                    "auto_restore": self._auto_restore_enabled,
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
                        "certificate_provision": True,
                        "certificate_rotate": True,
                        "certificate_repair_trust": True,
                        "certificate_view_details": True,
                        "certificate_reset": True,
                    },
                },
                "certificate": self._certificate_projection(),
                "authorization_requests": pending,
                "clients": clients,
                "audit": {
                    "enabled": True,
                    "state": "ready",
                    "retention_days": self._store.audit_retention_days,
                    "max_events": self._store.audit_max_events,
                    "retention_bytes": self._store.audit_max_bytes,
                    "display_limit": AUDIT_DISPLAY_LIMIT,
                    "event_count": audit_event_count,
                    "last_event_at": _iso(last_event),
                    "page": 1,
                    "page_size": 10,
                    "page_count": max(1, (displayed_audit_count + 9) // 10),
                    "recent_events": _project_grouped_audit_events(
                        audit_events[:10]
                    ),
                },
                "diagnostics": self._diagnostics(),
            }

    def read_audit_page(
        self,
        *,
        page: int,
        page_size: int,
    ) -> Mapping[str, Any]:
        with self._lock:
            snapshot = self.read_snapshot()
            event_count = int(snapshot["audit"]["event_count"])
            displayed_event_count = min(event_count, AUDIT_DISPLAY_LIMIT)
            safe_page_size = 10 if int(page_size) != 10 else int(page_size)
            page_count = max(
                1,
                (displayed_event_count + safe_page_size - 1) // safe_page_size,
            )
            safe_page = min(max(int(page), 1), page_count)
            events = self._store.read_audit(
                limit=safe_page_size,
                offset=(safe_page - 1) * safe_page_size,
            )
            return {
                **snapshot["audit"],
                "page": safe_page,
                "page_size": safe_page_size,
                "page_count": page_count,
                "recent_events": _project_grouped_audit_events(events),
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
            self._desired_state = "enabled"
            self._persist_runtime_preferences()
            certificate = self._certificate_projection()
            if certificate["state"] not in {
                "valid",
                "expiring",
                "renewal_required",
            }:
                self._desired_state = "enabled"
                self._service_state = "error"
                self._recoverable_error = {
                    "code": (
                        "KEY_PASSPHRASE_UNAVAILABLE"
                        if certificate["state"] == "key_unavailable"
                        else "CERTIFICATE_NOT_READY"
                    ),
                    "recovery_action": (
                        "reset_certificate"
                        if certificate["state"] == "key_unavailable"
                        else "configure_certificate"
                    ),
                }
                self._state_version += 1
                raise GatewayActionError(
                    "ACTION_REJECTED",
                    current_state_version=self._state_version,
                )
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
            try:
                protect_regular_file(log_path)
            except PathSecurityError as exc:
                self._log_handle.close()
                self._log_handle = None
                raise ValueError("sidecar log permissions are unsafe") from exc
            secret_channel: (
                ParentSecretChannel | WindowsParentSecretChannel | None
            ) = None
            try:
                manifest = self._certificate_identity.load_manifest()
                if manifest is None:
                    raise CertificateIdentityError("IDENTITY_NOT_CONFIGURED")
                identity_files = self._certificate_identity.active_identity_files(
                    manifest
                )
                secret_channel = self._secret_channel_factory()
                command = _sidecar_command_prefix(self._python_executable)
                command.extend(
                    [
                        "--runtime-root",
                        str(self.runtime_root),
                        "--port",
                        str(self._configured_port),
                        "--authorization-timeout-seconds",
                        str(self._authorization_timeout_seconds),
                        "--secret-channel-kind",
                        secret_channel.endpoint_kind,
                        "--secret-channel-endpoint",
                        str(secret_channel.child_endpoint),
                        "--instance-id",
                        self._instance_id,
                        "--runtime-id",
                        self._runtime_id,
                    ]
                )
                if self._base_database is not None:
                    command.extend(["--base-db", str(self._base_database)])
                if self._require_fixed_windows_runtime_root:
                    command.append("--require-fixed-windows-runtime-root")
                popen_kwargs = secret_channel.popen_kwargs()
                self._process = subprocess.Popen(
                    command,
                    stdin=subprocess.DEVNULL,
                    stdout=self._log_handle,
                    stderr=self._log_handle,
                    close_fds=True,
                    **popen_kwargs,
                )
                secret_channel.close_child_copy()
                secret_channel.deliver(
                    child_pid=self._process.pid,
                    generation_id=manifest.generation_id,
                    certificate_path=identity_files.server_chain_path,
                    encrypted_private_key_path=identity_files.encrypted_private_key_path,
                    secret_loader=lambda: self._certificate_secret_provider.get_secret(
                        manifest.passphrase_reference
                    ),
                )
                self._write_lease()
            except Exception as exc:
                if secret_channel is not None:
                    secret_channel.close()
                self._terminate_owned_process()
                self._cleanup_tls()
                self._service_state = "error"
                self._recoverable_error = {
                    "code": (
                        exc.code
                        if isinstance(exc, TLSIdentityError)
                        and exc.code
                        in {
                            KEY_PASSPHRASE_IPC_UNSAFE,
                            "KEY_PASSPHRASE_UNAVAILABLE",
                        }
                        else "SIDECAR_START_FAILED"
                    ),
                    "recovery_action": (
                        "reset_certificate"
                        if isinstance(exc, TLSIdentityError)
                        and exc.code == "KEY_PASSPHRASE_UNAVAILABLE"
                        else "check_runtime"
                    ),
                }
                if self._recoverable_error["code"] == "SIDECAR_START_FAILED":
                    self._schedule_automatic_restart()
                self._state_version += 1
                raise GatewayActionError(
                    "ACTION_REJECTED",
                    current_state_version=self._state_version,
                ) from exc
            deadline = time.monotonic() + self._startup_timeout_seconds
            while time.monotonic() < deadline:
                if self._process.poll() is not None:
                    break
                if self._tls_ready():
                    self._service_state = "ready"
                    self._last_success_at = time.time()
                    self._cancel_automatic_restart()
                    self._state_version += 1
                    return self._action_result(self._state_version)
                time.sleep(0.05)
            self._terminate_owned_process()
            self._service_state = "error"
            self._recoverable_error = {
                "code": "SIDECAR_START_FAILED",
                "recovery_action": "retry_service",
            }
            self._schedule_automatic_restart()
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
            self._persist_runtime_preferences()
            self._cancel_automatic_restart()
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
            self._desired_state = "enabled"
            self._persist_runtime_preferences()
            self._cancel_automatic_restart()
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
        if not 1024 <= configured_port <= 65535 or configured_port == RESERVED_STABLE_PREVIEW_PORT:
            raise GatewayActionError("ACTION_REJECTED")
        with self._lock:
            self._refresh_process_state()
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            if self._service_state not in {"stopped", "error"} or self._process is not None:
                raise GatewayActionError("ACTION_REJECTED")
            changed = configured_port != self._configured_port
            if changed:
                self._store.revoke_all()
                self._configured_port = configured_port
                self._desired_state = "disabled"
                self._persist_runtime_preferences()
                self._cancel_automatic_restart()
                self._service_state = "stopped"
                self._recoverable_error = None
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

    def prepare_certificate_action(
        self,
        *,
        action: str,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]:
        del request_id
        allowed_actions = {
            "certificate_provision",
            "certificate_rotate",
            "certificate_repair_trust",
        }
        if action not in allowed_actions:
            raise GatewayActionError("ACTION_REJECTED")
        with self._lock:
            self._refresh_process_state()
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            now = time.time()
            self._prepared_certificate_actions = {
                confirmation_id: prepared
                for confirmation_id, prepared in self._prepared_certificate_actions.items()
                if prepared["expires_at"] > now
            }
            if self._prepared_certificate_actions:
                raise GatewayActionError("ACTION_REJECTED")
            certificate = self._certificate_projection()
            allowed_states = {
                "certificate_provision": {"not_configured"},
                "certificate_rotate": {
                    "valid",
                    "expiring",
                    "renewal_required",
                    "expired",
                },
                "certificate_repair_trust": {"trust_missing"},
            }
            if certificate["state"] not in allowed_states[action]:
                raise GatewayActionError("ACTION_REJECTED")
            confirmation_id = f"certificate:{secrets.token_urlsafe(24)}"
            expires_at = now + 120
            self._prepared_certificate_actions[confirmation_id] = {
                "expires_at": expires_at,
                "action": action,
                "generation_id": certificate.get("generation_id"),
                "trust_snapshot_digest": (
                    self._certificate_lifecycle.snapshot_digest()
                ),
            }
            self._state_version += 1
            effects = {
                "certificate_provision": [
                    "create_managed_identity",
                    "install_current_user_trust",
                ],
                "certificate_rotate": [
                    "create_managed_identity",
                    "replace_current_user_trust",
                ],
                "certificate_repair_trust": [
                    "install_current_user_trust",
                ],
            }
            return {
                **self._action_result(self._state_version),
                "confirmation_id": confirmation_id,
                "expires_at": _iso(expires_at),
                "effects": effects[action],
                "action": action,
                "profile": self._certificate_identity.profile,
                "expected_ca_fingerprint_sha256": certificate.get(
                    "ca_fingerprint_sha256"
                ),
                "confirmation_mode": "web",
            }

    def confirm_certificate_action(
        self,
        *,
        confirmation_id: str,
        request_id: str,
        expected_state_version: int,
    ) -> Mapping[str, Any]:
        del request_id
        with self._lock:
            self._refresh_process_state()
            self._sync_external_version()
            self._require_version(expected_state_version, self._state_version)
            prepared = self._prepared_certificate_actions.get(confirmation_id)
            if prepared is None or prepared["expires_at"] <= time.time():
                self._prepared_certificate_actions.pop(confirmation_id, None)
                raise GatewayActionError("ACTION_REJECTED")
            action = prepared["action"]
            current = self._certificate_identity.load_manifest()
            if (
                prepared["generation_id"]
                != (current.generation_id if current is not None else None)
                or prepared["trust_snapshot_digest"]
                != self._certificate_lifecycle.snapshot_digest()
            ):
                self._prepared_certificate_actions.pop(confirmation_id, None)
                raise GatewayActionError("ACTION_REJECTED")
            try:
                if action == "certificate_provision":
                    journal = self._certificate_lifecycle.provision()
                elif action == "certificate_rotate":
                    if current is None:
                        raise GatewayActionError("ACTION_REJECTED")
                    if self._process is not None:
                        self._terminate_owned_process()
                        self._cleanup_tls()
                        self._desired_state = "disabled"
                        self._service_state = "stopped"
                    journal = self._certificate_lifecycle.rotate()
                elif action == "certificate_repair_trust":
                    if current is None:
                        raise GatewayActionError("ACTION_REJECTED")
                    journal = self._certificate_lifecycle.repair_trust()
                    if journal.outcome != "completed":
                        raise CertificateLifecycleError(
                            journal.last_error_code
                            or "CERTIFICATE_TRUST_REPAIR_FAILED"
                        )
                else:
                    raise GatewayActionError("ACTION_REJECTED")
            except (
                CertificateTrustError,
                CertificateIdentityError,
                CertificateLifecycleError,
                TLSIdentityError,
            ) as exc:
                self._prepared_certificate_actions.pop(confirmation_id, None)
                self._recoverable_error = {
                    "code": getattr(
                        exc,
                        "code",
                        "CERTIFICATE_OPERATION_FAILED",
                    ),
                    "recovery_action": "configure_certificate",
                }
                self._state_version += 1
                raise GatewayActionError("ACTION_REJECTED") from exc
            self._prepared_certificate_actions.pop(confirmation_id, None)
            self._state_version += 1
            return {
                **self._action_result(self._state_version),
                "operation_id": journal.operation_id,
            }

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
                    "delete_managed_trust",
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
            reset_operation = self._certificate_lifecycle.reset()
            if reset_operation.outcome != "completed":
                self._service_state = "error"
                self._recoverable_error = {
                    "code": (
                        reset_operation.last_error_code
                        or "CERTIFICATE_RESET_INCOMPLETE"
                    ),
                    "recovery_action": "reset_certificate",
                }
                self._state_version += 1
                raise GatewayActionError("ACTION_REJECTED")
            self._store.reset_authorization_state(
                clear_audit=prepared[1] == "clear"
            )
            self._rotate_runtime_secrets()
            self._prepared_resets.pop(reset_id, None)
            self._prepared_certificate_actions.clear()
            self._desired_state = "disabled"
            self._persist_runtime_preferences()
            self._cancel_automatic_restart()
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
        self._monitor_stop.set()
        with self._lock:
            if self._closed:
                return
            if self._process is not None:
                self._terminate_owned_process()
            self._cleanup_tls()
            self._store.close()
            self._closed = True
            if self._cleanup_on_close and self.runtime_root.exists():
                shutil.rmtree(self.runtime_root)
        if (
            self._monitor_thread.is_alive()
            and threading.current_thread() is not self._monitor_thread
        ):
            self._monitor_thread.join(timeout=2)

    def __enter__(self) -> "DevSidecarSupervisor":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()
