#!/usr/bin/env python3
"""Remove the known empty Draw.io tab from queryable SAPD content."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import socket
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_FORMAL_QUERY = ROOT / "data/database/sapd_wiki.sqlite3"
DEFAULT_FORMAL_ASSET = ROOT / "data/database/sapd_content_assets.sqlite3"
DEFAULT_USER_DATABASE = ROOT / "data/user/sapd_wiki_user.sqlite3"
DEFAULT_OUTPUT_ROOT = (
    ROOT
    / "data/exports/worker-verify/base-content-unified-query/"
    "empty-drawio-content-repair"
)
DOCUMENT_REF = "base:content_document:sapd-security-architecture-model"
EMPTY_PAGE_REF = f"{DOCUMENT_REF}:page:002"
EXPECTED_PAGE_REFS = [
    f"{DOCUMENT_REF}:page:001",
    f"{DOCUMENT_REF}:page:003",
]
EXPECTED_PAGE_TITLES = ["图例", "信息化环境及对象底图"]
EXPECTED_COUNTS = {
    "knowledge_items": 4694,
    "knowledge_relations": 7786,
    "content_documents": 9,
    "content_fragments": 609,
    "content_relations": 684,
    "content_source_evidence": 1302,
}
APPLY_CONFIRMATION = "APPLY_EMPTY_DRAWIO_CONTENT_REPAIR"
RESTORE_CONFIRMATION = "RESTORE_EMPTY_DRAWIO_CONTENT_REPAIR"


def json_text(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_state(path: Path) -> dict[str, Any]:
    return {
        "exists": path.is_file(),
        "bytes": path.stat().st_size if path.is_file() else 0,
        "sha256": sha256_file(path) if path.is_file() else None,
    }


def connect(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = DELETE")
    return connection


def table_digest(
    connection: sqlite3.Connection,
    table: str,
    *,
    columns: Iterable[str] | None = None,
) -> str:
    selected = list(
        columns
        or [
            row["name"]
            for row in connection.execute(f"PRAGMA table_info({table})")
        ]
    )
    order = ", ".join(selected)
    digest = hashlib.sha256()
    for row in connection.execute(
        f"SELECT {', '.join(selected)} FROM {table} ORDER BY {order}"
    ):
        digest.update(json_text(list(row)).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


def query_snapshot(connection: sqlite3.Connection) -> dict[str, Any]:
    tables = (
        "content_documents",
        "content_fragments",
        "content_relations",
        "content_bindings",
        "content_source_evidence",
    )
    return {
        "counts": {
            table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in tables
        },
        "digests": {
            table: table_digest(connection, table)
            for table in tables
        },
        "fragmentTypes": {
            row[0]: row[1]
            for row in connection.execute(
                """
                SELECT fragment_type, COUNT(*)
                FROM content_fragments
                GROUP BY fragment_type
                ORDER BY fragment_type
                """
            )
        },
        "extractionStatuses": {
            row[0]: row[1]
            for row in connection.execute(
                """
                SELECT extraction_status, COUNT(*)
                FROM content_fragments
                GROUP BY extraction_status
                ORDER BY extraction_status
                """
            )
        },
    }


def content_manifest_digest(snapshot: dict[str, Any]) -> str:
    return "sha256:" + hashlib.sha256(
        json_text(
            {
                "counts": snapshot["counts"],
                "digests": snapshot["digests"],
                "fragmentTypes": snapshot["fragmentTypes"],
                "extractionStatuses": snapshot["extractionStatuses"],
            }
        ).encode("utf-8")
    ).hexdigest()


def database_counts(connection: sqlite3.Connection) -> dict[str, int]:
    return {
        table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        for table in EXPECTED_COUNTS
    }


def database_integrity(connection: sqlite3.Connection) -> dict[str, Any]:
    return {
        "integrity_check": connection.execute(
            "PRAGMA integrity_check"
        ).fetchone()[0],
        "foreign_key_violations": len(
            connection.execute("PRAGMA foreign_key_check").fetchall()
        ),
    }


def validate_query(connection: sqlite3.Connection) -> dict[str, Any]:
    pages = connection.execute(
        """
        SELECT fragment.stable_ref, fragment.title
        FROM content_fragments AS fragment
        JOIN content_documents AS document ON document.id=fragment.document_id
        WHERE document.stable_ref=?
          AND fragment.fragment_type='drawio_page'
        ORDER BY fragment.ordinal, fragment.stable_ref
        """,
        (DOCUMENT_REF,),
    ).fetchall()
    document = connection.execute(
        "SELECT metadata_json FROM content_documents WHERE stable_ref=?",
        (DOCUMENT_REF,),
    ).fetchone()
    metadata = json.loads(document["metadata_json"]) if document else {}
    empty_ref_uses = {
        "fragments": connection.execute(
            "SELECT COUNT(*) FROM content_fragments WHERE stable_ref=?",
            (EMPTY_PAGE_REF,),
        ).fetchone()[0],
        "relations": connection.execute(
            """
            SELECT COUNT(*) FROM content_relations
            WHERE source_ref=? OR target_ref=? OR stable_ref=?
            """,
            (
                EMPTY_PAGE_REF,
                EMPTY_PAGE_REF,
                f"{DOCUMENT_REF}:contains:page:002",
            ),
        ).fetchone()[0],
        "evidence": connection.execute(
            """
            SELECT COUNT(*) FROM content_source_evidence
            WHERE target_ref=? OR target_ref=?
            """,
            (EMPTY_PAGE_REF, f"{DOCUMENT_REF}:contains:page:002"),
        ).fetchone()[0],
    }
    counts = database_counts(connection)
    integrity = database_integrity(connection)
    connection.execute(
        "INSERT INTO content_fragments_fts(content_fragments_fts) VALUES('integrity-check')"
    )
    passed = (
        counts == EXPECTED_COUNTS
        and [row["stable_ref"] for row in pages] == EXPECTED_PAGE_REFS
        and [row["title"] for row in pages] == EXPECTED_PAGE_TITLES
        and empty_ref_uses == {"fragments": 0, "relations": 0, "evidence": 0}
        and "expected_pages" not in metadata
        and metadata.get("contentUnitCount") == 2
        and metadata.get("contentUnitMode") == "independent"
        and integrity == {
            "integrity_check": "ok",
            "foreign_key_violations": 0,
        }
    )
    return {
        "counts": counts,
        "drawioContentRefs": [row["stable_ref"] for row in pages],
        "drawioContentTitles": [row["title"] for row in pages],
        "emptyPageReferences": empty_ref_uses,
        "documentBusinessMetadata": metadata,
        "integrity": integrity,
        "pass": passed,
    }


def repair_query(connection: sqlite3.Connection, timestamp: str) -> dict[str, Any]:
    page = connection.execute(
        """
        SELECT stable_ref, body, notes, metadata_json
        FROM content_fragments
        WHERE stable_ref=? AND fragment_type='drawio_page'
        """,
        (EMPTY_PAGE_REF,),
    ).fetchone()
    if page is None:
        validation = validate_query(connection)
        if not validation["pass"]:
            raise ValueError("empty Draw.io page is absent but repaired state is invalid")
        digest_row = connection.execute(
            """
            SELECT value FROM content_schema_meta
            WHERE key='content_manifest_digest'
            """
        ).fetchone()
        if digest_row is None:
            raise ValueError("content manifest digest is missing")
        return {
            "already_repaired": True,
            "content_manifest_digest": digest_row["value"],
            "validation": validation,
        }
    page_metadata = json.loads(page["metadata_json"])
    if (
        str(page["body"]).strip()
        or str(page["notes"]).strip()
        or page_metadata.get("vertexCount") != 0
        or page_metadata.get("edgeCount") != 0
    ):
        raise ValueError("target Draw.io page is not empty; refusing repair")

    relation_rows = connection.execute(
        """
        SELECT stable_ref
        FROM content_relations
        WHERE source_ref=? OR target_ref=?
        ORDER BY stable_ref
        """,
        (EMPTY_PAGE_REF, EMPTY_PAGE_REF),
    ).fetchall()
    relation_refs = [row["stable_ref"] for row in relation_rows]
    if relation_refs != [f"{DOCUMENT_REF}:contains:page:002"]:
        raise ValueError(f"unexpected empty-page relations: {relation_refs}")

    with connection:
        targets = [EMPTY_PAGE_REF, *relation_refs]
        placeholders = ",".join("?" for _ in targets)
        evidence_deleted = connection.execute(
            f"DELETE FROM content_source_evidence WHERE target_ref IN ({placeholders})",
            targets,
        ).rowcount
        relations_deleted = connection.execute(
            """
            DELETE FROM content_relations
            WHERE source_ref=? OR target_ref=?
            """,
            (EMPTY_PAGE_REF, EMPTY_PAGE_REF),
        ).rowcount
        fragments_deleted = connection.execute(
            "DELETE FROM content_fragments WHERE stable_ref=?",
            (EMPTY_PAGE_REF,),
        ).rowcount

        document = connection.execute(
            "SELECT metadata_json FROM content_documents WHERE stable_ref=?",
            (DOCUMENT_REF,),
        ).fetchone()
        if document is None:
            raise ValueError("Draw.io content document is missing")
        metadata = json.loads(document["metadata_json"])
        metadata.pop("expected_pages", None)
        metadata["contentUnitCount"] = 2
        metadata["contentUnitMode"] = "independent"
        connection.execute(
            """
            UPDATE content_documents
            SET metadata_json=?, updated_at=?
            WHERE stable_ref=?
            """,
            (json_text(metadata), timestamp, DOCUMENT_REF),
        )

        snapshot = query_snapshot(connection)
        digest = content_manifest_digest(snapshot)
        connection.execute(
            """
            UPDATE content_schema_meta
            SET value=?, updated_at=?
            WHERE key='content_manifest_digest'
            """,
            (digest, timestamp),
        )

    validation = validate_query(connection)
    if not validation["pass"]:
        raise ValueError(f"repaired query validation failed: {validation}")
    return {
        "already_repaired": False,
        "deleted": {
            "fragments": fragments_deleted,
            "relations": relations_deleted,
            "evidence": evidence_deleted,
        },
        "content_manifest_digest": digest,
        "validation": validation,
    }


def port_is_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as client:
        client.settimeout(0.25)
        return client.connect_ex(("127.0.0.1", port)) == 0


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def atomic_copy(source: Path, target: Path, expected_hash: str) -> None:
    staged = target.parent / f".{target.name}.empty-drawio-{os.getpid()}.tmp"
    try:
        shutil.copy2(source, staged)
        with staged.open("rb") as handle:
            os.fsync(handle.fileno())
        if sha256_file(staged) != expected_hash:
            raise ValueError(f"staged database hash mismatch: {target}")
        os.replace(staged, target)
        fsync_directory(target.parent)
    finally:
        staged.unlink(missing_ok=True)


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def apply(args: argparse.Namespace) -> dict[str, Any]:
    if not args.apply or args.confirm != APPLY_CONFIRMATION:
        raise ValueError(
            f"formal apply requires --apply --confirm {APPLY_CONFIRMATION}"
        )
    formal_query = args.formal_query.resolve(strict=True)
    formal_asset = args.formal_asset.resolve(strict=True)
    user_database = args.user_database.resolve(strict=True)
    if port_is_open(5173) or port_is_open(28775):
        raise ValueError("5173 and 28775 must both be closed before formal apply")

    generated = time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())
    run_dir = args.output_root.resolve() / f"repair-{generated}"
    recovery_dir = run_dir / "recovery"
    candidate_dir = run_dir / "candidate"
    recovery_dir.mkdir(parents=True, exist_ok=False)
    candidate_dir.mkdir()
    query_backup = recovery_dir / formal_query.name
    asset_backup = recovery_dir / formal_asset.name
    query_candidate = candidate_dir / formal_query.name
    asset_candidate = candidate_dir / formal_asset.name
    for source, backup, candidate in (
        (formal_query, query_backup, query_candidate),
        (formal_asset, asset_backup, asset_candidate),
    ):
        shutil.copy2(source, backup)
        shutil.copy2(source, candidate)

    before = {
        "formalQuery": file_state(formal_query),
        "formalAsset": file_state(formal_asset),
        "realUser": file_state(user_database),
    }
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with closing(connect(query_candidate)) as query_connection:
        repair = repair_query(query_connection, timestamp)
    digest = repair["content_manifest_digest"]
    with closing(connect(asset_candidate)) as asset_connection:
        with asset_connection:
            asset_connection.execute(
                """
                UPDATE asset_schema_meta
                SET value=?, updated_at=?
                WHERE key='content_manifest_digest'
                """,
                (digest, timestamp),
            )
        asset_integrity = database_integrity(asset_connection)
    if asset_integrity != {
        "integrity_check": "ok",
        "foreign_key_violations": 0,
    }:
        raise ValueError("asset database integrity failed")

    committed_query = False
    committed_asset = False
    try:
        atomic_copy(
            query_candidate,
            formal_query,
            sha256_file(query_candidate),
        )
        committed_query = True
        atomic_copy(
            asset_candidate,
            formal_asset,
            sha256_file(asset_candidate),
        )
        committed_asset = True
        after = {
            "formalQuery": file_state(formal_query),
            "formalAsset": file_state(formal_asset),
            "realUser": file_state(user_database),
        }
        if after["realUser"] != before["realUser"]:
            raise ValueError("real user database changed during repair")
        with closing(connect(formal_query)) as connection:
            formal_validation = validate_query(connection)
        if not formal_validation["pass"]:
            raise ValueError("formal database validation failed after apply")
    except Exception:
        if committed_query:
            atomic_copy(
                query_backup,
                formal_query,
                str(before["formalQuery"]["sha256"]),
            )
        if committed_asset:
            atomic_copy(
                asset_backup,
                formal_asset,
                str(before["formalAsset"]["sha256"]),
            )
        raise

    report = {
        "schema_version": "empty-drawio-content-repair-v1",
        "result": "pass",
        "run_id": run_dir.name,
        "before": before,
        "repair": repair,
        "assetIntegrity": asset_integrity,
        "after": after,
        "formalValidation": formal_validation,
        "recovery": {
            "queryBackup": str(query_backup.relative_to(run_dir)),
            "assetBackup": str(asset_backup.relative_to(run_dir)),
            "restoreCommand": (
                "python3 scripts/repair_empty_drawio_content.py "
                f"--restore-from {run_dir.relative_to(ROOT)} "
                f"--confirm {RESTORE_CONFIRMATION}"
            ),
        },
    }
    write_json(run_dir / "report.json", report)
    return report


def restore(args: argparse.Namespace) -> dict[str, Any]:
    if args.confirm != RESTORE_CONFIRMATION:
        raise ValueError(f"restore requires --confirm {RESTORE_CONFIRMATION}")
    if port_is_open(5173) or port_is_open(28775):
        raise ValueError("5173 and 28775 must both be closed before restore")
    run_dir = args.restore_from.resolve(strict=True)
    if DEFAULT_OUTPUT_ROOT.resolve() not in run_dir.parents:
        raise ValueError("restore path is outside the controlled repair root")
    report = json.loads((run_dir / "report.json").read_text(encoding="utf-8"))
    formal_query = args.formal_query.resolve(strict=True)
    formal_asset = args.formal_asset.resolve(strict=True)
    user_database = args.user_database.resolve(strict=True)
    user_before = file_state(user_database)
    query_backup = run_dir / report["recovery"]["queryBackup"]
    asset_backup = run_dir / report["recovery"]["assetBackup"]
    atomic_copy(
        query_backup,
        formal_query,
        str(report["before"]["formalQuery"]["sha256"]),
    )
    atomic_copy(
        asset_backup,
        formal_asset,
        str(report["before"]["formalAsset"]["sha256"]),
    )
    user_after = file_state(user_database)
    if user_after != user_before:
        raise ValueError("real user database changed during restore")
    return {
        "schema_version": "empty-drawio-content-repair-restore-v1",
        "result": "pass",
        "restoredFrom": str(run_dir),
        "formalQuery": file_state(formal_query),
        "formalAsset": file_state(formal_asset),
        "realUserUnchanged": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--formal-query", type=Path, default=DEFAULT_FORMAL_QUERY)
    parser.add_argument("--formal-asset", type=Path, default=DEFAULT_FORMAL_ASSET)
    parser.add_argument(
        "--user-database",
        type=Path,
        default=DEFAULT_USER_DATABASE,
    )
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm", default="")
    parser.add_argument("--restore-from", type=Path)
    args = parser.parse_args()
    result = restore(args) if args.restore_from else apply(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
