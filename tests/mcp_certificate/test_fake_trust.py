from __future__ import annotations

import unittest

from sapd_wiki.local_mcp.certificate_trust import (
    CertificateTrustError,
    FakeCurrentUserTrustAdapter,
)


FINGERPRINT_A = ":".join(["AA"] * 32)
FINGERPRINT_B = ":".join(["BB"] * 32)


class FakeCurrentUserTrustTests(unittest.TestCase):
    def test_install_verify_and_exact_remove_are_idempotent(self) -> None:
        adapter = FakeCurrentUserTrustAdapter()
        self.assertTrue(
            adapter.install(display_name="SAPD Test CA", fingerprint_sha256=FINGERPRINT_A)
        )
        self.assertFalse(
            adapter.install(display_name="SAPD Test CA", fingerprint_sha256=FINGERPRINT_A)
        )
        self.assertTrue(
            adapter.inspect(
                display_name="SAPD Test CA",
                fingerprint_sha256=FINGERPRINT_A,
            ).installed
        )
        self.assertTrue(
            adapter.remove(display_name="SAPD Test CA", fingerprint_sha256=FINGERPRINT_A)
        )
        self.assertFalse(
            adapter.remove(display_name="SAPD Test CA", fingerprint_sha256=FINGERPRINT_A)
        )

    def test_same_name_different_fingerprint_is_never_taken_over(self) -> None:
        adapter = FakeCurrentUserTrustAdapter()
        adapter.install(display_name="SAPD Test CA", fingerprint_sha256=FINGERPRINT_A)
        inspection = adapter.inspect(
            display_name="SAPD Test CA",
            fingerprint_sha256=FINGERPRINT_B,
        )
        self.assertTrue(inspection.conflict)
        with self.assertRaises(CertificateTrustError):
            adapter.install(
                display_name="SAPD Test CA",
                fingerprint_sha256=FINGERPRINT_B,
            )
        with self.assertRaises(CertificateTrustError):
            adapter.remove(
                display_name="SAPD Test CA",
                fingerprint_sha256=FINGERPRINT_B,
            )

    def test_partial_fingerprint_is_rejected(self) -> None:
        adapter = FakeCurrentUserTrustAdapter()
        with self.assertRaises(CertificateTrustError):
            adapter.install(display_name="SAPD Test CA", fingerprint_sha256="AA:BB")


if __name__ == "__main__":
    unittest.main()
