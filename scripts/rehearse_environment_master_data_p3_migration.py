#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sqlite3
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

DEFAULT_BASE_DB = ROOT / "data/database/sapd_wiki.sqlite3"
DEFAULT_USER_DB = ROOT / "data/user/sapd_wiki_user.sqlite3"
DEFAULT_WORKBOOK = ROOT / "data/raw-samples/wiki sample.xlsx"
DEFAULT_WORKBENCH = (
    ROOT / "frontend/capability-browser/public/data/environment-workbench.json"
)
DEFAULT_BASEMAP = (
    ROOT / "frontend/capability-browser/generated/environmentBasemap.semantic.json"
)
DEFAULT_P2_OUTPUT = (
    ROOT / "data/exports/worker-verify/plan-env-md/p2-20260725T161109Z"
)
DEFAULT_OUTPUT_ROOT = ROOT / "data/exports/worker-verify/plan-env-md"
SCENE_SHEET = "作用域-安全技术服务-安全技术模块映射"
MASTER_TYPES = (
    "information_environment",
    "environment_segment_type",
    "information_object",
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: datetime) -> str:
    return value.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def json_hash(value: Any) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def deterministic_uuid(value: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, value))


def connect_database(path: Path, *, read_only: bool = False) -> sqlite3.Connection:
    if read_only:
        connection = sqlite3.connect(
            f"{path.resolve().as_uri()}?mode=ro",
            uri=True,
            isolation_level=None,
        )
        connection.execute("PRAGMA query_only = ON")
    else:
        connection = sqlite3.connect(path, isolation_level=None)
        connection.execute("PRAGMA foreign_keys = ON")
    connection.row_factory = sqlite3.Row
    return connection


def sqlite_backup(source_path: Path, destination_path: Path) -> None:
    source = sqlite3.connect(f"{source_path.resolve().as_uri()}?mode=ro", uri=True)
    destination = sqlite3.connect(destination_path)
    try:
        source.backup(destination)
    finally:
        destination.close()
        source.close()


def read_allocations(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def hash_query(
    connection: sqlite3.Connection,
    sql: str,
    params: Iterable[Any] = (),
) -> str:
    digest = hashlib.sha256()
    cursor = connection.execute(sql, tuple(params))
    for row in cursor:
        payload = json.dumps(
            list(row),
            ensure_ascii=False,
            separators=(",", ":"),
            default=str,
        )
        digest.update(payload.encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


def table_hash(connection: sqlite3.Connection, table: str) -> str:
    columns = [
        row["name"] for row in connection.execute(f"PRAGMA table_info({table})")
    ]
    if not columns:
        raise ValueError(f"缺少表：{table}")
    order = "id" if "id" in columns else ", ".join(columns)
    return hash_query(
        connection,
        f"SELECT {', '.join(columns)} FROM {table} ORDER BY {order}",
    )


def logical_snapshot(connection: sqlite3.Connection) -> dict[str, Any]:
    counts = {
        table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in (
            "knowledge_items",
            "knowledge_relations",
            "source_references",
            "change_logs",
            "base_id_redirects",
        )
    }
    context_counts = {
        "information_environments": connection.execute(
            "SELECT COUNT(*) FROM knowledge_items WHERE type='information_environment'"
        ).fetchone()[0],
        "environment_segment_types": connection.execute(
            "SELECT COUNT(*) FROM knowledge_items WHERE type='environment_segment_type'"
        ).fetchone()[0],
        "environment_segments": connection.execute(
            "SELECT COUNT(*) FROM knowledge_items WHERE type='environment_segment'"
        ).fetchone()[0],
        "information_objects": connection.execute(
            "SELECT COUNT(*) FROM knowledge_items WHERE type='information_object'"
        ).fetchone()[0],
        "instance_of_relations": connection.execute(
            "SELECT COUNT(*) FROM knowledge_relations WHERE relation_type='instance_of'"
        ).fetchone()[0],
        "environment_object_contexts": connection.execute(
            """
            SELECT COUNT(*)
            FROM knowledge_relations AS relation
            JOIN knowledge_items AS source ON source.id=relation.source_item_id
            JOIN knowledge_items AS target ON target.id=relation.target_item_id
            WHERE relation.relation_type='belongs_to'
              AND source.type='information_object'
              AND target.type IN ('environment_segment','information_environment')
            """
        ).fetchone()[0],
    }
    hashes = {
        table: table_hash(connection, table)
        for table in (
            "knowledge_items",
            "knowledge_relations",
            "source_references",
            "change_logs",
            "base_id_redirects",
        )
    }
    hashes["knowledge_items_fts_logical"] = hash_query(
        connection,
        """
        SELECT rowid, title, description, code, category
        FROM knowledge_items_fts
        ORDER BY rowid
        """,
    )
    hashes["schema"] = hash_query(
        connection,
        """
        SELECT type, name, tbl_name, sql
        FROM sqlite_master
        WHERE sql IS NOT NULL
        ORDER BY type, name
        """,
    )
    return {
        "integrity_check": connection.execute(
            "PRAGMA integrity_check"
        ).fetchone()[0],
        "foreign_key_check": [
            list(row) for row in connection.execute("PRAGMA foreign_key_check")
        ],
        "counts": counts,
        "domain_counts": context_counts,
        "hashes": hashes,
    }


def protected_apply_hashes(connection: sqlite3.Connection) -> dict[str, str]:
    return {
        "existing_item_identity_without_code": hash_query(
            connection,
            """
            SELECT id, type, title, description, category, status, parent_id,
                   source_file_id, source_hash, metadata_json, created_at, updated_at,
                   stable_key, stable_ref, public_id
            FROM knowledge_items
            WHERE type != 'environment_segment_type'
            ORDER BY id
            """,
        ),
        "existing_relations_without_instance_of": hash_query(
            connection,
            """
            SELECT id, source_item_id, target_item_id, relation_type, relation_label,
                   confidence, source_file_id, import_job_id, metadata_json,
                   created_at, updated_at, stable_key, stable_ref, public_id
            FROM knowledge_relations
            WHERE relation_type != 'instance_of'
            ORDER BY id
            """,
        ),
        "existing_source_references": hash_query(
            connection,
            """
            SELECT refs.id, refs.target_type, refs.target_id, refs.source_file_id,
                   refs.source_sheet, refs.source_row, refs.source_column,
                   refs.source_cell, refs.raw_value, refs.source_hash, refs.created_at
            FROM source_references AS refs
            LEFT JOIN knowledge_items AS item
              ON refs.target_type='item' AND refs.target_id=item.id
            LEFT JOIN knowledge_relations AS relation
              ON refs.target_type='relation' AND refs.target_id=relation.id
            WHERE COALESCE(item.type, '') != 'environment_segment_type'
              AND COALESCE(relation.relation_type, '') != 'instance_of'
            ORDER BY refs.id
            """,
        ),
        "existing_change_logs": hash_query(
            connection,
            """
            SELECT logs.id, logs.target_type, logs.target_id, logs.change_type,
                   logs.before_json, logs.after_json, logs.import_job_id, logs.changed_at
            FROM change_logs AS logs
            WHERE logs.id NOT LIKE 'p3-env-md-%'
            ORDER BY logs.id
            """,
        ),
    }


def load_plan(p2_output: Path) -> dict[str, Any]:
    plan = read_json(p2_output / "p2-plan.json")
    if plan["gate"]["result"] != "ready_for_p3_temp_apply":
        raise ValueError("P2门禁未进入 ready_for_p3_temp_apply")
    if plan["gate"]["formal_apply_authorized"] is not False:
        raise ValueError("P2计划必须保持 formal_apply_authorized=false")
    decisions = read_json(
        p2_output / "master-data-decision-manifest.p2.json"
    )["entries"]
    allocations = read_allocations(p2_output / "master-code-allocation.csv")
    relations = read_json(p2_output / "instance-of-plan.json")["relations"]
    if len(decisions) != 77 or len(allocations) != 77 or len(relations) != 29:
        raise ValueError("P2清单数量不满足77/77/29")
    decisions_by_ref = {entry["stable_ref"]: entry for entry in decisions}
    allocations_by_ref = {
        entry["stable_ref"]: entry for entry in allocations
    }
    if len(decisions_by_ref) != 77 or len(allocations_by_ref) != 77:
        raise ValueError("P2主数据身份存在重复")
    return {
        "plan": plan,
        "decisions": decisions,
        "decisions_by_ref": decisions_by_ref,
        "allocations": allocations,
        "allocations_by_ref": allocations_by_ref,
        "relations": relations,
    }


def validate_formal_inputs(
    plan_data: dict[str, Any],
    paths: dict[str, Path],
) -> dict[str, str]:
    expected = plan_data["plan"]["input_integrity"]["hashes_after"]
    hashes = {name: sha256_file(path) for name, path in paths.items()}
    for name in (
        "base_database",
        "user_database",
        "source_workbook",
        "environment_workbench",
        "environment_basemap_semantic",
    ):
        if hashes[name] != expected[name]:
            raise ValueError(
                f"P2后保护输入哈希漂移：{name} expected={expected[name]} actual={hashes[name]}"
            )
    return hashes


def canonical_source_ref(
    connection: sqlite3.Connection,
    target_id: str,
) -> sqlite3.Row:
    row = connection.execute(
        """
        SELECT id, source_file_id, source_sheet, source_row, source_column,
               source_cell, raw_value, source_hash
        FROM source_references
        WHERE target_type='item' AND target_id=?
        ORDER BY
          CASE WHEN source_sheet=? THEN 0 ELSE 1 END,
          source_row, source_column, source_cell, id
        LIMIT 1
        """,
        (target_id, SCENE_SHEET),
    ).fetchone()
    if not row:
        raise ValueError(f"环境上下文缺少来源证据：{target_id}")
    return row


def change_log_id(kind: str, target_id: str) -> str:
    digest = hashlib.sha256(
        f"PLAN-ENV-MD:P3:{kind}:{target_id}".encode("utf-8")
    ).hexdigest()[:24]
    return f"p3-env-md-{digest}"


def insert_change_log(
    connection: sqlite3.Connection,
    *,
    kind: str,
    target_type: str,
    target_id: str,
    change_type: str,
    before: Any,
    after: Any,
) -> int:
    log_id = change_log_id(kind, target_id)
    existing = connection.execute(
        "SELECT id FROM change_logs WHERE id=?",
        (log_id,),
    ).fetchone()
    if existing:
        return 0
    connection.execute(
        """
        INSERT INTO change_logs (
          id, target_type, target_id, change_type, before_json, after_json
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            log_id,
            target_type,
            target_id,
            change_type,
            json.dumps(before, ensure_ascii=False, sort_keys=True)
            if before is not None
            else None,
            json.dumps(after, ensure_ascii=False, sort_keys=True)
            if after is not None
            else None,
        ),
    )
    return 1


def copy_source_reference(
    connection: sqlite3.Connection,
    *,
    target_type: str,
    target_id: str,
    source: sqlite3.Row,
) -> int:
    ref_id = deterministic_uuid(
        f"PLAN-ENV-MD:P3:{target_type}:{target_id}:{source['id']}"
    )
    existing = connection.execute(
        "SELECT id FROM source_references WHERE id=?",
        (ref_id,),
    ).fetchone()
    if existing:
        return 0
    connection.execute(
        """
        INSERT INTO source_references (
          id, target_type, target_id, source_file_id, source_sheet, source_row,
          source_column, source_cell, raw_value, source_hash
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            ref_id,
            target_type,
            target_id,
            source["source_file_id"],
            source["source_sheet"],
            source["source_row"],
            source["source_column"],
            source["source_cell"],
            source["raw_value"],
            source["source_hash"],
        ),
    )
    return 1


def apply_plan(
    connection: sqlite3.Connection,
    plan_data: dict[str, Any],
    *,
    fail_after_code_backfill: bool = False,
) -> dict[str, int]:
    result = {
        "codes_backfilled": 0,
        "segment_types_created": 0,
        "instance_of_created": 0,
        "source_references_created": 0,
        "change_logs_created": 0,
    }
    connection.execute("BEGIN IMMEDIATE")
    try:
        for allocation in plan_data["allocations"]:
            if allocation["decision"] != "reuse":
                continue
            row = connection.execute(
                """
                SELECT id, type, code, stable_key, stable_ref, public_id, metadata_json
                FROM knowledge_items WHERE id=?
                """,
                (allocation["database_id"],),
            ).fetchone()
            if not row:
                raise ValueError(
                    f"既有主数据不存在：{allocation['database_id']}"
                )
            for field in ("stable_key", "stable_ref", "public_id"):
                if str(row[field] or "") != allocation[field]:
                    raise ValueError(
                        f"既有主数据身份冲突：{allocation['code']} field={field}"
                    )
            if row["code"] not in (None, "", allocation["code"]):
                raise ValueError(
                    f"既有非空编号冲突：{allocation['stable_ref']} code={row['code']}"
                )
            if row["code"] != allocation["code"]:
                connection.execute(
                    "UPDATE knowledge_items SET code=? WHERE id=?",
                    (allocation["code"], row["id"]),
                )
                result["codes_backfilled"] += 1
                result["change_logs_created"] += insert_change_log(
                    connection,
                    kind="code",
                    target_type="item",
                    target_id=row["id"],
                    change_type="update",
                    before={"code": row["code"]},
                    after={
                        "code": allocation["code"],
                        "stable_ref": row["stable_ref"],
                    },
                )

        if fail_after_code_backfill:
            raise RuntimeError("P3_FAILPOINT_AFTER_CODE_BACKFILL")

        segment_allocations = [
            entry
            for entry in plan_data["allocations"]
            if entry["master_type"] == "environment_segment_type"
        ]
        relations_by_target: dict[str, list[dict[str, Any]]] = {}
        for relation in plan_data["relations"]:
            relations_by_target.setdefault(
                relation["target_stable_ref"], []
            ).append(relation)

        for allocation in segment_allocations:
            decision = plan_data["decisions_by_ref"][allocation["stable_ref"]]
            existing = connection.execute(
                """
                SELECT id, type, code, title, description, stable_key, stable_ref,
                       public_id, metadata_json
                FROM knowledge_items
                WHERE stable_ref=? OR id=?
                """,
                (allocation["stable_ref"], allocation["database_id"]),
            ).fetchall()
            if len(existing) > 1:
                raise ValueError(
                    f"环境子类类型身份冲突：{allocation['stable_ref']}"
                )
            mapped_relations = relations_by_target.get(
                allocation["stable_ref"], []
            )
            if not mapped_relations:
                raise ValueError(
                    f"环境子类类型没有上下文映射：{allocation['code']}"
                )
            source_refs = [
                canonical_source_ref(connection, row["source_item_id"])
                for row in mapped_relations
            ]
            metadata = {
                "object_key": f"environment_segment_type::{allocation['code']}",
                "aliases": decision["aliases"],
                "master_data_plan": "PLAN-ENV-MD",
                "master_data_phase": "P3",
                "source_context_refs": sorted(
                    row["source_stable_ref"] for row in mapped_relations
                ),
            }
            if existing:
                row = existing[0]
                expected = {
                    "id": allocation["database_id"],
                    "type": "environment_segment_type",
                    "code": allocation["code"],
                    "title": allocation["canonical_title"],
                    "description": decision["definition"],
                    "stable_key": allocation["stable_key"],
                    "stable_ref": allocation["stable_ref"],
                    "public_id": allocation["public_id"],
                    "metadata_json": json.dumps(
                        metadata, ensure_ascii=False, sort_keys=True
                    ),
                }
                for field, value in expected.items():
                    if row[field] != value:
                        raise ValueError(
                            f"环境子类类型重复apply内容冲突：{allocation['code']} field={field}"
                        )
            else:
                primary_source = source_refs[0]
                connection.execute(
                    """
                    INSERT INTO knowledge_items (
                      id, type, code, title, description, status,
                      source_file_id, source_hash, metadata_json,
                      stable_key, stable_ref, public_id
                    )
                    VALUES (?, 'environment_segment_type', ?, ?, ?, 'active',
                            ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        allocation["database_id"],
                        allocation["code"],
                        allocation["canonical_title"],
                        decision["definition"],
                        primary_source["source_file_id"],
                        primary_source["source_hash"],
                        json.dumps(metadata, ensure_ascii=False, sort_keys=True),
                        allocation["stable_key"],
                        allocation["stable_ref"],
                        allocation["public_id"],
                    ),
                )
                result["segment_types_created"] += 1
                result["change_logs_created"] += insert_change_log(
                    connection,
                    kind="item",
                    target_type="item",
                    target_id=allocation["database_id"],
                    change_type="create",
                    before=None,
                    after={
                        "code": allocation["code"],
                        "stable_ref": allocation["stable_ref"],
                    },
                )
            for source in source_refs:
                result["source_references_created"] += copy_source_reference(
                    connection,
                    target_type="item",
                    target_id=allocation["database_id"],
                    source=source,
                )

        for planned in plan_data["relations"]:
            source = connection.execute(
                "SELECT id, stable_ref FROM knowledge_items WHERE id=?",
                (planned["source_item_id"],),
            ).fetchone()
            target = connection.execute(
                "SELECT id, stable_ref FROM knowledge_items WHERE id=?",
                (planned["target_planned_id"],),
            ).fetchone()
            if not source or source["stable_ref"] != planned["source_stable_ref"]:
                raise ValueError(
                    f"instance_of来源身份冲突：{planned['source_stable_ref']}"
                )
            if not target or target["stable_ref"] != planned["target_stable_ref"]:
                raise ValueError(
                    f"instance_of目标身份冲突：{planned['target_stable_ref']}"
                )
            existing = connection.execute(
                """
                SELECT id, target_item_id, stable_key, stable_ref, public_id
                FROM knowledge_relations
                WHERE source_item_id=? AND relation_type='instance_of'
                """,
                (planned["source_item_id"],),
            ).fetchall()
            if len(existing) > 1:
                raise ValueError(
                    f"instance_of来源存在多重关系：{planned['source_stable_ref']}"
                )
            metadata = {
                "relation_key": (
                    f"environment_segment::{planned['source_public_id']}"
                    f"::instance_of::environment_segment_type::{planned['target_code']}"
                ),
                "relation_label": "实例归属",
                "confidence": "exact",
                "master_data_plan": "PLAN-ENV-MD",
                "master_data_phase": "P3",
            }
            if existing:
                row = existing[0]
                if (
                    row["id"] != planned["planned_relation_id"]
                    or row["target_item_id"] != planned["target_planned_id"]
                    or row["stable_key"] != planned["stable_key"]
                    or row["stable_ref"] != planned["stable_ref"]
                    or row["public_id"] != planned["public_id"]
                ):
                    raise ValueError(
                        f"instance_of重复apply内容冲突：{planned['source_stable_ref']}"
                    )
            else:
                source_ref = canonical_source_ref(
                    connection, planned["source_item_id"]
                )
                connection.execute(
                    """
                    INSERT INTO knowledge_relations (
                      id, source_item_id, target_item_id, relation_type,
                      relation_label, confidence, source_file_id, metadata_json,
                      stable_key, stable_ref, public_id
                    )
                    VALUES (?, ?, ?, 'instance_of', '实例归属', 'exact', ?, ?, ?, ?, ?)
                    """,
                    (
                        planned["planned_relation_id"],
                        planned["source_item_id"],
                        planned["target_planned_id"],
                        source_ref["source_file_id"],
                        json.dumps(metadata, ensure_ascii=False, sort_keys=True),
                        planned["stable_key"],
                        planned["stable_ref"],
                        planned["public_id"],
                    ),
                )
                result["instance_of_created"] += 1
                result["change_logs_created"] += insert_change_log(
                    connection,
                    kind="relation",
                    target_type="relation",
                    target_id=planned["planned_relation_id"],
                    change_type="create",
                    before=None,
                    after={
                        "source_stable_ref": planned["source_stable_ref"],
                        "target_stable_ref": planned["target_stable_ref"],
                        "stable_ref": planned["stable_ref"],
                    },
                )
            source_ref = canonical_source_ref(
                connection, planned["source_item_id"]
            )
            result["source_references_created"] += copy_source_reference(
                connection,
                target_type="relation",
                target_id=planned["planned_relation_id"],
                source=source_ref,
            )

        connection.execute("COMMIT")
        return result
    except Exception:
        connection.execute("ROLLBACK")
        raise


def validate_applied_state(
    connection: sqlite3.Connection,
    plan_data: dict[str, Any],
) -> dict[str, Any]:
    counts = {
        master_type: connection.execute(
            "SELECT COUNT(*) FROM knowledge_items WHERE type=?",
            (master_type,),
        ).fetchone()[0]
        for master_type in MASTER_TYPES
    }
    code_count = connection.execute(
        """
        SELECT COUNT(*)
        FROM knowledge_items
        WHERE type IN ('information_environment','environment_segment_type','information_object')
          AND code IS NOT NULL AND code != ''
        """
    ).fetchone()[0]
    relation_count = connection.execute(
        "SELECT COUNT(*) FROM knowledge_relations WHERE relation_type='instance_of'"
    ).fetchone()[0]
    source_cardinality_issues = [
        dict(row)
        for row in connection.execute(
            """
            SELECT source_item_id, COUNT(*) AS count
            FROM knowledge_relations
            WHERE relation_type='instance_of'
            GROUP BY source_item_id
            HAVING COUNT(*) != 1
            """
        )
    ]
    orphan_rows = [
        dict(row)
        for row in connection.execute(
            """
            SELECT relation.id
            FROM knowledge_relations AS relation
            LEFT JOIN knowledge_items AS source ON source.id=relation.source_item_id
            LEFT JOIN knowledge_items AS target ON target.id=relation.target_item_id
            WHERE relation.relation_type='instance_of'
              AND (
                source.id IS NULL OR source.type!='environment_segment'
                OR target.id IS NULL OR target.type!='environment_segment_type'
              )
            """
        )
    ]
    evidence = {
        "segment_type_item_refs": connection.execute(
            """
            SELECT COUNT(*)
            FROM source_references AS refs
            JOIN knowledge_items AS item
              ON refs.target_type='item' AND refs.target_id=item.id
            WHERE item.type='environment_segment_type'
            """
        ).fetchone()[0],
        "instance_of_relation_refs": connection.execute(
            """
            SELECT COUNT(*)
            FROM source_references AS refs
            JOIN knowledge_relations AS relation
              ON refs.target_type='relation' AND refs.target_id=relation.id
            WHERE relation.relation_type='instance_of'
            """
        ).fetchone()[0],
    }
    blockers = []
    if counts != {
        "information_environment": 10,
        "environment_segment_type": 16,
        "information_object": 51,
    }:
        blockers.append(f"主数据数量错误：{counts}")
    if code_count != 77:
        blockers.append(f"主数据编号覆盖不是77：{code_count}")
    if relation_count != 29:
        blockers.append(f"instance_of数量不是29：{relation_count}")
    if source_cardinality_issues:
        blockers.append("instance_of来源端不是唯一")
    if orphan_rows:
        blockers.append("instance_of存在孤儿或错误端点")
    if evidence["segment_type_item_refs"] < 29:
        blockers.append("environment_segment_type来源证据少于29")
    if evidence["instance_of_relation_refs"] != 29:
        blockers.append("instance_of来源证据不是29")
    for allocation in plan_data["allocations"]:
        row = connection.execute(
            "SELECT code FROM knowledge_items WHERE id=?",
            (allocation["database_id"],),
        ).fetchone()
        if not row or row["code"] != allocation["code"]:
            blockers.append(f"编号未按计划应用：{allocation['code']}")
    return {
        "result": "pass" if not blockers else "blocked",
        "blockers": blockers,
        "master_counts": counts,
        "master_code_count": code_count,
        "instance_of_count": relation_count,
        "source_cardinality_issues": source_cardinality_issues,
        "orphan_relations": orphan_rows,
        "evidence": evidence,
    }


def master_usage_summary(
    connection: sqlite3.Connection,
    master_ref: str,
    master_type: str,
) -> dict[str, int]:
    if master_type == "information_environment":
        environment_refs = {master_ref}
        segment_refs = {
            row[0]
            for row in connection.execute(
                """
                SELECT segment.stable_ref
                FROM knowledge_relations AS relation
                JOIN knowledge_items AS segment ON segment.id=relation.source_item_id
                JOIN knowledge_items AS environment ON environment.id=relation.target_item_id
                WHERE relation.relation_type='belongs_to'
                  AND segment.type='environment_segment'
                  AND environment.stable_ref=?
                """,
                (master_ref,),
            )
        }
    elif master_type == "environment_segment_type":
        segment_rows = connection.execute(
            """
            SELECT segment.id, segment.stable_ref
            FROM knowledge_relations AS relation
            JOIN knowledge_items AS segment ON segment.id=relation.source_item_id
            WHERE relation.relation_type='instance_of'
              AND relation.target_item_id=(
                SELECT id FROM knowledge_items WHERE stable_ref=?
              )
            """,
            (master_ref,),
        ).fetchall()
        segment_refs = {row["stable_ref"] for row in segment_rows}
        segment_ids = {row["id"] for row in segment_rows}
        environment_refs = set()
        if segment_ids:
            placeholders = ",".join("?" for _ in segment_ids)
            environment_refs = {
                row[0]
                for row in connection.execute(
                    f"""
                    SELECT environment.stable_ref
                    FROM knowledge_relations AS relation
                    JOIN knowledge_items AS environment ON environment.id=relation.target_item_id
                    WHERE relation.relation_type='belongs_to'
                      AND relation.source_item_id IN ({placeholders})
                      AND environment.type='information_environment'
                    """,
                    tuple(sorted(segment_ids)),
                )
            }
    else:
        object_id = connection.execute(
            "SELECT id FROM knowledge_items WHERE stable_ref=?",
            (master_ref,),
        ).fetchone()["id"]
        parent_rows = connection.execute(
            """
            SELECT target.id, target.type, target.stable_ref
            FROM knowledge_relations AS relation
            JOIN knowledge_items AS target ON target.id=relation.target_item_id
            WHERE relation.relation_type='belongs_to'
              AND relation.source_item_id=?
              AND target.type IN ('environment_segment','information_environment')
            """,
            (object_id,),
        ).fetchall()
        segment_refs = {
            row["stable_ref"]
            for row in parent_rows
            if row["type"] == "environment_segment"
        }
        environment_refs = {
            row["stable_ref"]
            for row in parent_rows
            if row["type"] == "information_environment"
        }
        segment_ids = {
            row["id"] for row in parent_rows if row["type"] == "environment_segment"
        }
        if segment_ids:
            placeholders = ",".join("?" for _ in segment_ids)
            environment_refs.update(
                row[0]
                for row in connection.execute(
                    f"""
                    SELECT environment.stable_ref
                    FROM knowledge_relations AS relation
                    JOIN knowledge_items AS environment ON environment.id=relation.target_item_id
                    WHERE relation.relation_type='belongs_to'
                      AND relation.source_item_id IN ({placeholders})
                      AND environment.type='information_environment'
                    """,
                    tuple(sorted(segment_ids)),
                )
            )
    if master_type == "information_object":
        object_contexts = connection.execute(
            """
            SELECT COUNT(*)
            FROM knowledge_relations AS relation
            JOIN knowledge_items AS source ON source.id=relation.source_item_id
            JOIN knowledge_items AS target ON target.id=relation.target_item_id
            WHERE relation.relation_type='belongs_to'
              AND source.stable_ref=?
              AND target.type IN ('environment_segment','information_environment')
            """,
            (master_ref,),
        ).fetchone()[0]
        information_objects = 1
    else:
        object_contexts = 0
        information_objects = 0
    return {
        "information_environments": len(environment_refs),
        "environment_segments": len(segment_refs),
        "information_objects": information_objects,
        "environment_object_contexts": object_contexts,
    }


def candidate_dictionary(
    connection: sqlite3.Connection,
    plan_data: dict[str, Any],
    generated_at: str,
) -> dict[str, Any]:
    collections = {
        "information_environment": "information_environments",
        "environment_segment_type": "environment_segment_types",
        "information_object": "information_objects",
    }
    result: dict[str, Any] = {
        "schema_version": "environment-dictionary-v1",
        "data_state": "ready",
        "generated_at": generated_at,
        "source_package_versions": {
            "plan": "PLAN-ENV-MD",
            "phase": "P3-shadow-candidate",
            "p2_run_id": plan_data["plan"]["run_id"],
        },
        "master_counts": {
            "information_environments": 0,
            "environment_segment_types": 0,
            "information_objects": 0,
        },
        "context_counts": {
            "environment_segments": connection.execute(
                "SELECT COUNT(*) FROM knowledge_items WHERE type='environment_segment'"
            ).fetchone()[0],
            "environment_object_contexts": connection.execute(
                """
                SELECT COUNT(*)
                FROM knowledge_relations AS relation
                JOIN knowledge_items AS source ON source.id=relation.source_item_id
                JOIN knowledge_items AS target ON target.id=relation.target_item_id
                WHERE relation.relation_type='belongs_to'
                  AND source.type='information_object'
                  AND target.type IN ('environment_segment','information_environment')
                """
            ).fetchone()[0],
        },
        "information_environments": [],
        "environment_segment_types": [],
        "information_objects": [],
        "usage_relations": [],
        "evidence_ref_count": 0,
    }
    for master_type, collection in collections.items():
        rows = connection.execute(
            """
            SELECT id, stable_ref, public_id, type, code, title, description,
                   status, metadata_json
            FROM knowledge_items
            WHERE type=?
            ORDER BY code
            """,
            (master_type,),
        ).fetchall()
        for row in rows:
            metadata = json.loads(row["metadata_json"] or "{}")
            result[collection].append(
                {
                    "id": row["id"],
                    "stable_ref": row["stable_ref"],
                    "public_id": row["public_id"],
                    "type": row["type"],
                    "code": row["code"],
                    "title": row["title"],
                    "description": row["description"],
                    "aliases": list(metadata.get("aliases") or []),
                    "status": row["status"],
                    "usage_summary": master_usage_summary(
                        connection, row["stable_ref"], master_type
                    ),
                }
            )
        result["master_counts"][collection] = len(result[collection])

    environment_rows = connection.execute(
        """
        SELECT id, stable_ref, title
        FROM knowledge_items
        WHERE type='information_environment'
        ORDER BY stable_ref
        """
    ).fetchall()
    for row in environment_rows:
        result["usage_relations"].append(
            {
                "relation_ref": f"usage:{row['stable_ref']}",
                "relation_type": "master_context",
                "master_ref": row["stable_ref"],
                "master_type": "information_environment",
                "context_type": "information_environment",
                "context_ref": row["stable_ref"],
                "context_title": row["title"],
                "environment_ref": row["stable_ref"],
                "segment_ref": None,
                "object_ref": None,
                "route": "/environment-mapping",
                "route_params": {"environment_ref": row["stable_ref"]},
            }
        )
    for row in connection.execute(
        """
        SELECT relation.stable_ref AS relation_ref,
               target.stable_ref AS master_ref,
               source.stable_ref AS context_ref,
               source.title AS context_title,
               environment.stable_ref AS environment_ref
        FROM knowledge_relations AS relation
        JOIN knowledge_items AS source ON source.id=relation.source_item_id
        JOIN knowledge_items AS target ON target.id=relation.target_item_id
        JOIN knowledge_relations AS belongs
          ON belongs.source_item_id=source.id AND belongs.relation_type='belongs_to'
        JOIN knowledge_items AS environment
          ON environment.id=belongs.target_item_id
         AND environment.type='information_environment'
        WHERE relation.relation_type='instance_of'
        ORDER BY relation.stable_ref
        """
    ):
        result["usage_relations"].append(
            {
                "relation_ref": row["relation_ref"],
                "relation_type": "instance_of",
                "master_ref": row["master_ref"],
                "master_type": "environment_segment_type",
                "context_type": "environment_segment",
                "context_ref": row["context_ref"],
                "context_title": row["context_title"],
                "environment_ref": row["environment_ref"],
                "segment_ref": row["context_ref"],
                "object_ref": None,
                "route": "/environment-mapping",
                "route_params": {
                    "environment_ref": row["environment_ref"],
                    "segment_ref": row["context_ref"],
                },
            }
        )
    object_context_rows = connection.execute(
        """
        SELECT relation.stable_ref AS relation_ref,
               object.stable_ref AS master_ref,
               object.stable_ref AS object_ref,
               object.title AS context_title,
               parent.type AS parent_type,
               parent.stable_ref AS parent_ref,
               environment.stable_ref AS segment_environment_ref
        FROM knowledge_relations AS relation
        JOIN knowledge_items AS object ON object.id=relation.source_item_id
        JOIN knowledge_items AS parent ON parent.id=relation.target_item_id
        LEFT JOIN knowledge_relations AS segment_belongs
          ON parent.type='environment_segment'
         AND segment_belongs.source_item_id=parent.id
         AND segment_belongs.relation_type='belongs_to'
        LEFT JOIN knowledge_items AS environment
          ON environment.id=segment_belongs.target_item_id
         AND environment.type='information_environment'
        WHERE relation.relation_type='belongs_to'
          AND object.type='information_object'
          AND parent.type IN ('environment_segment','information_environment')
        ORDER BY relation.stable_ref
        """
    ).fetchall()
    for row in object_context_rows:
        environment_ref = (
            row["parent_ref"]
            if row["parent_type"] == "information_environment"
            else row["segment_environment_ref"]
        )
        segment_ref = (
            row["parent_ref"]
            if row["parent_type"] == "environment_segment"
            else None
        )
        result["usage_relations"].append(
            {
                "relation_ref": row["relation_ref"],
                "relation_type": "belongs_to",
                "master_ref": row["master_ref"],
                "master_type": "information_object",
                "context_type": "environment_object_context",
                "context_ref": row["relation_ref"],
                "context_title": row["context_title"],
                "environment_ref": environment_ref,
                "segment_ref": segment_ref,
                "object_ref": row["object_ref"],
                "route": "/environment-mapping",
                "route_params": {
                    "environment_ref": environment_ref,
                    **({"segment_ref": segment_ref} if segment_ref else {}),
                    "object_ref": row["object_ref"],
                },
            }
        )
    master_ids = [
        row["id"]
        for master_type in MASTER_TYPES
        for row in connection.execute(
            "SELECT id FROM knowledge_items WHERE type=?",
            (master_type,),
        )
    ]
    placeholders = ",".join("?" for _ in master_ids)
    result["evidence_ref_count"] = connection.execute(
        f"""
        SELECT COUNT(*) FROM source_references
        WHERE target_type='item' AND target_id IN ({placeholders})
        """,
        tuple(master_ids),
    ).fetchone()[0]
    return result


def validate_candidate_dictionary(package: dict[str, Any]) -> dict[str, Any]:
    blockers = []
    if package["schema_version"] != "environment-dictionary-v1":
        blockers.append("schema_version错误")
    expected_counts = {
        "information_environments": 10,
        "environment_segment_types": 16,
        "information_objects": 51,
    }
    if package["master_counts"] != expected_counts:
        blockers.append(f"主数据统计错误：{package['master_counts']}")
    if package["context_counts"] != {
        "environment_segments": 29,
        "environment_object_contexts": 67,
    }:
        blockers.append(f"上下文统计错误：{package['context_counts']}")
    forbidden = {
        "sheet",
        "row",
        "column",
        "raw_value",
        "source_file",
        "source_file_id",
        "import_id",
        "import_job_id",
        "metadata",
    }

    def walk(value: Any) -> None:
        if isinstance(value, list):
            for item in value:
                walk(item)
        elif isinstance(value, dict):
            leaked = forbidden.intersection(value)
            if leaked:
                blockers.append(f"候选包泄漏字段：{sorted(leaked)}")
            for item in value.values():
                walk(item)

    walk(package)
    master_records = (
        package["information_environments"]
        + package["environment_segment_types"]
        + package["information_objects"]
    )
    if len(master_records) != 77:
        blockers.append("候选包主数据不是77条")
    if len({row["code"] for row in master_records}) != 77:
        blockers.append("候选包业务编号重复")
    if len(package["usage_relations"]) != 106:
        blockers.append(
            f"候选包usage_relations不是106：{len(package['usage_relations'])}"
        )
    return {
        "result": "pass" if not blockers else "blocked",
        "blockers": blockers,
        "master_counts": package["master_counts"],
        "context_counts": package["context_counts"],
        "usage_relation_count": len(package["usage_relations"]),
        "evidence_ref_count": package["evidence_ref_count"],
    }


def rollback_plan(
    connection: sqlite3.Connection,
    plan_data: dict[str, Any],
    before_codes: dict[str, str | None],
) -> dict[str, int]:
    result = {
        "source_references_deleted": 0,
        "change_logs_deleted": 0,
        "instance_of_deleted": 0,
        "segment_types_deleted": 0,
        "codes_restored": 0,
    }
    relation_ids = [
        row["planned_relation_id"] for row in plan_data["relations"]
    ]
    segment_type_ids = [
        row["database_id"]
        for row in plan_data["allocations"]
        if row["master_type"] == "environment_segment_type"
    ]
    log_ids = [
        change_log_id("code", row["database_id"])
        for row in plan_data["allocations"]
        if row["decision"] == "reuse"
    ]
    log_ids += [
        change_log_id("item", item_id) for item_id in segment_type_ids
    ]
    log_ids += [
        change_log_id("relation", relation_id) for relation_id in relation_ids
    ]
    connection.execute("BEGIN IMMEDIATE")
    try:
        for relation in plan_data["relations"]:
            row = connection.execute(
                """
                SELECT id, source_item_id, target_item_id, relation_type, stable_ref
                FROM knowledge_relations WHERE id=?
                """,
                (relation["planned_relation_id"],),
            ).fetchone()
            if not row:
                raise ValueError(
                    f"回退前缺少instance_of：{relation['stable_ref']}"
                )
            if (
                row["source_item_id"] != relation["source_item_id"]
                or row["target_item_id"] != relation["target_planned_id"]
                or row["relation_type"] != "instance_of"
                or row["stable_ref"] != relation["stable_ref"]
            ):
                raise ValueError(
                    f"回退前instance_of内容冲突：{relation['stable_ref']}"
                )
        for item_id in segment_type_ids:
            row = connection.execute(
                "SELECT type FROM knowledge_items WHERE id=?",
                (item_id,),
            ).fetchone()
            if not row or row["type"] != "environment_segment_type":
                raise ValueError(f"回退前环境子类类型冲突：{item_id}")

        for target_type, target_ids in (
            ("relation", relation_ids),
            ("item", segment_type_ids),
        ):
            placeholders = ",".join("?" for _ in target_ids)
            cursor = connection.execute(
                f"""
                DELETE FROM source_references
                WHERE target_type=? AND target_id IN ({placeholders})
                """,
                (target_type, *target_ids),
            )
            result["source_references_deleted"] += cursor.rowcount
        placeholders = ",".join("?" for _ in log_ids)
        result["change_logs_deleted"] = connection.execute(
            f"DELETE FROM change_logs WHERE id IN ({placeholders})",
            tuple(log_ids),
        ).rowcount
        placeholders = ",".join("?" for _ in relation_ids)
        result["instance_of_deleted"] = connection.execute(
            f"DELETE FROM knowledge_relations WHERE id IN ({placeholders})",
            tuple(relation_ids),
        ).rowcount
        placeholders = ",".join("?" for _ in segment_type_ids)
        result["segment_types_deleted"] = connection.execute(
            f"DELETE FROM knowledge_items WHERE id IN ({placeholders})",
            tuple(segment_type_ids),
        ).rowcount
        for item_id, before_code in before_codes.items():
            row = connection.execute(
                "SELECT code FROM knowledge_items WHERE id=?",
                (item_id,),
            ).fetchone()
            if not row:
                raise ValueError(f"回退编号目标不存在：{item_id}")
            planned_code = next(
                allocation["code"]
                for allocation in plan_data["allocations"]
                if allocation["database_id"] == item_id
            )
            if row["code"] != planned_code:
                raise ValueError(
                    f"回退前编号冲突：{item_id} expected={planned_code} actual={row['code']}"
                )
            connection.execute(
                "UPDATE knowledge_items SET code=? WHERE id=?",
                (before_code, item_id),
            )
            result["codes_restored"] += 1
        connection.execute("COMMIT")
        return result
    except Exception:
        connection.execute("ROLLBACK")
        raise


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    fieldnames = list(rows[0]) if rows else []
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def markdown_report(report: dict[str, Any]) -> str:
    apply_result = report["apply"]["first"]
    repeat_result = report["apply"]["repeat"]
    rollback = report["rollback"]["actions"]
    return "\n".join(
        [
            "# PLAN-ENV-MD P3 临时迁移与回退演练",
            "",
            f"- run_id: `{report['run_id']}`",
            f"- result: `{report['gate']['result']}`",
            "- formal_apply_authorized: `false`",
            "- temporary_database_retained: `false`",
            "",
            "## 首次 apply",
            "",
            f"- codes_backfilled: `{apply_result['codes_backfilled']}`",
            f"- segment_types_created: `{apply_result['segment_types_created']}`",
            f"- instance_of_created: `{apply_result['instance_of_created']}`",
            f"- source_references_created: `{apply_result['source_references_created']}`",
            f"- change_logs_created: `{apply_result['change_logs_created']}`",
            "",
            "## 重复 apply",
            "",
            f"- total mutations: `{sum(repeat_result.values())}`",
            "- expected: `0`",
            "",
            "## 临时候选包与开关回退",
            "",
            f"- candidate validation: `{report['package_rehearsal']['validation']['result']}`",
            "- switch sequence: `false → true → false`",
            "- candidate package retained: `false`",
            "- formal environment package modified: `false`",
            "",
            "## SQLite逆向回退",
            "",
            f"- codes_restored: `{rollback['codes_restored']}`",
            f"- segment_types_deleted: `{rollback['segment_types_deleted']}`",
            f"- instance_of_deleted: `{rollback['instance_of_deleted']}`",
            f"- logical snapshot restored: `{str(report['rollback']['logical_snapshot_restored']).lower()}`",
            f"- injected transaction rollback restored: `{str(report['failure_injection']['logical_snapshot_restored']).lower()}`",
            "",
            "## 边界",
            "",
            "- SQLite文件经提交/删除后物理页布局可以变化，因此回退判定使用业务表逻辑哈希、FTS逻辑结果、schema、计数、外键和integrity，而非伪要求临时文件字节哈希相同。",
            "- 正式基础库、用户库、源Excel、环境工作台包和底图语义文件前后SHA-256一致。",
            "- P4才实现正式影子导出/API；P6正式apply仍需单独授权和恢复包。",
            "",
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Rehearse PLAN-ENV-MD P3 apply, repeat apply, package fallback, and rollback in a temporary SQLite copy."
    )
    parser.add_argument("--base-db", default=str(DEFAULT_BASE_DB))
    parser.add_argument("--user-db", default=str(DEFAULT_USER_DB))
    parser.add_argument("--source-workbook", default=str(DEFAULT_WORKBOOK))
    parser.add_argument("--environment-workbench", default=str(DEFAULT_WORKBENCH))
    parser.add_argument("--environment-basemap", default=str(DEFAULT_BASEMAP))
    parser.add_argument("--p2-output", default=str(DEFAULT_P2_OUTPUT))
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    parser.add_argument("--run-id")
    args = parser.parse_args()

    started = utc_now()
    run_id = args.run_id or f"p3-{started.strftime('%Y%m%dT%H%M%SZ')}"
    output_dir = Path(args.output_root).resolve() / run_id
    output_dir.mkdir(parents=True, exist_ok=False)
    p2_output = Path(args.p2_output).resolve()
    paths = {
        "base_database": Path(args.base_db).resolve(),
        "user_database": Path(args.user_db).resolve(),
        "source_workbook": Path(args.source_workbook).resolve(),
        "environment_workbench": Path(args.environment_workbench).resolve(),
        "environment_basemap_semantic": Path(
            args.environment_basemap
        ).resolve(),
    }
    plan_data = load_plan(p2_output)
    hashes_before = validate_formal_inputs(plan_data, paths)
    p2_manifest_hash = sha256_file(p2_output / "manifest.json")

    ledger = []
    for allocation in plan_data["allocations"]:
        ledger.append(
            {
                "operation": (
                    "backfill_code"
                    if allocation["decision"] == "reuse"
                    else "create_master"
                ),
                "target_type": allocation["master_type"],
                "target_id": allocation["database_id"],
                "stable_ref": allocation["stable_ref"],
                "code": allocation["code"],
                "rollback": (
                    "restore_code"
                    if allocation["decision"] == "reuse"
                    else "delete_created_master"
                ),
            }
        )
    for relation in plan_data["relations"]:
        ledger.append(
            {
                "operation": "create_relation",
                "target_type": "instance_of",
                "target_id": relation["planned_relation_id"],
                "stable_ref": relation["stable_ref"],
                "code": relation["target_code"],
                "rollback": "delete_created_relation",
            }
        )

    with tempfile.TemporaryDirectory(prefix="sapd-p3-env-md-") as temp_dir:
        temp_root = Path(temp_dir)
        temp_db = temp_root / "sapd_wiki.p3.sqlite3"
        sqlite_backup(paths["base_database"], temp_db)
        with connect_database(temp_db) as connection:
            baseline = logical_snapshot(connection)
            baseline_protected = protected_apply_hashes(connection)
            before_codes = {
                allocation["database_id"]: connection.execute(
                    "SELECT code FROM knowledge_items WHERE id=?",
                    (allocation["database_id"],),
                ).fetchone()["code"]
                for allocation in plan_data["allocations"]
                if allocation["decision"] == "reuse"
            }
            first_apply = apply_plan(connection, plan_data)
            applied_snapshot = logical_snapshot(connection)
            applied_protected = protected_apply_hashes(connection)
            applied_validation = validate_applied_state(connection, plan_data)
            repeat_apply = apply_plan(connection, plan_data)
            repeated_snapshot = logical_snapshot(connection)
            repeated_validation = validate_applied_state(connection, plan_data)

            candidate = candidate_dictionary(
                connection, plan_data, iso_utc(started)
            )
            candidate_validation = validate_candidate_dictionary(candidate)
            candidate_path = temp_root / "environment-dictionary.candidate.json"
            write_json(candidate_path, candidate)
            candidate_hash = sha256_file(candidate_path)
            switch_path = temp_root / "feature-switch.json"
            write_json(
                switch_path,
                {"environment_master_dictionary_enabled": False},
            )
            switch_initial = read_json(switch_path)
            write_json(
                switch_path,
                {"environment_master_dictionary_enabled": True},
            )
            switch_enabled = read_json(switch_path)
            write_json(
                switch_path,
                {"environment_master_dictionary_enabled": False},
            )
            switch_rolled_back = read_json(switch_path)
            candidate_path.unlink()
            package_rollback = {
                "candidate_removed": not candidate_path.exists(),
                "fallback_hash_unchanged": (
                    sha256_file(paths["environment_workbench"])
                    == hashes_before["environment_workbench"]
                ),
            }

            rollback_actions = rollback_plan(
                connection, plan_data, before_codes
            )
            rolled_back_snapshot = logical_snapshot(connection)
            rolled_back_protected = protected_apply_hashes(connection)
            try:
                apply_plan(
                    connection,
                    plan_data,
                    fail_after_code_backfill=True,
                )
                failpoint_error = None
            except RuntimeError as error:
                failpoint_error = str(error)
            after_failpoint_snapshot = logical_snapshot(connection)

    hashes_after = {name: sha256_file(path) for name, path in paths.items()}
    blockers = []
    if baseline["integrity_check"] != "ok" or baseline["foreign_key_check"]:
        blockers.append("临时基础库副本基线完整性失败")
    if applied_validation["result"] != "pass":
        blockers.extend(applied_validation["blockers"])
    if repeated_validation["result"] != "pass":
        blockers.extend(repeated_validation["blockers"])
    if sum(repeat_apply.values()) != 0:
        blockers.append(f"重复apply仍有写入：{repeat_apply}")
    if applied_protected != baseline_protected:
        blockers.append("apply改变了既有对象身份、旧关系或旧来源证据")
    if repeated_snapshot != applied_snapshot:
        blockers.append("重复apply后逻辑快照发生变化")
    if candidate_validation["result"] != "pass":
        blockers.extend(candidate_validation["blockers"])
    if switch_initial["environment_master_dictionary_enabled"] is not False:
        blockers.append("临时开关初始状态不是false")
    if switch_enabled["environment_master_dictionary_enabled"] is not True:
        blockers.append("临时开关未成功启用")
    if (
        switch_rolled_back["environment_master_dictionary_enabled"]
        is not False
    ):
        blockers.append("临时开关未成功回退")
    if not all(package_rollback.values()):
        blockers.append(f"候选包回退失败：{package_rollback}")
    if rolled_back_snapshot != baseline:
        blockers.append("SQLite逆向回退后逻辑快照未恢复")
    if rolled_back_protected != baseline_protected:
        blockers.append("SQLite逆向回退后保护记录未恢复")
    if rollback_actions != {
        "source_references_deleted": 58,
        "change_logs_deleted": 106,
        "instance_of_deleted": 29,
        "segment_types_deleted": 16,
        "codes_restored": 61,
    }:
        blockers.append(f"回退动作数量错误：{rollback_actions}")
    if failpoint_error != "P3_FAILPOINT_AFTER_CODE_BACKFILL":
        blockers.append("失败注入未触发预期异常")
    if after_failpoint_snapshot != baseline:
        blockers.append("失败注入事务rollback后逻辑快照未恢复")
    if hashes_before != hashes_after:
        blockers.append("正式保护输入哈希发生变化")

    report = {
        "schema_version": "environment-master-data-p3-rehearsal-v1",
        "plan_id": "PLAN-ENV-MD",
        "phase": "P3",
        "run_id": run_id,
        "generated_at": iso_utc(started),
        "source_p2_run_id": plan_data["plan"]["run_id"],
        "p2_manifest_sha256": p2_manifest_hash,
        "formal_apply_authorized": False,
        "temporary_database": {
            "created_with_sqlite_backup": True,
            "retained": False,
            "physical_file_hash_used_as_rollback_gate": False,
        },
        "protected_inputs": {
            "hashes_before": hashes_before,
            "hashes_after": hashes_after,
            "unchanged": hashes_before == hashes_after,
        },
        "baseline": baseline,
        "apply": {
            "first": first_apply,
            "validation": applied_validation,
            "protected_hashes_unchanged": (
                applied_protected == baseline_protected
            ),
            "repeat": repeat_apply,
            "repeat_validation": repeated_validation,
            "repeat_logical_snapshot_unchanged": (
                repeated_snapshot == applied_snapshot
            ),
        },
        "package_rehearsal": {
            "candidate_sha256": candidate_hash,
            "candidate_retained": False,
            "validation": candidate_validation,
            "switch_sequence": [
                switch_initial,
                switch_enabled,
                switch_rolled_back,
            ],
            "rollback": package_rollback,
            "formal_package_modified": False,
        },
        "rollback": {
            "actions": rollback_actions,
            "logical_snapshot_restored": rolled_back_snapshot == baseline,
            "protected_hashes_restored": (
                rolled_back_protected == baseline_protected
            ),
            "snapshot": rolled_back_snapshot,
        },
        "failure_injection": {
            "failpoint": "after_code_backfill_before_commit",
            "error": failpoint_error,
            "logical_snapshot_restored": (
                after_failpoint_snapshot == baseline
            ),
        },
        "gate": {
            "result": "ready_for_p4_shadow_export"
            if not blockers
            else "blocked",
            "blockers": blockers,
            "formal_apply_authorized": False,
        },
    }
    report_path = output_dir / "p3-migration-rehearsal.json"
    markdown_path = output_dir / "p3-migration-rehearsal.md"
    ledger_path = output_dir / "migration-before-after-ledger.csv"
    rollback_path = output_dir / "rollback-manifest.json"
    snapshots_path = output_dir / "logical-snapshot-hashes.json"
    write_json(report_path, report)
    markdown_path.write_text(markdown_report(report), encoding="utf-8")
    write_csv(ledger_path, ledger)
    write_json(
        rollback_path,
        {
            "schema_version": "environment-master-data-p3-rollback-manifest-v1",
            "run_id": run_id,
            "formal_apply_authorized": False,
            "restore_codes": [
                {
                    "item_id": item_id,
                    "before_code": before_code,
                }
                for item_id, before_code in sorted(before_codes.items())
            ],
            "delete_relation_ids": [
                row["planned_relation_id"]
                for row in plan_data["relations"]
            ],
            "delete_item_ids": [
                row["database_id"]
                for row in plan_data["allocations"]
                if row["master_type"] == "environment_segment_type"
            ],
            "expected_actions": rollback_actions,
        },
    )
    write_json(
        snapshots_path,
        {
            "schema_version": "environment-master-data-p3-logical-snapshots-v1",
            "run_id": run_id,
            "baseline": baseline,
            "applied": applied_snapshot,
            "rolled_back": rolled_back_snapshot,
            "after_failure_injection": after_failpoint_snapshot,
            "physical_file_hash_is_not_a_rollback_gate": True,
        },
    )
    output_files = [
        report_path,
        markdown_path,
        ledger_path,
        rollback_path,
        snapshots_path,
    ]
    write_json(
        output_dir / "manifest.json",
        {
            "schema_version": "worker-verify-manifest-v1",
            "run_id": run_id,
            "generated_at": iso_utc(started),
            "formal_apply_authorized": False,
            "files": [
                {
                    "path": path.name,
                    "sha256": sha256_file(path),
                    "size": path.stat().st_size,
                }
                for path in output_files
            ],
        },
    )
    print(
        json.dumps(
            {
                "output_dir": str(output_dir),
                "gate": report["gate"],
                "first_apply": first_apply,
                "repeat_apply": repeat_apply,
                "rollback": rollback_actions,
                "package_rehearsal": report["package_rehearsal"],
                "protected_inputs_unchanged": report["protected_inputs"][
                    "unchanged"
                ],
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if not blockers else 1


if __name__ == "__main__":
    raise SystemExit(main())
