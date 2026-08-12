#!/usr/bin/env python3
"""Prepare, verify, apply, and restore the approved Phase 2 Batch 1 DB delta.

This helper is deliberately specific to the two approved service-to-measure
relations. It never changes frontend owners, the content asset database, legacy
JSON, desktop packages, source Excel, or a user database.
"""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
import tarfile
import tempfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


FORMAL_BEFORE_SHA256 = "30d14679c7d8b7743fba129af38afde7b943bcdd707ff7b8a57bce5146f54c9e"
SOURCE_EXCEL_SHA256 = "8127291446b44000e1390b269ad727f17cae0a04cdc7c0ea3dc1310f460e890f"
CONTENT_ASSET_SHA256 = "adaa19bf1fb641eb6e54da74b33b3f0510126ed9208d0d97ed565398db05bce6"
APPLY_CONFIRMATION = "APPLY_PHASE2_BATCH1_RELATION_ONLY"
RESTORE_CONFIRMATION = "RESTORE_PHASE2_BATCH1_FORMAL_BASE_ONLY"

ARTIFACTS = {
    "macos-license-dmg": "apps/macos/SAPDWiki/dist/license/SAPD-Wiki-0.4.0-license-20260801-033335Z-mac-arm64.dmg",
    "macos-no-license-dmg": "apps/macos/SAPDWiki/dist/no-license/SAPD-Wiki-0.4.0-no-license-20260801-033335Z-mac-arm64.dmg",
    "windows-setup": "apps/electron/dist/SAPD-Wiki-Setup-0.4.0-win-x64.exe",
}
RELEASE_MANIFESTS = {
    "macos-license-base-manifest": "apps/macos/SAPDWiki/dist/dmg-staging-license/SAPD Wiki.app/Contents/Resources/Runtime/data/base/base-manifest.json",
    "macos-no-license-base-manifest": "apps/macos/SAPDWiki/dist/dmg-staging-no-license/SAPD Wiki.app/Contents/Resources/Runtime/data/base/base-manifest.json",
    "macos-license-info-plist": "apps/macos/SAPDWiki/dist/dmg-staging-license/SAPD Wiki.app/Contents/Info.plist",
    "macos-no-license-info-plist": "apps/macos/SAPDWiki/dist/dmg-staging-no-license/SAPD Wiki.app/Contents/Info.plist",
    "macos-unpackaged-current-base-manifest": "apps/macos/SAPDWiki/.build/runtime-work/SAPD-Wiki-v0.4.0-mac-arm64/data/base/base-manifest.json",
    "windows-nonmatching-0.3.0-base-manifest": "apps/electron/.build/archive/local-windows-0.3.0/bundle-work/SAPD-Wiki-v0.3.0-win-x64/data/base/base-manifest.json",
    "content-source-manifest": "config/content-source-manifest.v1.json",
    "content-release-manifest": "config/content-release-manifest.v2.json",
}
LEGACY_EXTRA_FILES = {
    "environment-basemap-semantic": "frontend/capability-browser/generated/environmentBasemap.semantic.json",
    "environment-basemap-node-details": "frontend/capability-browser/generated/environmentBasemap.node-details.json",
}
SOURCE_ROOTS = (
    ".github",
    "apps",
    "config",
    "db",
    "docs",
    "frontend",
    "scripts",
    "src",
    "tests",
)
SOURCE_ROOT_FILES = (
    "AGENTS.md",
    "CURRENT_STATE.md",
    "DESIGN.md",
    "README.md",
    "findings.md",
    "progress.md",
    "pyproject.toml",
    "task_plan.md",
)
SOURCE_EXCLUDED_PARTS = {".build", "dist", "node_modules", "__pycache__", ".git"}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def file_state(path: Path) -> dict[str, Any]:
    stat = path.stat()
    return {
        "path": str(path.resolve()),
        "size": stat.st_size,
        "mtime_ns": stat.st_mtime_ns,
        "sha256": sha256_file(path),
    }


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def run_git(root: Path, *args: str) -> bytes:
    return subprocess.run(
        ["git", *args],
        cwd=root,
        check=True,
        stdout=subprocess.PIPE,
    ).stdout


def git_identity(root: Path, output: Path) -> dict[str, Any]:
    output.mkdir(parents=True, exist_ok=True)
    head = run_git(root, "rev-parse", "HEAD").decode().strip()
    patch = run_git(root, "diff", "--binary")
    patch_path = output / "tracked-dirty.patch"
    patch_path.write_bytes(patch)
    untracked_raw = run_git(root, "ls-files", "--others", "--exclude-standard", "-z")
    untracked = sorted(
        value.decode("utf-8")
        for value in untracked_raw.split(b"\0")
        if value
    )
    non_data: list[dict[str, Any]] = []
    for relative in untracked:
        if relative == "data" or relative.startswith("data/"):
            continue
        path = root / relative
        if path.is_file() and not path.is_symlink():
            non_data.append(
                {
                    "path": relative,
                    "sha256": sha256_file(path),
                    "size": path.stat().st_size,
                }
            )
    identity = {
        "root": str(root.resolve()),
        "head": head,
        "tracked_patch_sha256": hashlib.sha256(patch).hexdigest(),
        "tracked_patch_bytes": len(patch),
        "untracked_path_count": len(untracked),
        "untracked_path_list_sha256": hashlib.sha256(untracked_raw).hexdigest(),
        "untracked_non_data_files": non_data,
    }
    write_json(output / "identity.json", identity)
    return identity


def _source_files(root: Path) -> Iterable[tuple[Path, str]]:
    seen: set[str] = set()
    for root_file in SOURCE_ROOT_FILES:
        path = root / root_file
        if path.is_file():
            seen.add(root_file)
            yield path, root_file
    for root_name in SOURCE_ROOTS:
        base = root / root_name
        if not base.exists():
            continue
        for path in sorted(base.rglob("*")):
            relative = path.relative_to(root)
            if any(part in SOURCE_EXCLUDED_PARTS for part in relative.parts):
                continue
            if relative.parts[:4] == (
                "frontend",
                "capability-browser",
                "public",
                "data",
            ):
                continue
            relative_text = relative.as_posix()
            if relative_text in seen or (not path.is_file() and not path.is_symlink()):
                continue
            seen.add(relative_text)
            yield path, relative_text


def build_source_snapshot(root: Path, target: Path) -> dict[str, Any]:
    target.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with tarfile.open(target, "w:gz") as archive:
        for path, relative in _source_files(root):
            archive.add(path, arcname=relative, recursive=False)
            count += 1
    return {**file_state(target), "file_count": count}


def tree_state(root: Path) -> dict[str, Any]:
    digest = hashlib.sha256()
    count = 0
    total = 0
    for path in sorted(value for value in root.rglob("*") if value.is_file() and not value.is_symlink()):
        relative = path.relative_to(root).as_posix()
        file_digest = sha256_file(path)
        size = path.stat().st_size
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(file_digest.encode("ascii"))
        digest.update(b"\n")
        count += 1
        total += size
    return {
        "path": str(root.resolve()),
        "file_count": count,
        "total_bytes": total,
        "tree_sha256": digest.hexdigest(),
    }


def readonly_connection(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(
        f"file:{path.resolve()}?mode=ro&immutable=1",
        uri=True,
    )
    connection.row_factory = sqlite3.Row
    return connection


def database_integrity(path: Path) -> dict[str, Any]:
    with closing(readonly_connection(path)) as connection:
        return {
            "integrity_check": connection.execute("PRAGMA integrity_check").fetchone()[0],
            "foreign_key_violations": len(connection.execute("PRAGMA foreign_key_check").fetchall()),
        }


def database_snapshot(path: Path) -> dict[str, Any]:
    with closing(readonly_connection(path)) as connection:
        return {
            "file": file_state(path),
            "integrity": database_integrity(path),
            "objects": connection.execute("SELECT COUNT(*) FROM knowledge_items").fetchone()[0],
            "relations": connection.execute("SELECT COUNT(*) FROM knowledge_relations").fetchone()[0],
            "schema_version": connection.execute(
                "SELECT value FROM content_schema_meta WHERE key='schema_version'"
            ).fetchone()[0],
            "parent_source_db_sha256": connection.execute(
                "SELECT value FROM content_schema_meta WHERE key='base_database_sha256'"
            ).fetchone()[0],
        }


def _row_digest(connection: sqlite3.Connection, query: str) -> str:
    digest = hashlib.sha256()
    for row in connection.execute(query):
        digest.update(json.dumps(tuple(row), ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


def validate_candidate(old_base: Path, candidate: Path, candidate_manifest: Path) -> dict[str, Any]:
    manifest = json.loads(candidate_manifest.read_text(encoding="utf-8"))
    candidate_sha = sha256_file(candidate)
    if sha256_file(old_base) != FORMAL_BEFORE_SHA256:
        raise ValueError("formal base CAS mismatch before candidate validation")
    if candidate_sha != manifest.get("base_database", {}).get("sha256"):
        raise ValueError("candidate manifest SHA mismatch")
    if manifest.get("parent_source_db_sha256") != FORMAL_BEFORE_SHA256:
        raise ValueError("candidate parent/source SHA mismatch")
    if manifest.get("source_workbook", {}).get("sha256") != SOURCE_EXCEL_SHA256:
        raise ValueError("candidate source workbook SHA mismatch")
    expected_delta = {tuple(row) for row in manifest.get("relation_delta", [])}
    if len(expected_delta) != 2 or manifest.get("object_delta") != 0:
        raise ValueError("candidate manifest is not the approved relation-only delta")
    with closing(readonly_connection(old_base)) as old, closing(readonly_connection(candidate)) as new:
        old_objects = _row_digest(old, "SELECT * FROM knowledge_items ORDER BY id")
        new_objects = _row_digest(new, "SELECT * FROM knowledge_items ORDER BY id")
        if old_objects != new_objects:
            raise ValueError("candidate changed objects or object ownership")
        old_relations = {
            tuple(row)
            for row in old.execute(
                "SELECT source_item_id, relation_type, target_item_id FROM knowledge_relations"
            )
        }
        new_relations = {
            tuple(row)
            for row in new.execute(
                "SELECT source_item_id, relation_type, target_item_id FROM knowledge_relations"
            )
        }
        if new_relations - old_relations != expected_delta or old_relations - new_relations:
            raise ValueError("candidate relation delta is not exactly the approved two")
        evidence_counts = {}
        for service_id, relation_type, measure_id in sorted(expected_delta):
            relation = new.execute(
                """
                SELECT id FROM knowledge_relations
                WHERE source_item_id=? AND relation_type=? AND target_item_id=?
                """,
                (service_id, relation_type, measure_id),
            ).fetchone()
            rows = new.execute(
                """
                SELECT source_sheet, source_row, source_column, source_cell,
                       raw_value, source_hash, source_file_id
                FROM source_references
                WHERE target_type='relation' AND target_id=?
                ORDER BY source_row, source_cell
                """,
                (relation[0],),
            ).fetchall()
            evidence_counts[service_id] = len(rows)
            if any(row[0] != "作用域-安全技术服务-安全技术模块映射" or row[5] != SOURCE_EXCEL_SHA256 for row in rows):
                raise ValueError("candidate relation provenance mismatch")
            if {row[2] for row in rows} != {"安全技术服务", "安全技术模块/措施"}:
                raise ValueError("candidate relation does not carry both F/G evidence")
    if sorted(evidence_counts.values()) != [6, 16]:
        raise ValueError(f"candidate evidence counts changed: {evidence_counts}")
    snapshot = database_snapshot(candidate)
    if snapshot["integrity"] != {"integrity_check": "ok", "foreign_key_violations": 0}:
        raise ValueError("candidate integrity failed")
    return {
        "candidate": snapshot,
        "object_row_digest": new_objects,
        "relation_delta": [list(row) for row in sorted(expected_delta)],
        "evidence_counts": evidence_counts,
    }


def user_schema_summary(path: Path) -> dict[str, Any]:
    with closing(readonly_connection(path)) as connection:
        tables = [
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
        ]
        table_schemas = []
        for table in tables:
            quoted = table.replace('"', '""')
            table_schemas.append(
                {
                    "table": table,
                    "columns": [tuple(row) for row in connection.execute(f'PRAGMA table_xinfo("{quoted}")')],
                    "foreign_keys": [tuple(row) for row in connection.execute(f'PRAGMA foreign_key_list("{quoted}")')],
                    "indexes": [tuple(row) for row in connection.execute(f'PRAGMA index_list("{quoted}")')],
                }
            )
        schema_version = connection.execute(
            "SELECT value FROM user_meta WHERE key='schema_version'"
        ).fetchone()
        migrations = [
            row[0]
            for row in connection.execute(
                "SELECT version FROM user_schema_migrations ORDER BY version"
            )
        ]
        payload = {
            "database_path": str(path.resolve()),
            "database_size": path.stat().st_size,
            "database_mtime_ns": path.stat().st_mtime_ns,
            "schema_version": schema_version[0] if schema_version else None,
            "pragma_user_version": connection.execute("PRAGMA user_version").fetchone()[0],
            "migrations": migrations,
            "table_count": len(tables),
            "tables": table_schemas,
            "business_rows_read": False,
            "database_copied": False,
            "database_file_sha256_computed": False,
        }
    canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    payload["schema_summary_sha256"] = hashlib.sha256(canonical).hexdigest()
    return payload


def copy_named_files(main_root: Path, bundle: Path, mapping: dict[str, str], group: str) -> dict[str, Any]:
    result = {}
    for label, relative in mapping.items():
        source = main_root / relative
        if not source.is_file() or source.is_symlink():
            raise FileNotFoundError(f"required {group} file missing: {source}")
        suffix = "".join(source.suffixes) or ".bin"
        target = bundle / group / f"{label}{suffix}"
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
        result[label] = {
            "source": file_state(source),
            "bundle": file_state(target),
            "source_relative_path": relative,
            "bundle_relative_path": target.relative_to(bundle).as_posix(),
        }
    return result


def payload_inventory(bundle: Path) -> dict[str, Any]:
    excluded = {"rollback-bundle-manifest.json", "bundle-file-manifest.json"}
    rows = []
    total = 0
    for path in sorted(value for value in bundle.rglob("*") if value.is_file() and not value.is_symlink()):
        relative = path.relative_to(bundle).as_posix()
        if relative in excluded or relative.startswith("reports/"):
            continue
        state = file_state(path)
        rows.append({"path": relative, "sha256": state["sha256"], "size": state["size"]})
        total += state["size"]
    canonical = json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return {
        "files": rows,
        "file_count": len(rows),
        "total_bytes": total,
        "inventory_sha256": hashlib.sha256(canonical).hexdigest(),
    }


def prepare_bundle(args: argparse.Namespace) -> dict[str, Any]:
    main_root = args.main_root.resolve(strict=True)
    dedicated_root = args.dedicated_root.resolve(strict=True)
    candidate_dir = args.candidate_dir.resolve(strict=True)
    bundle = args.bundle_dir.resolve()
    if bundle.exists() and any(bundle.iterdir()):
        raise ValueError("rollback bundle directory must be empty")
    bundle.mkdir(parents=True, exist_ok=True)

    formal = main_root / "data/database/sapd_wiki.sqlite3"
    asset = main_root / "data/database/sapd_content_assets.sqlite3"
    source_excel = main_root / "data/raw-samples/wiki sample.xlsx"
    legacy = main_root / "frontend/capability-browser/public/data"
    candidate = candidate_dir / "sapd_wiki.measure-candidate.sqlite3"
    candidate_manifest = candidate_dir / "candidate-manifest.json"
    candidate_rollback = candidate_dir / "rollback-manifest.json"
    if sha256_file(formal) != FORMAL_BEFORE_SHA256:
        raise ValueError("formal base CAS mismatch before rollback preparation")
    if sha256_file(asset) != CONTENT_ASSET_SHA256:
        raise ValueError("content asset CAS mismatch before rollback preparation")
    if sha256_file(source_excel) != SOURCE_EXCEL_SHA256:
        raise ValueError("source Excel CAS mismatch before rollback preparation")
    candidate_validation = validate_candidate(formal, candidate, candidate_manifest)

    old_base_target = bundle / "databases/pre-apply/sapd_wiki.sqlite3"
    asset_target = bundle / "databases/content-assets/sapd_content_assets.sqlite3"
    candidate_target = bundle / "candidate/sapd_wiki.measure-candidate.sqlite3"
    for source, target in (
        (formal, old_base_target),
        (asset, asset_target),
        (candidate, candidate_target),
        (candidate_manifest, bundle / "candidate/candidate-manifest.json"),
        (candidate_rollback, bundle / "candidate/rollback-manifest.json"),
    ):
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)

    legacy_target = bundle / "legacy-web/public-data"
    shutil.copytree(legacy, legacy_target, symlinks=True)
    legacy_extra = copy_named_files(
        main_root,
        bundle,
        LEGACY_EXTRA_FILES,
        "legacy-web/generated",
    )
    main_identity = git_identity(main_root, bundle / "code/main-workspace")
    dedicated_identity = git_identity(dedicated_root, bundle / "code/dedicated-worktree")
    source_snapshot = build_source_snapshot(main_root, bundle / "code/old-stack-source-snapshot.tar.gz")
    artifacts = copy_named_files(main_root, bundle, ARTIFACTS, "artifacts")
    release_manifests = copy_named_files(main_root, bundle, RELEASE_MANIFESTS, "release-manifests")
    user_summary = user_schema_summary(args.user_db.resolve(strict=True))
    write_json(bundle / "user-schema/user-schema-summary.json", user_summary)
    helper_target = bundle / "tools/apply_capability_measure_candidate.py"
    helper_target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(Path(__file__).resolve(), helper_target)

    recovery = f"""# Phase 2 Batch 1 complete rollback bundle\n\nPrepared before formal apply: {now_iso()}\n\nThis bundle freezes the current old Web source snapshot, old base/content asset databases,\nlegacy Web public/data tree, active-directory macOS DMGs, the active-directory Windows Setup,\nand available manifests. The packages are historical artifacts and are NOT a common build of\nthe current dirty source snapshot. The Windows Setup lacks a matching local build manifest/UAT.\n\nVerify:\n\n```bash\npython3 tools/apply_capability_measure_candidate.py verify-bundle --bundle-dir .\n```\n\nRehearse DB recovery without touching formal data:\n\n```bash\npython3 tools/apply_capability_measure_candidate.py rehearse --bundle-dir . --work-dir /private/tmp/sapd-phase2-batch1-restore-rehearsal\n```\n\nRestore formal base only (safe operational rollback for this relation-only apply):\n\n```bash\npython3 tools/apply_capability_measure_candidate.py restore-formal --bundle-dir . --formal-db '{formal}' --confirm {RESTORE_CONFIRMATION}\n```\n\nFull old-stack recovery:\n\n1. Stop the failed candidate Runtime and any subsequent deployment.\n2. Extract `code/old-stack-source-snapshot.tar.gz` into a new empty deployment directory.\n3. Restore `legacy-web/public-data` as that deployment's `frontend/capability-browser/public/data`.\n4. Restore `databases/pre-apply/sapd_wiki.sqlite3` and the bundled content asset DB together.\n5. Deploy the bundled macOS DMGs and Windows Setup as the historical last local artifacts; do not mix them with the candidate DB.\n6. Preserve the real user DB in place; never downgrade or overwrite it.\n7. Validate all core API/page/search/user-state checks before resuming service.\n\nThe three desktop artifacts are not proven to be one cross-platform common release set. This\nbundle makes the current state recoverable but does not remove that final-switch blocker.\n"""
    (bundle / "RECOVERY.md").write_text(recovery, encoding="utf-8")

    old_base = database_snapshot(old_base_target)
    candidate_bundle_validation = validate_candidate(old_base_target, candidate_target, bundle / "candidate/candidate-manifest.json")
    legacy_source = tree_state(legacy)
    legacy_bundle = tree_state(legacy_target)
    if legacy_source["tree_sha256"] != legacy_bundle["tree_sha256"]:
        raise ValueError("legacy Web tree copy mismatch")
    inventory = payload_inventory(bundle)
    write_json(bundle / "bundle-file-manifest.json", inventory)
    manifest = {
        "contract": "phase2-batch1-complete-rollback-v1",
        "status": "prepared-before-formal-apply",
        "run_id": args.run_id,
        "created_at": now_iso(),
        "scope": "relation-only base database apply; no frontend owner switch",
        "formal_before": old_base,
        "candidate": candidate_bundle_validation,
        "content_asset": file_state(asset_target),
        "source_excel": file_state(source_excel),
        "legacy_web": {
            "source": legacy_source,
            "bundle": legacy_bundle,
            "generated_business_json": legacy_extra,
        },
        "code": {
            "main_workspace": main_identity,
            "dedicated_worktree": dedicated_identity,
            "old_stack_source_snapshot": source_snapshot,
        },
        "web_runtime": {
            "kind": "current-local-runnable-input-snapshot",
            "separately_packaged_accepted_artifact_available": False,
            "source_snapshot": source_snapshot,
            "legacy_public_data": legacy_bundle,
            "base_database_sha256": FORMAL_BEFORE_SHA256,
            "content_asset_sha256": CONTENT_ASSET_SHA256,
            "warning": "not proven to share a build stamp with the historical macOS/Windows artifacts",
        },
        "desktop_artifacts": artifacts,
        "release_manifests": release_manifests,
        "user_schema_summary": user_summary,
        "bundle_inventory": {
            key: inventory[key]
            for key in ("file_count", "total_bytes", "inventory_sha256")
        },
        "release_set_assessment": {
            "current_dirty_source_and_artifacts_common_build": False,
            "web_macos_windows_common_accepted_release_set": False,
            "web_runtime": "current runnable source/data snapshot; no separate previously accepted Web package was available",
            "macos_dmgs": "historical 0.4.0 pair with common 20260801-033335Z stamp",
            "windows_setup": "active-directory 0.4.0 local copy; matching local build manifest and Windows 10/11 UAT unavailable",
            "final_owner_switch_blocked": True,
        },
        "restore_contract": {
            "formal_restore_sha256": FORMAL_BEFORE_SHA256,
            "user_db": "preserve in place; no copy, downgrade, or overwrite",
            "full_stack": "restore source snapshot + legacy tree + old base/content asset + all three desktop artifacts as one bundle",
        },
    }
    write_json(bundle / "rollback-bundle-manifest.json", manifest)
    return manifest


def verify_bundle(bundle: Path) -> dict[str, Any]:
    bundle = bundle.resolve(strict=True)
    manifest = json.loads((bundle / "rollback-bundle-manifest.json").read_text(encoding="utf-8"))
    expected_inventory = json.loads((bundle / "bundle-file-manifest.json").read_text(encoding="utf-8"))
    actual_inventory = payload_inventory(bundle)
    if actual_inventory != expected_inventory:
        raise ValueError("rollback bundle inventory mismatch")
    old_base = bundle / "databases/pre-apply/sapd_wiki.sqlite3"
    candidate = bundle / "candidate/sapd_wiki.measure-candidate.sqlite3"
    if sha256_file(old_base) != FORMAL_BEFORE_SHA256:
        raise ValueError("rollback base SHA mismatch")
    candidate_validation = validate_candidate(
        old_base,
        candidate,
        bundle / "candidate/candidate-manifest.json",
    )
    if tree_state(bundle / "legacy-web/public-data")["tree_sha256"] != manifest["legacy_web"]["bundle"]["tree_sha256"]:
        raise ValueError("rollback legacy tree mismatch")
    return {
        "result": "pass",
        "bundle": str(bundle),
        "manifest_sha256": sha256_file(bundle / "rollback-bundle-manifest.json"),
        "inventory": actual_inventory,
        "candidate": candidate_validation,
    }


def fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def atomic_copy(source: Path, target: Path, expected_hash: str) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    staged = target.parent / f".{target.name}.phase2-{os.getpid()}.tmp"
    try:
        shutil.copy2(source, staged)
        with staged.open("rb") as handle:
            os.fsync(handle.fileno())
        if sha256_file(staged) != expected_hash:
            raise ValueError("staged atomic copy hash mismatch")
        os.replace(staged, target)
        fsync_directory(target.parent)
    finally:
        staged.unlink(missing_ok=True)


def rehearse(bundle: Path, work_dir: Path) -> dict[str, Any]:
    verified = verify_bundle(bundle)
    if work_dir.exists() and any(work_dir.iterdir()):
        raise ValueError("rehearsal work directory must be empty")
    work_dir.mkdir(parents=True, exist_ok=True)
    target = work_dir / "sapd_wiki.rehearsal.sqlite3"
    shutil.copy2(bundle / "candidate/sapd_wiki.measure-candidate.sqlite3", target)
    candidate_sha = sha256_file(target)
    atomic_copy(
        bundle / "databases/pre-apply/sapd_wiki.sqlite3",
        target,
        FORMAL_BEFORE_SHA256,
    )
    restored_sha = sha256_file(target)
    if restored_sha != FORMAL_BEFORE_SHA256:
        raise ValueError("rollback rehearsal did not restore the formal SHA")
    return {
        "result": "pass",
        "bundle_manifest_sha256": verified["manifest_sha256"],
        "candidate_sha256": candidate_sha,
        "restored_sha256": restored_sha,
        "integrity": database_integrity(target),
    }


def apply_formal(bundle: Path, formal: Path, source_excel: Path, content_asset: Path, confirmation: str) -> dict[str, Any]:
    if confirmation != APPLY_CONFIRMATION:
        raise ValueError("explicit apply confirmation is required")
    if sha256_file(formal) != FORMAL_BEFORE_SHA256:
        raise ValueError("formal base CAS changed before atomic replacement")
    verified = verify_bundle(bundle)
    candidate = bundle / "candidate/sapd_wiki.measure-candidate.sqlite3"
    candidate_sha = sha256_file(candidate)
    lock_path = formal.parent / ".phase2-batch1-formal-apply.lock"
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open("a+b") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        if sha256_file(formal) != FORMAL_BEFORE_SHA256:
            raise ValueError("formal base CAS changed before atomic replacement")
        if sha256_file(source_excel) != SOURCE_EXCEL_SHA256:
            raise ValueError("source Excel CAS changed before atomic replacement")
        if sha256_file(content_asset) != CONTENT_ASSET_SHA256:
            raise ValueError("content asset CAS changed before atomic replacement")
        atomic_copy(candidate, formal, candidate_sha)
        after = database_snapshot(formal)
        if after["file"]["sha256"] != candidate_sha:
            raise ValueError("formal database post-apply SHA mismatch")
    report = {
        "result": "pass",
        "applied_at": now_iso(),
        "bundle_manifest_sha256": verified["manifest_sha256"],
        "formal_before_sha256": FORMAL_BEFORE_SHA256,
        "formal_after": after,
        "source_excel_sha256": sha256_file(source_excel),
        "content_asset_sha256": sha256_file(content_asset),
    }
    write_json(bundle / "reports/formal-apply-result.json", report)
    return report


def restore_formal(bundle: Path, formal: Path, confirmation: str) -> dict[str, Any]:
    if confirmation != RESTORE_CONFIRMATION:
        raise ValueError("explicit complete-old-stack restore confirmation is required")
    verified = verify_bundle(bundle)
    source = bundle / "databases/pre-apply/sapd_wiki.sqlite3"
    atomic_copy(source, formal, FORMAL_BEFORE_SHA256)
    return {
        "result": "pass",
        "bundle_manifest_sha256": verified["manifest_sha256"],
        "restored_sha256": sha256_file(formal),
        "integrity": database_integrity(formal),
    }


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser()
    commands = root.add_subparsers(dest="command", required=True)
    prepare = commands.add_parser("prepare-bundle")
    prepare.add_argument("--main-root", type=Path, required=True)
    prepare.add_argument("--dedicated-root", type=Path, required=True)
    prepare.add_argument("--candidate-dir", type=Path, required=True)
    prepare.add_argument("--bundle-dir", type=Path, required=True)
    prepare.add_argument("--user-db", type=Path, required=True)
    prepare.add_argument("--run-id", required=True)
    verify = commands.add_parser("verify-bundle")
    verify.add_argument("--bundle-dir", type=Path, required=True)
    rehearsal = commands.add_parser("rehearse")
    rehearsal.add_argument("--bundle-dir", type=Path, required=True)
    rehearsal.add_argument("--work-dir", type=Path, required=True)
    apply = commands.add_parser("apply")
    apply.add_argument("--bundle-dir", type=Path, required=True)
    apply.add_argument("--formal-db", type=Path, required=True)
    apply.add_argument("--source-excel", type=Path, required=True)
    apply.add_argument("--content-asset-db", type=Path, required=True)
    apply.add_argument("--confirm", required=True)
    restore = commands.add_parser("restore-formal")
    restore.add_argument("--bundle-dir", type=Path, required=True)
    restore.add_argument("--formal-db", type=Path, required=True)
    restore.add_argument("--confirm", required=True)
    return root


def main() -> int:
    args = parser().parse_args()
    if args.command == "prepare-bundle":
        result = prepare_bundle(args)
    elif args.command == "verify-bundle":
        result = verify_bundle(args.bundle_dir)
    elif args.command == "rehearse":
        result = rehearse(args.bundle_dir, args.work_dir)
    elif args.command == "apply":
        result = apply_formal(
            args.bundle_dir.resolve(strict=True),
            args.formal_db.resolve(strict=True),
            args.source_excel.resolve(strict=True),
            args.content_asset_db.resolve(strict=True),
            args.confirm,
        )
    else:
        result = restore_formal(
            args.bundle_dir.resolve(strict=True),
            args.formal_db.resolve(strict=True),
            args.confirm,
        )
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
