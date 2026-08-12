#!/usr/bin/env python3
"""Build the approved Phase 2 Batch 1 two-relation SQLite candidate.

This is intentionally a narrow candidate gate, not a general migration tool.
It parses the existing scene-sheet ETL owner, stages only the two approved
service-to-measure relations, and fails closed on every other business delta.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from sapd_wiki.candidates import ParseResult, item_key  # noqa: E402
from sapd_wiki.db import connect  # noqa: E402
from sapd_wiki.loader import approve_import  # noqa: E402
from sapd_wiki.parsers import parse_core_sheets  # noqa: E402
from sapd_wiki.projection_contract import build_release_projection_identity  # noqa: E402
from sapd_wiki.source_files import (  # noqa: E402
    create_import_job,
    register_source_file,
    update_import_job_summary,
)
from sapd_wiki.staging import write_staging  # noqa: E402


FORMAL_SHA256 = "30d14679c7d8b7743fba129af38afde7b943bcdd707ff7b8a57bce5146f54c9e"
SOURCE_SHA256 = "8127291446b44000e1390b269ad727f17cae0a04cdc7c0ea3dc1310f460e890f"
SCENE_SHEET = "作用域-安全技术服务-安全技术模块映射"
MEASURE_TITLE = "应用系统自身认证模块"
APPROVED_SERVICE_CODES = ("I-AP&T-AS.IA-02", "I-US&T-AS.IA-02")
APPROVED_SOURCE_ROWS = {
    "I-AP&T-AS.IA-02": (144, 224, 320, 343, 373, 392, 523, 537),
    "I-US&T-AS.IA-02": (188, 272, 481),
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _rows(conn: sqlite3.Connection, query: str) -> list[tuple]:
    return [tuple(row) for row in conn.execute(query).fetchall()]


def _business_snapshot(path: Path) -> dict[str, object]:
    conn = sqlite3.connect(f"file:{path}?mode=ro&immutable=1", uri=True)
    try:
        objects = _rows(
            conn,
            "SELECT * FROM knowledge_items ORDER BY id",
        )
        relations = _rows(
            conn,
            """
            SELECT source_item_id, relation_type, target_item_id
            FROM knowledge_relations
            ORDER BY source_item_id, relation_type, target_item_id
            """,
        )
        counts = dict(
            conn.execute(
                "SELECT type, COUNT(*) FROM knowledge_items WHERE status='active' GROUP BY type"
            ).fetchall()
        )
        return {
            "objects": objects,
            "relations": relations,
            "active_object_counts": counts,
        }
    finally:
        conn.close()


def _approved_relations(workbook: Path):
    parsed = parse_core_sheets(workbook, [SCENE_SHEET])
    service_keys = {
        item_key("security_technical_service", code, "") for code in APPROVED_SERVICE_CODES
    }
    measure_key = item_key("security_technical_measure", None, MEASURE_TITLE)
    approved = [
        relation
        for relation in parsed.relations
        if relation.relation_type == "uses_measure"
        and relation.source_key in service_keys
        and relation.target_key == measure_key
    ]
    grouped = {relation.source_key: relation for relation in approved}
    if set(grouped) != service_keys:
        raise RuntimeError("approved scene relations are not exactly present")
    return approved


def _expected_relation_delta(conn: sqlite3.Connection) -> set[tuple[str, str, str]]:
    rows = conn.execute(
        """
        SELECT service.id, service.code, measure.id
        FROM knowledge_items AS service
        CROSS JOIN knowledge_items AS measure
        WHERE service.type='security_technical_service'
          AND service.code IN (?, ?)
          AND measure.type='security_technical_measure'
          AND measure.title=?
        """,
        (*APPROVED_SERVICE_CODES, MEASURE_TITLE),
    ).fetchall()
    if len(rows) != 2:
        raise RuntimeError("candidate endpoints are not unique in the base database")
    return {(row[0], "uses_measure", row[2]) for row in rows}


def _verify_provenance(
    conn: sqlite3.Connection,
    *,
    source_file_id: str,
) -> dict[str, list[dict[str, object]]]:
    evidence: dict[str, list[dict[str, object]]] = {}
    for code, expected_rows in APPROVED_SOURCE_ROWS.items():
        relation = conn.execute(
            """
            SELECT relation.id
            FROM knowledge_relations AS relation
            JOIN knowledge_items AS service ON service.id=relation.source_item_id
            JOIN knowledge_items AS measure ON measure.id=relation.target_item_id
            WHERE relation.relation_type='uses_measure'
              AND service.type='security_technical_service' AND service.code=?
              AND measure.type='security_technical_measure' AND measure.title=?
            """,
            (code, MEASURE_TITLE),
        ).fetchone()
        if relation is None:
            raise RuntimeError(f"candidate relation missing: {code}")
        rows = conn.execute(
            """
            SELECT ref.source_sheet, ref.source_row, ref.source_column,
                   ref.source_cell, ref.raw_value, ref.source_hash
            FROM source_references AS ref
            WHERE ref.target_type='relation' AND ref.target_id=?
              AND ref.source_file_id=?
            ORDER BY ref.source_row, ref.source_cell
            """,
            (relation[0], source_file_id),
        ).fetchall()
        expected = {
            (row, f"F{row}", "安全技术服务") for row in expected_rows
        } | {
            (row, f"G{row}", "安全技术模块/措施") for row in expected_rows
        }
        actual = {(row[1], row[3], row[2]) for row in rows}
        if actual != expected or any(row[0] != SCENE_SHEET or row[5] != SOURCE_SHA256 for row in rows):
            raise RuntimeError(f"candidate provenance mismatch: {code}")
        evidence[code] = [
            {
                "sheet": row[0],
                "row": row[1],
                "column": row[2],
                "cell": row[3],
                "raw_value": row[4],
                "source_hash": row[5],
            }
            for row in rows
        ]
    return evidence


def build_candidate(
    *,
    base_database: Path,
    workbook: Path,
    content_asset_database: Path,
    output_dir: Path,
) -> dict[str, object]:
    base_database = base_database.resolve()
    workbook = workbook.resolve()
    content_asset_database = content_asset_database.resolve()
    output_dir = output_dir.resolve()
    if output_dir.exists() and any(output_dir.iterdir()):
        raise RuntimeError("candidate output directory must be empty")
    output_dir.mkdir(parents=True, exist_ok=True)

    base_before_sha = sha256_file(base_database)
    source_sha = sha256_file(workbook)
    if base_before_sha != FORMAL_SHA256:
        raise RuntimeError(f"formal base CAS mismatch: {base_before_sha}")
    if source_sha != SOURCE_SHA256:
        raise RuntimeError(f"source workbook CAS mismatch: {source_sha}")

    baseline_snapshot = _business_snapshot(base_database)
    candidate_database = output_dir / "sapd_wiki.measure-candidate.sqlite3"
    rollback_database = output_dir / "sapd_wiki.formal-rollback.sqlite3"
    shutil.copy2(base_database, candidate_database)
    shutil.copy2(base_database, rollback_database)

    relations = _approved_relations(workbook)
    conn = connect(candidate_database)
    try:
        expected_delta = _expected_relation_delta(conn)
        with conn:
            conn.execute(
                """
                UPDATE content_schema_meta SET value=?, updated_at=datetime('now')
                WHERE key='base_database_sha256'
                """,
                (base_before_sha,),
            )
            source_file = register_source_file(
                conn,
                workbook,
                usage_policy="import_source",
                sensitive_level="internal",
            )
            import_job_id = create_import_job(
                conn,
                source_file.id,
                job_type="batch_import",
                status="reviewing",
            )
            stage_summary = write_staging(
                conn,
                import_job_id,
                ParseResult(relations=relations),
            )
            update_import_job_summary(
                conn,
                import_job_id,
                status="reviewing",
                summary_json=json.dumps(
                    {
                        "source_file": {
                            "id": source_file.id,
                            "file_path": source_file.file_path,
                            "file_hash": source_file.file_hash,
                            "created": source_file.created,
                        },
                        "selected_sheets": [SCENE_SHEET],
                        "approved_relation_keys": sorted(
                            relation.key for relation in relations
                        ),
                        "stage_summary": stage_summary.to_dict(),
                    },
                    ensure_ascii=False,
                    sort_keys=True,
                ),
            )
        approval = approve_import(conn, import_job_id)
        if approval.relations_created != 2 or approval.items_created or approval.items_updated:
            raise RuntimeError(f"unexpected approval delta: {approval.to_dict()}")
        provenance = _verify_provenance(conn, source_file_id=source_file.id)
        schema_row = conn.execute(
            "SELECT value FROM content_schema_meta WHERE key='schema_version'"
        ).fetchone()
        if schema_row is None or not str(schema_row[0]).strip():
            raise RuntimeError("candidate database schema version is missing")
        database_schema_version = str(schema_row[0]).strip()
        if conn.execute("PRAGMA foreign_key_check").fetchall():
            raise RuntimeError("candidate foreign key check failed")
    finally:
        conn.close()

    candidate_snapshot = _business_snapshot(candidate_database)
    if candidate_snapshot["objects"] != baseline_snapshot["objects"]:
        raise RuntimeError("candidate changed knowledge item data or ownership")
    if candidate_snapshot["active_object_counts"] != baseline_snapshot["active_object_counts"]:
        raise RuntimeError("candidate changed active object counts")
    before_relations = set(baseline_snapshot["relations"])
    after_relations = set(candidate_snapshot["relations"])
    if after_relations - before_relations != expected_delta or before_relations - after_relations:
        raise RuntimeError("candidate relation delta is not exactly the approved two relations")

    candidate_sha = sha256_file(candidate_database)
    content_asset_sha = sha256_file(content_asset_database)
    identity = build_release_projection_identity(
        base_database=candidate_database,
        artifact_db_sha256=candidate_sha,
    )
    manifest = {
        **identity,
        "candidate_kind": "phase2-batch1-capability-measure-relations",
        "base_database": {
            "path": candidate_database.name,
            "sha256": candidate_sha,
            "size": candidate_database.stat().st_size,
            "schema_version": database_schema_version,
        },
        "content_asset_database": {
            "path": str(content_asset_database),
            "sha256": content_asset_sha,
            "size": content_asset_database.stat().st_size,
        },
        "source_workbook": {
            "source_file_id": source_file.id,
            "import_job_id": import_job_id,
            "path": str(workbook),
            "sha256": source_sha,
        },
        "parent_artifact_db_sha256": base_before_sha,
        "relation_delta": [list(value) for value in sorted(expected_delta)],
        "object_delta": 0,
        "provenance": provenance,
    }
    rollback_manifest = {
        "apply_precondition_artifact_db_sha256": base_before_sha,
        "candidate_artifact_db_sha256": candidate_sha,
        "restore_artifact_db_sha256": base_before_sha,
        "restore_database": rollback_database.name,
        "user_database_action": "preserve-in-place-no-downgrade-no-overwrite",
        "system_rollback_requirement": "restore the previous complete Web/macOS/Windows release set; database-only rollback is insufficient",
    }
    (output_dir / "candidate-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    (output_dir / "rollback-manifest.json").write_text(
        json.dumps(rollback_manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return {
        "candidate_database": str(candidate_database),
        "rollback_database": str(rollback_database),
        "candidate_manifest": str(output_dir / "candidate-manifest.json"),
        "rollback_manifest": str(output_dir / "rollback-manifest.json"),
        "manifest": manifest,
        "rollback": rollback_manifest,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-db", type=Path, required=True)
    parser.add_argument("--workbook", type=Path, required=True)
    parser.add_argument("--content-asset-db", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    report = build_candidate(
        base_database=args.base_db,
        workbook=args.workbook,
        content_asset_database=args.content_asset_db,
        output_dir=args.output_dir,
    )
    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
