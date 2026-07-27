from __future__ import annotations

import os
import secrets
import shutil
import tempfile
import unittest
from hashlib import sha256
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes

from sapd_wiki.local_mcp.certificate_identity import CertificateIdentityStore
from sapd_wiki.local_mcp.certificate_trust import CertificateTrustError
from sapd_wiki.local_mcp.platform_secrets import (
    SecretCustodyError,
    WindowsDpapiCurrentUserProvider,
)
from sapd_wiki.local_mcp.path_security import (
    ensure_secure_directory,
    windows_fixed_mcp_root,
)
from sapd_wiki.local_mcp.tls import InMemorySecretProvider
from sapd_wiki.local_mcp.windows_current_user_trust import (
    WindowsCurrentUserRootTrustAdapter,
    WindowsWinCryptCurrentUserRootBridge,
)


REFERENCE = (
    "sapd-wiki-mcp:"
    + ("a" * 64)
    + ":dev:generation-windows-d2-0001:server-key"
)
SECRET = b"windows-dpapi-secret-value-000000000001"


class FakeDpapiNativeApi:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, bool, bytes]] = []

    def protect(
        self,
        plaintext: bytes,
        *,
        entropy: bytes,
        scope: str,
        ui_forbidden: bool,
    ) -> bytes:
        self.calls.append(("protect", scope, ui_forbidden, entropy))
        return b"fake-dpapi-v1:" + sha256(entropy).digest() + plaintext[::-1]

    def unprotect(
        self,
        ciphertext: bytes,
        *,
        entropy: bytes,
        scope: str,
        ui_forbidden: bool,
    ) -> bytes:
        self.calls.append(("unprotect", scope, ui_forbidden, entropy))
        prefix = b"fake-dpapi-v1:" + sha256(entropy).digest()
        if not ciphertext.startswith(prefix):
            raise SecretCustodyError("SECRET_UNPROTECT_FAILED")
        return ciphertext[len(prefix) :][::-1]


class FakeCertificateStoreNativeApi:
    def __init__(self) -> None:
        self.certificates: list[bytes] = []
        self.calls: list[tuple[str, str, str]] = []

    @staticmethod
    def _assert_store(*, store_location: str, store_name: str) -> None:
        if store_location != "CurrentUser" or store_name != "Root":
            raise AssertionError((store_location, store_name))

    def list_certificates(
        self,
        *,
        store_location: str,
        store_name: str,
    ) -> list[bytes]:
        self._assert_store(
            store_location=store_location,
            store_name=store_name,
        )
        self.calls.append(("list", store_location, store_name))
        return list(self.certificates)

    def add_certificate(
        self,
        *,
        store_location: str,
        store_name: str,
        certificate_der: bytes,
    ) -> None:
        self._assert_store(
            store_location=store_location,
            store_name=store_name,
        )
        self.calls.append(("add", store_location, store_name))
        self.certificates.append(bytes(certificate_der))

    def remove_by_sha256(
        self,
        *,
        store_location: str,
        store_name: str,
        fingerprint_sha256: str,
    ) -> int:
        self._assert_store(
            store_location=store_location,
            store_name=store_name,
        )
        self.calls.append(("remove", store_location, store_name))
        expected = fingerprint_sha256.replace(":", "").lower()
        retained: list[bytes] = []
        removed = 0
        for payload in self.certificates:
            actual = x509.load_der_x509_certificate(payload).fingerprint(
                hashes.SHA256()
            ).hex()
            if actual == expected:
                removed += 1
            else:
                retained.append(payload)
        self.certificates = retained
        return removed


class WindowsNativeSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_dpapi_provider_persists_only_ciphertext_in_current_user_scope(
        self,
    ) -> None:
        native = FakeDpapiNativeApi()
        provider = WindowsDpapiCurrentUserProvider(
            self.root / "dpapi",
            native_api=native,
            mutation_enabled=True,
        )
        provider.put_secret(REFERENCE, SECRET)
        blob_path = next((self.root / "dpapi").glob("*.dpapi"))
        self.assertNotIn(SECRET, blob_path.read_bytes())
        self.assertEqual(provider.get_secret(REFERENCE), SECRET)
        self.assertEqual(
            [(call[0], call[1], call[2]) for call in native.calls],
            [
                ("protect", "CurrentUser", True),
                ("unprotect", "CurrentUser", True),
            ],
        )
        self.assertEqual(native.calls[0][3], native.calls[1][3])
        self.assertFalse(provider.uses_local_machine_scope)
        provider.delete_secret(REFERENCE)
        self.assertIsNone(provider.get_secret(REFERENCE))

    def test_dpapi_provider_binds_ciphertext_to_reference_entropy(self) -> None:
        native = FakeDpapiNativeApi()
        provider = WindowsDpapiCurrentUserProvider(
            self.root / "binding",
            native_api=native,
            mutation_enabled=True,
        )
        provider.put_secret(REFERENCE, SECRET)
        other_reference = REFERENCE.replace(
            "generation-windows-d2-0001",
            "generation-windows-d2-0002",
        )
        first_blob = next((self.root / "binding").glob("*.dpapi")).read_bytes()
        other_path = provider._blob_path(other_reference)
        other_path.write_bytes(first_blob)
        os.chmod(other_path, 0o600)
        with self.assertRaises(SecretCustodyError) as raised:
            provider.get_secret(other_reference)
        self.assertEqual(raised.exception.code, "SECRET_UNPROTECT_FAILED")

    def test_dpapi_mutation_requires_explicit_capability(self) -> None:
        provider = WindowsDpapiCurrentUserProvider(
            self.root / "disabled",
            native_api=FakeDpapiNativeApi(),
        )
        with self.assertRaises(SecretCustodyError) as raised:
            provider.put_secret(REFERENCE, SECRET)
        self.assertEqual(
            raised.exception.code,
            "SECRET_WRITE_NOT_AUTHORIZED",
        )

    def test_wincrypt_bridge_uses_exact_current_user_root_and_sha256(self) -> None:
        identity = CertificateIdentityStore(
            self.root / "identity",
            secret_provider=InMemorySecretProvider(),
        )
        manifest = identity.provision(
            install_id="windows-native-security-test-0001",
            include_loopback_name_constraints=True,
        )
        target = identity.trust_target(manifest)
        native = FakeCertificateStoreNativeApi()
        bridge = WindowsWinCryptCurrentUserRootBridge(native_api=native)
        adapter = WindowsCurrentUserRootTrustAdapter(
            bridge=bridge,
            mutation_enabled=True,
        )
        self.assertTrue(adapter.install_target(target))
        self.assertTrue(adapter.inspect_target(target).installed)
        self.assertTrue(adapter.remove_target(target))
        self.assertEqual(
            {call[1:] for call in native.calls},
            {("CurrentUser", "Root")},
        )
        self.assertFalse(native.certificates)

    def test_native_backends_are_importable_but_fail_closed_off_windows(
        self,
    ) -> None:
        if os.name == "nt":
            self.skipTest("non-Windows fail-closed contract")
        with self.assertRaises(SecretCustodyError) as secret_raised:
            WindowsDpapiCurrentUserProvider(self.root / "real-dpapi")
        self.assertEqual(
            secret_raised.exception.code,
            "SECRET_BACKEND_UNAVAILABLE",
        )
        with self.assertRaises(CertificateTrustError) as trust_raised:
            WindowsWinCryptCurrentUserRootBridge()
        self.assertEqual(
            trust_raised.exception.code,
            "CERTIFICATE_TRUST_BACKEND_UNAVAILABLE",
        )


@unittest.skipUnless(os.name == "nt", "Windows native security backends")
class WindowsRealNativeSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.token = secrets.token_hex(10)
        self.root = (
            windows_fixed_mcp_root()
            / "NativeSecurityTests"
            / self.token
        )
        ensure_secure_directory(
            self.root,
            require_fixed_windows_mcp_root=True,
        )

    def tearDown(self) -> None:
        if self.root.exists():
            shutil.rmtree(self.root)

    def test_real_dpapi_round_trip_is_current_user_only(self) -> None:
        reference = REFERENCE.replace(
            "generation-windows-d2-0001",
            f"generation-{self.token}",
        )
        provider = WindowsDpapiCurrentUserProvider(
            self.root / "dpapi",
            mutation_enabled=True,
        )
        provider.put_secret(reference, SECRET)
        blob = next((self.root / "dpapi").glob("*.dpapi"))
        self.assertNotIn(SECRET, blob.read_bytes())
        self.assertEqual(provider.get_secret(reference), SECRET)
        self.assertFalse(provider.uses_local_machine_scope)
        provider.delete_secret(reference)
        self.assertIsNone(provider.get_secret(reference))

    def test_real_wincrypt_current_user_root_install_and_exact_cleanup(
        self,
    ) -> None:
        profile = f"ci-{self.token}"
        identity = CertificateIdentityStore(
            self.root / "identity",
            secret_provider=InMemorySecretProvider(),
            profile=profile,
        )
        manifest = identity.provision(
            install_id=f"windows-native-{self.token}",
            include_loopback_name_constraints=True,
        )
        target = identity.trust_target(manifest)
        bridge = WindowsWinCryptCurrentUserRootBridge()
        adapter = WindowsCurrentUserRootTrustAdapter(
            bridge=bridge,
            mutation_enabled=True,
            managed_fingerprints={target.fingerprint_sha256},
        )
        try:
            self.assertTrue(adapter.install_target(target))
            inspection = adapter.inspect_target(target)
            self.assertTrue(inspection.installed)
            self.assertEqual(inspection.scope, "current_user")
            self.assertTrue(adapter.remove_target(target))
            self.assertFalse(adapter.inspect_target(target).installed)
        finally:
            bridge.remove_by_sha256(
                fingerprint_sha256=target.fingerprint_sha256,
            )


if __name__ == "__main__":
    unittest.main()
