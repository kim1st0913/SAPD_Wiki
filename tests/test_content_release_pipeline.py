from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "publish_content_release",
    ROOT / "scripts/publish_content_release.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class ContentReleasePipelineTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="sapd-content-release-")
        self.root = Path(self.temp.name)
        self.original_release_root = MODULE.RELEASE_ROOT
        MODULE.RELEASE_ROOT = (self.root / "releases").resolve()

    def tearDown(self) -> None:
        MODULE.RELEASE_ROOT = self.original_release_root
        self.temp.cleanup()

    def sqlite_file(self, path: Path, statements: list[str]) -> Path:
        with sqlite3.connect(path) as connection:
            for statement in statements:
                connection.execute(statement)
        return path

    def test_prepare_is_idempotent_and_parent_is_compare_and_swap_bound(self) -> None:
        formal_query = self.sqlite_file(
            self.root / "formal-query.sqlite3",
            ["CREATE TABLE marker(id TEXT PRIMARY KEY)"],
        )
        formal_asset = self.sqlite_file(
            self.root / "formal-asset.sqlite3",
            [
                """
                CREATE TABLE content_assets(
                  asset_hash TEXT PRIMARY KEY,
                  content_bytes BLOB NOT NULL
                )
                """
            ],
        )
        user_database = self.root / "user.sqlite3"
        user_database.write_bytes(b"user-sentinel")
        content_manifest = self.root / "content.json"
        ocr_review = self.root / "ocr.json"
        query_schema = self.root / "query.sql"
        asset_schema = self.root / "asset.sql"
        content_manifest.write_text(
            '{"status":"t0_frozen","documents":[]}\n',
            encoding="utf-8",
        )
        ocr_review.write_text('{"status":"approved"}\n', encoding="utf-8")
        query_schema.write_text("-- query\n", encoding="utf-8")
        asset_schema.write_text("-- asset\n", encoding="utf-8")
        release_manifest = self.root / "release.json"
        release_manifest.write_text(
            json.dumps(
                {
                    "schema_version": "content-release-manifest-v2",
                    "status": "approved",
                    "content_manifest": str(content_manifest),
                    "ocr_review": str(ocr_review),
                    "query_schema": str(query_schema),
                    "asset_schema": str(asset_schema),
                    "policy": {
                        "build_mode": "full-expected-snapshot-from-current-parent",
                        "stable_ref_removal_default": "block",
                        "parser_or_format_change_default": "block",
                        "manual_content_bindings": "preserve",
                        "poster_ocr_forbidden": True,
                        "formal_apply_requires_dynamic_confirmation": True,
                        "real_user_database_write": "forbidden",
                    },
                    "approval": {
                        "status": "approved",
                        "approved_inputs_only": True,
                        "approved_import_jobs": [],
                    },
                }
            ),
            encoding="utf-8",
        )
        args = argparse.Namespace(
            manifest=str(release_manifest),
            formal_query=str(formal_query),
            formal_asset=str(formal_asset),
            user_database=str(user_database),
        )
        first = MODULE.prepare(args)
        second = MODULE.prepare(args)
        self.assertEqual(first["release_id"], second["release_id"])
        self.assertEqual(first["status"], "prepared")
        self.assertNotEqual(
            first["paths"]["content_manifest"],
            str(content_manifest),
        )
        content_manifest.write_text('{"changed": true}\n', encoding="utf-8")
        MODULE.ensure_inputs_unchanged(first)
        Path(first["paths"]["content_manifest"]).write_text(
            '{"tampered": true}\n',
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "INPUT_CHANGED_CONTENT_MANIFEST"):
            MODULE.ensure_inputs_unchanged(first)

        with formal_query.open("ab") as handle:
            handle.write(b"stale")
        with self.assertRaisesRegex(ValueError, "STALE_PARENT_QUERY"):
            MODULE.ensure_parent_unchanged(first)

    def test_logical_diff_reports_added_changed_and_removed(self) -> None:
        before = {
            "content_documents": {
                "same": "digest-a",
                "changed": "digest-before",
                "removed": "digest-r",
            }
        }
        after = {
            "content_documents": {
                "same": "digest-a",
                "changed": "digest-after",
                "added": "digest-new",
            }
        }
        diff = MODULE.logical_diff(before, after)["content_documents"]
        self.assertEqual(diff["added"], ["added"])
        self.assertEqual(diff["changed"], ["changed"])
        self.assertEqual(diff["removed"], ["removed"])

    def test_apply_and_rollback_preserve_user_database(self) -> None:
        formal_query = self.sqlite_file(
            self.root / "formal-query.sqlite3",
            [
                "CREATE TABLE marker(id TEXT PRIMARY KEY)",
                "INSERT INTO marker VALUES ('parent')",
            ],
        )
        candidate_query = self.sqlite_file(
            self.root / "candidate-query.sqlite3",
            [
                "CREATE TABLE marker(id TEXT PRIMARY KEY)",
                "INSERT INTO marker VALUES ('candidate')",
            ],
        )
        parent_payload = b"parent-asset"
        candidate_payload = b"candidate-asset"
        parent_hash = hashlib.sha256(parent_payload).hexdigest()
        candidate_hash = hashlib.sha256(candidate_payload).hexdigest()
        formal_asset = self.sqlite_file(
            self.root / "formal-asset.sqlite3",
            [
                """
                CREATE TABLE content_assets(
                  asset_hash TEXT PRIMARY KEY,
                  content_bytes BLOB NOT NULL
                )
                """,
            ],
        )
        candidate_asset = self.sqlite_file(
            self.root / "candidate-asset.sqlite3",
            [
                """
                CREATE TABLE content_assets(
                  asset_hash TEXT PRIMARY KEY,
                  content_bytes BLOB NOT NULL
                )
                """,
            ],
        )
        with sqlite3.connect(formal_asset) as connection:
            connection.execute(
                "INSERT INTO content_assets VALUES (?, ?)",
                (parent_hash, parent_payload),
            )
        with sqlite3.connect(candidate_asset) as connection:
            connection.execute(
                "INSERT INTO content_assets VALUES (?, ?)",
                (candidate_hash, candidate_payload),
            )
        user_database = self.root / "user.sqlite3"
        user_database.write_bytes(b"user-sentinel")
        user_before = MODULE.file_state(user_database)
        release_id = "a" * 64
        run_dir = MODULE.bounded_release_dir(release_id)
        run_dir.mkdir(parents=True)
        immutable_inputs = {}
        for key, suffix in (
            ("release_manifest", ".json"),
            ("content_manifest", ".json"),
            ("ocr_review", ".json"),
            ("query_schema", ".sql"),
            ("asset_schema", ".sql"),
        ):
            path = self.root / f"{key}{suffix}"
            path.write_text(f"{key}\n", encoding="utf-8")
            immutable_inputs[key] = path
        candidate = {
            "query_sha256": sha256_file(candidate_query),
            "asset_sha256": sha256_file(candidate_asset),
        }
        state = {
            "schema_version": "content-release-state-v2",
            "release_id": release_id,
            "status": "gated",
            "inputs": {
                "parent_query_sha256": sha256_file(formal_query),
                "parent_asset_sha256": sha256_file(formal_asset),
                "release_manifest_sha256": sha256_file(
                    immutable_inputs["release_manifest"]
                ),
                "content_manifest_sha256": sha256_file(
                    immutable_inputs["content_manifest"]
                ),
                "ocr_review_sha256": sha256_file(immutable_inputs["ocr_review"]),
                "query_schema_sha256": sha256_file(
                    immutable_inputs["query_schema"]
                ),
                "asset_schema_sha256": sha256_file(
                    immutable_inputs["asset_schema"]
                ),
                "importer_sha256": sha256_file(MODULE.BUILDER),
                "publisher_sha256": sha256_file(MODULE.PUBLISHER),
            },
            "paths": {
                "formal_query": str(formal_query),
                "formal_asset": str(formal_asset),
                "candidate_query": str(candidate_query),
                "candidate_asset": str(candidate_asset),
                "user_database": str(user_database),
                **{
                    key: str(path)
                    for key, path in immutable_inputs.items()
                },
            },
            "build": {"candidate": candidate},
            "verification": {"result": "pass", "candidate": candidate},
            "user_database_before": user_before,
        }
        MODULE.atomic_write_json(run_dir / "release-state.json", state)

        applied = MODULE.apply_release(
            argparse.Namespace(
                release_id=release_id,
                confirm=f"APPLY_CONTENT_RELEASE_{release_id}",
            )
        )
        self.assertEqual(applied["status"], "applied")
        self.assertEqual(sha256_file(formal_query), sha256_file(candidate_query))
        self.assertEqual(sha256_file(formal_asset), sha256_file(candidate_asset))
        self.assertEqual(MODULE.file_state(user_database), user_before)

        newer_query = self.root / "newer-query.sqlite3"
        newer_asset = self.root / "newer-asset.sqlite3"
        newer_query.write_bytes(b"newer-query")
        newer_asset.write_bytes(b"newer-asset")
        MODULE.atomic_copy(
            newer_query,
            formal_query,
            sha256_file(newer_query),
        )
        MODULE.atomic_copy(
            newer_asset,
            formal_asset,
            sha256_file(newer_asset),
        )
        with self.assertRaisesRegex(ValueError, "STALE_NEWER_RELEASE"):
            MODULE.rollback(
                argparse.Namespace(
                    release_id=release_id,
                    confirm=f"RESTORE_CONTENT_RELEASE_{release_id}",
                )
            )
        self.assertEqual(sha256_file(formal_query), sha256_file(newer_query))
        self.assertEqual(sha256_file(formal_asset), sha256_file(newer_asset))
        MODULE.atomic_copy(
            candidate_query,
            formal_query,
            sha256_file(candidate_query),
        )
        MODULE.atomic_copy(
            candidate_asset,
            formal_asset,
            sha256_file(candidate_asset),
        )
        rolled_back = MODULE.rollback(
            argparse.Namespace(
                release_id=release_id,
                confirm=f"RESTORE_CONTENT_RELEASE_{release_id}",
            )
        )
        self.assertEqual(rolled_back["status"], "rolled_back")
        self.assertEqual(
            sha256_file(formal_query),
            state["inputs"]["parent_query_sha256"],
        )
        self.assertEqual(
            sha256_file(formal_asset),
            state["inputs"]["parent_asset_sha256"],
        )
        self.assertEqual(MODULE.file_state(user_database), user_before)

    def test_atomic_json_fsyncs_parent_directory(self) -> None:
        output = self.root / "state.json"
        with mock.patch.object(MODULE, "fsync_directory") as fsync:
            MODULE.atomic_write_json(output, {"status": "prepared"})
        fsync.assert_called_once_with(output.parent)

    def test_release_bound_mcp_evidence_is_fail_closed(self) -> None:
        state = {
            "release_id": "b" * 64,
            "build": {
                "candidate": {
                    "query_sha256": "q" * 64,
                    "asset_sha256": "a" * 64,
                }
            },
        }
        tools = {
            name: {"result": "pass", "result_count": 1}
            for name in (
                "search_knowledge",
                "get_knowledge_object",
                "get_related_knowledge",
                "get_source_evidence",
                "get_knowledge_version",
            )
        }
        evidence = {
            "schema_version": "content-release-mcp-five-tools-v1",
            "result": "pass",
            "release_id": state["release_id"],
            "query_sha256": "q" * 64,
            "asset_sha256": "a" * 64,
            "runtime_id": "runtime-1",
            "client_id": "client-1",
            "observed_at": "2026-07-27T00:00:00Z",
            "tool_results": tools,
        }
        MODULE.validate_mcp_evidence(evidence, state)
        evidence["release_id"] = "c" * 64
        with self.assertRaisesRegex(ValueError, "not bound"):
            MODULE.validate_mcp_evidence(evidence, state)

if __name__ == "__main__":
    unittest.main()
