#!/usr/bin/env python3
"""Verify the immutable Windows Runtime template before installer testing."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sqlite3
import sys
import tempfile
from contextlib import closing
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
SRC_ROOT = REPO_ROOT / "src"
for import_root in (SCRIPT_DIR, SRC_ROOT):
    import_value = str(import_root)
    if import_value in sys.path:
        sys.path.remove(import_value)
    sys.path.insert(0, import_value)

try:
    from create_user_db import DEFAULT_SCHEMA_VERSION, initialize_user_db
except ModuleNotFoundError:
    from scripts.create_user_db import DEFAULT_SCHEMA_VERSION, initialize_user_db

from sapd_wiki.projection_contract import (
    ProjectionManifestError,
    load_projection_identity,
)


BACKEND_NAME = "SAPD-Wiki-Backend.exe"
RUNTIME_METADATA_NAME = "electron-runtime-build.json"
RUNTIME_FINGERPRINT_NAME = ".sapd-runtime-fingerprint"
DELIVERY_MANIFEST_NAME = "windows-delivery-data-manifest.json"
SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
REVISION_PATTERN = re.compile(r"^[0-9a-f]{40}$")
REQUIRED_LIFECYCLE_FRONTEND_PATHS = (
    "public/data/oi149-split-manifest.json",
    "public/data/lifecycle/index.json",
    "public/data/lifecycle/evidence.json",
    "public/data/lifecycle/projections/lifecycle_domain_LC-AP.json",
    "public/data/lifecycle/projections/lifecycle_domain_LC-DT.json",
)


def _hash_paths(root: Path, paths: list[Path]) -> tuple[str, int]:
    digest = hashlib.sha256()
    files = sorted(
        (path for path in paths if path.is_file()),
        key=lambda path: path.relative_to(root).as_posix(),
    )
    for path in files:
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest(), len(files)


def backend_tree_summary(backend_root: Path) -> tuple[str, int]:
    backend_root = backend_root.resolve()
    executable = backend_root / BACKEND_NAME
    internal = backend_root / "_internal"
    if not executable.is_file() or not internal.is_dir():
        raise ValueError("Windows backend executable or _internal tree is missing")
    controlled = [executable, *(path for path in internal.rglob("*") if path.is_file())]
    return _hash_paths(backend_root, controlled)


def runtime_tree_sha256(runtime_root: Path) -> str:
    runtime_root = runtime_root.resolve()
    include_roots = [
        runtime_root / BACKEND_NAME,
        runtime_root / "_internal",
        runtime_root / "README-FIRST.md",
        runtime_root / "CHANGELOG.md",
        runtime_root / "start-windows.bat",
        runtime_root / "stop-windows.bat",
        runtime_root / "app" / "frontend-dist",
        runtime_root / "config",
        runtime_root / "data" / "base",
        runtime_root / "diagnostics",
    ]
    controlled: list[Path] = []
    for item in include_roots:
        if item.is_file():
            controlled.append(item)
        elif item.is_dir():
            controlled.extend(path for path in item.rglob("*") if path.is_file())
    return _hash_paths(runtime_root, controlled)[0]


def _schema_snapshot(connection: sqlite3.Connection) -> list[tuple[object, ...]]:
    return connection.execute(
        """
        SELECT type, name, sql
        FROM sqlite_master
        WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
        ORDER BY type, name
        """
    ).fetchall()


def verify_empty_user_database(user_db: Path) -> None:
    if not user_db.is_file():
        raise ValueError(f"Windows user database template is missing: {user_db}")
    try:
        with closing(sqlite3.connect(f"file:{user_db.resolve()}?mode=ro", uri=True)) as connection:
            tables = {
                str(row[0])
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                )
            }
            schema_row = connection.execute(
                "SELECT value FROM user_meta WHERE key='schema_version'"
            ).fetchone()
            meta_rows = dict(connection.execute("SELECT key, value FROM user_meta"))
            migration_rows = [
                str(row[0])
                for row in connection.execute(
                    "SELECT version FROM user_schema_migrations ORDER BY version"
                )
            ]
            change_rows = connection.execute(
                "SELECT action, target_ref, payload_json FROM user_change_logs"
            ).fetchall()
            data_tables = sorted(
                table
                for table in tables
                if table.startswith("user_")
                and table not in {"user_meta", "user_schema_migrations", "user_change_logs"}
            )
            populated = [
                table
                for table in data_tables
                if int(connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0])
            ]
            actual_schema = _schema_snapshot(connection)
    except sqlite3.Error as error:
        raise ValueError("Windows user database template is invalid") from error

    with tempfile.TemporaryDirectory(prefix="sapd-windows-user-schema-") as temp_name:
        reference_db = Path(temp_name) / "reference.sqlite3"
        initialize_user_db(reference_db, DEFAULT_SCHEMA_VERSION)
        with closing(sqlite3.connect(f"file:{reference_db.resolve()}?mode=ro", uri=True)) as connection:
            expected_schema = _schema_snapshot(connection)

    schema_version = str(schema_row[0] if schema_row else "")
    expected_seed_payload = {
        "schema_version": DEFAULT_SCHEMA_VERSION,
        "previous_schema_version": None,
    }
    valid_seed_log = len(change_rows) == 1 and change_rows[0][0:2] == (
        "initialize_user_db",
        None,
    )
    if valid_seed_log:
        try:
            valid_seed_log = json.loads(str(change_rows[0][2] or "")) == expected_seed_payload
        except json.JSONDecodeError:
            valid_seed_log = False
    if (
        schema_version != DEFAULT_SCHEMA_VERSION
        or meta_rows
        != {"schema_version": DEFAULT_SCHEMA_VERSION, "created_by": "sapd-wiki-zip-alpha"}
        or migration_rows != [DEFAULT_SCHEMA_VERSION]
        or not valid_seed_log
        or actual_schema != expected_schema
        or populated
    ):
        raise ValueError(
            "Windows user database is not an empty current-schema seed: "
            f"schema={schema_version}; populated={populated}"
        )


def verify_runtime_template(
    runtime_root: Path,
    *,
    expected_app_version: str,
    expected_source_revision: str,
    expected_delivery_release_id: str,
) -> dict[str, object]:
    runtime_root = runtime_root.resolve()
    metadata = json.loads(
        (runtime_root / RUNTIME_METADATA_NAME).read_text(encoding="utf-8-sig")
    )
    if metadata.get("schemaVersion") != "sapd-windows-electron-runtime-v2":
        raise ValueError("unsupported Windows Runtime metadata schema")
    if metadata.get("appVersion") != expected_app_version:
        raise ValueError("Windows Runtime app version mismatch")
    if not REVISION_PATTERN.fullmatch(expected_source_revision) or metadata.get(
        "sourceRevision"
    ) != expected_source_revision:
        raise ValueError("Windows Runtime source revision mismatch")
    if metadata.get("platform") != "win-x64":
        raise ValueError("Windows Runtime platform mismatch")

    delivery = metadata.get("deliveryData")
    if not isinstance(delivery, dict) or delivery.get("releaseId") != expected_delivery_release_id:
        raise ValueError("Windows Runtime Delivery Data release mismatch")
    delivery_manifest = json.loads(
        (runtime_root / "data" / "base" / DELIVERY_MANIFEST_NAME).read_text(
            encoding="utf-8-sig"
        )
    )
    if (
        delivery_manifest.get("schemaVersion") != delivery.get("schemaVersion")
        or delivery_manifest.get("releaseId") != delivery.get("releaseId")
    ):
        raise ValueError("Windows Runtime embedded Delivery manifest mismatch")
    base_manifest_path = runtime_root / "data" / "base" / "base-manifest.json"
    base_manifest = json.loads(base_manifest_path.read_text(encoding="utf-8-sig"))
    if base_manifest.get("app_version") != expected_app_version:
        raise ValueError("Windows Delivery manifest app version mismatch")
    try:
        projection_identity = load_projection_identity(base_manifest_path)
    except ProjectionManifestError as error:
        raise ValueError(f"Windows projection identity is invalid: {error}") from error
    delivery_databases = delivery_manifest.get("databases", {})
    delivery_base = delivery_databases.get("base", {})
    delivery_assets = delivery_databases.get("contentAssets", {})
    if (
        projection_identity.artifact_db_sha256 != delivery_base.get("sha256")
        or projection_identity.parent_source_db_sha256
        != delivery_base.get("metadata", {}).get("base_database_sha256")
        or projection_identity.content_asset_sha256
        != delivery_assets.get("sha256")
    ):
        raise ValueError("Windows projection identity does not match Delivery data")

    frontend_root = runtime_root / "app" / "frontend-dist"
    missing_lifecycle_paths = [
        relative_path
        for relative_path in REQUIRED_LIFECYCLE_FRONTEND_PATHS
        if not (frontend_root / relative_path).is_file()
    ]
    if missing_lifecycle_paths:
        raise ValueError(
            "Windows Runtime lifecycle split package is incomplete: "
            + ", ".join(missing_lifecycle_paths)
        )

    recorded = str(metadata.get("runtimeFingerprint", ""))
    fingerprint_path = runtime_root / RUNTIME_FINGERPRINT_NAME
    fingerprint_file = fingerprint_path.read_text(encoding="ascii").strip()
    actual = runtime_tree_sha256(runtime_root)
    if not SHA256_PATTERN.fullmatch(recorded) or recorded != fingerprint_file or recorded != actual:
        raise ValueError("Windows Runtime fingerprint mismatch")
    verify_empty_user_database(
        runtime_root / "data" / "user" / "sapd_wiki_user.sqlite3"
    )
    return {
        "verified": True,
        "runtimeFingerprint": actual,
        "appVersion": expected_app_version,
        "deliveryReleaseId": expected_delivery_release_id,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-root", type=Path, required=True)
    parser.add_argument("--expected-app-version", required=True)
    parser.add_argument("--expected-source-revision", required=True)
    parser.add_argument("--expected-delivery-release-id", required=True)
    args = parser.parse_args()
    result = verify_runtime_template(
        args.runtime_root,
        expected_app_version=args.expected_app_version,
        expected_source_revision=args.expected_source_revision,
        expected_delivery_release_id=args.expected_delivery_release_id,
    )
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
