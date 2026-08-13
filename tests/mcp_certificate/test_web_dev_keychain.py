from __future__ import annotations

import shlex
import tempfile
import unittest
from pathlib import Path

from sapd_wiki.local_mcp.platform_secrets import (
    KeychainAccessDiagnosis,
    KeychainCommandResult,
    MacOSWebDevKeychainSecretProvider,
    SecretCustodyError,
)


class FakeAccessController:
    def __init__(self, *, available: bool = True) -> None:
        self.available = available
        self.diagnosis = KeychainAccessDiagnosis(
            keychain_unlocked=True,
            item_found=True,
            security_trusted=True,
        )
        self.diagnose_calls: list[dict[str, object]] = []
        self.repair_calls: list[dict[str, object]] = []

    def diagnose(self, **kwargs) -> KeychainAccessDiagnosis:
        self.diagnose_calls.append(kwargs)
        return self.diagnosis

    def repair(self, **kwargs) -> None:
        self.repair_calls.append(kwargs)


class FakeKeychainRunner:
    def __init__(self) -> None:
        self.value: bytes | None = None
        self.find_error: int | None = None
        self.put_error: int | None = None
        self.calls: list[tuple[tuple[str, ...], bytes | None]] = []

    def run(
        self,
        argv: tuple[str, ...],
        *,
        input_bytes: bytes | None = None,
    ) -> KeychainCommandResult:
        self.calls.append((argv, input_bytes))
        action = argv[1]
        if action == "-i":
            if self.put_error is not None:
                return KeychainCommandResult(self.put_error, b"", b"locked")
            command = shlex.split((input_bytes or b"").decode("utf-8"))
            if command[0] != "add-generic-password":
                raise AssertionError(command[0])
            self.value = command[command.index("-w") + 1].encode("ascii")
            return KeychainCommandResult(0, b"", b"")
        if action == "add-generic-password":
            self.value = (input_bytes or b"").rstrip(b"\r\n")
            return KeychainCommandResult(0, b"", b"")
        if action == "find-generic-password":
            if self.find_error is not None:
                return KeychainCommandResult(self.find_error, b"", b"locked")
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
        self.access_controller = FakeAccessController()
        self.provider = MacOSWebDevKeychainSecretProvider(
            runner=self.runner,
            access_controller=self.access_controller,
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
        self.assertEqual(argv, ("/usr/bin/security", "-i"))
        command = shlex.split((input_bytes or b"").decode("utf-8"))
        self.assertEqual(command[0], "add-generic-password")
        self.assertEqual(command[command.index("-a") + 1], self.reference)
        self.assertEqual(command[command.index("-s") + 1], self.provider.service)
        self.assertEqual(command[command.index("-T") + 1], "/usr/bin/security")
        self.assertEqual(command[command.index("-w") + 1], secret.decode("ascii"))
        self.assertEqual(command[-1], str(self.provider.login_keychain))
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

    def test_locked_store_is_distinct_from_missing_item(self) -> None:
        self.runner.find_error = 36
        self.access_controller.diagnosis = KeychainAccessDiagnosis(
            keychain_unlocked=False,
            item_found=True,
            security_trusted=True,
        )
        with self.assertRaises(SecretCustodyError) as raised:
            self.provider.get_secret(self.reference)
        self.assertEqual(
            raised.exception.code,
            "SECRET_STORE_LOCKED_OR_SESSION_UNAVAILABLE",
        )

        self.runner.find_error = None
        self.assertIsNone(self.provider.get_secret(self.reference))

    def test_locked_store_write_is_retryable_not_a_permanent_write_failure(
        self,
    ) -> None:
        for returncode, expected in (
            (36, "SECRET_INTERACTION_NOT_ALLOWED"),
            (51, "SECRET_AUTH_OR_ACCESS_DENIED"),
        ):
            with self.subTest(returncode=returncode):
                self.runner.put_error = returncode
                with self.assertRaises(SecretCustodyError) as raised:
                    self.provider.put_secret(
                        self.reference,
                        b"persistent-web-dev-secret-0123456789ABCDEF",
                    )
                self.assertEqual(raised.exception.code, expected)
        self.runner.put_error = 1
        with self.assertRaises(SecretCustodyError) as raised:
            self.provider.put_secret(
                self.reference,
                b"persistent-web-dev-secret-0123456789ABCDEF",
            )
        self.assertEqual(raised.exception.code, "SECRET_WRITE_FAILED")

    def test_auth_failure_with_unlocked_item_is_repairable_access_denial(self) -> None:
        self.runner.find_error = 51
        self.access_controller.diagnosis = KeychainAccessDiagnosis(
            keychain_unlocked=True,
            item_found=True,
            security_trusted=False,
        )
        with self.assertRaises(SecretCustodyError) as raised:
            self.provider.get_secret(self.reference)
        self.assertEqual(raised.exception.code, "SECRET_AUTH_OR_ACCESS_DENIED")
        self.assertEqual(len(self.access_controller.diagnose_calls), 1)

    def test_access_repair_targets_only_full_account_reference(self) -> None:
        self.assertTrue(self.provider.access_repair_available)
        self.provider.repair_access(self.reference)
        self.assertEqual(
            self.access_controller.repair_calls,
            [
                {
                    "keychain": self.provider.login_keychain,
                    "service": self.provider.service,
                    "account": self.reference,
                }
            ],
        )

    def test_unknown_read_failure_does_not_suggest_reset_or_unlock(self) -> None:
        self.runner.find_error = 1
        with self.assertRaises(SecretCustodyError) as raised:
            self.provider.get_secret(self.reference)
        self.assertEqual(raised.exception.code, "SECRET_BACKEND_FAILURE")

if __name__ == "__main__":
    unittest.main()
