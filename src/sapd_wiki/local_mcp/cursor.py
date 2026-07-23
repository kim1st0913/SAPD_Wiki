"""Contract-bound HMAC keyset cursor."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from typing import Any, Callable, Mapping

from .errors import CursorStaleError


Clock = Callable[[], float]


@dataclass(frozen=True)
class CursorContext:
    tool: str
    normalized_parameters: Mapping[str, Any]
    client: str
    grant: str
    scope: str
    policy_version: str
    knowledge_version: str
    identity_version: str
    sort_version: str

    def bindings(self) -> dict[str, Any]:
        return {
            "tool": self.tool,
            "normalized_parameters": dict(self.normalized_parameters),
            "client": self.client,
            "grant": self.grant,
            "scope": self.scope,
            "policy_version": self.policy_version,
            "knowledge_version": self.knowledge_version,
            "identity_version": self.identity_version,
            "sort_version": self.sort_version,
        }


class CursorCodec:
    REQUIRED_FIELDS = frozenset(
        {
            "tool",
            "normalized_parameters",
            "client",
            "grant",
            "scope",
            "policy_version",
            "knowledge_version",
            "identity_version",
            "sort_version",
            "last_sort_key",
            "issued_at",
        }
    )

    def __init__(
        self,
        key: bytes,
        *,
        ttl_seconds: int = 900,
        clock: Clock = time.time,
    ) -> None:
        if len(key) < 32:
            raise ValueError("cursor HMAC key must be at least 256 bits")
        if ttl_seconds <= 0:
            raise ValueError("cursor ttl must be positive")
        self._key = key
        self._ttl_seconds = ttl_seconds
        self._clock = clock

    def encode(self, context: CursorContext, *, last_sort_key: str) -> str:
        payload = {
            **context.bindings(),
            "last_sort_key": last_sort_key,
            "issued_at": int(self._clock()),
        }
        raw = json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        signature = hmac.new(self._key, raw, hashlib.sha256).digest()
        return base64.urlsafe_b64encode(raw + signature).decode("ascii").rstrip("=")

    def decode(self, cursor: str, expected: CursorContext) -> str:
        if not isinstance(cursor, str) or not cursor or len(cursor) > 4096:
            raise CursorStaleError("cursor format is invalid")
        try:
            padding = "=" * (-len(cursor) % 4)
            combined = base64.b64decode(
                cursor + padding,
                altchars=b"-_",
                validate=True,
            )
        except (ValueError, TypeError) as exc:
            raise CursorStaleError("cursor encoding is invalid") from exc
        digest_size = hashlib.sha256().digest_size
        if len(combined) <= digest_size:
            raise CursorStaleError("cursor payload is invalid")
        raw, provided = combined[:-digest_size], combined[-digest_size:]
        expected_signature = hmac.new(self._key, raw, hashlib.sha256).digest()
        if not hmac.compare_digest(provided, expected_signature):
            raise CursorStaleError("cursor integrity check failed")
        try:
            payload = json.loads(raw)
        except (UnicodeError, json.JSONDecodeError) as exc:
            raise CursorStaleError("cursor payload is invalid") from exc
        if not isinstance(payload, dict) or set(payload) != self.REQUIRED_FIELDS:
            raise CursorStaleError("cursor bindings are incomplete")
        for key, value in expected.bindings().items():
            if payload.get(key) != value:
                raise CursorStaleError(f"cursor {key} binding is stale")
        issued_at = payload.get("issued_at")
        now = int(self._clock())
        if isinstance(issued_at, bool) or not isinstance(issued_at, int):
            raise CursorStaleError("cursor issue time is invalid")
        if issued_at > now or now - issued_at > self._ttl_seconds:
            raise CursorStaleError("cursor has expired")
        last_sort_key = payload.get("last_sort_key")
        if not isinstance(last_sort_key, str) or not last_sort_key.startswith("fixture://"):
            raise CursorStaleError("cursor sort key is invalid")
        return last_sort_key
