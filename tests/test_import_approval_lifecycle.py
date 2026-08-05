from __future__ import annotations

import hashlib
import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from sapd_wiki.db import connect, run_migrations
from sapd_wiki.exports import export_second_batch_summary
from sapd_wiki.import_lifecycle import (
    ImportFinalizeError,
    finalize_import,
    require_project_database_write_permission,
)
from sapd_wiki.paths import DEFAULT_DB_PATH
from sapd_wiki.loader import ImportApprovalError, approve_import


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class ImportApprovalLifecycleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="sapd-import-lifecycle-")
        self.root = Path(self.temp.name)
        self.db_path = self.root / "base.sqlite3"
        self.user_path = self.root / "user.sqlite3"
        self.user_path.write_bytes(b"user-data-sentinel")
        self.user_hash = file_hash(self.user_path)
        run_migrations(self.db_path)
        self.source_file_id = "source-1"
        with closing(connect(self.db_path)) as connection, connection:
            connection.execute(
                """
                INSERT INTO source_files (
                  id, file_name, file_type, file_path, file_hash, file_size,
                  usage_policy, sensitive_level, status
                )
                VALUES (?, 'source.xlsx', 'xlsx', 'source.xlsx', 'hash-1', 10,
                        'import_source', 'internal', 'active')
                """,
                (self.source_file_id,),
            )

    def tearDown(self) -> None:
        self.assertEqual(file_hash(self.user_path), self.user_hash)
        self.temp.cleanup()

    def create_job(
        self,
        *,
        status: str = "reviewing",
        source_cell: str = "A1",
        raw_value: str = "Alpha",
        with_item: bool = True,
    ) -> str:
        job_id = str(uuid.uuid4())
        with closing(connect(self.db_path)) as connection, connection:
            connection.execute(
                """
                INSERT INTO import_jobs (
                  id, source_file_id, job_type, status, summary_json
                )
                VALUES (?, ?, 'reimport', ?, ?)
                """,
                (
                    job_id,
                    self.source_file_id,
                    status,
                    json.dumps(
                        {
                            "selected_sheets": ["Sheet1"],
                            "stage_summary": {"validations": []},
                        }
                    ),
                ),
            )
            if with_item:
                connection.execute(
                    """
                    INSERT INTO staging_items (
                      id, import_job_id, proposed_action, matched_item_id,
                      type, code, title, description, metadata_json,
                      source_reference_json, validation_status
                    )
                    VALUES (?, ?, 'create', NULL, 'test_type', 'T-1',
                            'Alpha', 'Description', ?, ?, 'ok')
                    """,
                    (
                        f"staging-{job_id}",
                        job_id,
                        json.dumps({"object_key": "test_type::T-1::Alpha"}),
                        json.dumps(
                            [
                                {
                                    "source_sheet": "Sheet1",
                                    "source_row": 1,
                                    "source_column": "A",
                                    "source_cell": source_cell,
                                    "raw_value": raw_value,
                                }
                            ]
                        ),
                    ),
                )
        return job_id

    def create_stable_identity_job(self) -> str:
        job_id = self.create_job(with_item=False)
        with closing(connect(self.db_path)) as connection, connection:
            connection.executemany(
                """
                INSERT INTO staging_items (
                  id, import_job_id, proposed_action, matched_item_id,
                  type, code, title, description, metadata_json,
                  source_reference_json, validation_status
                ) VALUES (?, ?, 'create', NULL, 'test_type', ?, ?, ?, ?, ?, 'ok')
                """,
                [
                    (
                        f"{job_id}-source",
                        job_id,
                        "T-SOURCE",
                        "Source",
                        "Source description",
                        json.dumps(
                            {
                                "stable_key": "test_type:T-SOURCE",
                                "object_key": "test_type::T-SOURCE::Source",
                            }
                        ),
                        json.dumps(
                            [
                                {
                                    "source_sheet": "Sheet1",
                                    "source_row": 1,
                                    "source_column": "A",
                                    "source_cell": "A1",
                                    "raw_value": "Source",
                                }
                            ]
                        ),
                    ),
                    (
                        f"{job_id}-target",
                        job_id,
                        "T-TARGET",
                        "Target",
                        "Target description",
                        json.dumps(
                            {
                                "stable_key": "test_type:T-TARGET",
                                "object_key": "test_type::T-TARGET::Target",
                            }
                        ),
                        json.dumps(
                            [
                                {
                                    "source_sheet": "Sheet1",
                                    "source_row": 2,
                                    "source_column": "A",
                                    "source_cell": "A2",
                                    "raw_value": "Target",
                                }
                            ]
                        ),
                    ),
                ],
            )
            connection.execute(
                """
                INSERT INTO staging_relations (
                  id, import_job_id, proposed_action, matched_relation_id,
                  source_item_key, target_item_key, relation_type,
                  metadata_json, source_reference_json, validation_status
                ) VALUES (?, ?, 'create', NULL, ?, ?, 'supports', ?, ?, 'ok')
                """,
                (
                    f"{job_id}-relation",
                    job_id,
                    "test_type::T-SOURCE::Source",
                    "test_type::T-TARGET::Target",
                    json.dumps({"stable_key": "T-SOURCE:supports:T-TARGET"}),
                    json.dumps(
                        [
                            {
                                "source_sheet": "Sheet1",
                                "source_row": 3,
                                "source_column": "B",
                                "source_cell": "B3",
                                "raw_value": "Source supports Target",
                            }
                        ]
                    ),
                ),
            )
        return job_id

    def table_counts(self) -> dict[str, int]:
        with closing(connect(self.db_path)) as connection, connection:
            return {
                table: connection.execute(
                    f"SELECT COUNT(*) FROM {table}"
                ).fetchone()[0]
                for table in (
                    "knowledge_items",
                    "knowledge_relations",
                    "source_references",
                    "change_logs",
                    "review_decisions",
                )
            }

    def job_status(self, job_id: str) -> str:
        with closing(connect(self.db_path)) as connection, connection:
            return connection.execute(
                "SELECT status FROM import_jobs WHERE id = ?",
                (job_id,),
            ).fetchone()["status"]

    def test_duplicate_approval_is_rejected_without_second_write(self) -> None:
        job_id = self.create_job()
        with closing(connect(self.db_path)) as connection, connection:
            summary = approve_import(connection, job_id)
        self.assertEqual(summary.items_created, 1)
        self.assertEqual(summary.source_references_created, 1)
        self.assertEqual(summary.source_references_reused, 0)
        before = self.table_counts()

        with closing(connect(self.db_path)) as connection, connection:
            with self.assertRaisesRegex(
                ImportApprovalError,
                "IMPORT_ALREADY_APPROVED",
            ):
                approve_import(connection, job_id)
        self.assertEqual(self.table_counts(), before)

    def test_new_import_assigns_stable_identity_and_reimport_keeps_it(self) -> None:
        first_job = self.create_stable_identity_job()
        with closing(connect(self.db_path)) as connection, connection:
            first = approve_import(connection, first_job)
            first_items = connection.execute(
                """
                SELECT id, code, stable_key, stable_ref, public_id
                FROM knowledge_items ORDER BY code
                """
            ).fetchall()
            first_relation = connection.execute(
                """
                SELECT id, stable_key, stable_ref, public_id
                FROM knowledge_relations
                """
            ).fetchone()

        self.assertEqual(first.items_created, 2)
        self.assertEqual(first.relations_created, 1)
        expected_item_refs = {
            "T-SOURCE": "base:test_type:test_type:T-SOURCE",
            "T-TARGET": "base:test_type:test_type:T-TARGET",
        }
        for item in first_items:
            stable_ref = expected_item_refs[item["code"]]
            self.assertEqual(item["stable_key"], f"test_type:{item['code']}")
            self.assertEqual(item["stable_ref"], stable_ref)
            self.assertEqual(
                item["public_id"],
                f"ki_{hashlib.sha256(stable_ref.encode('utf-8')).hexdigest()[:16]}",
            )
        expected_relation_ref = "base_relation:supports:T-SOURCE:supports:T-TARGET"
        self.assertEqual(first_relation["stable_key"], "T-SOURCE:supports:T-TARGET")
        self.assertEqual(first_relation["stable_ref"], expected_relation_ref)
        self.assertEqual(
            first_relation["public_id"],
            f"kr_{hashlib.sha256(expected_relation_ref.encode('utf-8')).hexdigest()[:16]}",
        )

        identity_before = {
            "items": [tuple(row) for row in first_items],
            "relation": tuple(first_relation),
        }
        repeated_job = self.create_stable_identity_job()
        with closing(connect(self.db_path)) as connection, connection:
            repeated = approve_import(connection, repeated_job)
            identity_after = {
                "items": [
                    tuple(row)
                    for row in connection.execute(
                        """
                        SELECT id, code, stable_key, stable_ref, public_id
                        FROM knowledge_items ORDER BY code
                        """
                    ).fetchall()
                ],
                "relation": tuple(
                    connection.execute(
                        """
                        SELECT id, stable_key, stable_ref, public_id
                        FROM knowledge_relations
                        """
                    ).fetchone()
                ),
            }

        self.assertEqual(repeated.items_created, 0)
        self.assertEqual(repeated.items_updated, 2)
        self.assertEqual(repeated.relations_created, 0)
        self.assertEqual(repeated.source_references_created, 0)
        self.assertEqual(repeated.source_references_reused, 3)
        self.assertEqual(identity_after, identity_before)

    def test_stable_identity_insert_failure_rolls_back_entire_approval(self) -> None:
        job_id = self.create_stable_identity_job()
        with closing(connect(self.db_path)) as connection, connection:
            connection.execute(
                """
                CREATE TRIGGER reject_relation_stable_identity
                BEFORE INSERT ON knowledge_relations
                WHEN NEW.stable_ref IS NOT NULL
                BEGIN
                  SELECT RAISE(ABORT, 'injected stable identity failure');
                END
                """
            )

        with closing(connect(self.db_path)) as connection, connection:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "injected stable identity failure"):
                approve_import(connection, job_id)

        self.assertEqual(self.job_status(job_id), "reviewing")
        self.assertEqual(
            self.table_counts(),
            {
                "knowledge_items": 0,
                "knowledge_relations": 0,
                "source_references": 0,
                "change_logs": 0,
                "review_decisions": 0,
            },
        )

    def test_wrong_states_and_missing_job_are_rejected(self) -> None:
        cases = {
            "pending": "IMPORT_NOT_STAGED",
            "parsed": "IMPORT_NOT_STAGED",
            "rejected": "IMPORT_JOB_CLOSED",
            "failed": "IMPORT_JOB_CLOSED",
        }
        for status, code in cases.items():
            job_id = self.create_job(status=status, with_item=False)
            with self.subTest(status=status), closing(connect(self.db_path)) as connection, connection:
                with self.assertRaisesRegex(ImportApprovalError, code):
                    approve_import(connection, job_id)
        with closing(connect(self.db_path)) as connection, connection:
            with self.assertRaisesRegex(
                ImportApprovalError,
                "IMPORT_JOB_NOT_FOUND",
            ):
                approve_import(connection, "missing")

    def test_concurrent_approval_only_commits_once(self) -> None:
        job_id = self.create_job()

        def approve_once() -> str:
            with closing(connect(self.db_path)) as connection, connection:
                try:
                    approve_import(connection, job_id)
                    return "approved"
                except ImportApprovalError as error:
                    return error.code

        with ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(lambda _index: approve_once(), range(2)))
        self.assertCountEqual(
            results,
            ["approved", "IMPORT_ALREADY_APPROVED"],
        )
        self.assertEqual(self.table_counts()["source_references"], 1)
        self.assertEqual(self.table_counts()["change_logs"], 1)

    def test_approval_failure_rolls_back_and_keeps_reviewing(self) -> None:
        job_id = self.create_job()
        with closing(connect(self.db_path)) as connection, connection:
            connection.execute(
                """
                CREATE TRIGGER reject_source_reference
                BEFORE INSERT ON source_references
                BEGIN
                  SELECT RAISE(ABORT, 'injected failure');
                END
                """
            )
        with closing(connect(self.db_path)) as connection, connection:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "injected failure"):
                approve_import(connection, job_id)
        self.assertEqual(self.job_status(job_id), "reviewing")
        self.assertEqual(
            self.table_counts(),
            {
                "knowledge_items": 0,
                "knowledge_relations": 0,
                "source_references": 0,
                "change_logs": 0,
                "review_decisions": 0,
            },
        )

    def test_source_reference_full_evidence_key_is_reused(self) -> None:
        first = self.create_job()
        with closing(connect(self.db_path)) as connection, connection:
            approve_import(connection, first)

        same = self.create_job()
        with closing(connect(self.db_path)) as connection, connection:
            summary = approve_import(connection, same)
        self.assertEqual(summary.source_references_created, 0)
        self.assertEqual(summary.source_references_reused, 1)
        self.assertEqual(self.table_counts()["source_references"], 1)

        changed = self.create_job(source_cell="B1")
        with closing(connect(self.db_path)) as connection, connection:
            summary = approve_import(connection, changed)
        self.assertEqual(summary.source_references_created, 1)
        self.assertEqual(summary.source_references_reused, 0)
        self.assertEqual(self.table_counts()["source_references"], 2)

    def test_empty_selected_sheet_deprecates_its_last_item_type(self) -> None:
        job_id = self.create_job(with_item=False)
        with closing(connect(self.db_path)) as connection, connection:
            connection.execute(
                """
                INSERT INTO knowledge_items (
                  id, type, code, title, status, source_file_id, source_hash, metadata_json
                ) VALUES ('removed-item', 'removed_type', 'R-1', 'Removed item',
                          'active', ?, ?, '{}')
                """,
                (self.source_file_id, self.user_hash),
            )
            connection.execute(
                """
                INSERT INTO source_references (
                  id, target_type, target_id, source_file_id, source_sheet,
                  source_row, source_column, source_cell, raw_value, source_hash
                ) VALUES ('removed-item-ref', 'item', 'removed-item', ?,
                          'Sheet1', 1, 'A', 'A1', 'removed', ?)
                """,
                (self.source_file_id, self.user_hash),
            )
            connection.commit()
            summary = approve_import(connection, job_id)
            item = connection.execute(
                "SELECT status FROM knowledge_items WHERE id = 'removed-item'"
            ).fetchone()

        self.assertEqual(summary.items_deprecated, 1)
        self.assertEqual(item["status"], "deprecated")

    def test_unresolved_staging_relation_does_not_delete_existing_relation(self) -> None:
        job_id = self.create_job()
        with closing(connect(self.db_path)) as connection, connection:
            connection.execute(
                """
                INSERT INTO knowledge_items (
                  id, type, code, title, status, source_file_id, source_hash, metadata_json
                ) VALUES ('existing-target', 'test_type', 'T-2', 'Existing target',
                          'active', ?, 'hash-1', ?)
                """,
                (
                    self.source_file_id,
                    json.dumps({"object_key": "test_type::T-2::Existing target"}),
                ),
            )
            connection.execute(
                """
                INSERT INTO knowledge_relations (
                  id, source_item_id, target_item_id, relation_type,
                  confidence, source_file_id, import_job_id, metadata_json
                ) VALUES ('existing-relation', 'existing-target', 'existing-target',
                          'supports', 'exact', ?, ?, '{}')
                """,
                (self.source_file_id, job_id),
            )
            connection.execute(
                """
                INSERT INTO source_references (
                  id, target_type, target_id, source_file_id, source_sheet,
                  source_row, source_column, source_cell, raw_value, source_hash
                ) VALUES ('existing-relation-ref', 'relation', 'existing-relation', ?,
                          'Sheet1', 1, 'A', 'A1', 'existing relation', 'hash-1')
                """,
                (self.source_file_id,),
            )
            connection.execute(
                """
                INSERT INTO staging_relations (
                  id, import_job_id, proposed_action, matched_relation_id,
                  source_item_key, target_item_key, relation_type,
                  metadata_json, source_reference_json, validation_status
                ) VALUES (?, ?, 'create', NULL, ?, ?, 'supports', '{}', '[]', 'ok')
                """,
                (
                    f"staging-relation-{job_id}",
                    job_id,
                    "test_type::T-1::Alpha",
                    "test_type::missing::Missing endpoint",
                ),
            )
            connection.commit()
            summary = approve_import(connection, job_id)
            relation = connection.execute(
                "SELECT id FROM knowledge_relations WHERE id = 'existing-relation'"
            ).fetchone()
            source_ref = connection.execute(
                "SELECT id FROM source_references WHERE id = 'existing-relation-ref'"
            ).fetchone()
            decision = connection.execute(
                """
                SELECT decision FROM review_decisions
                WHERE import_job_id = ? AND staging_type = 'relation'
                """,
                (job_id,),
            ).fetchone()

        self.assertEqual(summary.relations_deleted, 0)
        self.assertIn("本次导入存在未解析关系，已跳过旧关系自动删除。", summary.warnings)
        self.assertIsNotNone(relation)
        self.assertIsNotNone(source_ref)
        self.assertEqual(decision["decision"], "needs_fix")

    def test_finalize_dry_run_apply_and_repeat(self) -> None:
        job_id = self.create_job()
        with closing(connect(self.db_path)) as connection, connection:
            approve_import(connection, job_id)
        before_hash = file_hash(self.db_path)
        dry_run = finalize_import(self.db_path, job_id)
        self.assertEqual(dry_run["mode"], "dry-run")
        self.assertEqual(dry_run["result"], "ready")
        self.assertEqual(
            dry_run["delete_counts"],
            {
                "review_decisions": 1,
                "staging_relations": 0,
                "staging_items": 1,
            },
        )
        self.assertEqual(file_hash(self.db_path), before_hash)

        formal_before = dry_run["formal_fingerprints"]
        applied = finalize_import(
            self.db_path,
            job_id,
            apply=True,
            output_root=self.root / "recovery",
        )
        self.assertEqual(applied["result"], "finalized")
        self.assertEqual(applied["formal_fingerprints"], formal_before)
        self.assertTrue(Path(applied["recovery"]["manifest"]).is_file())
        self.assertEqual(
            json.loads(
                Path(applied["recovery"]["manifest"]).read_text(encoding="utf-8")
            )["state"],
            "applied",
        )
        with closing(connect(self.db_path)) as connection, connection:
            counts = {
                table: connection.execute(
                    f"SELECT COUNT(*) FROM {table} WHERE import_job_id = ?",
                    (job_id,),
                ).fetchone()[0]
                for table in (
                    "review_decisions",
                    "staging_relations",
                    "staging_items",
                )
            }
            summary = json.loads(
                connection.execute(
                    "SELECT summary_json FROM import_jobs WHERE id = ?",
                    (job_id,),
                ).fetchone()["summary_json"]
            )
        self.assertEqual(counts, {key: 0 for key in counts})
        self.assertEqual(
            summary["import_lifecycle"]["intermediate_cleanup"]["status"],
            "completed",
        )

        with closing(connect(self.db_path)) as connection, connection:
            connection.execute(
                """
                INSERT INTO staging_items (
                  id, import_job_id, proposed_action, type, title,
                  metadata_json, source_reference_json, validation_status
                ) VALUES (?, ?, 'create', 'test', 'drift', '{}', '[]', 'ok')
                """,
                (f"drift-{job_id}", job_id),
            )
        with self.assertRaisesRegex(
            ImportFinalizeError,
            "IMPORT_FINALIZE_STATE_DRIFT",
        ):
            finalize_import(self.db_path, job_id)

        with closing(connect(self.db_path)) as connection, connection:
            connection.execute(
                "DELETE FROM staging_items WHERE import_job_id = ?",
                (job_id,),
            )
        repeated = finalize_import(
            self.db_path,
            job_id,
            apply=True,
            output_root=self.root / "recovery",
        )
        self.assertEqual(repeated["result"], "already_finalized")
        self.assertEqual(
            repeated["delete_counts"],
            {key: 0 for key in counts},
        )

    def test_finalize_failure_marks_recovery_package_rolled_back(self) -> None:
        job_id = self.create_job(status="rejected")
        with closing(connect(self.db_path)) as connection, connection:
            connection.execute(
                """
                CREATE TRIGGER reject_staging_delete
                BEFORE DELETE ON staging_items
                BEGIN
                  SELECT RAISE(ABORT, 'delete blocked');
                END
                """
            )
        output_root = self.root / "failed-recovery"
        with self.assertRaisesRegex(sqlite3.IntegrityError, "delete blocked"):
            finalize_import(
                self.db_path,
                job_id,
                apply=True,
                output_root=output_root,
            )
        manifests = list(output_root.rglob("manifest.json"))
        self.assertEqual(len(manifests), 1)
        self.assertEqual(
            json.loads(manifests[0].read_text(encoding="utf-8"))["state"],
            "rolled_back",
        )
        self.assertEqual(self.job_status(job_id), "rejected")

    def test_approve_cli_requires_explicit_real_database_write_flag(self) -> None:
        with self.assertRaisesRegex(ValueError, "--allow-project-db-write"):
            require_project_database_write_permission(
                DEFAULT_DB_PATH,
                allowed=False,
            )

    def test_finalize_rejects_open_job(self) -> None:
        for status in ("reviewing", "pending", "parsed"):
            job_id = self.create_job(status=status, with_item=False)
            with self.subTest(status=status):
                with self.assertRaisesRegex(
                    ImportFinalizeError,
                    "IMPORT_JOB_NOT_FINALIZABLE",
                ):
                    finalize_import(self.db_path, job_id)

    def test_default_second_batch_export_uses_latest_approved(self) -> None:
        approved = self.create_job(status="approved", with_item=False)
        rejected = self.create_job(status="rejected", with_item=False)
        with closing(connect(self.db_path)) as connection, connection:
            connection.execute(
                "UPDATE import_jobs SET finished_at = '2026-01-01 00:00:00' WHERE id = ?",
                (approved,),
            )
            connection.execute(
                "UPDATE import_jobs SET finished_at = '2026-01-02 00:00:00' WHERE id = ?",
                (rejected,),
            )
        output = self.root / "second-batch.json"
        with closing(connect(self.db_path)) as connection, connection:
            export_second_batch_summary(connection, output_path=output)
        payload = json.loads(output.read_text(encoding="utf-8"))
        self.assertEqual(payload["import_job_id"], approved)
        self.assertEqual(payload["job_status"], "approved")

        diagnostic = self.root / "rejected.json"
        with closing(connect(self.db_path)) as connection, connection:
            export_second_batch_summary(
                connection,
                output_path=diagnostic,
                import_job_id=rejected,
            )
        diagnostic_payload = json.loads(
            diagnostic.read_text(encoding="utf-8")
        )
        self.assertEqual(diagnostic_payload["job_status"], "rejected")

    def test_default_export_fails_when_no_job_is_approved(self) -> None:
        job_id = self.create_job(status="rejected", with_item=False)
        self.assertTrue(job_id)
        output = self.root / "should-not-exist" / "summary.json"
        with closing(connect(self.db_path)) as connection, connection:
            with self.assertRaisesRegex(ValueError, "NO_APPROVED_IMPORT_JOB"):
                export_second_batch_summary(connection, output_path=output)
        self.assertFalse(output.parent.exists())


if __name__ == "__main__":
    unittest.main()
