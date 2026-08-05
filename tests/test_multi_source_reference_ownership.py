from __future__ import annotations

import json
import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from sapd_wiki.db import connect, run_migrations
from sapd_wiki.exports import _combine_sources, _source_reference_map, _wb_source_ref
from sapd_wiki.import_lifecycle import finalize_import
from sapd_wiki.loader import _delete_stale_relations, _deprecate_stale_items, approve_import
from sapd_wiki.source_files import register_source_file


class MultiSourceReferenceOwnershipTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="sapd-multi-source-")
        self.db_path = Path(self.temp.name) / "base.sqlite3"
        run_migrations(self.db_path)
        with closing(connect(self.db_path)) as connection, connection:
            connection.executemany(
                """
                INSERT INTO source_files (
                  id, file_name, file_type, file_path, file_hash, file_size,
                  usage_policy, sensitive_level, status
                ) VALUES (?, ?, 'xlsx', ?, ?, 10, 'import_source', 'internal', 'active')
                """,
                [
                    ("source-a", "source-a.xlsx", "source-a.xlsx", "hash-a"),
                    ("source-b", "source-b.xlsx", "source-b.xlsx", "hash-b"),
                ],
            )
            connection.execute(
                """
                INSERT INTO import_jobs (id, source_file_id, job_type, status, summary_json)
                VALUES ('job-a', 'source-a', 'reimport', 'reviewing', '{}')
                """
            )

    def tearDown(self) -> None:
        self.temp.cleanup()

    @staticmethod
    def _insert_item(
        connection,
        *,
        item_id: str,
        code: str,
        title: str,
        source_file_id: str,
        source_hash: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO knowledge_items (
              id, type, code, title, status, source_file_id, source_hash, metadata_json
            ) VALUES (?, 'test_type', ?, ?, 'active', ?, ?, '{}')
            """,
            (item_id, code, title, source_file_id, source_hash),
        )

    @staticmethod
    def _insert_reference(
        connection,
        *,
        reference_id: str,
        target_type: str,
        target_id: str,
        source_file_id: str,
        source_sheet: str,
        source_hash: str,
    ) -> None:
        connection.execute(
            """
            INSERT INTO source_references (
              id, target_type, target_id, source_file_id, source_sheet,
              source_row, source_column, source_cell, raw_value, source_hash
            ) VALUES (?, ?, ?, ?, ?, 1, 'A', ?, ?, ?)
            """,
            (
                reference_id,
                target_type,
                target_id,
                source_file_id,
                source_sheet,
                reference_id,
                reference_id,
                source_hash,
            ),
        )

    def test_export_validates_each_reference_against_its_own_source_file(self) -> None:
        with closing(connect(self.db_path)) as connection, connection:
            self._insert_item(
                connection,
                item_id="item-multi",
                code="T-1",
                title="Multi",
                source_file_id="source-a",
                source_hash="hash-a",
            )
            self._insert_item(
                connection,
                item_id="item-target",
                code="T-2",
                title="Target",
                source_file_id="source-b",
                source_hash="hash-b",
            )
            connection.execute(
                """
                INSERT INTO knowledge_relations (
                  id, source_item_id, target_item_id, relation_type,
                  confidence, source_file_id, import_job_id, metadata_json
                ) VALUES (
                  'relation-multi', 'item-multi', 'item-target', 'supports',
                  'exact', 'source-a', 'job-a', '{}'
                )
                """
            )
            for target_type, target_id in (
                ("item", "item-multi"),
                ("relation", "relation-multi"),
            ):
                self._insert_reference(
                    connection,
                    reference_id=f"{target_type}-a",
                    target_type=target_type,
                    target_id=target_id,
                    source_file_id="source-a",
                    source_sheet="Source A",
                    source_hash="hash-a",
                )
                self._insert_reference(
                    connection,
                    reference_id=f"{target_type}-b",
                    target_type=target_type,
                    target_id=target_id,
                    source_file_id="source-b",
                    source_sheet="Source B",
                    source_hash="hash-b",
                )
                self._insert_reference(
                    connection,
                    reference_id=f"{target_type}-b-stale",
                    target_type=target_type,
                    target_id=target_id,
                    source_file_id="source-b",
                    source_sheet="Source B stale",
                    source_hash="old-hash-b",
                )

            item_refs = _source_reference_map(connection, "item")
            relation_refs = _source_reference_map(connection, "relation")

        self.assertEqual(
            {row["sheet"] for row in item_refs["item-multi"]},
            {"Source A", "Source B"},
        )
        self.assertEqual(
            {row["sheet"] for row in relation_refs["relation-multi"]},
            {"Source A", "Source B"},
        )

    def test_same_content_at_another_path_reuses_canonical_source_owner(self) -> None:
        first_path = Path(self.temp.name) / "first" / "source.xlsx"
        second_path = Path(self.temp.name) / "second" / "source.xlsx"
        first_path.parent.mkdir()
        second_path.parent.mkdir()
        first_path.write_bytes(b"same source content")
        second_path.write_bytes(b"same source content")

        with closing(connect(self.db_path)) as connection, connection:
            original = register_source_file(connection, first_path)
            repeated = register_source_file(connection, first_path)
            moved = register_source_file(connection, second_path)
            stored = connection.execute(
                "SELECT id, file_name, file_path FROM source_files WHERE id = ?",
                (original.id,),
            ).fetchone()

        self.assertFalse(repeated.created)
        self.assertFalse(moved.created)
        self.assertEqual(repeated.id, original.id)
        self.assertEqual(moved.id, original.id)
        self.assertEqual(stored["id"], original.id)
        self.assertEqual(stored["file_name"], first_path.name)
        self.assertEqual(stored["file_path"], str(first_path.resolve()))
        self.assertEqual(moved.file_path, str(first_path.resolve()))

    def test_export_deduplicates_only_the_complete_evidence_key(self) -> None:
        with closing(connect(self.db_path)) as connection, connection:
            self._insert_item(
                connection,
                item_id="item-duplicate-evidence",
                code="T-3",
                title="Duplicate Evidence",
                source_file_id="source-a",
                source_hash="hash-a",
            )
            connection.executemany(
                """
                INSERT INTO source_references (
                  id, target_type, target_id, source_file_id, source_sheet,
                  source_row, source_column, source_cell, raw_value, source_hash
                ) VALUES (?, 'item', 'item-duplicate-evidence', ?, 'Evidence', 7, 'B', 'B7', 'same', ?)
                """,
                [
                    ("same-visible-evidence-from-b", "source-b", "hash-b"),
                    ("duplicate-a-2", "source-a", "hash-a"),
                    ("duplicate-a-1", "source-a", "hash-a"),
                ],
            )
            refs = _source_reference_map(connection, "item")

        self.assertEqual(len(refs["item-duplicate-evidence"]), 2)
        self.assertEqual(
            [source["source_file_id"] for source in refs["item-duplicate-evidence"]],
            ["source-a", "source-b"],
        )
        self.assertEqual(
            {(source["source_file_id"], source["source_hash"]) for source in refs["item-duplicate-evidence"]},
            {("source-a", "hash-a"), ("source-b", "hash-b")},
        )
        combined = _combine_sources(refs["item-duplicate-evidence"], refs["item-duplicate-evidence"])
        self.assertEqual(len(combined), 2)
        self.assertEqual(len({_wb_source_ref(source) for source in combined}), 2)

    def test_reference_only_source_does_not_authorize_owner_handoff(self) -> None:
        with closing(connect(self.db_path)) as connection, connection:
            self._insert_item(
                connection,
                item_id="item-multi",
                code="T-1",
                title="Multi",
                source_file_id="source-a",
                source_hash="hash-a",
            )
            self._insert_item(
                connection,
                item_id="item-single",
                code="T-2",
                title="Single",
                source_file_id="source-a",
                source_hash="hash-a",
            )
            self._insert_item(
                connection,
                item_id="item-target",
                code="T-3",
                title="Target",
                source_file_id="source-b",
                source_hash="hash-b",
            )
            connection.executemany(
                """
                INSERT INTO knowledge_relations (
                  id, source_item_id, target_item_id, relation_type,
                  confidence, source_file_id, import_job_id, metadata_json
                ) VALUES (?, ?, 'item-target', ?, 'exact', 'source-a', 'job-a', '{}')
                """,
                [
                    ("relation-multi", "item-multi", "supports"),
                    ("relation-single", "item-single", "contains"),
                ],
            )
            for target_type, target_id in (
                ("item", "item-multi"),
                ("relation", "relation-multi"),
            ):
                self._insert_reference(
                    connection,
                    reference_id=f"{target_type}-multi-a",
                    target_type=target_type,
                    target_id=target_id,
                    source_file_id="source-a",
                    source_sheet="Sheet1",
                    source_hash="hash-a",
                )
                self._insert_reference(
                    connection,
                    reference_id=f"{target_type}-multi-b",
                    target_type=target_type,
                    target_id=target_id,
                    source_file_id="source-b",
                    source_sheet="Sheet B",
                    source_hash="hash-b",
                )
            for target_type, target_id in (
                ("item", "item-single"),
                ("relation", "relation-single"),
            ):
                self._insert_reference(
                    connection,
                    reference_id=f"{target_type}-single-a",
                    target_type=target_type,
                    target_id=target_id,
                    source_file_id="source-a",
                    source_sheet="Sheet1",
                    source_hash="hash-a",
                )

            relations_deleted = _delete_stale_relations(
                connection,
                import_job_id="job-a",
                source_file_id="source-a",
                source_file_path="source-a.xlsx",
                current_relation_keys={("current", "supports", "target")},
                source_sheets={"Sheet1"},
            )
            items_deprecated = _deprecate_stale_items(
                connection,
                import_job_id="job-a",
                source_file_id="source-a",
                source_file_path="source-a.xlsx",
                current_item_keys={"test_type::T-0::Current"},
                current_item_types={"test_type"},
                source_sheets={"Sheet1"},
            )

            item_rows = {
                row["id"]: row
                for row in connection.execute(
                    "SELECT id, status, source_file_id, source_hash FROM knowledge_items"
                ).fetchall()
            }
            relation_rows = {
                row["id"]: row
                for row in connection.execute(
                    "SELECT id, source_file_id FROM knowledge_relations"
                ).fetchall()
            }
            remaining_refs = {
                (row["target_type"], row["target_id"], row["source_file_id"])
                for row in connection.execute(
                    "SELECT target_type, target_id, source_file_id FROM source_references"
                ).fetchall()
            }
            owner_handoff_logs = {
                (row["target_type"], row["target_id"]): row["change_type"]
                for row in connection.execute(
                    """
                    SELECT target_type, target_id, change_type
                    FROM change_logs
                    WHERE import_job_id = 'job-a' AND change_type = 'update'
                    """
                ).fetchall()
            }

        self.assertEqual(relations_deleted, 1)
        self.assertEqual(items_deprecated, 1)
        self.assertEqual(item_rows["item-multi"]["status"], "active")
        self.assertEqual(item_rows["item-multi"]["source_file_id"], "source-a")
        self.assertEqual(item_rows["item-multi"]["source_hash"], "hash-a")
        self.assertEqual(item_rows["item-single"]["status"], "deprecated")
        self.assertEqual(relation_rows["relation-multi"]["source_file_id"], "source-a")
        self.assertNotIn("relation-single", relation_rows)
        self.assertIn(("item", "item-multi", "source-a"), remaining_refs)
        self.assertIn(("item", "item-multi", "source-b"), remaining_refs)
        self.assertIn(("relation", "relation-multi", "source-a"), remaining_refs)
        self.assertIn(("relation", "relation-multi", "source-b"), remaining_refs)
        self.assertIn(("item", "item-single", "source-a"), remaining_refs)
        self.assertNotIn(("relation", "relation-single", "source-a"), remaining_refs)
        self.assertEqual(owner_handoff_logs, {})

    def test_reimport_can_remove_the_last_relation_in_a_valid_sheet_scope(self) -> None:
        with closing(connect(self.db_path)) as connection, connection:
            self._insert_item(
                connection,
                item_id="item-source",
                code="T-10",
                title="Source",
                source_file_id="source-a",
                source_hash="hash-a",
            )
            self._insert_item(
                connection,
                item_id="item-target",
                code="T-11",
                title="Target",
                source_file_id="source-a",
                source_hash="hash-a",
            )
            connection.execute(
                """
                INSERT INTO knowledge_relations (
                  id, source_item_id, target_item_id, relation_type,
                  confidence, source_file_id, import_job_id, metadata_json
                ) VALUES (
                  'relation-last', 'item-source', 'item-target', 'supports',
                  'exact', 'source-a', 'job-a', '{}'
                )
                """
            )
            self._insert_reference(
                connection,
                reference_id="relation-last-a",
                target_type="relation",
                target_id="relation-last",
                source_file_id="source-a",
                source_sheet="Sheet1",
                source_hash="hash-a",
            )

            deleted = _delete_stale_relations(
                connection,
                import_job_id="job-a",
                source_file_id="source-a",
                source_file_path="source-a.xlsx",
                current_relation_keys=set(),
                source_sheets={"Sheet1"},
            )

            self.assertEqual(deleted, 1)
            self.assertIsNone(
                connection.execute(
                    "SELECT 1 FROM knowledge_relations WHERE id = 'relation-last'"
                ).fetchone()
            )
            self.assertIsNone(
                connection.execute(
                    "SELECT 1 FROM source_references WHERE target_id = 'relation-last'"
                ).fetchone()
            )

    def test_reimport_deprecates_a_type_removed_entirely_from_the_sheet(self) -> None:
        with closing(connect(self.db_path)) as connection, connection:
            self._insert_item(
                connection,
                item_id="item-kept",
                code="K-1",
                title="Kept",
                source_file_id="source-a",
                source_hash="hash-a",
            )
            connection.execute(
                "UPDATE knowledge_items SET type = 'kept_type' WHERE id = 'item-kept'"
            )
            self._insert_item(
                connection,
                item_id="item-removed",
                code="R-1",
                title="Removed",
                source_file_id="source-a",
                source_hash="hash-a",
            )
            connection.execute(
                "UPDATE knowledge_items SET type = 'removed_type' WHERE id = 'item-removed'"
            )
            self._insert_item(
                connection,
                item_id="item-shared",
                code="R-2",
                title="Shared",
                source_file_id="source-a",
                source_hash="hash-a",
            )
            connection.execute(
                "UPDATE knowledge_items SET type = 'removed_type' WHERE id = 'item-shared'"
            )
            for item_id in ("item-kept", "item-removed", "item-shared"):
                self._insert_reference(
                    connection,
                    reference_id=f"{item_id}-a",
                    target_type="item",
                    target_id=item_id,
                    source_file_id="source-a",
                    source_sheet="Sheet1",
                    source_hash="hash-a",
                )
            self._insert_reference(
                connection,
                reference_id="item-shared-b",
                target_type="item",
                target_id="item-shared",
                source_file_id="source-b",
                source_sheet="Sheet B",
                source_hash="hash-b",
            )

            deprecated = _deprecate_stale_items(
                connection,
                import_job_id="job-a",
                source_file_id="source-a",
                source_file_path="source-a.xlsx",
                current_item_keys={"kept_type::K-1::Kept"},
                current_item_types={"kept_type"},
                source_sheets={"Sheet1"},
            )
            rows = {
                row["id"]: row
                for row in connection.execute(
                    "SELECT id, status, source_file_id FROM knowledge_items"
                ).fetchall()
            }

        self.assertEqual(deprecated, 1)
        self.assertEqual(rows["item-kept"]["status"], "active")
        self.assertEqual(rows["item-removed"]["status"], "deprecated")
        self.assertEqual(rows["item-shared"]["status"], "active")
        self.assertEqual(rows["item-shared"]["source_file_id"], "source-a")


class G1SourceOwnershipRegressionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="sapd-g1-source-owner-")
        self.root = Path(self.temp.name)
        self.db_path = self.root / "base.sqlite3"
        run_migrations(self.db_path)
        self.source_a_path = self.root / "source-a.xlsx"
        self.source_b_path = self.root / "source-b.xlsx"
        self.source_a_path.write_bytes(b"source-a-complete-snapshot")
        self.source_b_path.write_bytes(b"source-b-complete-snapshot")
        with closing(connect(self.db_path)) as connection, connection:
            self.source_a = register_source_file(connection, self.source_a_path)
            self.source_b = register_source_file(connection, self.source_b_path)

    def tearDown(self) -> None:
        self.temp.cleanup()

    @staticmethod
    def _item_snapshot(prefix: str, *, suffix: str, matched_item_id: str | None = None) -> dict:
        object_key = f"test_type::{suffix}"
        return {
            "matched_item_id": matched_item_id,
            "type": "test_type",
            "code": suffix,
            "title": f"{prefix} title {suffix}",
            "description": f"{prefix} description {suffix}",
            "metadata": {
                "object_key": object_key,
                "category": f"{prefix} category",
                "origin": prefix,
                "business_payload": {"owner": prefix, "suffix": suffix},
            },
            "source_reference": {
                "source_sheet": "Sheet1",
                "source_row": 10 if suffix == "SOURCE" else 20,
                "source_column": "B",
                "source_cell": "B10" if suffix == "SOURCE" else "B20",
                "raw_value": f"{prefix} raw {suffix}",
            },
        }

    @staticmethod
    def _relation_snapshot(prefix: str, *, matched_relation_id: str | None = None) -> dict:
        return {
            "matched_relation_id": matched_relation_id,
            "source_item_key": "test_type::SOURCE",
            "target_item_key": "test_type::TARGET",
            "relation_type": "supports",
            "metadata": {
                "relation_label": f"{prefix} relation label",
                "confidence": "exact",
                "origin": prefix,
                "business_payload": {"owner": prefix},
            },
            "source_reference": {
                "source_sheet": "Sheet1",
                "source_row": 30,
                "source_column": "C",
                "source_cell": "C30",
                "raw_value": f"{prefix} raw relation",
            },
        }

    def _stage_job(
        self,
        connection,
        *,
        job_id: str,
        source_file_id: str,
        items: list[dict] | None = None,
        relations: list[dict] | None = None,
    ) -> None:
        connection.execute(
            """
            INSERT INTO import_jobs (id, source_file_id, job_type, status, summary_json)
            VALUES (?, ?, 'reimport', 'reviewing', ?)
            """,
            (
                job_id,
                source_file_id,
                json.dumps({"selected_sheets": ["Sheet1"], "stage_summary": {"validations": []}}),
            ),
        )
        for index, item in enumerate(items or []):
            connection.execute(
                """
                INSERT INTO staging_items (
                  id, import_job_id, proposed_action, matched_item_id, type, code,
                  title, description, metadata_json, source_reference_json,
                  validation_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok')
                """,
                (
                    f"{job_id}-item-{index}",
                    job_id,
                    "update" if item.get("matched_item_id") else "create",
                    item.get("matched_item_id"),
                    item["type"],
                    item["code"],
                    item["title"],
                    item["description"],
                    json.dumps(item["metadata"], ensure_ascii=False),
                    json.dumps([item["source_reference"]], ensure_ascii=False),
                ),
            )
        for index, relation in enumerate(relations or []):
            connection.execute(
                """
                INSERT INTO staging_relations (
                  id, import_job_id, proposed_action, matched_relation_id,
                  source_item_key, target_item_key, relation_type, metadata_json,
                  source_reference_json, validation_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ok')
                """,
                (
                    f"{job_id}-relation-{index}",
                    job_id,
                    "update" if relation.get("matched_relation_id") else "create",
                    relation.get("matched_relation_id"),
                    relation["source_item_key"],
                    relation["target_item_key"],
                    relation["relation_type"],
                    json.dumps(relation["metadata"], ensure_ascii=False),
                    json.dumps([relation["source_reference"]], ensure_ascii=False),
                ),
            )

    def _approve(self, job_id: str):
        with closing(connect(self.db_path)) as connection:
            return approve_import(connection, job_id)

    def _seed_complete_b_then_a(self) -> tuple[dict[str, str], str]:
        b_items = [
            self._item_snapshot("B", suffix="SOURCE"),
            self._item_snapshot("B", suffix="TARGET"),
        ]
        with closing(connect(self.db_path)) as connection, connection:
            self._stage_job(
                connection,
                job_id="job-b-full",
                source_file_id=self.source_b.id,
                items=b_items,
                relations=[self._relation_snapshot("B")],
            )
        self._approve("job-b-full")

        with closing(connect(self.db_path)) as connection:
            item_ids = {
                json.loads(row["metadata_json"])["object_key"]: row["id"]
                for row in connection.execute(
                    "SELECT id, metadata_json FROM knowledge_items ORDER BY id"
                ).fetchall()
            }
            relation_id = connection.execute(
                "SELECT id FROM knowledge_relations WHERE relation_type = 'supports'"
            ).fetchone()["id"]

        a_items = [
            self._item_snapshot(
                "A",
                suffix="SOURCE",
                matched_item_id=item_ids["test_type::SOURCE"],
            ),
            self._item_snapshot(
                "A",
                suffix="TARGET",
                matched_item_id=item_ids["test_type::TARGET"],
            ),
        ]
        with closing(connect(self.db_path)) as connection, connection:
            self._stage_job(
                connection,
                job_id="job-a-full",
                source_file_id=self.source_a.id,
                items=a_items,
                relations=[self._relation_snapshot("A", matched_relation_id=relation_id)],
            )
        self._approve("job-a-full")
        finalize_root = self.root / "import-finalize"
        finalize_import(self.db_path, "job-b-full", apply=True, output_root=finalize_root)
        finalize_import(self.db_path, "job-a-full", apply=True, output_root=finalize_root)
        return item_ids, relation_id

    def _stage_empty_a_withdrawal(self, job_id: str) -> None:
        with closing(connect(self.db_path)) as connection, connection:
            self._stage_job(
                connection,
                job_id=job_id,
                source_file_id=self.source_a.id,
            )

    def _seed_single_a_item(self) -> str:
        with closing(connect(self.db_path)) as connection, connection:
            self._stage_job(
                connection,
                job_id="job-a-single",
                source_file_id=self.source_a.id,
                items=[self._item_snapshot("A", suffix="SOURCE")],
            )
        self._approve("job-a-single")
        with closing(connect(self.db_path)) as connection:
            return connection.execute("SELECT id FROM knowledge_items").fetchone()["id"]

    def test_multi_source_withdrawal_fails_closed_until_surviving_source_is_reimported(self) -> None:
        item_ids, relation_id = self._seed_complete_b_then_a()
        self._stage_empty_a_withdrawal("job-a-withdraw")
        summary = self._approve("job-a-withdraw")

        with closing(connect(self.db_path)) as connection:
            items = {
                json.loads(row["metadata_json"])["object_key"]: row
                for row in connection.execute(
                    """
                    SELECT id, code, title, description, category, status,
                           source_file_id, source_hash, metadata_json
                    FROM knowledge_items
                    """
                ).fetchall()
            }
            relation = connection.execute(
                """
                SELECT id, relation_label, confidence, source_file_id,
                       import_job_id, metadata_json
                FROM knowledge_relations WHERE id = ?
                """,
                (relation_id,),
            ).fetchone()
            references = connection.execute(
                """
                SELECT target_type, target_id, source_file_id, source_sheet,
                       source_row, source_column, source_cell, raw_value, source_hash
                FROM source_references
                ORDER BY target_type, target_id, source_file_id
                """
            ).fetchall()

        self.assertEqual(summary.items_deprecated, 0)
        self.assertEqual(summary.relations_deleted, 0)
        for suffix in ("SOURCE", "TARGET"):
            item = items[f"test_type::{suffix}"]
            self.assertEqual(item["id"], item_ids[f"test_type::{suffix}"])
            self.assertEqual(item["title"], f"A title {suffix}")
            self.assertEqual(item["description"], f"A description {suffix}")
            self.assertEqual(item["category"], "A category")
            self.assertEqual(item["source_file_id"], self.source_a.id)
            self.assertEqual(item["source_hash"], self.source_a.file_hash)
            self.assertEqual(json.loads(item["metadata_json"])["origin"], "A")
        self.assertEqual(relation["id"], relation_id)
        self.assertEqual(relation["relation_label"], "A relation label")
        self.assertEqual(relation["source_file_id"], self.source_a.id)
        self.assertEqual(relation["import_job_id"], "job-a-full")
        self.assertEqual(json.loads(relation["metadata_json"])["origin"], "A")
        self.assertEqual(len(references), 6)
        self.assertEqual({row["source_file_id"] for row in references}, {self.source_a.id, self.source_b.id})

        # B's completed staging rows were finalized, so source_references alone cannot
        # reconstruct B's complete business object. A new explicit B import is the
        # existing transaction that can safely replace the whole object snapshot.
        with closing(connect(self.db_path)) as connection, connection:
            self._stage_job(
                connection,
                job_id="job-b-repeat",
                source_file_id=self.source_b.id,
                items=[
                    self._item_snapshot("B", suffix="SOURCE", matched_item_id=item_ids["test_type::SOURCE"]),
                    self._item_snapshot("B", suffix="TARGET", matched_item_id=item_ids["test_type::TARGET"]),
                ],
                relations=[self._relation_snapshot("B", matched_relation_id=relation_id)],
            )
        repeated = self._approve("job-b-repeat")
        self.assertEqual(repeated.source_references_created, 0)
        self.assertEqual(repeated.source_references_reused, 3)
        with closing(connect(self.db_path)) as connection:
            reimported_items = {
                json.loads(row["metadata_json"])["object_key"]: row
                for row in connection.execute(
                    """
                    SELECT id, title, description, category, source_file_id,
                           source_hash, metadata_json
                    FROM knowledge_items
                    """
                ).fetchall()
            }
            reimported_relation = connection.execute(
                """
                SELECT id, relation_label, source_file_id, import_job_id, metadata_json
                FROM knowledge_relations
                """
            ).fetchone()
        self.assertEqual({row["id"] for row in reimported_items.values()}, set(item_ids.values()))
        for suffix in ("SOURCE", "TARGET"):
            item = reimported_items[f"test_type::{suffix}"]
            self.assertEqual(item["title"], f"B title {suffix}")
            self.assertEqual(item["description"], f"B description {suffix}")
            self.assertEqual(item["category"], "B category")
            self.assertEqual(item["source_file_id"], self.source_b.id)
            self.assertEqual(item["source_hash"], self.source_b.file_hash)
            self.assertEqual(json.loads(item["metadata_json"])["origin"], "B")
        self.assertEqual(reimported_relation["id"], relation_id)
        self.assertEqual(reimported_relation["relation_label"], "B relation label")
        self.assertEqual(reimported_relation["source_file_id"], self.source_b.id)
        self.assertEqual(reimported_relation["import_job_id"], "job-b-repeat")
        self.assertEqual(json.loads(reimported_relation["metadata_json"])["origin"], "B")

    def test_multi_source_withdrawal_failure_rolls_back_owner_content_and_evidence(self) -> None:
        item_ids, relation_id = self._seed_complete_b_then_a()
        self._stage_empty_a_withdrawal("job-a-withdraw-failure")
        with closing(connect(self.db_path)) as connection, connection:
            before_logs = connection.execute("SELECT COUNT(*) AS count FROM change_logs").fetchone()["count"]
            connection.execute(
                """
                CREATE TRIGGER reject_withdrawal_approval
                BEFORE UPDATE OF status ON import_jobs
                WHEN OLD.id = 'job-a-withdraw-failure' AND NEW.status = 'approved'
                BEGIN
                  SELECT RAISE(ABORT, 'injected withdrawal approval failure');
                END
                """
            )

        with closing(connect(self.db_path)) as connection:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "injected withdrawal approval failure"):
                approve_import(connection, "job-a-withdraw-failure")

        with closing(connect(self.db_path)) as connection:
            items = connection.execute(
                "SELECT id, title, source_file_id, metadata_json FROM knowledge_items ORDER BY id"
            ).fetchall()
            relation = connection.execute(
                "SELECT id, relation_label, source_file_id, import_job_id, metadata_json FROM knowledge_relations"
            ).fetchone()
            reference_count = connection.execute(
                "SELECT COUNT(*) AS count FROM source_references"
            ).fetchone()["count"]
            job_status = connection.execute(
                "SELECT status FROM import_jobs WHERE id = 'job-a-withdraw-failure'"
            ).fetchone()["status"]
            after_logs = connection.execute("SELECT COUNT(*) AS count FROM change_logs").fetchone()["count"]

        self.assertEqual({row["id"] for row in items}, set(item_ids.values()))
        self.assertTrue(all(row["source_file_id"] == self.source_a.id for row in items))
        self.assertTrue(all(json.loads(row["metadata_json"])["origin"] == "A" for row in items))
        self.assertEqual(relation["id"], relation_id)
        self.assertEqual(relation["relation_label"], "A relation label")
        self.assertEqual(relation["source_file_id"], self.source_a.id)
        self.assertEqual(relation["import_job_id"], "job-a-full")
        self.assertEqual(json.loads(relation["metadata_json"])["origin"], "A")
        self.assertEqual(reference_count, 6)
        self.assertEqual(job_status, "reviewing")
        self.assertEqual(after_logs, before_logs)

    def test_single_source_deprecation_preserves_exact_evidence_and_repeats_idempotently(self) -> None:
        item_id = self._seed_single_a_item()
        with closing(connect(self.db_path)) as connection:
            before = dict(
                connection.execute(
                    """
                    SELECT source_file_id, source_sheet, source_row, source_column,
                           source_cell, raw_value, source_hash
                    FROM source_references WHERE target_type = 'item' AND target_id = ?
                    """,
                    (item_id,),
                ).fetchone()
            )

        self._stage_empty_a_withdrawal("job-a-single-withdraw")
        first = self._approve("job-a-single-withdraw")
        self._stage_empty_a_withdrawal("job-a-single-withdraw-repeat")
        second = self._approve("job-a-single-withdraw-repeat")

        with closing(connect(self.db_path)) as connection:
            item = connection.execute(
                "SELECT id, status, source_file_id, source_hash FROM knowledge_items WHERE id = ?",
                (item_id,),
            ).fetchone()
            references = connection.execute(
                """
                SELECT source_file_id, source_sheet, source_row, source_column,
                       source_cell, raw_value, source_hash
                FROM source_references WHERE target_type = 'item' AND target_id = ?
                """,
                (item_id,),
            ).fetchall()

        self.assertEqual(first.items_deprecated, 1)
        self.assertEqual(second.items_deprecated, 0)
        self.assertEqual(item["id"], item_id)
        self.assertEqual(item["status"], "deprecated")
        self.assertEqual(item["source_file_id"], self.source_a.id)
        self.assertEqual(item["source_hash"], self.source_a.file_hash)
        self.assertEqual(len(references), 1)
        self.assertEqual(dict(references[0]), before)

    def test_single_source_deprecation_failure_rolls_back_without_losing_evidence(self) -> None:
        item_id = self._seed_single_a_item()
        self._stage_empty_a_withdrawal("job-a-single-withdraw-failure")
        with closing(connect(self.db_path)) as connection, connection:
            connection.execute(
                """
                CREATE TRIGGER reject_item_deprecation
                BEFORE UPDATE OF status ON knowledge_items
                WHEN NEW.status = 'deprecated'
                BEGIN
                  SELECT RAISE(ABORT, 'injected deprecation failure');
                END
                """
            )

        with closing(connect(self.db_path)) as connection:
            with self.assertRaisesRegex(sqlite3.IntegrityError, "injected deprecation failure"):
                approve_import(connection, "job-a-single-withdraw-failure")

        with closing(connect(self.db_path)) as connection:
            item = connection.execute(
                "SELECT status FROM knowledge_items WHERE id = ?",
                (item_id,),
            ).fetchone()
            reference = connection.execute(
                """
                SELECT source_row, source_column, source_cell, raw_value, source_hash
                FROM source_references WHERE target_type = 'item' AND target_id = ?
                """,
                (item_id,),
            ).fetchone()
            job_status = connection.execute(
                "SELECT status FROM import_jobs WHERE id = 'job-a-single-withdraw-failure'"
            ).fetchone()["status"]

        self.assertEqual(item["status"], "active")
        self.assertEqual(dict(reference), {
            "source_row": 10,
            "source_column": "B",
            "source_cell": "B10",
            "raw_value": "A raw SOURCE",
            "source_hash": self.source_a.file_hash,
        })
        self.assertEqual(job_status, "reviewing")

    def test_same_hash_new_path_reuses_canonical_source_row_and_repeats_idempotently(self) -> None:
        first_path = self.root / "canonical" / "source.xlsx"
        moved_path = self.root / "moved" / "renamed.xlsx"
        third_path = self.root / "third" / "again.xlsx"
        for path in (first_path, moved_path, third_path):
            path.parent.mkdir()
            path.write_bytes(b"same-hash-source")

        with closing(connect(self.db_path)) as connection, connection:
            original = register_source_file(connection, first_path)
            moved = register_source_file(connection, moved_path)
            repeated = register_source_file(connection, moved_path)
            third = register_source_file(connection, third_path)
            rows = connection.execute(
                "SELECT id, file_name, file_path, file_hash, status FROM source_files WHERE file_hash = ?",
                (original.file_hash,),
            ).fetchall()

        self.assertFalse(moved.created)
        self.assertFalse(repeated.created)
        self.assertFalse(third.created)
        self.assertEqual({original.id, moved.id, repeated.id, third.id}, {original.id})
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], original.id)
        self.assertEqual(rows[0]["file_name"], first_path.name)
        self.assertEqual(rows[0]["file_path"], str(first_path.resolve()))
        self.assertEqual(moved.file_path, str(first_path.resolve()))
        self.assertEqual(third.file_path, str(first_path.resolve()))
        self.assertEqual(rows[0]["status"], "active")

    def test_same_hash_new_path_failure_rolls_back_without_conflicting_identity(self) -> None:
        first_path = self.root / "canonical-rollback" / "source.xlsx"
        moved_path = self.root / "moved-rollback" / "source.xlsx"
        first_path.parent.mkdir()
        moved_path.parent.mkdir()
        first_path.write_bytes(b"same-hash-rollback")
        moved_path.write_bytes(b"same-hash-rollback")
        with closing(connect(self.db_path)) as connection, connection:
            original = register_source_file(connection, first_path)
            connection.execute(
                f"""
                CREATE TRIGGER reject_source_reactivation
                BEFORE UPDATE ON source_files
                WHEN OLD.id = '{original.id}'
                BEGIN
                  SELECT RAISE(ABORT, 'injected source reuse failure');
                END
                """
            )

        with closing(connect(self.db_path)) as connection:
            connection.execute("BEGIN IMMEDIATE")
            with self.assertRaisesRegex(sqlite3.IntegrityError, "injected source reuse failure"):
                register_source_file(connection, moved_path)
            connection.rollback()
            rows = connection.execute(
                "SELECT id, file_name, file_path, status FROM source_files WHERE file_hash = ?",
                (original.file_hash,),
            ).fetchall()

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["id"], original.id)
        self.assertEqual(rows[0]["file_name"], first_path.name)
        self.assertEqual(rows[0]["file_path"], str(first_path.resolve()))
        self.assertEqual(rows[0]["status"], "active")


if __name__ == "__main__":
    unittest.main()
