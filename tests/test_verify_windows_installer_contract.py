from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERIFY_SCRIPT = ROOT / "scripts" / "verify_windows_installer.ps1"
BACKEND_SCRIPT = ROOT / "scripts" / "package_backend_windows.ps1"


class VerifyWindowsInstallerContractTests(unittest.TestCase):
    def test_control_panel_reads_aggregate_certificate_projection(self) -> None:
        source = VERIFY_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("$McpPanel.certificate.trust_backend", source)
        self.assertIn("$McpPanel.certificate.secret_backend", source)
        self.assertIn("$McpPanel.certificate.state", source)
        self.assertNotIn("$McpPanel.data.certificate", source)

    def test_installer_invokes_behavioral_runtime_verifier(self) -> None:
        source = VERIFY_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("verify_windows_runtime.py", source)
        self.assertIn("--expected-app-version", source)
        self.assertIn("--expected-source-revision", source)
        self.assertIn("--expected-delivery-release-id", source)
        self.assertEqual(source.count("python scripts\\verify_windows_runtime.py"), 2)

    def test_windows_backend_wrapper_forwards_source_revision(self) -> None:
        source = BACKEND_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("[string]$SourceRevision = $env:GITHUB_SHA", source)
        self.assertIn("--source-revision $SourceRevision", source)


if __name__ == "__main__":
    unittest.main()
