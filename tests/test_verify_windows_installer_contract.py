from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERIFY_SCRIPT = ROOT / "scripts" / "verify_windows_installer.ps1"


class VerifyWindowsInstallerContractTests(unittest.TestCase):
    def test_control_panel_reads_aggregate_certificate_projection(self) -> None:
        source = VERIFY_SCRIPT.read_text(encoding="utf-8")

        self.assertIn("$McpPanel.certificate.trust_backend", source)
        self.assertIn("$McpPanel.certificate.secret_backend", source)
        self.assertIn("$McpPanel.certificate.state", source)
        self.assertNotIn("$McpPanel.data.certificate", source)


if __name__ == "__main__":
    unittest.main()
