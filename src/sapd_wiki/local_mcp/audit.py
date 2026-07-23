from __future__ import annotations

import hashlib
import hmac
import re
import time
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from .control_store import ControlStore


_SAFE_NAME = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")
_VERSION_KEYS = frozenset(
    {
        "knowledge_version",
        "policy_version",
        "identity_version",
        "grant_version",
    }
)


class AuditValueError(ValueError):
    pass


@dataclass(frozen=True)
class AuditEvent:
    event_type: str
    result_code: str
    client_id: str | None = None
    tool_name: str | None = None
    scope: str | None = None
    query_fingerprint: str | None = None
    returned_count: int | None = None
    duration_ms: int | None = None
    correlation_id: str | None = None
    versions: Mapping[str, str] | None = None


class AuditLogger:
    """Writes allowlisted metadata and HMAC query fingerprints only."""

    def __init__(
        self,
        store: ControlStore,
        *,
        period_key: bytes,
        clock: callable = time.time,
    ) -> None:
        if len(period_key) < 32:
            raise ValueError("period_key must contain at least 256 bits")
        self._store = store
        self._period_key = bytes(period_key)
        self._clock = clock

    def fingerprint_query(self, normalized_query: str) -> str:
        return hmac.new(
            self._period_key,
            normalized_query.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

    @staticmethod
    def _safe_name(value: str | None, field: str) -> str | None:
        if value is None:
            return None
        if not _SAFE_NAME.fullmatch(value):
            raise AuditValueError(f"{field} contains unsafe metadata")
        return value

    def record(
        self,
        event: AuditEvent,
        *,
        normalized_query: str | None = None,
    ) -> None:
        versions = dict(event.versions or {})
        if not set(versions).issubset(_VERSION_KEYS):
            raise AuditValueError("versions contains an unsupported field")
        safe_versions = {
            key: self._safe_name(str(value), key) or ""
            for key, value in versions.items()
        }
        payload: dict[str, Any] = {
            "occurred_at": self._clock(),
            "event_type": self._safe_name(event.event_type, "event_type"),
            "result_code": self._safe_name(event.result_code, "result_code"),
            "client_id": self._safe_name(event.client_id, "client_id"),
            "tool_name": self._safe_name(event.tool_name, "tool_name"),
            "scope": self._safe_name(event.scope, "scope"),
            "correlation_id": self._safe_name(
                event.correlation_id, "correlation_id"
            ),
            "returned_count": event.returned_count,
            "duration_ms": event.duration_ms,
            "versions": safe_versions,
        }
        if event.query_fingerprint is not None and normalized_query is not None:
            raise AuditValueError("provide a query or a fingerprint, not both")
        payload["query_fingerprint"] = (
            self.fingerprint_query(normalized_query)
            if normalized_query is not None
            else event.query_fingerprint
        )
        if payload["query_fingerprint"] is not None and not re.fullmatch(
            r"[0-9a-f]{64}", payload["query_fingerprint"]
        ):
            raise AuditValueError("query_fingerprint must be an HMAC-SHA-256 digest")
        for field in ("returned_count", "duration_ms"):
            value = payload[field]
            if value is not None and (not isinstance(value, int) or value < 0):
                raise AuditValueError(f"{field} must be a non-negative integer")
        self._store.append_audit(payload)

