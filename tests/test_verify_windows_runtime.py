from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from scripts.create_user_db import DEFAULT_SCHEMA_VERSION, initialize_user_db
from scripts.prepare_windows_electron_runtime import write_runtime_fingerprint
from scripts.verify_windows_runtime import verify_runtime_template


class VerifyWindowsRuntimeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory(prefix="sapd-windows-verify-")
        self.root = Path(self.temporary.name)
        self.runtime = self.root / "runtime"
        (self.runtime / "_internal").mkdir(parents=True)
        (self.runtime / "data" / "user").mkdir(parents=True)
        (self.runtime / "data" / "base").mkdir(parents=True)
        (self.runtime / "app" / "frontend-dist").mkdir(parents=True)
        (self.runtime / "config").mkdir()
        (self.runtime / "diagnostics").mkdir()
        (self.runtime / "SAPD-Wiki-Backend.exe").write_bytes(b"MZ")
        (self.runtime / "_internal" / "runtime.dll").write_bytes(b"dependency")
        (self.runtime / "app" / "frontend-dist" / "index.html").write_text("ok")
        (self.runtime / "config" / "app-config.json").write_text("{}")
        initialize_user_db(
            self.runtime / "data" / "user" / "sapd_wiki_user.sqlite3",
            DEFAULT_SCHEMA_VERSION,
        )
        (self.runtime / "data" / "base" / "windows-delivery-data-manifest.json").write_text(
            json.dumps(
                {
                    "schemaVersion": "sapd-windows-delivery-data-v1",
                    "releaseId": "release-test-v1",
                }
            ),
            encoding="utf-8",
        )
        (self.runtime / "data" / "base" / "base-manifest.json").write_text(
            json.dumps({"app_version": "0.4.0"}), encoding="utf-8"
        )
        fingerprint = write_runtime_fingerprint(self.runtime)
        self.metadata = {
            "schemaVersion": "sapd-windows-electron-runtime-v2",
            "appVersion": "0.4.0",
            "platform": "win-x64",
            "sourceRevision": "a" * 40,
            "runtimeFingerprint": fingerprint,
            "deliveryData": {
                "schemaVersion": "sapd-windows-delivery-data-v1",
                "releaseId": "release-test-v1",
            },
        }
        self._write_metadata()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def _write_metadata(self) -> None:
        (self.runtime / "electron-runtime-build.json").write_text(
            json.dumps(self.metadata), encoding="utf-8"
        )

    def verify(self) -> dict[str, object]:
        return verify_runtime_template(
            self.runtime,
            expected_app_version="0.4.0",
            expected_source_revision="a" * 40,
            expected_delivery_release_id="release-test-v1",
        )

    def test_valid_runtime_and_empty_current_user_schema_pass(self) -> None:
        self.assertTrue(self.verify()["verified"])

    def test_runtime_content_tamper_fails_fingerprint_recalculation(self) -> None:
        (self.runtime / "_internal" / "runtime.dll").write_bytes(b"tampered")
        with self.assertRaisesRegex(ValueError, "Runtime fingerprint mismatch"):
            self.verify()

    def test_user_database_schema_version_mismatch_fails(self) -> None:
        user_db = self.runtime / "data" / "user" / "sapd_wiki_user.sqlite3"
        with closing(sqlite3.connect(user_db)) as connection, connection:
            connection.execute(
                "UPDATE user_meta SET value='obsolete' WHERE key='schema_version'"
            )
        with self.assertRaisesRegex(ValueError, "current-schema seed"):
            self.verify()

    def test_populated_user_business_table_fails(self) -> None:
        user_db = self.runtime / "data" / "user" / "sapd_wiki_user.sqlite3"
        with closing(sqlite3.connect(user_db)) as connection, connection:
            connection.execute(
                "INSERT INTO user_favorites(id, target_ref) VALUES ('x', 'base:x')"
            )
        with self.assertRaisesRegex(ValueError, "current-schema seed"):
            self.verify()

    def test_unexpected_user_metadata_rows_fail(self) -> None:
        user_db = self.runtime / "data" / "user" / "sapd_wiki_user.sqlite3"
        with closing(sqlite3.connect(user_db)) as connection, connection:
            connection.execute(
                "INSERT INTO user_meta(key, value) VALUES ('unexpected', 'value')"
            )
        with self.assertRaisesRegex(ValueError, "current-schema seed"):
            self.verify()

    def test_runtime_app_version_mismatch_fails(self) -> None:
        self.metadata["appVersion"] = "0.3.9"
        self._write_metadata()
        with self.assertRaisesRegex(ValueError, "app version mismatch"):
            self.verify()

    def test_delivery_manifest_app_version_mismatch_fails(self) -> None:
        (self.runtime / "data" / "base" / "base-manifest.json").write_text(
            json.dumps({"app_version": "0.3.9"}), encoding="utf-8"
        )
        with self.assertRaisesRegex(ValueError, "Delivery manifest app version mismatch"):
            self.verify()

    def test_embedded_delivery_manifest_identity_mismatch_fails(self) -> None:
        manifest_path = (
            self.runtime / "data" / "base" / "windows-delivery-data-manifest.json"
        )
        manifest_path.write_text(
            json.dumps(
                {
                    "schemaVersion": "sapd-windows-delivery-data-v1",
                    "releaseId": "other-release",
                }
            ),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "embedded Delivery manifest mismatch"):
            self.verify()
