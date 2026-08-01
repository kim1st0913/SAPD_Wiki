from __future__ import annotations

import argparse
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from scripts.prepare_windows_electron_runtime import (
    BACKEND_NAME,
    backend_source,
    build_runtime,
    load_delivery_manifest,
)
from scripts.windows_delivery_data import (
    SCHEMA_VERSION,
    database_summary,
    sha256_file,
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
            app_version="0.3.0",
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
        self.assertEqual(
            json.loads(
                (runtime / "data/base/base-manifest.json").read_text(
                    encoding="utf-8"
                )
            )["build_time"],
            "2026-07-27T00:00:00Z",
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

    def test_windows_runtime_contains_current_user_readme_and_changelog(self) -> None:
        args = self._args(self.root / "runtime-readme")
        args.app_version = "0.3.5"
        runtime = build_runtime(args, args.backend, args.output)
        readme = (runtime / "README-FIRST.md").read_text(encoding="utf-8")
        changelog = (runtime / "CHANGELOG.md").read_text(encoding="utf-8")

        self.assertIn("# SAPD Wiki 0.3.5 Windows 使用说明", readme)
        self.assertIn("### 0.3.5", readme)
        self.assertIn("### 0.3.0（macOS）", readme)
        self.assertIn("### 0.1.6（macOS）", readme)
        self.assertIn("批注一键导出", readme)
        self.assertIn("系统设置 > AI功能集成", readme)
        self.assertNotIn("macOS DMG", readme)
        self.assertIn("## 0.3.5", changelog)


if __name__ == "__main__":
    unittest.main()
