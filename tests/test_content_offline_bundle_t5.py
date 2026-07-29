from __future__ import annotations

import hashlib
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "scripts/build_zip_bundle.py"
CHECK = ROOT / "scripts/check_bundle_runtime.py"


class ContentOfflineBundleT5Tests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="sapd-t5-bundle-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.frontend = self.root / "frontend"
        self.frontend.mkdir()
        (self.frontend / "index.html").write_text("<!doctype html>", encoding="utf-8")
        (self.frontend / "app.js").write_text(
            "\n".join(
                [
                    'const MATURITY_MODEL_GUIDE_DOCUMENT_PATH = "/assets/guides/maturity-model-usage.html?embed=1&v=test";',
                    "const ARCHIMATE_POSTER_PDF_PATH = "
                    "`${ARCHIMATE_POSTER_ASSET_BASE}/archimate-poster-v3.2-zh.pdf`;",
                ]
            ),
            encoding="utf-8",
        )
        (self.frontend / "components").mkdir()
        (self.frontend / "components/AppShell.js").write_text(
            'href: "./assets/guides/maturity-model-usage.html"',
            encoding="utf-8",
        )
        original = b"<!doctype html><title>guide</title>"
        (self.frontend / "assets/guides").mkdir(parents=True)
        (self.frontend / "assets/guides/maturity-model-usage.html").write_bytes(
            original
        )
        self.base = self.root / "candidate-query.sqlite3"
        self.asset = self.root / "candidate-assets.sqlite3"
        self.base.write_bytes(b"query-database-test")
        with sqlite3.connect(self.asset) as connection:
            connection.executescript(
                (ROOT / "config/sql/content-asset-schema-v1.sql").read_text(
                    encoding="utf-8"
                )
            )
            asset_hash = hashlib.sha256(original).hexdigest()
            connection.execute(
                """
                INSERT INTO content_assets(
                  asset_hash, mime_type, format, byte_count, content_bytes, created_at
                ) VALUES (?, 'text/html', 'html', ?, ?, '2026-07-26T00:00:00Z')
                """,
                (asset_hash, len(original), original),
            )
            connection.execute(
                """
                INSERT INTO document_assets(
                  id, owner_ref, asset_hash, asset_role, ordinal,
                  logical_file_name, metadata_json, created_at, updated_at
                ) VALUES (
                  'test-guide', ?, ?, 'original', 1,
                  'sapd-maturity-model-usage-guide.html', '{}',
                  '2026-07-26T00:00:00Z', '2026-07-26T00:00:00Z'
                )
                """,
                (
                    "base:content_document:sapd-maturity-model-usage-guide",
                    asset_hash,
                ),
            )
        self.output = self.root / "output"

    def build(self) -> Path:
        subprocess.run(
            [
                sys.executable,
                str(BUILD),
                "--output-dir",
                str(self.output),
                "--platform",
                "mac-arm64",
                "--bundle-version",
                "t5-test",
                "--app-version",
                "t5-test",
                "--frontend-dist",
                str(self.frontend),
                "--base-db",
                str(self.base),
                "--content-asset-db",
                str(self.asset),
                "--allow-placeholder",
            ],
            check=True,
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        return self.output / "SAPD-Wiki-vt5-test-mac-arm64"

    def test_bundle_copies_asset_and_records_hash_and_runtime_path(self) -> None:
        bundle = self.build()
        copied_asset = bundle / "data/base/sapd_content_assets.sqlite3"
        self.assertEqual(copied_asset.read_bytes(), self.asset.read_bytes())
        manifest = json.loads(
            (bundle / "data/base/base-manifest.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            manifest["content_asset_database"]["file"],
            "sapd_content_assets.sqlite3",
        )
        self.assertRegex(
            manifest["content_asset_database"]["sha256"],
            r"^[0-9a-f]{64}$",
        )
        config = json.loads(
            (bundle / "config/app-config.json").read_text(encoding="utf-8")
        )
        self.assertEqual(
            config["content_asset_database"],
            "data/base/sapd_content_assets.sqlite3",
        )
        self.assertTrue(config["mcp_platform_integration"])
        self.assertFalse(
            (
                bundle
                / "app/frontend-dist/assets/guides/maturity-model-usage.html"
            ).exists()
        )
        packaged_app = (
            bundle / "app/frontend-dist/app.js"
        ).read_text(encoding="utf-8")
        packaged_shell = (
            bundle / "app/frontend-dist/components/AppShell.js"
        ).read_text(encoding="utf-8")
        self.assertIn("/api/v1/content/assets/by-owner?", packaged_app)
        self.assertIn("/api/v1/content/assets/by-owner?", packaged_shell)
        self.assertEqual(
            manifest["package"]["frontend_original_assets_removed"],
            ["assets/guides/maturity-model-usage.html"],
        )

        checked = subprocess.run(
            [sys.executable, str(CHECK), str(bundle), "--json"],
            check=True,
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        result = json.loads(checked.stdout)
        checks = {item["name"]: item["ok"] for item in result["checks"]}
        self.assertTrue(checks["content_asset_db_path_safe"])
        self.assertTrue(checks["content_asset_db_exists"])
        self.assertTrue(checks["content_asset_db_sha256_matches"])
        self.assertTrue(checks["config_content_asset_db_path_set"])

    def test_bundle_check_rejects_tampered_asset_database(self) -> None:
        bundle = self.build()
        with (bundle / "data/base/sapd_content_assets.sqlite3").open("ab") as handle:
            handle.write(b"tampered")
        checked = subprocess.run(
            [sys.executable, str(CHECK), str(bundle), "--json"],
            check=False,
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        self.assertEqual(checked.returncode, 1)
        result = json.loads(checked.stdout)
        check = next(
            item
            for item in result["checks"]
            if item["name"] == "content_asset_db_sha256_matches"
        )
        self.assertFalse(check["ok"])


if __name__ == "__main__":
    unittest.main()
