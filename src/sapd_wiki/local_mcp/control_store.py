from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
import time
from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 1
RUNTIME_PREFERENCES_SCHEMA_VERSION = 1
RUNTIME_PREFERENCES_KEY = "runtime_preferences"


class ControlStoreError(RuntimeError):
    """Raised when the isolated MCP control store cannot be used safely."""


class ControlStore:
    """SQLite control plane that never persists bearer-token material.

    Token, authorization-code, and redirect bindings are looked up by an
    HMAC-SHA-256 verifier. The HMAC key is supplied by the caller and is not
    written to this database.
    """

    def __init__(
        self,
        path: Path,
        *,
        verifier_key: bytes,
        clock: Callable[[], float] = time.time,
    ) -> None:
        if len(verifier_key) < 32:
            raise ValueError("verifier_key must contain at least 256 bits")
        self.path = Path(path)
        self._key = bytes(verifier_key)
        self._clock = clock
        self._lock = threading.RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(
            self.path,
            isolation_level=None,
            check_same_thread=False,
        )
        self._connection.row_factory = sqlite3.Row
        try:
            os.chmod(self.path, 0o600)
        except OSError as exc:
            self._connection.close()
            raise ControlStoreError("CONTROL_STORE_PERMISSIONS_UNSAFE") from exc
        self._initialize()

    def _initialize(self) -> None:
        with self._lock:
            self._connection.executescript(
                """
                PRAGMA foreign_keys=ON;
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS control_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS oauth_clients (
                    client_id TEXT PRIMARY KEY,
                    metadata_json TEXT NOT NULL,
                    registration_mode TEXT NOT NULL DEFAULT 'pre_registered',
                    created_at REAL NOT NULL,
                    revoked_at REAL
                );
                CREATE TABLE IF NOT EXISTS authorization_codes (
                    verifier TEXT PRIMARY KEY,
                    client_id TEXT NOT NULL,
                    scopes_json TEXT NOT NULL,
                    expires_at REAL NOT NULL,
                    code_challenge TEXT NOT NULL,
                    redirect_uri TEXT NOT NULL,
                    redirect_uri_explicit INTEGER NOT NULL,
                    resource TEXT NOT NULL,
                    subject TEXT,
                    consumed_at REAL
                );
                CREATE TABLE IF NOT EXISTS authorization_requests (
                    request_id TEXT PRIMARY KEY,
                    client_id TEXT NOT NULL,
                    client_name TEXT,
                    redirect_uri TEXT NOT NULL,
                    scopes_json TEXT NOT NULL,
                    resource TEXT NOT NULL,
                    policy_version TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    expires_at REAL NOT NULL,
                    status TEXT NOT NULL CHECK(status IN ('pending', 'allowed', 'denied', 'timed_out')),
                    decided_at REAL
                );
                CREATE INDEX IF NOT EXISTS authorization_request_queue_idx
                    ON authorization_requests(status, created_at);
                CREATE TABLE IF NOT EXISTS token_families (
                    family_id TEXT PRIMARY KEY,
                    client_id TEXT NOT NULL,
                    scopes_json TEXT NOT NULL,
                    resource TEXT NOT NULL,
                    instance_id TEXT NOT NULL,
                    runtime_id TEXT NOT NULL,
                    grant_version TEXT NOT NULL,
                    policy_version TEXT NOT NULL,
                    current_refresh_verifier TEXT NOT NULL,
                    generation INTEGER NOT NULL,
                    created_at REAL NOT NULL,
                    revoked_at REAL,
                    reuse_detected INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS token_verifiers (
                    verifier TEXT PRIMARY KEY,
                    family_id TEXT NOT NULL REFERENCES token_families(family_id),
                    token_kind TEXT NOT NULL CHECK(token_kind IN ('access', 'refresh')),
                    client_id TEXT NOT NULL,
                    generation INTEGER NOT NULL,
                    expires_at REAL,
                    active INTEGER NOT NULL,
                    created_at REAL NOT NULL
                );
                CREATE INDEX IF NOT EXISTS token_family_idx
                    ON token_verifiers(family_id, token_kind);
                CREATE TABLE IF NOT EXISTS audit_events (
                    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    occurred_at REAL NOT NULL,
                    event_type TEXT NOT NULL,
                    client_id TEXT,
                    tool_name TEXT,
                    scope TEXT,
                    query_fingerprint TEXT,
                    returned_count INTEGER,
                    duration_ms INTEGER,
                    result_code TEXT NOT NULL,
                    correlation_id TEXT,
                    versions_json TEXT NOT NULL
                );
                """
            )
            client_columns = {
                str(row["name"])
                for row in self._connection.execute(
                    "PRAGMA table_info(oauth_clients)"
                ).fetchall()
            }
            if "registration_mode" not in client_columns:
                self._connection.execute(
                    """
                    ALTER TABLE oauth_clients
                    ADD COLUMN registration_mode TEXT NOT NULL DEFAULT 'pre_registered'
                    """
                )
            row = self._connection.execute(
                "SELECT value FROM control_meta WHERE key='schema_version'"
            ).fetchone()
            if row is None:
                self._connection.execute(
                    "INSERT INTO control_meta(key, value) VALUES('schema_version', ?)",
                    (str(SCHEMA_VERSION),),
                )
            elif row["value"] != str(SCHEMA_VERSION):
                raise ControlStoreError("CONTROL_STORE_SCHEMA_UNSUPPORTED")

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    def load_runtime_preferences(self) -> dict[str, Any] | None:
        """Load the non-secret lifecycle intent stored beside the control plane."""

        with self._lock:
            row = self._connection.execute(
                "SELECT value FROM control_meta WHERE key=?",
                (RUNTIME_PREFERENCES_KEY,),
            ).fetchone()
        if row is None:
            return None
        try:
            payload = json.loads(str(row["value"]))
        except (TypeError, ValueError) as exc:
            raise ControlStoreError("RUNTIME_PREFERENCES_INVALID") from exc
        if not isinstance(payload, dict) or set(payload) != {
            "schema_version",
            "desired_state",
            "configured_port",
        }:
            raise ControlStoreError("RUNTIME_PREFERENCES_INVALID")
        if payload["schema_version"] != RUNTIME_PREFERENCES_SCHEMA_VERSION:
            raise ControlStoreError("RUNTIME_PREFERENCES_SCHEMA_UNSUPPORTED")
        if payload["desired_state"] not in {"enabled", "disabled"}:
            raise ControlStoreError("RUNTIME_PREFERENCES_INVALID")
        configured_port = payload["configured_port"]
        if (
            isinstance(configured_port, bool)
            or not isinstance(configured_port, int)
            or not 1024 <= configured_port <= 65535
        ):
            raise ControlStoreError("RUNTIME_PREFERENCES_INVALID")
        return {
            "schema_version": RUNTIME_PREFERENCES_SCHEMA_VERSION,
            "desired_state": str(payload["desired_state"]),
            "configured_port": configured_port,
        }

    def save_runtime_preferences(
        self,
        *,
        desired_state: str,
        configured_port: int,
    ) -> None:
        if desired_state not in {"enabled", "disabled"}:
            raise ValueError("desired_state is not supported")
        if (
            isinstance(configured_port, bool)
            or not isinstance(configured_port, int)
            or not 1024 <= configured_port <= 65535
        ):
            raise ValueError("configured_port must be between 1024 and 65535")
        payload = self._json(
            {
                "schema_version": RUNTIME_PREFERENCES_SCHEMA_VERSION,
                "desired_state": desired_state,
                "configured_port": configured_port,
            }
        )
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO control_meta(key, value) VALUES(?, ?)
                ON CONFLICT(key) DO UPDATE SET value=excluded.value
                """,
                (RUNTIME_PREFERENCES_KEY, payload),
            )

    def __enter__(self) -> "ControlStore":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()

    def verifier(self, secret: str) -> str:
        return hmac.new(self._key, secret.encode("utf-8"), hashlib.sha256).hexdigest()

    @staticmethod
    def _json(value: Any) -> str:
        return json.dumps(value, ensure_ascii=True, separators=(",", ":"), sort_keys=True)

    def save_client(
        self,
        client_id: str,
        metadata: Mapping[str, Any],
        *,
        registration_mode: str = "pre_registered",
    ) -> None:
        if registration_mode not in {"pre_registered", "CIMD", "DCR"}:
            raise ValueError("registration_mode is not supported")
        payload = self._json(dict(metadata))
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO oauth_clients(
                    client_id, metadata_json, registration_mode, created_at, revoked_at
                )
                VALUES(?, ?, ?, ?, NULL)
                ON CONFLICT(client_id) DO UPDATE SET
                    metadata_json=excluded.metadata_json,
                    registration_mode=excluded.registration_mode,
                    revoked_at=NULL
                """,
                (client_id, payload, registration_mode, self._clock()),
            )

    def load_client(self, client_id: str) -> dict[str, Any] | None:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT metadata_json FROM oauth_clients
                WHERE client_id=? AND revoked_at IS NULL
                """,
                (client_id,),
            ).fetchone()
        return json.loads(row["metadata_json"]) if row is not None else None

    def client_registration_mode(self, client_id: str) -> str | None:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT registration_mode FROM oauth_clients
                WHERE client_id=? AND revoked_at IS NULL
                """,
                (client_id,),
            ).fetchone()
        return str(row["registration_mode"]) if row is not None else None

    def save_authorization_code(
        self,
        code: str,
        *,
        client_id: str,
        scopes: list[str],
        expires_at: float,
        code_challenge: str,
        redirect_uri: str,
        redirect_uri_explicit: bool,
        resource: str,
        subject: str | None,
    ) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO authorization_codes(
                    verifier, client_id, scopes_json, expires_at, code_challenge,
                    redirect_uri, redirect_uri_explicit, resource, subject, consumed_at
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                """,
                (
                    self.verifier(code),
                    client_id,
                    self._json(scopes),
                    expires_at,
                    code_challenge,
                    redirect_uri,
                    int(redirect_uri_explicit),
                    resource,
                    subject,
                ),
            )

    def load_authorization_code(self, code: str) -> dict[str, Any] | None:
        verifier = self.verifier(code)
        with self._lock:
            row = self._connection.execute(
                """
                SELECT * FROM authorization_codes
                WHERE verifier=? AND consumed_at IS NULL
                """,
                (verifier,),
            ).fetchone()
        if row is None or not hmac.compare_digest(row["verifier"], verifier):
            return None
        result = dict(row)
        result["scopes"] = json.loads(result.pop("scopes_json"))
        return result

    def consume_authorization_code(self, code: str) -> bool:
        with self._lock:
            cursor = self._connection.execute(
                """
                UPDATE authorization_codes SET consumed_at=?
                WHERE verifier=? AND consumed_at IS NULL
                """,
                (self._clock(), self.verifier(code)),
            )
            return cursor.rowcount == 1

    def create_authorization_request(
        self,
        *,
        client_id: str,
        client_name: str | None,
        redirect_uri: str,
        scopes: list[str],
        resource: str,
        policy_version: str,
        timeout_seconds: int = 120,
    ) -> str:
        if not 1 <= int(timeout_seconds) <= 600:
            raise ValueError("timeout_seconds is outside the allowed range")
        now = self._clock()
        scopes_json = self._json(scopes)
        with self._lock:
            self._connection.execute(
                """
                UPDATE authorization_requests
                SET status='timed_out', decided_at=?
                WHERE status='pending' AND expires_at<=?
                """,
                (now, now),
            )
            existing = self._connection.execute(
                """
                SELECT request_id
                FROM authorization_requests
                WHERE status='pending'
                  AND expires_at>?
                  AND client_id=?
                  AND redirect_uri=?
                  AND scopes_json=?
                  AND resource=?
                  AND policy_version=?
                ORDER BY created_at ASC, request_id ASC
                LIMIT 1
                """,
                (
                    now,
                    client_id,
                    redirect_uri,
                    scopes_json,
                    resource,
                    policy_version,
                ),
            ).fetchone()
            if existing is not None:
                return str(existing["request_id"])
            request_id = f"authorization:{secrets.token_urlsafe(24)}"
            self._connection.execute(
                """
                INSERT INTO authorization_requests(
                    request_id, client_id, client_name, redirect_uri, scopes_json,
                    resource, policy_version, created_at, expires_at, status, decided_at
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL)
                """,
                (
                    request_id,
                    client_id,
                    client_name,
                    redirect_uri,
                    scopes_json,
                    resource,
                    policy_version,
                    now,
                    now + int(timeout_seconds),
                ),
            )
        return request_id

    def authorization_decision(self, request_id: str) -> str | None:
        now = self._clock()
        with self._lock:
            self._connection.execute(
                """
                UPDATE authorization_requests
                SET status='timed_out', decided_at=?
                WHERE request_id=? AND status='pending' AND expires_at<=?
                """,
                (now, request_id, now),
            )
            row = self._connection.execute(
                """
                SELECT status FROM authorization_requests WHERE request_id=?
                """,
                (request_id,),
            ).fetchone()
        return str(row["status"]) if row is not None else None

    def list_authorization_requests(self) -> list[dict[str, Any]]:
        now = self._clock()
        with self._lock:
            self._connection.execute(
                """
                UPDATE authorization_requests
                SET status='timed_out', decided_at=?
                WHERE status='pending' AND expires_at<=?
                """,
                (now, now),
            )
            rows = self._connection.execute(
                """
                SELECT request_id, client_id, client_name, redirect_uri,
                       scopes_json, resource, policy_version, created_at, expires_at,
                       (
                           SELECT registration_mode
                           FROM oauth_clients AS clients
                           WHERE clients.client_id=authorization_requests.client_id
                       ) AS registration_mode
                FROM authorization_requests
                WHERE status='pending'
                ORDER BY created_at ASC, request_id ASC
                LIMIT 128
                """
            ).fetchall()
        result: list[dict[str, Any]] = []
        represented: set[tuple[str, str, str, str, str]] = set()
        for row in rows:
            item = dict(row)
            identity = (
                str(item["client_id"]),
                str(item["redirect_uri"]),
                str(item["scopes_json"]),
                str(item["resource"]),
                str(item["policy_version"]),
            )
            if identity in represented:
                continue
            represented.add(identity)
            item["scopes"] = json.loads(item.pop("scopes_json"))
            item["registration_mode"] = item["registration_mode"] or "DCR"
            item["trust_state"] = (
                "unverified"
                if item["registration_mode"] == "DCR"
                else "verified"
            )
            result.append(item)
        return result

    def decide_authorization_request(self, request_id: str, *, allow: bool) -> bool:
        now = self._clock()
        with self._lock:
            self._connection.execute(
                """
                UPDATE authorization_requests
                SET status='timed_out', decided_at=?
                WHERE request_id=? AND status='pending' AND expires_at<=?
                """,
                (now, request_id, now),
            )
            selected = self._connection.execute(
                """
                SELECT client_id, redirect_uri, scopes_json, resource, policy_version
                FROM authorization_requests
                WHERE request_id=? AND status='pending' AND expires_at>?
                """,
                (request_id, now),
            ).fetchone()
            if selected is None:
                return False
            cursor = self._connection.execute(
                """
                UPDATE authorization_requests
                SET status=?, decided_at=?
                WHERE status='pending'
                  AND expires_at>?
                  AND client_id=?
                  AND redirect_uri=?
                  AND scopes_json=?
                  AND resource=?
                  AND policy_version=?
                """,
                (
                    "allowed" if allow else "denied",
                    now,
                    now,
                    selected["client_id"],
                    selected["redirect_uri"],
                    selected["scopes_json"],
                    selected["resource"],
                    selected["policy_version"],
                ),
            )
            return cursor.rowcount >= 1

    def cancel_authorization_request(self, request_id: str) -> bool:
        now = self._clock()
        with self._lock:
            cursor = self._connection.execute(
                """
                UPDATE authorization_requests
                SET status='denied', decided_at=?
                WHERE request_id=? AND status='pending'
                """,
                (now, request_id),
            )
        return cursor.rowcount == 1

    def create_token_family(
        self,
        *,
        family_id: str,
        client_id: str,
        scopes: list[str],
        resource: str,
        instance_id: str,
        runtime_id: str,
        grant_version: str,
        policy_version: str,
        access_token: str,
        access_expires_at: float,
        refresh_token: str,
        refresh_expires_at: float | None,
    ) -> None:
        access_verifier = self.verifier(access_token)
        refresh_verifier = self.verifier(refresh_token)
        now = self._clock()
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                self._connection.execute(
                    """
                    INSERT INTO token_families(
                        family_id, client_id, scopes_json, resource, instance_id,
                        runtime_id, grant_version, policy_version,
                        current_refresh_verifier, generation, created_at
                    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                    """,
                    (
                        family_id,
                        client_id,
                        self._json(scopes),
                        resource,
                        instance_id,
                        runtime_id,
                        grant_version,
                        policy_version,
                        refresh_verifier,
                        now,
                    ),
                )
                self._insert_token_verifier(
                    access_verifier,
                    family_id,
                    "access",
                    client_id,
                    0,
                    access_expires_at,
                    now,
                )
                self._insert_token_verifier(
                    refresh_verifier,
                    family_id,
                    "refresh",
                    client_id,
                    0,
                    refresh_expires_at,
                    now,
                )
                self._connection.execute("COMMIT")
            except Exception:
                self._connection.execute("ROLLBACK")
                raise

    def _insert_token_verifier(
        self,
        verifier: str,
        family_id: str,
        token_kind: str,
        client_id: str,
        generation: int,
        expires_at: float | None,
        now: float,
    ) -> None:
        self._connection.execute(
            """
            INSERT INTO token_verifiers(
                verifier, family_id, token_kind, client_id, generation,
                expires_at, active, created_at
            ) VALUES(?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                verifier,
                family_id,
                token_kind,
                client_id,
                generation,
                expires_at,
                now,
            ),
        )

    def lookup_token(
        self,
        token: str,
        *,
        kind: str | None = None,
        include_inactive: bool = False,
    ) -> dict[str, Any] | None:
        verifier = self.verifier(token)
        conditions = ["v.verifier=?"]
        arguments: list[Any] = [verifier]
        if kind is not None:
            conditions.append("v.token_kind=?")
            arguments.append(kind)
        if not include_inactive:
            conditions.extend(["v.active=1", "f.revoked_at IS NULL"])
        query = f"""
            SELECT v.*, f.scopes_json, f.resource, f.instance_id, f.runtime_id,
                   f.grant_version, f.policy_version, f.current_refresh_verifier,
                   f.revoked_at, f.reuse_detected
            FROM token_verifiers v
            JOIN token_families f ON f.family_id=v.family_id
            WHERE {' AND '.join(conditions)}
        """
        with self._lock:
            row = self._connection.execute(query, tuple(arguments)).fetchone()
        if row is None or not hmac.compare_digest(row["verifier"], verifier):
            return None
        result = dict(row)
        result["scopes"] = json.loads(result.pop("scopes_json"))
        return result

    def rotate_refresh_family(
        self,
        old_refresh_token: str,
        *,
        access_token: str,
        access_expires_at: float,
        refresh_token: str,
        refresh_expires_at: float | None,
    ) -> dict[str, Any] | None:
        old_verifier = self.verifier(old_refresh_token)
        new_access_verifier = self.verifier(access_token)
        new_refresh_verifier = self.verifier(refresh_token)
        now = self._clock()
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                row = self._connection.execute(
                    """
                    SELECT v.*, f.current_refresh_verifier, f.revoked_at,
                           f.scopes_json, f.resource, f.instance_id, f.runtime_id,
                           f.grant_version, f.policy_version
                    FROM token_verifiers v
                    JOIN token_families f ON f.family_id=v.family_id
                    WHERE v.verifier=? AND v.token_kind='refresh'
                    """,
                    (old_verifier,),
                ).fetchone()
                if row is None:
                    self._connection.execute("ROLLBACK")
                    return None
                family_id = row["family_id"]
                if (
                    row["revoked_at"] is not None
                    or row["current_refresh_verifier"] != old_verifier
                    or row["active"] != 1
                ):
                    self._revoke_family_locked(family_id, reuse=True)
                    self._connection.execute("COMMIT")
                    return {"reused": True, "family_id": family_id}
                generation = int(row["generation"]) + 1
                self._connection.execute(
                    "UPDATE token_verifiers SET active=0 WHERE family_id=?",
                    (family_id,),
                )
                self._insert_token_verifier(
                    new_access_verifier,
                    family_id,
                    "access",
                    row["client_id"],
                    generation,
                    access_expires_at,
                    now,
                )
                self._insert_token_verifier(
                    new_refresh_verifier,
                    family_id,
                    "refresh",
                    row["client_id"],
                    generation,
                    refresh_expires_at,
                    now,
                )
                self._connection.execute(
                    """
                    UPDATE token_families
                    SET current_refresh_verifier=?, generation=?
                    WHERE family_id=?
                    """,
                    (new_refresh_verifier, generation, family_id),
                )
                self._connection.execute("COMMIT")
                result = dict(row)
                result["scopes"] = json.loads(result.pop("scopes_json"))
                result["generation"] = generation
                result["reused"] = False
                return result
            except Exception:
                self._connection.execute("ROLLBACK")
                raise

    def _revoke_family_locked(self, family_id: str, *, reuse: bool = False) -> None:
        self._connection.execute(
            """
            UPDATE token_families
            SET revoked_at=COALESCE(revoked_at, ?),
                reuse_detected=CASE WHEN ? THEN 1 ELSE reuse_detected END
            WHERE family_id=?
            """,
            (self._clock(), int(reuse), family_id),
        )
        self._connection.execute(
            "UPDATE token_verifiers SET active=0 WHERE family_id=?",
            (family_id,),
        )

    def revoke_family(self, family_id: str, *, reuse: bool = False) -> None:
        with self._lock:
            self._revoke_family_locked(family_id, reuse=reuse)

    def revoke_by_token(self, token: str) -> str | None:
        row = self.lookup_token(token, include_inactive=True)
        if row is None:
            return None
        self.revoke_family(row["family_id"])
        return row["client_id"]

    def revoke_client(self, client_id: str) -> int:
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT family_id FROM token_families
                WHERE client_id=? AND revoked_at IS NULL
                """,
                (client_id,),
            ).fetchall()
            for row in rows:
                self._revoke_family_locked(row["family_id"])
            return len(rows)

    def revoke_all(self) -> int:
        with self._lock:
            rows = self._connection.execute(
                "SELECT family_id FROM token_families WHERE revoked_at IS NULL"
            ).fetchall()
            for row in rows:
                self._revoke_family_locked(row["family_id"])
            return len(rows)

    def list_client_summaries(self) -> list[dict[str, Any]]:
        with self._lock:
            clients = self._connection.execute(
                """
                SELECT client_id, metadata_json, registration_mode,
                       created_at, revoked_at
                FROM oauth_clients
                ORDER BY created_at ASC, client_id ASC
                """
            ).fetchall()
            result: list[dict[str, Any]] = []
            for client in clients:
                family = self._connection.execute(
                    """
                    SELECT scopes_json, policy_version, created_at, revoked_at
                    FROM token_families
                    WHERE client_id=?
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (client["client_id"],),
                ).fetchone()
                if family is None:
                    continue
                last_used = self._connection.execute(
                    """
                    SELECT MAX(occurred_at) AS occurred_at
                    FROM audit_events
                    WHERE client_id=? AND event_type='TOOL_CALL'
                    """,
                    (client["client_id"],),
                ).fetchone()
                metadata = json.loads(client["metadata_json"])
                result.append(
                    {
                        "client_id": client["client_id"],
                        "display_name": metadata.get("client_name") or client["client_id"],
                        "trust_state": (
                            "unverified"
                            if client["registration_mode"] == "DCR"
                            else "verified"
                        ),
                        "scopes": json.loads(family["scopes_json"]),
                        "authorized_at": family["created_at"],
                        "last_used_at": last_used["occurred_at"] if last_used is not None else None,
                        "policy_version": family["policy_version"],
                        "status": "revoked" if family["revoked_at"] is not None else "authorized",
                    }
                )
        return result

    def deactivate_token(self, token: str) -> None:
        with self._lock:
            self._connection.execute(
                "UPDATE token_verifiers SET active=0 WHERE verifier=?",
                (self.verifier(token),),
            )

    def append_audit(self, event: Mapping[str, Any]) -> None:
        with self._lock:
            self._connection.execute(
                """
                INSERT INTO audit_events(
                    occurred_at, event_type, client_id, tool_name, scope,
                    query_fingerprint, returned_count, duration_ms, result_code,
                    correlation_id, versions_json
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event["occurred_at"],
                    event["event_type"],
                    event.get("client_id"),
                    event.get("tool_name"),
                    event.get("scope"),
                    event.get("query_fingerprint"),
                    event.get("returned_count"),
                    event.get("duration_ms"),
                    event["result_code"],
                    event.get("correlation_id"),
                    self._json(event.get("versions", {})),
                ),
            )

    def count_audit(self) -> int:
        with self._lock:
            row = self._connection.execute(
                "SELECT COUNT(*) AS total FROM audit_events"
            ).fetchone()
        return int(row["total"]) if row is not None else 0

    def read_audit(
        self,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        safe_limit = min(max(int(limit), 1), 1000)
        safe_offset = max(int(offset), 0)
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT * FROM audit_events ORDER BY event_id DESC LIMIT ? OFFSET ?
                """,
                (safe_limit, safe_offset),
            ).fetchall()
        result: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["versions"] = json.loads(item.pop("versions_json"))
            result.append(item)
        return result

    def clear_audit(self) -> int:
        with self._lock:
            cursor = self._connection.execute("DELETE FROM audit_events")
            return cursor.rowcount

    def reset_authorization_state(self, *, clear_audit: bool) -> bool:
        """Remove dev OAuth grants and clients without touching synthetic knowledge."""

        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                counts = [
                    self._connection.execute(
                        f"SELECT COUNT(*) AS total FROM {table}"
                    ).fetchone()["total"]
                    for table in (
                        "authorization_requests",
                        "authorization_codes",
                        "token_verifiers",
                        "token_families",
                        "oauth_clients",
                    )
                ]
                self._connection.execute("DELETE FROM authorization_requests")
                self._connection.execute("DELETE FROM authorization_codes")
                self._connection.execute("DELETE FROM token_verifiers")
                self._connection.execute("DELETE FROM token_families")
                self._connection.execute("DELETE FROM oauth_clients")
                audit_count = 0
                if clear_audit:
                    audit_count = int(
                        self._connection.execute(
                            "SELECT COUNT(*) AS total FROM audit_events"
                        ).fetchone()["total"]
                    )
                    self._connection.execute("DELETE FROM audit_events")
                self._connection.execute("COMMIT")
            except Exception:
                self._connection.execute("ROLLBACK")
                raise
        return any(int(value) > 0 for value in counts) or audit_count > 0
