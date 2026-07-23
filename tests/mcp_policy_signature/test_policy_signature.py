from __future__ import annotations

import base64
import copy
import hashlib
import unittest
from datetime import datetime, timezone

import rfc8785
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from sapd_wiki.local_mcp.policy_signature import (
    PolicyEnvelopeVerifier,
    PolicySignatureError,
    TrustedPolicyKey,
)
from sapd_wiki.local_mcp.policy import AiExposurePolicy


NOW = datetime(2026, 7, 23, 12, 0, tzinfo=timezone.utc)
MANIFEST = "sha256:" + ("b" * 64)


def digest(value: dict[str, object]) -> str:
    return f"sha256:{hashlib.sha256(rfc8785.dumps(value)).hexdigest()}"


def encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).decode("ascii").rstrip("=")


class PolicySignatureTests(unittest.TestCase):
    def setUp(self) -> None:
        self.private = Ed25519PrivateKey.generate()
        public = self.private.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        self.trusted = TrustedPolicyKey("fixture-key", public)
        self.content = {
            "allow": ["fixture_type"],
            "default_decision": "deny",
        }
        self.envelope = {
            "profile_version": "MCP-POLICY-SIGNATURE-v1",
            "key_id": "fixture-key",
            "issued_at": "2026-07-23T11:00:00Z",
            "expires_at": "2026-07-24T11:00:00Z",
            "base_manifest_digest": MANIFEST,
            "policy_version": "fixture-policy-v1",
            "summary_schema_version": "fixture-summary-v1",
            "content_digest": digest(self.content),
            "signature": "",
        }
        self.sign()

    def sign(self) -> None:
        payload = dict(self.envelope)
        payload.pop("signature")
        self.envelope["signature"] = encode(self.private.sign(rfc8785.dumps(payload)))

    def verifier(
        self,
        *,
        key: TrustedPolicyKey | None = None,
    ) -> PolicyEnvelopeVerifier:
        selected = self.trusted if key is None else key
        return PolicyEnvelopeVerifier(
            {selected.key_id: selected},
            now=lambda: NOW,
        )

    def assert_code(
        self,
        code: str,
        *,
        envelope: dict[str, object] | None = None,
        content: dict[str, object] | None = None,
        verifier: PolicyEnvelopeVerifier | None = None,
        manifest: str = MANIFEST,
    ) -> None:
        with self.assertRaises(PolicySignatureError) as caught:
            (verifier or self.verifier()).verify(
                envelope or self.envelope,
                content or self.content,
                expected_base_manifest_digest=manifest,
            )
        self.assertEqual(caught.exception.code, code)

    def test_valid_envelope(self) -> None:
        result = self.verifier().verify(
            self.envelope,
            self.content,
            expected_base_manifest_digest=MANIFEST,
        )
        self.assertEqual(result["policy_version"], "fixture-policy-v1")
        self.assertEqual(result["key_id"], "fixture-key")

    def test_verified_envelope_builds_closed_exposure_policy(self) -> None:
        self.content = {
            "allowed_object_types": ["fixture_type"],
            "allowed_relation_types": ["fixture_related"],
            "default_decision": "deny",
        }
        self.envelope["content_digest"] = digest(self.content)
        self.sign()
        policy = AiExposurePolicy.from_signed_content(
            verifier=self.verifier(),
            envelope=self.envelope,
            content=self.content,
            expected_manifest_digest=MANIFEST,
        )
        self.assertEqual(policy.policy_version, "fixture-policy-v1")
        self.assertEqual(policy.allowed_object_types, frozenset({"fixture_type"}))

        open_by_default = dict(self.content)
        open_by_default["default_decision"] = "allow"
        self.envelope["content_digest"] = digest(open_by_default)
        self.sign()
        with self.assertRaisesRegex(ValueError, "deny-by-default"):
            AiExposurePolicy.from_signed_content(
                verifier=self.verifier(),
                envelope=self.envelope,
                content=open_by_default,
                expected_manifest_digest=MANIFEST,
            )

    def test_unknown_and_revoked_keys_are_blocked(self) -> None:
        unknown = PolicyEnvelopeVerifier({}, now=lambda: NOW)
        self.assert_code("UNKNOWN_KEY_ID", verifier=unknown)
        revoked = TrustedPolicyKey(
            self.trusted.key_id,
            self.trusted.public_key,
            revoked=True,
        )
        self.assert_code("POLICY_SIGNATURE_INVALID", verifier=self.verifier(key=revoked))

    def test_manifest_and_content_mismatch_are_blocked(self) -> None:
        self.assert_code("MANIFEST_DIGEST_MISMATCH", manifest="sha256:" + ("c" * 64))
        changed = dict(self.content)
        changed["default_decision"] = "allow"
        self.assert_code("POLICY_SIGNATURE_INVALID", content=changed)

    def test_expired_and_future_envelopes_are_blocked(self) -> None:
        expired = copy.deepcopy(self.envelope)
        expired["expires_at"] = "2026-07-23T11:30:00Z"
        self.envelope = expired
        self.sign()
        self.assert_code("POLICY_EXPIRED")

        future = copy.deepcopy(self.envelope)
        future["issued_at"] = "2026-07-23T13:00:00Z"
        future["expires_at"] = "2026-07-24T13:00:00Z"
        self.envelope = future
        self.sign()
        self.assert_code("POLICY_SIGNATURE_INVALID")

    def test_signature_tampering_and_extra_fields_are_blocked(self) -> None:
        tampered = copy.deepcopy(self.envelope)
        tampered["signature"] = tampered["signature"][:-1] + "A"
        self.assert_code("POLICY_SIGNATURE_INVALID", envelope=tampered)
        extra = copy.deepcopy(self.envelope)
        extra["debug"] = True
        self.assert_code("POLICY_SIGNATURE_INVALID", envelope=extra)

    def test_non_nfc_and_padded_signature_are_blocked(self) -> None:
        non_nfc_content = {"name": "e\u0301"}
        self.assert_code("POLICY_SIGNATURE_INVALID", content=non_nfc_content)
        padded = copy.deepcopy(self.envelope)
        padded["signature"] += "="
        self.assert_code("POLICY_SIGNATURE_INVALID", envelope=padded)


if __name__ == "__main__":
    unittest.main()
