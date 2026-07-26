"""Framework-independent models for the local MCP control surface.

The control surface deliberately exposes a small, closed projection.  It must
not become a serialization path for supervisor internals.
"""

from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256
import json
import re
from typing import Any, Mapping


CONTROL_CONTRACT_VERSION = "sapd-mcp-control-v1"
SESSION_HEADER = "X-SAPD-Session-Token"
NATIVE_CONFIRMATION_HEADER = "X-SAPD-Native-Confirmation"

_OPAQUE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$")
_NATIVE_CAPABILITY_RE = re.compile(r"^[A-Za-z0-9_-]{32,512}$")
_CONTROL_CHARACTER_RE = re.compile(r"[\x00-\x1f\x7f]")
_WINDOWS_ABSOLUTE_PATH_RE = re.compile(r"^[A-Za-z]:[\\/]")

_SENSITIVE_EXACT_KEYS = frozenset(
    {
        "token",
        "tokens",
        "private_key",
        "passphrase",
        "redirect_query",
        "absolute_path",
        "pid",
        "process_id",
        "raw_log",
        "raw_logs",
        "logs",
        "query",
        "queries",
        "normalized_query",
        "query_fingerprint",
        "knowledge",
        "knowledge_content",
        "knowledge_text",
        "raw_text",
        "raw_value",
        "description",
        "ai_summary",
        "user_content",
    }
)

_PUBLIC_ERROR_MESSAGES = {
    "INVALID_REQUEST": "The control request is invalid.",
    "INVALID_JSON": "The request body must be a closed JSON object.",
    "INVALID_HOST": "The local control host is not authorized.",
    "INVALID_ORIGIN": "The request origin is not authorized.",
    "SESSION_REQUIRED": "A valid local Web session is required.",
    "NOT_FOUND": "The control endpoint does not exist.",
    "METHOD_NOT_ALLOWED": "The HTTP method is not allowed for this endpoint.",
    "UNSUPPORTED_MEDIA_TYPE": "Mutations require application/json.",
    "STATE_VERSION_CONFLICT": "The control state changed; refresh and try again.",
    "REQUEST_ID_REUSED": "The request identifier was already used for another mutation.",
    "DESKTOP_CAPABILITY_REQUIRED": "This action requires confirmation in the desktop app.",
    "NATIVE_CONFIRMATION_INVALID": "The desktop confirmation is invalid, expired, or already used.",
    "SUPERVISOR_UNAVAILABLE": "The MCP supervisor is unavailable.",
    "ACTION_REJECTED": "The MCP supervisor rejected the requested action.",
    "SNAPSHOT_INVALID": "The MCP supervisor returned an invalid control snapshot.",
    "RESPONSE_POLICY_VIOLATION": "The control response was blocked by the disclosure policy.",
    "INTERNAL_ERROR": "The local control request could not be completed.",
}


class ControlError(Exception):
    """Stable service/API error that is safe to map to a public response."""

    def __init__(
        self,
        code: str,
        *,
        status: int,
        retryable: bool = False,
        current_state_version: int | None = None,
    ) -> None:
        super().__init__(code)
        self.code = code
        self.status = status
        self.retryable = retryable
        self.current_state_version = current_state_version

    @property
    def public_message(self) -> str:
        return _PUBLIC_ERROR_MESSAGES.get(self.code, _PUBLIC_ERROR_MESSAGES["INTERNAL_ERROR"])


class StateVersionConflict(ControlError):
    def __init__(self, current_state_version: int | None = None) -> None:
        super().__init__(
            "STATE_VERSION_CONFLICT",
            status=409,
            retryable=True,
            current_state_version=current_state_version,
        )


class GatewayActionError(ControlError):
    """An expected, already classified rejection from a supervisor adapter."""

    _ALLOWED_CODES = {
        "STATE_VERSION_CONFLICT": (409, True),
        "DESKTOP_CAPABILITY_REQUIRED": (428, False),
        "NATIVE_CONFIRMATION_INVALID": (403, False),
        "SUPERVISOR_UNAVAILABLE": (503, True),
        "ACTION_REJECTED": (409, False),
    }

    def __init__(self, code: str, *, current_state_version: int | None = None) -> None:
        safe_code = code if code in self._ALLOWED_CODES else "ACTION_REJECTED"
        status, retryable = self._ALLOWED_CODES[safe_code]
        super().__init__(
            safe_code,
            status=status,
            retryable=retryable,
            current_state_version=current_state_version,
        )


class ResponsePolicyViolation(ControlError):
    def __init__(self) -> None:
        super().__init__("RESPONSE_POLICY_VIOLATION", status=500)


@dataclass(frozen=True, slots=True)
class ControlApiRequest:
    method: str
    path: str
    headers: Mapping[str, str]
    body: bytes | str | Mapping[str, Any] | None = None
    query: Mapping[str, list[str]] | None = None


@dataclass(frozen=True, slots=True)
class ControlApiResponse:
    status: int
    headers: Mapping[str, str]
    body: Mapping[str, Any]

    def json_bytes(self) -> bytes:
        return json.dumps(self.body, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


@dataclass(frozen=True, slots=True)
class MutationCommand:
    request_id: str
    expected_state_version: int


def normalize_sensitive_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.casefold()).strip("_")


def _is_sensitive_key(key: str) -> bool:
    normalized = normalize_sensitive_key(key)
    segments = frozenset(normalized.split("_"))
    if normalized in _SENSITIVE_EXACT_KEYS:
        return True
    if "token" in segments or "pid" in segments or "query" in segments:
        return True
    if "private_key" in normalized or "passphrase" in normalized or "redirect_query" in normalized:
        return True
    if "absolute_path" in normalized or "raw_log" in normalized:
        return True
    if normalized.startswith("knowledge_") and normalized not in {"knowledge_state", "knowledge_version"}:
        return True
    if "user_content" in normalized or normalized in {"knowledge", "user_data"}:
        return True
    return False


def assert_safe_response(value: Any) -> None:
    """Recursively reject disclosure-prone fields and non-JSON values."""

    if isinstance(value, Mapping):
        for key, child in value.items():
            if not isinstance(key, str) or _is_sensitive_key(key):
                raise ResponsePolicyViolation()
            assert_safe_response(child)
        return
    if isinstance(value, (list, tuple)):
        for child in value:
            assert_safe_response(child)
        return
    if value is None or isinstance(value, (str, int, float, bool)):
        if isinstance(value, float) and (value != value or value in {float("inf"), float("-inf")}):
            raise ResponsePolicyViolation()
        if isinstance(value, str):
            ensure_no_absolute_path(value)
        return
    raise ResponsePolicyViolation()


def require_closed_object(
    value: Any,
    *,
    required: frozenset[str],
    optional: frozenset[str] = frozenset(),
    error_code: str = "INVALID_REQUEST",
) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ControlError(error_code, status=502 if error_code == "SNAPSHOT_INVALID" else 400)
    keys = set(value)
    if keys - required - optional or required - keys:
        raise ControlError(error_code, status=502 if error_code == "SNAPSHOT_INVALID" else 400)
    return value


def require_string(
    value: Any,
    *,
    minimum: int = 0,
    maximum: int = 256,
    error_code: str = "SNAPSHOT_INVALID",
) -> str:
    if not isinstance(value, str) or not minimum <= len(value) <= maximum or _CONTROL_CHARACTER_RE.search(value):
        raise ControlError(error_code, status=502)
    return value


def require_nullable_string(
    value: Any,
    *,
    maximum: int = 256,
    error_code: str = "SNAPSHOT_INVALID",
) -> str | None:
    if value is None:
        return None
    return require_string(value, maximum=maximum, error_code=error_code)


def require_bool(value: Any, *, error_code: str = "SNAPSHOT_INVALID") -> bool:
    if not isinstance(value, bool):
        raise ControlError(error_code, status=502)
    return value


def require_int(
    value: Any,
    *,
    minimum: int = 0,
    maximum: int = 2**63 - 1,
    error_code: str = "SNAPSHOT_INVALID",
) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        raise ControlError(error_code, status=502)
    return value


def require_enum(value: Any, allowed: frozenset[str], *, error_code: str = "SNAPSHOT_INVALID") -> str:
    result = require_string(value, minimum=1, maximum=64, error_code=error_code)
    if result not in allowed:
        raise ControlError(error_code, status=502)
    return result


def validate_opaque_id(value: Any, *, error_code: str = "INVALID_REQUEST") -> str:
    if not isinstance(value, str) or not _OPAQUE_ID_RE.fullmatch(value):
        raise ControlError(error_code, status=502 if error_code == "SNAPSHOT_INVALID" else 400)
    return value


def validate_native_capability(value: Any) -> str:
    if not isinstance(value, str) or not value:
        raise ControlError("DESKTOP_CAPABILITY_REQUIRED", status=428)
    if not _NATIVE_CAPABILITY_RE.fullmatch(value):
        raise ControlError("NATIVE_CONFIRMATION_INVALID", status=403)
    return value


def validate_expected_state_version(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ControlError("INVALID_REQUEST", status=400)
    return value


def validate_port(value: Any) -> int:
    return require_int(value, minimum=1, maximum=65535)


def ensure_no_absolute_path(value: str) -> str:
    if (
        value.startswith("/")
        or value.startswith("\\\\")
        or value.casefold().startswith("file:///")
        or _WINDOWS_ABSOLUTE_PATH_RE.match(value)
    ):
        raise ResponsePolicyViolation()
    return value


def mutation_fingerprint(action: str, expected_state_version: int, parameters: Mapping[str, Any]) -> str:
    canonical = json.dumps(
        {
            "action": action,
            "expected_state_version": expected_state_version,
            "parameters": parameters,
        },
        ensure_ascii=True,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return sha256(canonical).hexdigest()
