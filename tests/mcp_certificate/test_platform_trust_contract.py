from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sapd_wiki.local_mcp.certificate_identity import CertificateIdentityStore
from sapd_wiki.local_mcp.certificate_trust import CertificateTrustError
from sapd_wiki.local_mcp.macos_current_user_trust import (
    CommandResult,
    MacOSCurrentUserTrustAdapter,
)
from sapd_wiki.local_mcp.tls import InMemorySecretProvider
from sapd_wiki.local_mcp.windows_current_user_trust import (
    WindowsCurrentUserRootTrustAdapter,
    WindowsTrustRecord,
)


class FakeSecurityRunner:
    def __init__(self, fingerprint: str) -> None:
        self.fingerprint = fingerprint
        self.installed = False
        self.calls: list[tuple[str, ...]] = []

    def run(
        self,
        argv: tuple[str, ...],
        *,
        input_bytes: bytes | None = None,
    ) -> CommandResult:
        del input_bytes
        self.calls.append(argv)
        action = argv[1]
        if action == "find-certificate":
            payload = (
                f"SHA-256 hash: {self.fingerprint.replace(':', '')}\n".encode()
                if self.installed
                else b""
            )
            return CommandResult(0 if self.installed else 44, payload, b"")
        if action == "verify-cert":
            return CommandResult(0 if self.installed else 1, b"", b"")
        if action == "add-trusted-cert":
            self.installed = True
            return CommandResult(0, b"", b"")
        if action == "delete-certificate":
            self.installed = False
            return CommandResult(0, b"", b"")
        raise AssertionError(action)


class FakeWindowsBridge:
    def __init__(self, display_name: str, fingerprint: str) -> None:
        self.display_name = display_name
        self.fingerprint = fingerprint
        self.installed = False
        self.removed: list[str] = []

    def list_records(self, *, display_name: str) -> list[WindowsTrustRecord]:
        self.assert_display_name = display_name
        if not self.installed:
            return []
        return [
            WindowsTrustRecord(
                fingerprint_sha256=self.fingerprint,
                display_name=self.display_name,
                store_location="CurrentUser",
                store_name="Root",
            )
        ]

    def install_public_ca(self, *, certificate_der: bytes) -> None:
        self.assertTrue_der = bool(certificate_der)
        self.installed = True

    def remove_by_sha256(self, *, fingerprint_sha256: str) -> None:
        self.removed.append(fingerprint_sha256)
        self.installed = False


class PlatformTrustContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        identity = CertificateIdentityStore(
            self.root / "identity",
            secret_provider=InMemorySecretProvider(),
        )
        manifest = identity.provision(install_id="platform-contract-install-001")
        self.target = identity.trust_target(manifest)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_macos_uses_user_ssl_host_policy_and_exact_sha256(self) -> None:
        runner = FakeSecurityRunner(self.target.fingerprint_sha256)
        adapter = MacOSCurrentUserTrustAdapter(
            runtime_root=self.root / "trust-runtime",
            runner=runner,
            mutation_enabled=True,
            login_keychain=self.root / "login.keychain-db",
        )
        self.assertTrue(adapter.install_target(self.target))
        install = next(call for call in runner.calls if call[1] == "add-trusted-cert")
        self.assertNotIn("-d", install)
        self.assertIn("-p", install)
        self.assertEqual(install[install.index("-p") + 1], "ssl")
        self.assertEqual(install[install.index("-s") + 1], "127.0.0.1")
        self.assertTrue(adapter.remove_target(self.target))
        delete = next(call for call in runner.calls if call[1] == "delete-certificate")
        self.assertEqual(
            delete[delete.index("-Z") + 1],
            self.target.fingerprint_sha256.replace(":", ""),
        )

    def test_macos_mutation_is_disabled_without_explicit_capability(self) -> None:
        adapter = MacOSCurrentUserTrustAdapter(
            runtime_root=self.root / "trust-runtime-disabled",
            runner=FakeSecurityRunner(self.target.fingerprint_sha256),
            mutation_enabled=False,
            login_keychain=self.root / "login.keychain-db",
        )
        with self.assertRaises(CertificateTrustError) as raised:
            adapter.install_target(self.target)
        self.assertEqual(
            raised.exception.code,
            "CERTIFICATE_TRUST_WRITE_NOT_AUTHORIZED",
        )

    def test_windows_contract_never_accepts_local_machine_records(self) -> None:
        class BadScopeBridge(FakeWindowsBridge):
            def list_records(self, *, display_name: str) -> list[WindowsTrustRecord]:
                return [
                    WindowsTrustRecord(
                        fingerprint_sha256=self.fingerprint,
                        display_name=display_name,
                        store_location="LocalMachine",
                        store_name="Root",
                    )
                ]

        bridge = BadScopeBridge(
            self.target.display_name,
            self.target.fingerprint_sha256,
        )
        adapter = WindowsCurrentUserRootTrustAdapter(
            bridge=bridge,
            mutation_enabled=True,
        )
        with self.assertRaises(CertificateTrustError) as raised:
            adapter.inspect_target(self.target)
        self.assertEqual(
            raised.exception.code,
            "CERTIFICATE_TRUST_SCOPE_VIOLATION",
        )

    def test_windows_install_and_remove_are_exact_current_user_root(self) -> None:
        bridge = FakeWindowsBridge(
            self.target.display_name,
            self.target.fingerprint_sha256,
        )
        adapter = WindowsCurrentUserRootTrustAdapter(
            bridge=bridge,
            mutation_enabled=True,
        )
        self.assertTrue(adapter.install_target(self.target))
        self.assertTrue(adapter.remove_target(self.target))
        self.assertEqual(bridge.removed, [self.target.fingerprint_sha256])


if __name__ == "__main__":
    unittest.main()
