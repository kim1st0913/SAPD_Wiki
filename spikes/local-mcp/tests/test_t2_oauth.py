from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
M0T = ROOT / "spikes/local-mcp/m0t"
sys.path.insert(0, str(M0T))

from oauth_harness import (  # noqa: E402
    CANONICAL_RESOURCE,
    SCOPE,
    OAuthError,
    OAuthHarness,
    pkce_challenge,
)


class MutableClock:
    def __init__(self) -> None:
        self.value = 1000.0

    def __call__(self) -> float:
        return self.value


class T2OAuthTests(unittest.TestCase):
    def setUp(self) -> None:
        self.clock = MutableClock()
        self.oauth = OAuthHarness(clock=self.clock)
        self.verifier = "fixture-verifier-" + ("v" * 48)

    def create(self, *, state: str = "fixture-state") -> object:
        return self.oauth.create_transaction(
            client_id="fixture-client",
            registered_redirect_uri="http://127.0.0.1/callback",
            redirect_uri="http://127.0.0.1:49152/callback",
            scope=SCOPE,
            resource=CANONICAL_RESOURCE,
            code_challenge_value=pkce_challenge(self.verifier),
            state=state,
            instance_id="fixture-instance",
        )

    def test_metadata_and_registration_priority(self) -> None:
        resource = self.oauth.protected_resource_metadata()
        server = self.oauth.authorization_server_metadata()
        self.assertEqual(resource["resource"], CANONICAL_RESOURCE)
        self.assertEqual(server["code_challenge_methods_supported"], ["S256"])
        self.assertEqual(
            self.oauth.select_registration(
                {"pre_registered": True, "CIMD": True, "DCR": True}
            ),
            "pre_registered",
        )
        self.assertEqual(
            self.oauth.select_registration({"CIMD": True, "DCR": True}),
            "CIMD",
        )
        self.assertEqual(self.oauth.select_registration({"DCR": True}), "DCR")

    def test_authorization_code_pkce_and_one_time_use(self) -> None:
        transaction = self.create()
        approved = self.oauth.approve(transaction.transaction_id)
        grant = self.oauth.exchange_code(
            code=approved["code"],
            client_id="fixture-client",
            redirect_uri=transaction.redirect_uri,
            verifier=self.verifier,
            resource=CANONICAL_RESOURCE,
        )
        verified = self.oauth.verify_access(
            grant.access_token,
            resource=CANONICAL_RESOURCE,
            scope=SCOPE,
        )
        self.assertEqual(verified.client_id, "fixture-client")
        with self.assertRaisesRegex(OAuthError, "invalid or used"):
            self.oauth.exchange_code(
                code=approved["code"],
                client_id="fixture-client",
                redirect_uri=transaction.redirect_uri,
                verifier=self.verifier,
                resource=CANONICAL_RESOURCE,
            )

    def test_redirect_rules_and_exact_token_redirect_binding(self) -> None:
        transaction = self.create()
        approved = self.oauth.approve(transaction.transaction_id)
        with self.assertRaises(OAuthError) as context:
            self.oauth.exchange_code(
                code=approved["code"],
                client_id="fixture-client",
                redirect_uri="http://127.0.0.1:49153/callback",
                verifier=self.verifier,
                resource=CANONICAL_RESOURCE,
            )
        self.assertEqual(context.exception.code, "REDIRECT_URI_MISMATCH")
        with self.assertRaises(OAuthError):
            self.oauth.create_transaction(
                client_id="fixture-client",
                registered_redirect_uri="http://127.0.0.1/callback",
                redirect_uri="http://localhost:49152/callback",
                scope=SCOPE,
                resource=CANONICAL_RESOURCE,
                code_challenge_value=pkce_challenge(self.verifier),
                state="state",
                instance_id="fixture-instance",
            )

    def test_timeout_and_denial_are_fail_closed(self) -> None:
        transaction = self.create()
        self.clock.value += 121
        with self.assertRaises(OAuthError) as context:
            self.oauth.approve(transaction.transaction_id)
        self.assertEqual(context.exception.code, "AUTH_TIMEOUT")
        denied = self.create(state="second")
        self.oauth.deny(denied.transaction_id)
        with self.assertRaises(OAuthError):
            self.oauth.approve(denied.transaction_id)

    def test_refresh_rotation_and_reuse_revoke_family(self) -> None:
        grant = self.oauth.issue_test_grant()
        replacement = self.oauth.refresh(grant.refresh_token)
        self.assertNotEqual(replacement.refresh_token, grant.refresh_token)
        with self.assertRaises(OAuthError) as context:
            self.oauth.refresh(grant.refresh_token)
        self.assertEqual(context.exception.code, "TOKEN_REUSED")
        with self.assertRaises(OAuthError) as context:
            self.oauth.verify_access(
                replacement.access_token,
                resource=CANONICAL_RESOURCE,
                scope=SCOPE,
            )
        self.assertEqual(context.exception.code, "TOKEN_REVOKED")

    def test_access_expiry_resource_scope_and_revocation(self) -> None:
        grant = self.oauth.issue_test_grant()
        with self.assertRaises(OAuthError) as context:
            self.oauth.verify_access(
                grant.access_token,
                resource="https://127.0.0.1:28776/mcp",
                scope=SCOPE,
            )
        self.assertEqual(context.exception.code, "TOKEN_AUDIENCE_MISMATCH")
        with self.assertRaises(OAuthError) as context:
            self.oauth.verify_access(
                grant.access_token,
                resource=CANONICAL_RESOURCE,
                scope="fixture.other",
            )
        self.assertEqual(context.exception.code, "INVALID_SCOPE")
        self.oauth.revoke(grant.access_token)
        with self.assertRaises(OAuthError) as context:
            self.oauth.verify_access(
                grant.access_token,
                resource=CANONICAL_RESOURCE,
                scope=SCOPE,
            )
        self.assertEqual(context.exception.code, "TOKEN_REVOKED")

    def test_concurrent_transactions_do_not_overwrite_each_other(self) -> None:
        first = self.create(state="first")
        second = self.create(state="second")
        self.assertNotEqual(first.transaction_id, second.transaction_id)
        first_result = self.oauth.approve(first.transaction_id)
        second_result = self.oauth.approve(second.transaction_id)
        self.assertNotEqual(first_result["code"], second_result["code"])
        self.assertEqual(first_result["state"], "first")
        self.assertEqual(second_result["state"], "second")

    def test_audit_events_never_contain_codes_or_tokens(self) -> None:
        transaction = self.create()
        approved = self.oauth.approve(transaction.transaction_id)
        grant = self.oauth.exchange_code(
            code=approved["code"],
            client_id="fixture-client",
            redirect_uri=transaction.redirect_uri,
            verifier=self.verifier,
            resource=CANONICAL_RESOURCE,
        )
        serialized = json.dumps(self.oauth.audit_events, sort_keys=True)
        self.assertNotIn(approved["code"], serialized)
        self.assertNotIn(grant.access_token, serialized)
        self.assertNotIn(grant.refresh_token, serialized)
        self.assertNotIn(self.verifier, serialized)


if __name__ == "__main__":
    unittest.main()
