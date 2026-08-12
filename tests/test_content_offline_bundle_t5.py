from __future__ import annotations

import hashlib
import importlib.util
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from sapd_wiki.projection_contract import (
    UI_PROJECTION_SUITE_VERSION,
    knowledge_version_for_artifact_sha256,
)

ROOT = Path(__file__).resolve().parents[1]
_BUILD_BUNDLE_SPEC = importlib.util.spec_from_file_location(
    "sapd_test_build_zip_bundle",
    ROOT / "scripts/build_zip_bundle.py",
)
if _BUILD_BUNDLE_SPEC is None or _BUILD_BUNDLE_SPEC.loader is None:
    raise RuntimeError("failed to load build_zip_bundle.py")
_BUILD_BUNDLE_MODULE = importlib.util.module_from_spec(_BUILD_BUNDLE_SPEC)
_BUILD_BUNDLE_SPEC.loader.exec_module(_BUILD_BUNDLE_MODULE)
copy_maturity_report_seed = _BUILD_BUNDLE_MODULE.copy_maturity_report_seed

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
        (self.frontend / "generated").mkdir()
        (self.frontend / "generated/branch-office.drawio").write_text(
            "editable source",
            encoding="utf-8",
        )
        (self.frontend / "generated/source-deck.pptx").write_bytes(b"editable deck")
        (self.frontend / "generated/branch-office.drawio.svg").write_text(
            "<svg></svg>",
            encoding="utf-8",
        )
        self.base = self.root / "candidate-query.sqlite3"
        self.asset = self.root / "candidate-assets.sqlite3"
        with closing(sqlite3.connect(self.base)) as connection, connection:
            connection.execute(
                "CREATE TABLE content_schema_meta "
                "(key TEXT PRIMARY KEY, value TEXT NOT NULL)"
            )
            connection.execute(
                "INSERT INTO content_schema_meta VALUES "
                "('base_database_sha256', ?)",
                ("b" * 64,),
            )
        with closing(sqlite3.connect(self.asset)) as connection, connection:
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

    def run_frozen_check_import(self, frozen_root: Path) -> subprocess.CompletedProcess[str]:
        bootstrap = "\n".join(
            [
                "import runpy, sys, types",
                "create_user_db = types.ModuleType('create_user_db')",
                "create_user_db.DEFAULT_SCHEMA_VERSION = 'user_schema_0.3'",
                "create_user_db.initialize_user_db = lambda path: None",
                "sys.modules['create_user_db'] = create_user_db",
                "sys.frozen = True",
                "sys._MEIPASS = sys.argv[1]",
                "namespace = runpy.run_path(sys.argv[2], run_name='sapd_frozen_check')",
                "assert namespace['UI_PROJECTION_SUITE_VERSION'] == 'sapd-ui-projection-v1'",
            ]
        )
        return subprocess.run(
            [
                sys.executable,
                "-I",
                "-c",
                bootstrap,
                str(frozen_root),
                str(CHECK),
            ],
            check=False,
            cwd=self.root,
            capture_output=True,
            text=True,
        )

    def test_frozen_check_imports_projection_contract_from_runtime_source(self) -> None:
        frozen_root = self.root / "frozen-success"
        package_root = frozen_root / "runtime_src/sapd_wiki"
        package_root.mkdir(parents=True)
        (package_root / "__init__.py").write_text("", encoding="utf-8")
        (package_root / "projection_contract.py").write_bytes(
            (ROOT / "src/sapd_wiki/projection_contract.py").read_bytes()
        )

        result = self.run_frozen_check_import(frozen_root)

        self.assertEqual(result.returncode, 0, result.stderr)

    def test_frozen_check_fails_closed_without_runtime_source_package(self) -> None:
        cases = {
            "missing_runtime_source": self.root / "frozen-missing-runtime-source",
            "missing_package": self.root / "frozen-missing-package",
        }
        cases["missing_package"].joinpath("runtime_src").mkdir(parents=True)
        for label, frozen_root in cases.items():
            with self.subTest(label=label):
                frozen_root.mkdir(exist_ok=True)
                result = self.run_frozen_check_import(frozen_root)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(
                    "frozen runtime source package is unavailable",
                    result.stderr,
                )

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
        self.assertEqual(
            manifest["knowledge_version"],
            knowledge_version_for_artifact_sha256(
                manifest["base_database"]["sha256"]
            ),
        )
        self.assertEqual(manifest["parent_source_db_sha256"], "b" * 64)
        self.assertEqual(
            manifest["projection_contract_version"],
            UI_PROJECTION_SUITE_VERSION,
        )
        self.assertRegex(manifest["frontend"]["source_sha256"], r"^[0-9a-f]{64}$")
        self.assertRegex(manifest["frontend"]["runtime_sha256"], r"^[0-9a-f]{64}$")
        self.assertEqual(manifest["frontend"]["source_file_count"], 5)
        self.assertEqual(manifest["frontend"]["runtime_file_count"], 4)
        self.assertNotEqual(
            manifest["frontend"]["source_sha256"],
            manifest["frontend"]["runtime_sha256"],
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
        self.assertEqual(
            manifest["package"]["frontend_source_artifacts_excluded"],
            ["generated/branch-office.drawio", "generated/source-deck.pptx"],
        )
        self.assertFalse((bundle / "app/frontend-dist/generated/branch-office.drawio").exists())
        self.assertFalse((bundle / "app/frontend-dist/generated/source-deck.pptx").exists())
        self.assertTrue((bundle / "app/frontend-dist/generated/branch-office.drawio.svg").is_file())

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
        self.assertTrue(checks["knowledge_version_matches_artifact"])
        self.assertTrue(checks["parent_source_db_sha256_matches"])
        self.assertTrue(checks["projection_contract_version_matches"])

    def test_bundle_check_fails_closed_for_projection_identity(self) -> None:
        bundle = self.build()
        manifest_path = bundle / "data/base/base-manifest.json"
        baseline = json.loads(manifest_path.read_text(encoding="utf-8"))
        cases = {
            "missing_knowledge": (
                lambda manifest: manifest.pop("knowledge_version"),
                "knowledge_version_matches_artifact",
            ),
            "wrong_knowledge": (
                lambda manifest: manifest.update(
                    knowledge_version="base-0000000000000000"
                ),
                "knowledge_version_matches_artifact",
            ),
            "wrong_parent_format": (
                lambda manifest: manifest.update(parent_source_db_sha256="bad"),
                "parent_source_db_sha256_format_valid",
            ),
            "wrong_contract": (
                lambda manifest: manifest.update(
                    projection_contract_version="sapd-ui-projection-v0"
                ),
                "projection_contract_version_matches",
            ),
        }
        for label, (mutate, expected_check) in cases.items():
            with self.subTest(label=label):
                candidate = json.loads(json.dumps(baseline))
                mutate(candidate)
                manifest_path.write_text(
                    json.dumps(candidate),
                    encoding="utf-8",
                )
                checked = subprocess.run(
                    [sys.executable, str(CHECK), str(bundle), "--json"],
                    check=False,
                    cwd=ROOT,
                    capture_output=True,
                    text=True,
                )
                self.assertEqual(checked.returncode, 1)
                checks = {
                    item["name"]: item["ok"]
                    for item in json.loads(checked.stdout)["checks"]
                }
                self.assertFalse(checks[expected_check])
        manifest_path.write_text(json.dumps(baseline), encoding="utf-8")

    def test_bundle_rejects_an_unmatched_required_frontend_asset_rewrite(self) -> None:
        (self.frontend / "components/AppShell.js").write_text(
            'href: "./assets/guides/renamed-maturity-guide.html"',
            encoding="utf-8",
        )

        with self.assertRaises(subprocess.CalledProcessError) as captured:
            self.build()

        self.assertIn(
            "frontend asset rewrite expected one match",
            captured.exception.stderr,
        )

    def test_bundle_rejects_a_missing_required_frontend_asset_rewrite_owner(self) -> None:
        (self.frontend / "components/AppShell.js").unlink()

        with self.assertRaises(subprocess.CalledProcessError) as captured:
            self.build()

        self.assertIn(
            "required frontend asset rewrite owner is missing",
            captured.exception.stderr,
        )

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

    def test_bundle_rejects_frontend_symbolic_links_before_copying(self) -> None:
        external_file = self.root / "external.txt"
        external_file.write_text("must stay outside", encoding="utf-8")
        external_dir = self.root / "external-dir"
        external_dir.mkdir()
        (external_dir / "secret.txt").write_text("must stay outside", encoding="utf-8")
        cases = {
            "file": (self.frontend / "linked-file.txt", external_file),
            "directory": (self.frontend / "linked-directory", external_dir),
            "broken": (self.frontend / "broken-link", self.root / "missing-target"),
        }
        for label, (link_path, target) in cases.items():
            with self.subTest(label=label):
                link_path.symlink_to(target, target_is_directory=label == "directory")
                with self.assertRaises(subprocess.CalledProcessError) as raised:
                    self.build()
                self.assertIn("must not contain symbolic links", raised.exception.stderr)
                link_path.unlink()

    def _report_seed(self) -> tuple[Path, Path, str, str]:
        source = self.root / "report-seed"
        target = self.root / "report-target"
        project_id = "seed-project"
        artifact_id = "seed-artifact"
        artifact = source / project_id / "artifacts" / artifact_id
        artifact.mkdir(parents=True)
        persistence = {
            "schemaVersion": "sapd-maturity-report-artifact-v1",
            "projectId": project_id,
            "reportId": "seed-report",
            "artifactId": artifact_id,
            "createdAt": "2026-08-05T00:00:00Z",
            "relativePath": f"maturity-reports/{project_id}/artifacts/{artifact_id}",
        }
        (artifact / "report.json").write_text(
            json.dumps({"id": "seed-report", "ok": True, "persistence": persistence}),
            encoding="utf-8",
        )
        (artifact / "report.html").write_text("<p>seed</p>", encoding="utf-8")
        (artifact / "report.md").write_text("seed", encoding="utf-8")
        (source / project_id / "manifest.json").write_text(
            json.dumps(
                {
                    "schemaVersion": "sapd-maturity-report-artifact-v1",
                    "projectId": project_id,
                    "artifacts": [persistence],
                }
            ),
            encoding="utf-8",
        )
        return source, target, project_id, artifact_id

    def test_report_seed_requires_closed_project_artifact_and_report_identity(self) -> None:
        source, target, project_id, artifact_id = self._report_seed()
        manifest_path = source / project_id / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        invalid_cases = (
            {**manifest, "projectId": "another-project"},
            {**manifest, "artifacts": [{**manifest["artifacts"][0], "reportId": "another-report"}]},
            {**manifest, "artifacts": [{**manifest["artifacts"][0], "relativePath": "outside"}]},
        )
        for invalid in invalid_cases:
            with self.subTest(invalid=invalid):
                manifest_path.write_text(json.dumps(invalid), encoding="utf-8")
                with self.assertRaises(ValueError):
                    copy_maturity_report_seed(source, target, [f"{project_id}={artifact_id}"])
                self.assertFalse((target / project_id / "manifest.json").exists())
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        report_path = source / project_id / "artifacts" / artifact_id / "report.json"
        report = json.loads(report_path.read_text(encoding="utf-8"))
        report["persistence"]["artifactId"] = "another-artifact"
        report_path.write_text(json.dumps(report), encoding="utf-8")
        with self.assertRaises(ValueError):
            copy_maturity_report_seed(source, target, [f"{project_id}={artifact_id}"])

    def test_report_seed_copies_one_valid_closed_identity(self) -> None:
        source, target, project_id, artifact_id = self._report_seed()
        copy_maturity_report_seed(source, target, [f"{project_id}={artifact_id}"])
        copied_manifest = json.loads(
            (target / project_id / "manifest.json").read_text(encoding="utf-8")
        )
        self.assertEqual(copied_manifest["projectId"], project_id)
        self.assertEqual(len(copied_manifest["artifacts"]), 1)
        self.assertEqual(copied_manifest["artifacts"][0]["artifactId"], artifact_id)
        copied_report = json.loads(
            (target / project_id / "artifacts" / artifact_id / "report.json").read_text(encoding="utf-8")
        )
        self.assertEqual(copied_report["persistence"], copied_manifest["artifacts"][0])

    def test_whole_report_seed_validates_identity_before_copying(self) -> None:
        source, target, project_id, _artifact_id = self._report_seed()
        manifest_path = source / project_id / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest_path.write_text(
            json.dumps({**manifest, "projectId": "another-project"}),
            encoding="utf-8",
        )
        with self.assertRaises(ValueError):
            copy_maturity_report_seed(source, target, [])
        self.assertFalse(target.exists())

        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        copy_maturity_report_seed(source, target, [])
        self.assertTrue((target / project_id / "manifest.json").is_file())

    def test_report_seed_rejects_symlink_in_artifact_read_chain(self) -> None:
        source, target, project_id, artifact_id = self._report_seed()
        report_path = source / project_id / "artifacts" / artifact_id / "report.json"
        outside = self.root / "outside-report.json"
        outside.write_bytes(report_path.read_bytes())
        report_path.unlink()
        report_path.symlink_to(outside)
        with self.assertRaisesRegex(ValueError, "symbolic link"):
            copy_maturity_report_seed(source, target, [f"{project_id}={artifact_id}"])
        self.assertFalse((target / project_id / "manifest.json").exists())


if __name__ == "__main__":
    unittest.main()
