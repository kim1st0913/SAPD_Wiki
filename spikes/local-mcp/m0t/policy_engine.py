from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from typing import Any


class PolicyError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    projection: str
    error_code: str | None


ALLOWED_FIELDS = {
    "canonical_ref",
    "object_type",
    "display_name",
    "effective_sensitive_level",
    "ai_use_policy",
    "ai_summary",
    "summary_version",
    "summary_hash",
}


def normalize_text(value: str, *, maximum: int, allow_empty: bool = False) -> str:
    normalized = unicodedata.normalize("NFKC", value)
    if any(unicodedata.category(character).startswith("C") for character in normalized):
        raise PolicyError("INVALID_INPUT", "control characters are forbidden")
    if not allow_empty and not normalized.strip():
        raise PolicyError("INVALID_INPUT", "empty input is forbidden")
    if len(normalized) > maximum:
        raise PolicyError("INVALID_INPUT", "input exceeds character limit")
    return normalized.strip()


def decide_object(row: dict[str, Any]) -> PolicyDecision:
    if set(row) - ALLOWED_FIELDS:
        return PolicyDecision(False, "hidden", "POLICY_BLOCKED")
    if row.get("effective_sensitive_level") != "public":
        return PolicyDecision(False, "hidden", "OBJECT_NOT_AVAILABLE")
    ai_use_policy = row.get("ai_use_policy")
    if ai_use_policy == "public_summary":
        return PolicyDecision(True, "public_summary", None)
    if ai_use_policy == "metadata_only":
        return PolicyDecision(True, "metadata_only", None)
    return PolicyDecision(False, "hidden", "OBJECT_NOT_AVAILABLE")


def project_object(row: dict[str, Any], projection: str) -> dict[str, Any]:
    base = {
        "canonical_ref": row["canonical_ref"],
        "object_type": row["object_type"],
        "display_name": row["display_name"],
    }
    if projection == "public_summary":
        base.update(
            {
                "ai_summary": row["ai_summary"],
                "summary_version": row["summary_version"],
                "summary_hash": row["summary_hash"],
            }
        )
    return base


def evaluate_secret_transport(state: dict[str, bool]) -> dict[str, str]:
    required = (
        "authenticated",
        "instance_bound",
        "peer_user_verified",
        "peer_process_verified",
        "minimum_acl",
    )
    if not all(state.get(key) is True for key in required):
        return {
            "service_state": "error",
            "knowledge_state": "blocked",
            "secret_transport_state": "blocked",
            "error_code": "KEY_PASSPHRASE_IPC_UNSAFE",
        }
    return {
        "service_state": "ready",
        "knowledge_state": "ready",
        "secret_transport_state": "ready",
        "error_code": "NONE",
    }
