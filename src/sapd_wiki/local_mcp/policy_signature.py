from __future__ import annotations

import base64
import hashlib
import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Mapping


_DIGEST_PATTERN = re.compile(r"^sha256:[0-9a-f]{64}$")
_REQUIRED_FIELDS = {
    "profile_version",
    "key_id",
    "issued_at",
    "expires_at",
    "base_manifest_digest",
    "policy_version",
    "summary_schema_version",
    "content_digest",
    "signature",
}


class PolicySignatureError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class TrustedPolicyKey:
    key_id: str
    public_key: bytes
    revoked: bool = False


def _canonical_json(value: Mapping[str, Any]) -> bytes:
    try:
        import rfc8785
    except ImportError as exc:  # pragma: no cover - exercised by optional dependency checks.
        raise PolicySignatureError(
            "POLICY_SIGNATURE_INVALID",
            "RFC 8785 canonicalization support is unavailable",
        ) from exc
    try:
        return rfc8785.dumps(value)
    except Exception as exc:  # noqa: BLE001 - library exceptions are normalized.
        raise PolicySignatureError(
            "POLICY_SIGNATURE_INVALID",
            "policy envelope is not canonicalizable",
        ) from exc


def _sha256_digest(value: bytes) -> str:
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def _parse_utc(value: str) -> datetime:
    if not value.endswith("Z"):
        raise PolicySignatureError(
            "POLICY_SIGNATURE_INVALID",
            "policy time must use RFC3339 UTC",
        )
    try:
        parsed = datetime.fromisoformat(value[:-1] + "+00:00")
    except ValueError as exc:
        raise PolicySignatureError(
            "POLICY_SIGNATURE_INVALID",
            "policy time is invalid",
        ) from exc
    if parsed.tzinfo is None or parsed.utcoffset() != timezone.utc.utcoffset(parsed):
        raise PolicySignatureError(
            "POLICY_SIGNATURE_INVALID",
            "policy time must use UTC",
        )
    return parsed


def _decode_signature(value: str) -> bytes:
    if "=" in value:
        raise PolicySignatureError(
            "POLICY_SIGNATURE_INVALID",
            "signature padding is forbidden",
        )
    if not re.fullmatch(r"[A-Za-z0-9_-]+", value) or len(value) % 4 == 1:
        raise PolicySignatureError(
            "POLICY_SIGNATURE_INVALID",
            "signature encoding is invalid",
        )
    try:
        decoded = base64.urlsafe_b64decode(value + ("=" * (-len(value) % 4)))
    except Exception as exc:  # noqa: BLE001 - decoder errors are normalized.
        raise PolicySignatureError(
            "POLICY_SIGNATURE_INVALID",
            "signature encoding is invalid",
        ) from exc
    canonical = base64.urlsafe_b64encode(decoded).rstrip(b"=").decode("ascii")
    if canonical != value:
        raise PolicySignatureError(
            "POLICY_SIGNATURE_INVALID",
            "signature encoding is not canonical",
        )
    return decoded


def _validate_nfc(value: Any) -> None:
    if isinstance(value, str):
        if unicodedata.normalize("NFC", value) != value:
            raise PolicySignatureError(
                "POLICY_SIGNATURE_INVALID",
                "policy strings must already be NFC",
            )
        return
    if isinstance(value, Mapping):
        for key, nested in value.items():
            _validate_nfc(key)
            _validate_nfc(nested)
        return
    if isinstance(value, list):
        for nested in value:
            _validate_nfc(nested)


class PolicyEnvelopeVerifier:
    def __init__(
        self,
        trusted_keys: Mapping[str, TrustedPolicyKey],
        *,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self._trusted_keys = dict(trusted_keys)
        self._now = now or (lambda: datetime.now(timezone.utc))

    def verify(
        self,
        envelope: Mapping[str, Any],
        content: Mapping[str, Any],
        *,
        expected_base_manifest_digest: str,
    ) -> dict[str, Any]:
        if set(envelope) != _REQUIRED_FIELDS:
            raise PolicySignatureError(
                "POLICY_SIGNATURE_INVALID",
                "policy envelope fields do not match the closed contract",
            )
        _validate_nfc(envelope)
        _validate_nfc(content)

        for field in (
            "profile_version",
            "key_id",
            "issued_at",
            "expires_at",
            "base_manifest_digest",
            "policy_version",
            "summary_schema_version",
            "content_digest",
            "signature",
        ):
            if not isinstance(envelope[field], str) or not envelope[field]:
                raise PolicySignatureError(
                    "POLICY_SIGNATURE_INVALID",
                    f"{field} must be a non-empty string",
                )

        for field in ("base_manifest_digest", "content_digest"):
            if not _DIGEST_PATTERN.fullmatch(envelope[field]):
                raise PolicySignatureError(
                    "POLICY_SIGNATURE_INVALID",
                    f"{field} must be a sha256 digest",
                )
        if not _DIGEST_PATTERN.fullmatch(expected_base_manifest_digest):
            raise PolicySignatureError(
                "MANIFEST_DIGEST_MISMATCH",
                "expected manifest digest is invalid",
            )
        if envelope["base_manifest_digest"] != expected_base_manifest_digest:
            raise PolicySignatureError(
                "MANIFEST_DIGEST_MISMATCH",
                "policy manifest binding does not match",
            )

        content_digest = _sha256_digest(_canonical_json(content))
        if envelope["content_digest"] != content_digest:
            raise PolicySignatureError(
                "POLICY_SIGNATURE_INVALID",
                "policy content digest does not match",
            )

        issued_at = _parse_utc(envelope["issued_at"])
        expires_at = _parse_utc(envelope["expires_at"])
        now = self._now()
        if now.tzinfo is None:
            raise PolicySignatureError(
                "POLICY_SIGNATURE_INVALID",
                "verification clock must be timezone-aware",
            )
        now = now.astimezone(timezone.utc)
        if issued_at > now:
            raise PolicySignatureError(
                "POLICY_SIGNATURE_INVALID",
                "policy was issued in the future",
            )
        if expires_at <= issued_at or expires_at <= now:
            raise PolicySignatureError(
                "POLICY_EXPIRED",
                "policy has expired",
            )

        trusted = self._trusted_keys.get(envelope["key_id"])
        if trusted is None:
            raise PolicySignatureError("UNKNOWN_KEY_ID", "policy key is unknown")
        if trusted.revoked:
            raise PolicySignatureError(
                "POLICY_SIGNATURE_INVALID",
                "policy key is revoked",
            )

        signed_payload = dict(envelope)
        encoded_signature = signed_payload.pop("signature")
        signature = _decode_signature(encoded_signature)
        try:
            from cryptography.hazmat.primitives.asymmetric.ed25519 import (
                Ed25519PublicKey,
            )
        except ImportError as exc:  # pragma: no cover - optional dependency check.
            raise PolicySignatureError(
                "POLICY_SIGNATURE_INVALID",
                "Ed25519 verification support is unavailable",
            ) from exc
        try:
            Ed25519PublicKey.from_public_bytes(trusted.public_key).verify(
                signature,
                _canonical_json(signed_payload),
            )
        except Exception as exc:  # noqa: BLE001 - crypto errors are normalized.
            raise PolicySignatureError(
                "POLICY_SIGNATURE_INVALID",
                "policy signature is invalid",
            ) from exc
        return {
            "policy_version": envelope["policy_version"],
            "summary_schema_version": envelope["summary_schema_version"],
            "key_id": envelope["key_id"],
            "content_digest": content_digest,
            "expires_at": envelope["expires_at"],
        }
