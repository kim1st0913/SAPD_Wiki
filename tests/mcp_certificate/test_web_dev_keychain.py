from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sapd_wiki.local_mcp.platform_secrets import (
    KeychainCommandResult,
    MacOSWebDevKeychainSecretProvider,
    SecretCustodyError,
)


class FakeKeychainRunner:
    def __init__(self) -> None:
        self.value: bytes | None = None
        self.calls: list[tuple[tuple[str, ...], bytes | None]] = []

    def run(
        self,
        argv: tuple[str, ...],
        *,
        input_bytes: bytes | None = None,
    ) -> KeychainCommandResult:
        self.calls.append((argv, input_bytes))
        action = argv[1]
        if action == "add-generic-password":
            self.value = (input_bytes or b"").rstrip(b"\r\n")
            return KeychainCommandResult(0, b"", b"")
        if action == "find-generic-password":
            if self.value is None:
                return KeychainCommandResult(44, b"", b"")
            return KeychainCommandResult(0, self.value + b"\n", b"")
        if action == "delete-generic-password":
            self.value = None
            return KeychainCommandResult(0, b"", b"")
        raise AssertionError(action)


class WebDevKeychainTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.runner = FakeKeychainRunner()
        self.provider = MacOSWebDevKeychainSecretProvider(
            runner=self.runner,
            mutation_enabled=True,
            login_keychain=Path(self.temporary.name) / "login.keychain-db",
        )
        self.reference = (
            "sapd-wiki-mcp:"
            + "a" * 64
            + ":dev:abcdefghijklmnopqrstuvwxyz123456:server-key"
        )

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_secret_uses_stdin_not_argv_or_environment(self) -> None:
        secret = b"persistent-web-dev-secret-0123456789ABCDEF"
        self.provider.put_secret(self.reference, secret)
        argv, input_bytes = self.runner.calls[-1]
        self.assertNotIn(secret.decode("ascii"), argv)
        self.assertEqual(argv[-1], "-w")
        self.assertEqual(input_bytes, secret + b"\n")
        self.assertEqual(self.provider.get_secret(self.reference), secret)
        self.provider.delete_secret(self.reference)
        self.assertIsNone(self.provider.get_secret(self.reference))

    def test_mutation_requires_explicit_capability(self) -> None:
        provider = MacOSWebDevKeychainSecretProvider(
            runner=self.runner,
            mutation_enabled=False,
            login_keychain=Path(self.temporary.name) / "login.keychain-db",
        )
        with self.assertRaises(SecretCustodyError) as raised:
            provider.put_secret(self.reference, b"x" * 40)
        self.assertEqual(raised.exception.code, "SECRET_WRITE_NOT_AUTHORIZED")


if __name__ == "__main__":
    unittest.main()
