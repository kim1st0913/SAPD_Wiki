from __future__ import annotations

import os
import tempfile
import unittest
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import serialization
from cryptography.x509.oid import ExtendedKeyUsageOID

from sapd_wiki.local_mcp.certificate_identity import (
    CertificateIdentityError,
    CertificateIdentityStore,
)
from sapd_wiki.local_mcp.tls import InMemorySecretProvider
from sapd_wiki.local_mcp.platform_secrets import (
    FakeMacOSDataProtectionKeychainProvider,
    SecretCustodyError,
)


class ToggleSecretProvider(InMemorySecretProvider):
    def __init__(self) -> None:
        super().__init__()
        self.temporarily_unavailable = False

    def get_secret(self, reference: str) -> bytes | None:
        if self.temporarily_unavailable:
            raise SecretCustodyError("SECRET_STORE_UNAVAILABLE")
        return super().get_secret(reference)


class CertificateIdentityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name) / "identity"
        self.provider = InMemorySecretProvider()
        self.store = CertificateIdentityStore(
            self.root,
            secret_provider=self.provider,
        )

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_generated_identity_is_stable_encrypted_and_loopback_only(self) -> None:
        manifest = self.store.provision(install_id="install-identity-test-0001")
        reloaded = self.store.provision()
        self.assertEqual(reloaded.generation_id, manifest.generation_id)
        self.assertEqual(
            reloaded.ca_fingerprint_sha256, manifest.ca_fingerprint_sha256
        )

        generation = self.root / "generations" / manifest.generation_id
        names = {path.name for path in generation.iterdir()}
        self.assertEqual(
            names,
            {
                "ca.pem",
                "server-chain.pem",
                "server-key.encrypted.pem",
                "manifest.json",
            },
        )
        self.assertFalse(any("ca-key" in name for name in names))
        key_payload = (generation / "server-key.encrypted.pem").read_bytes()
        self.assertIn(b"BEGIN ENCRYPTED PRIVATE KEY", key_payload[:128])
        self.assertNotIn(b"BEGIN PRIVATE KEY", key_payload[:128])

        ca = x509.load_pem_x509_certificate((generation / "ca.pem").read_bytes())
        chain_payload = (generation / "server-chain.pem").read_bytes()
        self.assertEqual(
            chain_payload.count(b"-----BEGIN CERTIFICATE-----"),
            1,
            "The TLS server must not send its self-signed trust anchor.",
        )
        leaf = x509.load_pem_x509_certificate(chain_payload)
        self.assertEqual(
            leaf.extensions.get_extension_for_class(
                x509.SubjectAlternativeName
            ).value.get_values_for_type(x509.IPAddress),
            [__import__("ipaddress").ip_address("127.0.0.1")],
        )
        self.assertEqual(
            leaf.extensions.get_extension_for_class(
                x509.ExtendedKeyUsage
            ).value,
            x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]),
        )
        self.assertEqual(
            ca.extensions.get_extension_for_class(x509.BasicConstraints).value,
            x509.BasicConstraints(ca=True, path_length=0),
        )
        ca_usage = ca.extensions.get_extension_for_class(x509.KeyUsage).value
        self.assertTrue(ca_usage.key_cert_sign)
        self.assertFalse(ca_usage.digital_signature)
        self.assertFalse(ca_usage.crl_sign)
        leaf_days = (
            leaf.not_valid_after_utc.date() - leaf.not_valid_before_utc.date()
        ).days
        ca_days = (ca.not_valid_after_utc.date() - ca.not_valid_before_utc.date()).days
        self.assertGreaterEqual(leaf_days, 365)
        self.assertGreaterEqual(ca_days - leaf_days, 35)
        for path in [self.root / "active-manifest.json", *generation.iterdir()]:
            self.assertEqual(path.stat().st_mode & 0o077, 0)

    def test_staged_generation_does_not_replace_active_until_activation(self) -> None:
        first = self.store.provision(install_id="install-identity-test-stage-01")
        staged = self.store.stage_generation()
        self.assertEqual(
            self.store.load_manifest().generation_id,
            first.generation_id,
        )
        self.assertIsNotNone(self.provider.get_secret(first.passphrase_reference))
        self.assertIsNotNone(self.provider.get_secret(staged.passphrase_reference))
        self.store.activate_generation(staged)
        self.assertEqual(
            self.store.load_manifest().generation_id,
            staged.generation_id,
        )
        self.assertIsNotNone(self.provider.get_secret(first.passphrase_reference))

    def test_rotation_changes_generation_but_preserves_install_identity(self) -> None:
        first = self.store.provision(install_id="install-identity-test-0002")
        second = self.store.provision(rotate=True)
        self.assertNotEqual(first.generation_id, second.generation_id)
        self.assertEqual(first.install_id, second.install_id)
        self.assertNotEqual(
            first.server_fingerprint_sha256,
            second.server_fingerprint_sha256,
        )
        self.assertIsNone(self.provider.get_secret(first.passphrase_reference))
        self.assertIsNotNone(self.provider.get_secret(second.passphrase_reference))
        with self.assertRaises(CertificateIdentityError) as raised:
            self.store.active_identity_files(first)
        self.assertEqual(raised.exception.code, "IDENTITY_GENERATION_MISMATCH")

    def test_secret_reference_is_bound_to_install_profile_and_generation(self) -> None:
        install_id = "install-identity-test-binding-0001"
        manifest = self.store.provision(install_id=install_id)
        self.assertEqual(
            manifest.passphrase_reference,
            (
                f"sapd-wiki-mcp:{sha256(install_id.encode('utf-8')).hexdigest()}:"
                f"dev:{manifest.generation_id}:server-key"
            ),
        )
        files = self.store.active_identity_files(manifest)
        self.assertTrue(files.ca_path.is_file())
        self.assertTrue(files.server_chain_path.is_file())
        self.assertTrue(files.encrypted_private_key_path.is_file())

    def test_manifest_schema_and_file_link_checks_fail_closed(self) -> None:
        manifest = self.store.provision(install_id="install-identity-test-0003")
        target = self.root / manifest.ca_relative_path
        alias = target.with_name("linked-ca.pem")
        os.link(target, alias)
        with self.assertRaises(CertificateIdentityError) as raised:
            self.store.load_manifest()
        self.assertEqual(raised.exception.code, "IDENTITY_FILE_UNSAFE")

    def test_public_state_uses_backend_state_without_exposing_secret_reference(self) -> None:
        initial = self.store.public_state(trust_installed=False)
        self.assertEqual(initial["state"], "not_configured")
        manifest = self.store.provision(install_id="install-identity-test-0004")
        state = self.store.public_state(trust_installed=True)
        self.assertEqual(state["state"], "valid")
        self.assertEqual(state["subject"], "127.0.0.1")
        self.assertGreater(state["remaining_days"], 300)
        self.assertNotIn("passphrase_reference", state)
        self.assertNotIn(str(self.root), repr(state))
        self.provider.delete_secret(manifest.passphrase_reference)
        self.assertEqual(
            self.store.public_state(trust_installed=True)["state"],
            "key_unavailable",
        )

    def test_candidate_name_constraints_are_explicit_opt_in(self) -> None:
        manifest = self.store.provision(
            install_id="install-identity-test-0005",
            include_loopback_name_constraints=True,
        )
        ca = x509.load_pem_x509_certificate(
            (self.root / manifest.ca_relative_path).read_bytes()
        )
        constraints = ca.extensions.get_extension_for_class(
            x509.NameConstraints
        )
        self.assertTrue(constraints.critical)

    def test_60_30_7_0_day_thresholds_are_distinct(self) -> None:
        current = [datetime(2026, 7, 24, 10, 0, tzinfo=UTC)]
        store = CertificateIdentityStore(
            Path(self.temporary.name) / "threshold-identity",
            secret_provider=InMemorySecretProvider(),
            clock=lambda: current[0],
        )
        manifest = store.provision(install_id="install-threshold-test-0001")
        valid_until = datetime.fromisoformat(
            manifest.valid_until.replace("Z", "+00:00")
        )
        current[0] = valid_until - timedelta(days=60)
        sixty = store.public_state(trust_installed=True)
        self.assertEqual(sixty["state"], "valid")
        self.assertEqual(sixty["next_action"], "certificate_rotate")
        current[0] = valid_until - timedelta(days=30)
        self.assertEqual(
            store.public_state(trust_installed=True)["state"],
            "expiring",
        )
        current[0] = valid_until - timedelta(days=7)
        self.assertEqual(
            store.public_state(trust_installed=True)["state"],
            "renewal_required",
        )
        current[0] = valid_until
        self.assertEqual(
            store.public_state(trust_installed=True)["state"],
            "expired",
        )

    def test_device_binding_change_projects_key_unavailable_without_crash(self) -> None:
        provider = FakeMacOSDataProtectionKeychainProvider(
            device_binding="original-device-binding-0001"
        )
        store = CertificateIdentityStore(
            Path(self.temporary.name) / "device-bound-identity",
            secret_provider=provider,
        )
        store.provision(install_id="install-device-binding-test-01")
        provider.simulate_device_change("replacement-device-binding-01")
        state = store.public_state(trust_installed=True)
        self.assertEqual(state["state"], "key_unavailable")
        self.assertEqual(state["next_action"], "certificate_reset")

    def test_temporary_secret_store_failure_is_not_projected_as_missing_key(
        self,
    ) -> None:
        provider = ToggleSecretProvider()
        store = CertificateIdentityStore(
            Path(self.temporary.name) / "temporarily-locked-identity",
            secret_provider=provider,
        )
        store.provision(install_id="install-temporary-keychain-lock-01")

        provider.temporarily_unavailable = True
        unavailable = store.public_state(trust_installed=True)
        self.assertEqual(unavailable["state"], "error")
        self.assertEqual(
            unavailable["reason_code"],
            "CERTIFICATE_SECRET_STORE_UNAVAILABLE",
        )
        self.assertEqual(
            unavailable["next_action"],
            "certificate_view_details",
        )

        provider.temporarily_unavailable = False
        recovered = store.public_state(trust_installed=True)
        self.assertEqual(recovered["state"], "valid")
        self.assertIsNone(recovered["reason_code"])


if __name__ == "__main__":
    unittest.main()
