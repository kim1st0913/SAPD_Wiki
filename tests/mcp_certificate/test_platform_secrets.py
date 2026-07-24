from __future__ import annotations

import unittest

from sapd_wiki.local_mcp.platform_secrets import (
    FakeMacOSDataProtectionKeychainProvider,
    FakeWindowsDpapiCurrentUserProvider,
    SecretCustodyError,
)


REFERENCE = (
    "sapd-wiki-mcp:"
    + ("a" * 64)
    + ":dev:generation-c0b-test-0001:server-key"
)
SECRET = b"C0B-bound-platform-secret-value-0000000001"


class FakePlatformSecretCustodyTests(unittest.TestCase):
    def test_macos_contract_is_current_user_nonsync_and_device_bound(self) -> None:
        provider = FakeMacOSDataProtectionKeychainProvider(
            device_binding="device-binding-macos-0001"
        )
        provider.put_secret(REFERENCE, SECRET)
        self.assertEqual(provider.get_secret(REFERENCE), SECRET)
        self.assertEqual(provider.accessibility, "WhenUnlockedThisDeviceOnly")
        self.assertTrue(provider.this_device_only)
        self.assertFalse(provider.synchronizable)
        self.assertFalse(provider.uses_local_machine_scope)
        provider.simulate_device_change("device-binding-macos-0002")
        with self.assertRaises(SecretCustodyError) as raised:
            provider.get_secret(REFERENCE)
        self.assertEqual(raised.exception.code, "SECRET_DEVICE_BINDING_MISMATCH")

    def test_windows_contract_is_current_user_and_never_local_machine(self) -> None:
        provider = FakeWindowsDpapiCurrentUserProvider(
            device_binding="device-binding-windows-0001"
        )
        provider.put_secret(REFERENCE, SECRET)
        self.assertEqual(provider.get_secret(REFERENCE), SECRET)
        self.assertEqual(provider.dpapi_scope, "CurrentUser")
        self.assertTrue(provider.current_user_only)
        self.assertFalse(provider.uses_local_machine_scope)
        self.assertFalse(provider.synchronizable)

    def test_reference_must_bind_install_profile_and_generation(self) -> None:
        provider = FakeMacOSDataProtectionKeychainProvider(
            device_binding="device-binding-macos-0001"
        )
        for invalid in (
            "sapd-wiki-mcp:dev:generation-c0b-test-0001:server-key",
            "sapd-wiki-mcp:" + ("a" * 64) + ":dev:short:server-key",
            REFERENCE.replace(":dev:", ":DEV:"),
        ):
            with self.assertRaises(SecretCustodyError):
                provider.put_secret(invalid, SECRET)


if __name__ == "__main__":
    unittest.main()
