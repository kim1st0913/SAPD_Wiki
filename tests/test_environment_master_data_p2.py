from __future__ import annotations

import json
import sqlite3
import unittest

from openpyxl import Workbook

from sapd_wiki.candidates import ObjectCandidate
from sapd_wiki.loader import _existing_relation_for_upsert
from sapd_wiki.parsers import parse_scene_sheet
from sapd_wiki.staging import _match_item


def _connection() -> sqlite3.Connection:
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    return conn


class EnvironmentSegmentMatchingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = _connection()
        self.conn.execute(
            """
            CREATE TABLE knowledge_items (
              id TEXT PRIMARY KEY,
              type TEXT NOT NULL,
              code TEXT,
              title TEXT NOT NULL,
              metadata_json TEXT
            )
            """
        )

    def tearDown(self) -> None:
        self.conn.close()

    def _insert_segment(self, item_id: str, environment: str) -> None:
        object_key = f"environment_segment::::网络::{environment}"
        self.conn.execute(
            """
            INSERT INTO knowledge_items (id, type, title, metadata_json)
            VALUES (?, 'environment_segment', '网络', ?)
            """,
            (item_id, json.dumps({"object_key": object_key}, ensure_ascii=False)),
        )

    def test_matches_exact_environment_context_independent_of_insert_order(self) -> None:
        self._insert_segment("segment-b", "云数据中心")
        self._insert_segment("segment-a", "园区网")

        matched = _match_item(
            self.conn,
            ObjectCandidate(type="environment_segment", title="网络", qualifier="园区网"),
        )

        self.assertEqual(matched, "segment-a")

    def test_does_not_fall_back_to_same_title_in_other_environment(self) -> None:
        self._insert_segment("segment-a", "园区网")

        matched = _match_item(
            self.conn,
            ObjectCandidate(type="environment_segment", title="网络", qualifier="云数据中心"),
        )

        self.assertIsNone(matched)

    def test_requires_environment_qualifier(self) -> None:
        with self.assertRaisesRegex(ValueError, "qualifier"):
            _match_item(
                self.conn,
                ObjectCandidate(type="environment_segment", title="网络"),
            )

    def test_rejects_duplicate_exact_context_identity(self) -> None:
        self._insert_segment("segment-a", "园区网")
        self._insert_segment("segment-b", "园区网")

        with self.assertRaisesRegex(ValueError, "上下文身份重复"):
            _match_item(
                self.conn,
                ObjectCandidate(type="environment_segment", title="网络", qualifier="园区网"),
            )

    def test_other_item_types_keep_existing_title_matching(self) -> None:
        self.conn.execute(
            """
            INSERT INTO knowledge_items (id, type, title, metadata_json)
            VALUES ('object-a', 'information_object', '网络设备', '{}')
            """
        )

        matched = _match_item(
            self.conn,
            ObjectCandidate(type="information_object", title="网络设备"),
        )

        self.assertEqual(matched, "object-a")


class EnvironmentSegmentTypeIdentityTests(unittest.TestCase):
    def test_code_is_stable_identity_when_title_changes(self) -> None:
        before = ObjectCandidate(
            type="environment_segment_type",
            code="ES-001",
            title="互联网边界",
        )
        after = ObjectCandidate(
            type="environment_segment_type",
            code="ES-001",
            title="互联网连接边界",
        )

        self.assertEqual(before.key, "environment_segment_type::ES-001")
        self.assertEqual(after.key, before.key)


class InstanceOfCardinalityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = _connection()
        self.conn.execute(
            """
            CREATE TABLE knowledge_relations (
              id TEXT PRIMARY KEY,
              source_item_id TEXT NOT NULL,
              target_item_id TEXT NOT NULL,
              relation_type TEXT NOT NULL
            )
            """
        )

    def tearDown(self) -> None:
        self.conn.close()

    def test_reuses_same_instance_of_target(self) -> None:
        self.conn.execute(
            """
            INSERT INTO knowledge_relations
              (id, source_item_id, target_item_id, relation_type)
            VALUES ('relation-a', 'segment-a', 'type-a', 'instance_of')
            """
        )

        relation_id = _existing_relation_for_upsert(
            self.conn,
            source_item_id="segment-a",
            target_item_id="type-a",
            relation_type="instance_of",
        )

        self.assertEqual(relation_id, "relation-a")

    def test_rejects_instance_of_target_change(self) -> None:
        self.conn.execute(
            """
            INSERT INTO knowledge_relations
              (id, source_item_id, target_item_id, relation_type)
            VALUES ('relation-a', 'segment-a', 'type-a', 'instance_of')
            """
        )

        with self.assertRaisesRegex(ValueError, "目标变更"):
            _existing_relation_for_upsert(
                self.conn,
                source_item_id="segment-a",
                target_item_id="type-b",
                relation_type="instance_of",
            )

    def test_rejects_existing_multiple_instance_of_relations(self) -> None:
        self.conn.executemany(
            """
            INSERT INTO knowledge_relations
              (id, source_item_id, target_item_id, relation_type)
            VALUES (?, 'segment-a', ?, 'instance_of')
            """,
            [("relation-a", "type-a"), ("relation-b", "type-b")],
        )

        with self.assertRaisesRegex(ValueError, "多重关系"):
            _existing_relation_for_upsert(
                self.conn,
                source_item_id="segment-a",
                target_item_id="type-a",
                relation_type="instance_of",
            )


class SceneParserParentResetTests(unittest.TestCase):
    def test_environment_change_does_not_inherit_previous_segment(self) -> None:
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "作用域-安全技术服务-安全技术模块映射"
        sheet.append(["", "", "", "", "", "", "", ""])
        sheet.append(["", "", "", "", "", "", "", ""])
        sheet.append(["", "园区网", "网络", "办公终端", "", "", "", ""])
        sheet.append(["", "远程办公", "", "移动办公终端", "", "", "", ""])

        result = parse_scene_sheet(workbook)

        forbidden_key = "environment_segment::::网络::远程办公"
        self.assertNotIn(forbidden_key, {item.key for item in result.objects})
        self.assertIn(
            (
                "information_object::::移动办公终端",
                "belongs_to",
                "information_environment::::远程办公",
            ),
            {
                (relation.source_key, relation.relation_type, relation.target_key)
                for relation in result.relations
            },
        )


if __name__ == "__main__":
    unittest.main()
