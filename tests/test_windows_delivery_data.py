from __future__ import annotations

import argparse
import json
import sqlite3
import tempfile
import unittest
import warnings
import zipfile
from contextlib import closing
from pathlib import Path

from scripts.windows_delivery_data import (
    ASSET_ARCHIVE_PATH,
    BASE_ARCHIVE_PATH,
    MANIFEST_PATH,
    SUMS_PATH,
    build_archive,
    join_archive_parts,
    split_archive,
    verify_archive,
)


class WindowsDeliveryDataTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(
            prefix="sapd-windows-data-test-"
        )
        self.root = Path(self.temporary.name)
        self.base = self.root / "base.sqlite3"
        self.assets = self.root / "assets.sqlite3"
        self.output = self.root / "output"
        self._create_base_database()
        self._create_asset_database()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _create_base_database(self) -> None:
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
                "INSERT INTO content_schema_meta VALUES ('schema_version', 'test-v1')"
            )
            connection.commit()

    def _create_asset_database(self) -> None:
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
                "CREATE TABLE document_assets (id TEXT PRIMARY KEY, asset_hash TEXT)"
            )
            connection.execute(
                "INSERT INTO asset_schema_meta VALUES ('schema_version', 'test-v1')"
            )
            connection.execute(
                "INSERT INTO content_assets VALUES ('abc', 'text/plain', 'txt', 3, X'616263')"
            )
            connection.commit()

    def build(self) -> Path:
        args = argparse.Namespace(
            base_db=self.base,
            content_asset_db=self.assets,
            output_dir=self.output,
            release_id="windows-data-test-v1",
            source_revision="a" * 40,
            approved_by="test",
            approved_at_utc="2026-07-27T00:00:00Z",
            evidence_ref="tests/test_windows_delivery_data.py",
            overwrite=False,
            skip_main_ancestry_check=True,
        )
        return build_archive(args)

    def test_build_and_verify_archive(self) -> None:
        archive = self.build()
        result = verify_archive(
            archive, expected_release_id="windows-data-test-v1"
        )
        self.assertTrue(result["verified"])
        self.assertEqual(result["sourceMainRevision"], "a" * 40)
        with zipfile.ZipFile(archive) as bundle:
            self.assertEqual(
                set(bundle.namelist()),
                {
                    BASE_ARCHIVE_PATH,
                    ASSET_ARCHIVE_PATH,
                    MANIFEST_PATH,
                    SUMS_PATH,
                },
            )
            manifest = json.loads(bundle.read(MANIFEST_PATH))
            self.assertEqual(
                manifest["databases"]["user"]["status"], "not_included"
            )

    def test_rejects_unexpected_archive_member(self) -> None:
        archive = self.build()
        tampered = self.root / "tampered.zip"
        with zipfile.ZipFile(archive) as source, zipfile.ZipFile(
            tampered, "w"
        ) as target:
            for item in source.infolist():
                target.writestr(item, source.read(item.filename))
            target.writestr("data/user/sapd_wiki_user.sqlite3", b"forbidden")
        with self.assertRaisesRegex(ValueError, "members mismatch"):
            verify_archive(tampered)

    def test_rejects_duplicate_archive_member(self) -> None:
        archive = self.build()
        tampered = self.root / "duplicate.zip"
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(archive) as source, zipfile.ZipFile(
                tampered, "w"
            ) as target:
                for item in source.infolist():
                    target.writestr(item, source.read(item.filename))
                target.writestr(MANIFEST_PATH, b"{}")
        with self.assertRaisesRegex(ValueError, "member count mismatch"):
            verify_archive(tampered)

    def test_rejects_windows_backslash_traversal(self) -> None:
        archive = self.build()
        tampered = self.root / "traversal.zip"
        with zipfile.ZipFile(archive) as source, zipfile.ZipFile(
            tampered, "w"
        ) as target:
            for item in source.infolist():
                if item.filename == MANIFEST_PATH:
                    target.writestr("..\\delivery-data-manifest.json", source.read(item.filename))
                else:
                    target.writestr(item, source.read(item.filename))
        with self.assertRaisesRegex(ValueError, "members mismatch"):
            verify_archive(tampered)

    def test_rejects_manifest_without_packaging_approval(self) -> None:
        archive = self.build()
        tampered = self.root / "unapproved.zip"
        with zipfile.ZipFile(archive) as source, zipfile.ZipFile(
            tampered, "w"
        ) as target:
            for item in source.infolist():
                content = source.read(item.filename)
                if item.filename == MANIFEST_PATH:
                    manifest = json.loads(content)
                    manifest["approvedForWindowsPackaging"] = False
                    content = json.dumps(manifest).encode("utf-8")
                target.writestr(item, content)
        with self.assertRaisesRegex(ValueError, "not approved"):
            verify_archive(tampered)

    def test_split_and_join_preserve_archive_identity(self) -> None:
        archive = self.build()
        parts_root = self.root / "parts"
        manifest = split_archive(
            archive,
            output_dir=parts_root,
            part_bytes=8 * 1024 * 1024,
        )
        joined = join_archive_parts(
            manifest,
            output_dir=self.root / "joined",
        )
        self.assertEqual(
            joined.read_bytes(),
            archive.read_bytes(),
        )

    def test_join_rejects_manifest_output_path_traversal(self) -> None:
        archive = self.build()
        manifest_path = split_archive(
            archive, output_dir=self.root / "parts-traversal", part_bytes=8 * 1024 * 1024
        )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["archiveName"] = "../escaped.zip"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "unsafe archive name"):
            join_archive_parts(manifest_path, output_dir=self.root / "joined-traversal")
        self.assertFalse((self.root / "escaped.zip").exists())

    def test_join_rejects_manifest_chunk_path_traversal(self) -> None:
        archive = self.build()
        manifest_path = split_archive(
            archive, output_dir=self.root / "parts-chunk-path", part_bytes=8 * 1024 * 1024
        )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["parts"][0]["name"] = "../escaped.part"
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "part order or name mismatch"):
            join_archive_parts(manifest_path, output_dir=self.root / "joined-chunk-path")
        self.assertFalse((self.root / "escaped.part").exists())

    def test_join_failure_cleans_temporary_and_preserves_existing_output(self) -> None:
        archive = self.build()
        manifest_path = split_archive(
            archive, output_dir=self.root / "parts-failure", part_bytes=8 * 1024 * 1024
        )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        part = manifest_path.parent / manifest["parts"][-1]["name"]
        part.write_bytes(part.read_bytes() + b"tamper")
        output_dir = self.root / "joined-failure"
        output_dir.mkdir()
        existing = output_dir / manifest["archiveName"]
        existing.write_bytes(b"preserve")
        with self.assertRaises(FileExistsError):
            join_archive_parts(manifest_path, output_dir=output_dir)
        self.assertEqual(existing.read_bytes(), b"preserve")
        existing.unlink()
        with self.assertRaisesRegex(ValueError, "part size mismatch"):
            join_archive_parts(manifest_path, output_dir=output_dir)
        self.assertEqual(list(output_dir.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
