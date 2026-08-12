from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from scripts.prepare_windows_electron_runtime import (
    BACKEND_NAME,
    DEFAULT_APP_VERSION,
    backend_source,
    build_runtime,
    load_delivery_manifest,
)
from scripts.package_backend_pyinstaller import write_windows_build_info
from scripts.windows_delivery_data import (
    SCHEMA_VERSION,
    database_summary,
    sha256_file,
)
from sapd_wiki.projection_contract import (
    UI_PROJECTION_SUITE_VERSION,
    knowledge_version_for_artifact_sha256,
)


class PrepareWindowsElectronRuntimeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(
            prefix="sapd-windows-runtime-test-"
        )
        self.root = Path(self.temporary.name)
        self.base = self.root / "sapd_wiki_base.sqlite3"
        self.assets = self.root / "sapd_content_assets.sqlite3"
        self.frontend = self.root / "frontend"
        self.backend_root = self.root / "backend"
        self.source_revision = "b" * 40
        self.data_source_revision = "a" * 40
        self._create_databases()
        self.frontend.mkdir()
        (self.frontend / "index.html").write_text(
            "<!doctype html><title>SAPD Wiki</title>\n", encoding="utf-8"
        )
        (self.frontend / "app.js").write_text(
            "\n".join(
                (
                    'const guide = "/assets/guides/maturity-model-usage.html?embed=1&view=test";',
                    "const ARCHIMATE_POSTER_PDF_PATH = `${ARCHIMATE_POSTER_ASSET_BASE}/archimate-poster-v3.2-zh.pdf`;",
                )
            ),
            encoding="utf-8",
        )
        (self.frontend / "components").mkdir()
        (self.frontend / "components" / "AppShell.js").write_text(
            'const guide = { href: "./assets/guides/maturity-model-usage.html" };\n',
            encoding="utf-8",
        )
        lifecycle_root = self.frontend / "public" / "data" / "lifecycle"
        lifecycle_projection_root = lifecycle_root / "projections"
        lifecycle_projection_root.mkdir(parents=True)
        for relative_path in (
            "public/data/oi149-split-manifest.json",
            "public/data/lifecycle/index.json",
            "public/data/lifecycle/evidence.json",
            "public/data/lifecycle/projections/lifecycle_domain_LC-AP.json",
            "public/data/lifecycle/projections/lifecycle_domain_LC-DT.json",
        ):
            (self.frontend / relative_path).write_text("{}\n", encoding="utf-8")
        self.backend_root.mkdir()
        (self.backend_root / "_internal").mkdir()
        (self.backend_root / "_internal" / "runtime.txt").write_text(
            "runtime\n", encoding="utf-8"
        )
        backend = self.backend_root / BACKEND_NAME
        backend.write_bytes(b"MZ" + b"\0" * 126)
        build_info = {
            "schemaVersion": "sapd-windows-backend-artifact-v1",
            "sourceRevision": self.source_revision,
            "platform": "win-x64",
            "executable": BACKEND_NAME,
            "executableSha256": sha256_file(backend),
            "backendTreeSha256": self._backend_tree_sha256(self.backend_root),
            "fileCount": 2,
            "builtAtUtc": "2026-07-27T00:00:00Z",
        }
        (self.backend_root / "build-info.json").write_text(
            json.dumps(build_info), encoding="utf-8"
        )
        self.delivery_manifest_path = self.root / "delivery-data-manifest.json"
        self.delivery_manifest = {
            "schemaVersion": SCHEMA_VERSION,
            "releaseId": "windows-data-test-runtime",
            "createdAtUtc": "2026-07-27T00:00:00Z",
            "sourceMainRevision": self.data_source_revision,
            "approvedForWindowsPackaging": True,
            "approval": {
                "approvedBy": "test",
                "approvedAtUtc": "2026-07-27T00:00:00Z",
                "evidenceRef": "test",
            },
            "databases": {
                "base": {
                    **database_summary(self.base, "base"),
                    "archivePath": "data/base/sapd_wiki_base.sqlite3",
                },
                "contentAssets": {
                    **database_summary(self.assets, "content-assets"),
                    "archivePath": "data/base/sapd_content_assets.sqlite3",
                },
                "user": {
                    "status": "not_included",
                    "templateCreatedByRunner": True,
                },
            },
            "exclusions": ["real-user-database"],
        }
        self.delivery_manifest_path.write_text(
            json.dumps(self.delivery_manifest), encoding="utf-8"
        )

    @staticmethod
    def _backend_tree_sha256(root: Path) -> str:
        digest = hashlib.sha256()
        controlled = [root / BACKEND_NAME, *sorted((root / "_internal").rglob("*"))]
        for path in controlled:
            if not path.is_file():
                continue
            digest.update(path.relative_to(root).as_posix().encode("utf-8"))
            digest.update(b"\0")
            digest.update(path.read_bytes())
            digest.update(b"\0")
        return digest.hexdigest()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _create_databases(self) -> None:
        with closing(sqlite3.connect(self.base)) as connection:
            for table in (
                "knowledge_items",
                "knowledge_relations",
                "source_references",
                "content_documents",
                "content_fragments",
                "content_relations",
                "content_source_evidence",
                "schema_migrations",
            ):
                connection.execute(f'CREATE TABLE "{table}" (id TEXT PRIMARY KEY)')
            connection.execute(
                "CREATE TABLE content_schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
            )
            connection.execute(
                "INSERT INTO content_schema_meta VALUES ('schema_version', 'content-query-test-v1')"
            )
            connection.execute(
                "INSERT INTO content_schema_meta VALUES "
                "('base_database_sha256', ?) ",
                ("c" * 64,),
            )
            connection.commit()
        with closing(sqlite3.connect(self.assets)) as connection:
            connection.execute(
                "CREATE TABLE asset_schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)"
            )
            connection.execute(
                "CREATE TABLE content_assets ("
                "asset_hash TEXT PRIMARY KEY, mime_type TEXT, format TEXT, "
                "byte_count INTEGER, content_bytes BLOB)"
            )
            connection.execute(
                "CREATE TABLE document_assets ("
                "id TEXT PRIMARY KEY, asset_hash TEXT, asset_role TEXT)"
            )
            connection.execute(
                "INSERT INTO asset_schema_meta VALUES ('schema_version', 'content-asset-test-v1')"
            )
            connection.commit()

    def _args(self, output: Path) -> argparse.Namespace:
        manifest, release_id = load_delivery_manifest(
            self.delivery_manifest_path,
            base_db=self.base,
            content_asset_db=self.assets,
            source_revision=self.source_revision,
        )
        backend, backend_metadata = backend_source(
            self.backend_root,
            self.root / "unused-extract",
            expected_source_revision=self.source_revision,
        )
        return argparse.Namespace(
            app_version=DEFAULT_APP_VERSION,
            frontend_dist=self.frontend,
            base_db=self.base,
            content_asset_db=self.assets,
            delivery_manifest=manifest,
            delivery_release_id=release_id,
            delivery_data_manifest=self.delivery_manifest_path,
            source_revision=self.source_revision,
            backend_metadata=backend_metadata,
            backend=backend,
            output=output,
        )

    def test_runtime_provenance_has_no_builder_absolute_path(self) -> None:
        args = self._args(self.root / "runtime-one")
        runtime = build_runtime(args, args.backend, args.output)
        metadata_text = (runtime / "electron-runtime-build.json").read_text(
            encoding="utf-8"
        )
        metadata = json.loads(metadata_text)
        self.assertNotIn(str(self.root), metadata_text)
        self.assertEqual(metadata["sourceRevision"], self.source_revision)
        self.assertEqual(
            metadata["deliveryData"]["releaseId"], "windows-data-test-runtime"
        )
        self.assertEqual(
            metadata["deliveryData"]["sourceMainRevision"],
            self.data_source_revision,
        )
        base_manifest = json.loads(
            (runtime / "data/base/base-manifest.json").read_text(
                encoding="utf-8"
            )
        )
        self.assertEqual(base_manifest["build_time"], "2026-07-27T00:00:00Z")
        self.assertEqual(
            base_manifest["base_database"]["sha256"],
            self.delivery_manifest["databases"]["base"]["sha256"],
        )
        self.assertEqual(
            base_manifest["knowledge_version"],
            knowledge_version_for_artifact_sha256(
                self.delivery_manifest["databases"]["base"]["sha256"]
            ),
        )
        self.assertEqual(base_manifest["parent_source_db_sha256"], "c" * 64)
        self.assertEqual(
            base_manifest["projection_contract_version"],
            UI_PROJECTION_SUITE_VERSION,
        )

    def test_windows_release_source_version_is_consistent(self) -> None:
        repository = Path(__file__).resolve().parents[1]
        package = json.loads(
            (repository / "apps/electron/package.json").read_text(encoding="utf-8")
        )
        lockfile = json.loads(
            (repository / "apps/electron/package-lock.json").read_text(
                encoding="utf-8"
            )
        )
        changelog = (repository / "apps/electron/CHANGELOG.md").read_text(
            encoding="utf-8"
        )

        self.assertEqual(DEFAULT_APP_VERSION, "0.4.1")
        self.assertEqual(package["version"], DEFAULT_APP_VERSION)
        self.assertEqual(lockfile["version"], DEFAULT_APP_VERSION)
        self.assertEqual(lockfile["packages"][""]["version"], DEFAULT_APP_VERSION)
        self.assertIn(f"## {DEFAULT_APP_VERSION}", changelog)
        self.assertIn("188f20efed31631f1f53219d4d8ef6f5e8c4fa5f2f07309b6bbe185994cf3680", changelog)
        self.assertIn("`has_measure` 关系增至 53 条", changelog)

    def test_delivery_manifest_rejects_stale_base_identity(self) -> None:
        stale_manifest = json.loads(
            self.delivery_manifest_path.read_text(encoding="utf-8")
        )
        stale_manifest["databases"]["base"]["sha256"] = (
            "30d14679c7d8b7743fba129af38afde7b943bcdd707ff7b8a57bce5146f54c9e"
        )
        stale_path = self.root / "stale-delivery-data-manifest.json"
        stale_path.write_text(json.dumps(stale_manifest), encoding="utf-8")

        with self.assertRaisesRegex(
            ValueError, "Windows delivery-data database mismatch: base.sha256"
        ):
            load_delivery_manifest(
                stale_path,
                base_db=self.base,
                content_asset_db=self.assets,
                source_revision=self.source_revision,
            )

    def test_same_backend_and_delivery_data_produce_same_fingerprint(self) -> None:
        first_args = self._args(self.root / "runtime-first")
        second_args = self._args(self.root / "runtime-second")
        first = build_runtime(first_args, first_args.backend, first_args.output)
        second = build_runtime(second_args, second_args.backend, second_args.output)
        self.assertEqual(
            (first / ".sapd-runtime-fingerprint").read_text(encoding="utf-8"),
            (second / ".sapd-runtime-fingerprint").read_text(encoding="utf-8"),
        )

    def test_runtime_verification_rejects_missing_lifecycle_split_package(self) -> None:
        args = self._args(self.root / "runtime-missing-lifecycle")
        runtime = build_runtime(args, args.backend, args.output)
        missing_path = (
            runtime
            / "app"
            / "frontend-dist"
            / "public"
            / "data"
            / "lifecycle"
            / "index.json"
        )
        missing_path.unlink()
        with self.assertRaisesRegex(ValueError, "lifecycle split package is incomplete"):
            from scripts.verify_windows_runtime import verify_runtime_template

            verify_runtime_template(
                runtime,
                expected_app_version=args.app_version,
                expected_source_revision=args.source_revision,
                expected_delivery_release_id=args.delivery_release_id,
            )

    def test_backend_provenance_rejects_tampered_internal_tree(self) -> None:
        (self.backend_root / "_internal" / "runtime.txt").write_text(
            "tampered\n", encoding="utf-8"
        )
        with self.assertRaisesRegex(ValueError, "dependency tree hash mismatch"):
            backend_source(
                self.backend_root,
                self.root / "unused-extract-tampered",
                expected_source_revision=self.source_revision,
            )

    def test_backend_build_info_binds_executable_and_internal_to_revision(self) -> None:
        (self.backend_root / "build-info.json").unlink()
        build_info_path = write_windows_build_info(
            self.backend_root, self.source_revision
        )
        build_info = json.loads(build_info_path.read_text(encoding="utf-8"))
        self.assertEqual(build_info["sourceRevision"], self.source_revision)
        self.assertEqual(
            build_info["backendTreeSha256"], self._backend_tree_sha256(self.backend_root)
        )
        backend_source(
            self.backend_root,
            self.root / "unused-extract-generated",
            expected_source_revision=self.source_revision,
        )

    def test_windows_runtime_contains_current_user_readme_and_changelog(self) -> None:
        args = self._args(self.root / "runtime-readme")
        args.app_version = DEFAULT_APP_VERSION
        runtime = build_runtime(args, args.backend, args.output)
        readme = (runtime / "README-FIRST.md").read_text(encoding="utf-8")
        changelog = (runtime / "CHANGELOG.md").read_text(encoding="utf-8")

        self.assertIn(f"# SAPD Wiki {DEFAULT_APP_VERSION} Windows 使用说明", readme)
        self.assertIn(f"### {DEFAULT_APP_VERSION}", readme)
        self.assertIn("### 0.4.0", readme)
        self.assertIn("### 0.3.5", readme)
        self.assertIn("### 0.3.0（macOS）", readme)
        self.assertIn("### 0.1.6（macOS）", readme)
        self.assertIn("批注一键导出", readme)
        self.assertIn("系统设置 > AI功能集成", readme)
        self.assertNotIn("macOS DMG", readme)
        self.assertIn(f"## {DEFAULT_APP_VERSION}", changelog)


if __name__ == "__main__":
    unittest.main()
