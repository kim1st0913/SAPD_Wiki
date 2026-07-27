#!/usr/bin/env python3
"""Build and verify the protected Windows delivery-data archive.

The archive is a packaging input for the private Windows installer workflow.
It never contains the real user database and never mutates its SQLite inputs.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import subprocess
import tempfile
import zipfile
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from pathlib import PurePosixPath
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE_DB = ROOT / "data" / "database" / "sapd_wiki.sqlite3"
DEFAULT_ASSET_DB = ROOT / "data" / "database" / "sapd_content_assets.sqlite3"
SCHEMA_VERSION = "sapd-windows-delivery-data-v1"
BASE_ARCHIVE_PATH = "data/base/sapd_wiki_base.sqlite3"
ASSET_ARCHIVE_PATH = "data/base/sapd_content_assets.sqlite3"
MANIFEST_PATH = "delivery-data-manifest.json"
SUMS_PATH = "SHA256SUMS.txt"
ALLOWED_ARCHIVE_PATHS = {
    BASE_ARCHIVE_PATH,
    ASSET_ARCHIVE_PATH,
    MANIFEST_PATH,
    SUMS_PATH,
}
RELEASE_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{2,79}$")
REVISION_PATTERN = re.compile(r"^[0-9a-f]{40}$")
MAX_ARCHIVE_MEMBERS = len(ALLOWED_ARCHIVE_PATHS)
MAX_MEMBER_BYTES = 768 * 1024 * 1024
MAX_TOTAL_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024
DEFAULT_RELEASE_PART_BYTES = 48 * 1024 * 1024


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def read_only_connection(path: Path) -> sqlite3.Connection:
    uri = f"{path.resolve().as_uri()}?mode=ro&immutable=1"
    connection = sqlite3.connect(uri, uri=True)
    connection.row_factory = sqlite3.Row
    return connection


def table_names(connection: sqlite3.Connection) -> set[str]:
    return {
        str(row["name"])
        for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        )
    }


def scalar(connection: sqlite3.Connection, query: str) -> Any:
    row = connection.execute(query).fetchone()
    return row[0] if row is not None else None


def database_summary(path: Path, role: str) -> dict[str, Any]:
    with closing(read_only_connection(path)) as connection:
        integrity = str(scalar(connection, "PRAGMA integrity_check"))
        foreign_key_rows = connection.execute("PRAGMA foreign_key_check").fetchall()
        tables = table_names(connection)
        if role == "base":
            required = {
                "knowledge_items",
                "knowledge_relations",
                "source_references",
                "content_documents",
                "content_fragments",
                "content_relations",
                "content_source_evidence",
                "schema_migrations",
            }
            count_tables = [
                "knowledge_items",
                "knowledge_relations",
                "source_references",
                "content_documents",
                "content_fragments",
                "content_relations",
                "content_source_evidence",
            ]
            meta_tables = ["content_schema_meta"]
        elif role == "content-assets":
            required = {"asset_schema_meta", "content_assets", "document_assets"}
            count_tables = ["content_assets", "document_assets"]
            meta_tables = ["asset_schema_meta"]
        else:
            raise ValueError(f"unsupported database role: {role}")
        missing = sorted(required - tables)
        if missing:
            raise ValueError(f"{role} database is missing required tables: {missing}")
        counts = {
            table: int(scalar(connection, f'SELECT COUNT(*) FROM "{table}"'))
            for table in count_tables
        }
        metadata: dict[str, str] = {}
        for table in meta_tables:
            if table in tables:
                metadata.update(
                    {
                        str(row["key"]): str(row["value"])
                        for row in connection.execute(
                            f'SELECT "key", "value" FROM "{table}" ORDER BY "key"'
                        )
                    }
                )
        if role == "content-assets":
            counts["content_asset_bytes"] = int(
                scalar(connection, "SELECT COALESCE(SUM(byte_count), 0) FROM content_assets")
            )
    if integrity != "ok":
        raise ValueError(f"{role} database integrity_check failed: {integrity}")
    if foreign_key_rows:
        raise ValueError(
            f"{role} database foreign_key_check failed: {len(foreign_key_rows)} rows"
        )
    return {
        "role": role,
        "fileName": path.name,
        "bytes": path.stat().st_size,
        "sha256": sha256_file(path),
        "integrityCheck": integrity,
        "foreignKeyViolations": 0,
        "counts": counts,
        "metadata": metadata,
    }


def validate_release_id(value: str) -> str:
    if not RELEASE_ID_PATTERN.fullmatch(value):
        raise ValueError(
            "release id must be 3-80 lowercase letters, digits, dots, underscores, or hyphens"
        )
    return value


def validate_revision(value: str) -> str:
    normalized = value.strip().lower()
    if not REVISION_PATTERN.fullmatch(normalized):
        raise ValueError("source revision must be a full 40-character lowercase Git SHA")
    return normalized


def ensure_source_revision_on_main(revision: str) -> None:
    subprocess.run(
        ["git", "merge-base", "--is-ancestor", revision, "refs/remotes/origin/main"],
        cwd=ROOT,
        check=True,
    )


def write_manifest(path: Path, manifest: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def write_sums(path: Path, files: list[tuple[str, Path]]) -> None:
    lines = [f"{sha256_file(file_path)} *{archive_path}" for archive_path, file_path in files]
    path.write_text("\n".join(lines) + "\n", encoding="ascii")


def build_archive(args: argparse.Namespace) -> Path:
    release_id = validate_release_id(args.release_id)
    revision = validate_revision(args.source_revision)
    if not args.skip_main_ancestry_check:
        ensure_source_revision_on_main(revision)

    base_db = args.base_db.expanduser().resolve()
    asset_db = args.content_asset_db.expanduser().resolve()
    for path, label in ((base_db, "base"), (asset_db, "content-assets")):
        if not path.is_file():
            raise FileNotFoundError(f"{label} database does not exist: {path}")

    before = {
        "base": sha256_file(base_db),
        "content-assets": sha256_file(asset_db),
    }
    base_summary = database_summary(base_db, "base")
    asset_summary = database_summary(asset_db, "content-assets")
    output_dir = args.output_dir.expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    archive_path = output_dir / f"SAPD-Wiki-Windows-Delivery-Data-{release_id}.zip"
    if archive_path.exists() and not args.overwrite:
        raise FileExistsError(f"delivery-data archive already exists: {archive_path}")

    with tempfile.TemporaryDirectory(
        prefix="sapd-windows-delivery-data-"
    ) as temp_name:
        staging = Path(temp_name)
        staged_base = staging / BASE_ARCHIVE_PATH
        staged_asset = staging / ASSET_ARCHIVE_PATH
        staged_base.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(base_db, staged_base)
        shutil.copy2(asset_db, staged_asset)
        if sha256_file(staged_base) != before["base"]:
            raise ValueError("base database changed while creating the delivery snapshot")
        if sha256_file(staged_asset) != before["content-assets"]:
            raise ValueError(
                "content asset database changed while creating the delivery snapshot"
            )

        manifest = {
            "schemaVersion": SCHEMA_VERSION,
            "releaseId": release_id,
            "createdAtUtc": args.approved_at_utc or utc_now(),
            "sourceMainRevision": revision,
            "approvedForWindowsPackaging": True,
            "approval": {
                "approvedBy": args.approved_by,
                "approvedAtUtc": args.approved_at_utc or utc_now(),
                "evidenceRef": args.evidence_ref,
            },
            "databases": {
                "base": {**base_summary, "archivePath": BASE_ARCHIVE_PATH},
                "contentAssets": {
                    **asset_summary,
                    "archivePath": ASSET_ARCHIVE_PATH,
                },
                "user": {
                    "status": "not_included",
                    "templateCreatedByRunner": True,
                },
            },
            "exclusions": [
                "real-user-database",
                "source-files",
                "raw-data",
                "exports-and-recovery-packages",
                "logs-and-diagnostics",
                "local-paths",
            ],
        }
        manifest_file = staging / MANIFEST_PATH
        sums_file = staging / SUMS_PATH
        write_manifest(manifest_file, manifest)
        write_sums(
            sums_file,
            [
                (BASE_ARCHIVE_PATH, staged_base),
                (ASSET_ARCHIVE_PATH, staged_asset),
                (MANIFEST_PATH, manifest_file),
            ],
        )
        temporary_archive = output_dir / f".{archive_path.name}.tmp"
        temporary_archive.unlink(missing_ok=True)
        with zipfile.ZipFile(
            temporary_archive,
            "w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=6,
            allowZip64=True,
        ) as archive:
            for archive_name in sorted(ALLOWED_ARCHIVE_PATHS):
                archive.write(staging / archive_name, arcname=archive_name)
        temporary_archive.replace(archive_path)

    after = {
        "base": sha256_file(base_db),
        "content-assets": sha256_file(asset_db),
    }
    if after != before:
        archive_path.unlink(missing_ok=True)
        raise ValueError("formal database hash changed during delivery-data packaging")
    verify_archive(archive_path, expected_release_id=release_id)
    return archive_path


def safe_extract(archive: zipfile.ZipFile, destination: Path) -> None:
    members = archive.infolist()
    if len(members) != MAX_ARCHIVE_MEMBERS:
        raise ValueError("delivery-data archive member count mismatch")
    seen: set[str] = set()
    total_size = 0
    for member in members:
        if "\\" in member.filename:
            raise ValueError(
                f"unsafe delivery-data archive member: {member.filename}"
            )
        normalized = member.filename.rstrip("/")
        pure_path = PurePosixPath(normalized)
        if (
            member.is_dir()
            or pure_path.is_absolute()
            or ".." in pure_path.parts
            or re.match(r"^[A-Za-z]:", normalized)
            or normalized.startswith("//")
        ):
            raise ValueError(
                f"unsafe delivery-data archive member: {member.filename}"
            )
        casefolded = normalized.casefold()
        if casefolded in seen:
            raise ValueError(
                f"duplicate delivery-data archive member: {member.filename}"
            )
        seen.add(casefolded)
        if normalized not in ALLOWED_ARCHIVE_PATHS:
            raise ValueError(f"unexpected delivery-data archive member: {member.filename}")
        unix_mode = (member.external_attr >> 16) & 0o170000
        if unix_mode == 0o120000:
            raise ValueError(
                f"symlink delivery-data archive member is forbidden: {member.filename}"
            )
        if member.file_size < 0 or member.file_size > MAX_MEMBER_BYTES:
            raise ValueError(
                f"delivery-data archive member is too large: {member.filename}"
            )
        total_size += member.file_size
        if total_size > MAX_TOTAL_UNCOMPRESSED_BYTES:
            raise ValueError("delivery-data archive uncompressed size is too large")
        target = (destination / normalized).resolve()
        if destination.resolve() not in target.parents:
            raise ValueError(f"unsafe delivery-data archive member: {member.filename}")
        target.parent.mkdir(parents=True, exist_ok=True)
        with archive.open(member) as source, target.open("xb") as output:
            shutil.copyfileobj(source, output, length=1024 * 1024)


def parse_sums(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    for raw_line in path.read_text(encoding="ascii").splitlines():
        digest, separator, archive_path = raw_line.partition(" *")
        if not separator or not re.fullmatch(r"[0-9a-f]{64}", digest):
            raise ValueError(f"invalid SHA256SUMS line: {raw_line}")
        result[archive_path] = digest
    return result


def verify_archive(
    archive_path: Path, *, expected_release_id: str | None = None
) -> dict[str, Any]:
    archive_path = archive_path.expanduser().resolve()
    if not archive_path.is_file():
        raise FileNotFoundError(f"delivery-data archive does not exist: {archive_path}")
    with tempfile.TemporaryDirectory(
        prefix="sapd-windows-delivery-data-verify-"
    ) as temp_name:
        extracted = Path(temp_name)
        with zipfile.ZipFile(archive_path) as archive:
            names = {item.filename.rstrip("/") for item in archive.infolist()}
            if names != ALLOWED_ARCHIVE_PATHS:
                raise ValueError(
                    f"delivery-data archive members mismatch: {sorted(names)}"
                )
            safe_extract(archive, extracted)

        manifest = json.loads(
            (extracted / MANIFEST_PATH).read_text(encoding="utf-8")
        )
        if manifest.get("schemaVersion") != SCHEMA_VERSION:
            raise ValueError("unsupported delivery-data manifest schema")
        release_id = validate_release_id(str(manifest.get("releaseId", "")))
        if expected_release_id is not None and release_id != expected_release_id:
            raise ValueError(
                f"delivery-data release mismatch: {release_id} != {expected_release_id}"
            )
        validate_revision(str(manifest.get("sourceMainRevision", "")))
        if manifest.get("approvedForWindowsPackaging") is not True:
            raise ValueError("delivery-data archive is not approved for Windows packaging")
        if manifest.get("databases", {}).get("user", {}).get("status") != "not_included":
            raise ValueError("delivery-data archive must not contain a user database")

        sums = parse_sums(extracted / SUMS_PATH)
        expected_sum_paths = {
            BASE_ARCHIVE_PATH,
            ASSET_ARCHIVE_PATH,
            MANIFEST_PATH,
        }
        if set(sums) != expected_sum_paths:
            raise ValueError("delivery-data SHA256SUMS paths mismatch")
        for relative_path, expected_hash in sums.items():
            actual = sha256_file(extracted / relative_path)
            if actual != expected_hash:
                raise ValueError(
                    f"delivery-data hash mismatch for {relative_path}: {actual}"
                )

        base_path = extracted / BASE_ARCHIVE_PATH
        asset_path = extracted / ASSET_ARCHIVE_PATH
        actual_summaries = {
            "base": database_summary(base_path, "base"),
            "contentAssets": database_summary(asset_path, "content-assets"),
        }
        for key in ("base", "contentAssets"):
            declared = manifest["databases"][key]
            actual = actual_summaries[key]
            for field in (
                "role",
                "bytes",
                "sha256",
                "integrityCheck",
                "foreignKeyViolations",
                "counts",
                "metadata",
            ):
                if declared.get(field) != actual.get(field):
                    raise ValueError(
                        f"delivery-data manifest mismatch: {key}.{field}"
                    )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "releaseId": release_id,
        "archive": str(archive_path),
        "archiveBytes": archive_path.stat().st_size,
        "archiveSha256": sha256_file(archive_path),
        "sourceMainRevision": manifest["sourceMainRevision"],
        "databases": {
            "baseSha256": manifest["databases"]["base"]["sha256"],
            "contentAssetsSha256": manifest["databases"]["contentAssets"]["sha256"],
        },
        "verified": True,
    }


def split_archive(
    archive_path: Path,
    *,
    output_dir: Path,
    part_bytes: int = DEFAULT_RELEASE_PART_BYTES,
) -> Path:
    archive_path = archive_path.expanduser().resolve()
    output_dir = output_dir.expanduser().resolve()
    if not archive_path.is_file():
        raise FileNotFoundError(f"delivery-data archive does not exist: {archive_path}")
    if part_bytes < 4 * 1024 * 1024 or part_bytes > 128 * 1024 * 1024:
        raise ValueError("release part size must be between 4 MiB and 128 MiB")
    verification = verify_archive(archive_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    prefix = f"{archive_path.name}.part-"
    existing = sorted(output_dir.glob(f"{prefix}*"))
    if existing:
        raise FileExistsError(f"release parts already exist: {existing[0]}")
    parts: list[dict[str, object]] = []
    with archive_path.open("rb") as source:
        index = 1
        while True:
            payload = source.read(part_bytes)
            if not payload:
                break
            name = f"{prefix}{index:04d}"
            path = output_dir / name
            path.write_bytes(payload)
            parts.append(
                {
                    "name": name,
                    "bytes": len(payload),
                    "sha256": sha256_file(path),
                }
            )
            index += 1
    manifest = {
        "schemaVersion": "sapd-windows-delivery-data-parts-v1",
        "archiveName": archive_path.name,
        "archiveBytes": archive_path.stat().st_size,
        "archiveSha256": verification["archiveSha256"],
        "releaseId": verification["releaseId"],
        "parts": parts,
    }
    manifest_path = output_dir / f"{archive_path.name}.parts.json"
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return manifest_path


def join_archive_parts(parts_manifest: Path, *, output_dir: Path) -> Path:
    parts_manifest = parts_manifest.expanduser().resolve()
    output_dir = output_dir.expanduser().resolve()
    manifest = json.loads(parts_manifest.read_text(encoding="utf-8"))
    if manifest.get("schemaVersion") != "sapd-windows-delivery-data-parts-v1":
        raise ValueError("unsupported delivery-data parts manifest")
    parts = manifest.get("parts")
    if not isinstance(parts, list) or not parts:
        raise ValueError("delivery-data parts manifest has no parts")
    output_dir.mkdir(parents=True, exist_ok=True)
    archive_path = output_dir / str(manifest["archiveName"])
    if archive_path.exists():
        raise FileExistsError(f"joined archive already exists: {archive_path}")
    with archive_path.open("xb") as output:
        for index, item in enumerate(parts, start=1):
            expected_name = f"{manifest['archiveName']}.part-{index:04d}"
            if not isinstance(item, dict) or item.get("name") != expected_name:
                raise ValueError("delivery-data part order or name mismatch")
            part_path = parts_manifest.parent / expected_name
            if not part_path.is_file():
                raise FileNotFoundError(f"delivery-data part is missing: {part_path}")
            if part_path.stat().st_size != int(item.get("bytes", -1)):
                raise ValueError(f"delivery-data part size mismatch: {expected_name}")
            if sha256_file(part_path) != item.get("sha256"):
                raise ValueError(f"delivery-data part hash mismatch: {expected_name}")
            with part_path.open("rb") as source:
                shutil.copyfileobj(source, output, length=1024 * 1024)
    if archive_path.stat().st_size != int(manifest.get("archiveBytes", -1)):
        archive_path.unlink(missing_ok=True)
        raise ValueError("joined delivery-data archive size mismatch")
    if sha256_file(archive_path) != manifest.get("archiveSha256"):
        archive_path.unlink(missing_ok=True)
        raise ValueError("joined delivery-data archive hash mismatch")
    verify_archive(
        archive_path,
        expected_release_id=str(manifest.get("releaseId", "")),
    )
    return archive_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build or verify the protected Windows delivery-data archive."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    build = subparsers.add_parser("build")
    build.add_argument("--base-db", type=Path, default=DEFAULT_BASE_DB)
    build.add_argument("--content-asset-db", type=Path, default=DEFAULT_ASSET_DB)
    build.add_argument("--output-dir", type=Path, required=True)
    build.add_argument("--release-id", required=True)
    build.add_argument("--source-revision", required=True)
    build.add_argument("--approved-by", required=True)
    build.add_argument("--approved-at-utc")
    build.add_argument("--evidence-ref", required=True)
    build.add_argument("--overwrite", action="store_true")
    build.add_argument(
        "--skip-main-ancestry-check",
        action="store_true",
        help="Tests only: do not use for a formal delivery-data archive.",
    )
    verify = subparsers.add_parser("verify")
    verify.add_argument("--archive", type=Path, required=True)
    verify.add_argument("--expected-release-id")
    split = subparsers.add_parser("split")
    split.add_argument("--archive", type=Path, required=True)
    split.add_argument("--output-dir", type=Path, required=True)
    split.add_argument("--part-bytes", type=int, default=DEFAULT_RELEASE_PART_BYTES)
    join = subparsers.add_parser("join")
    join.add_argument("--parts-manifest", type=Path, required=True)
    join.add_argument("--output-dir", type=Path, required=True)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == "build":
        archive = build_archive(args)
        result = verify_archive(archive, expected_release_id=args.release_id)
    elif args.command == "verify":
        result = verify_archive(
            args.archive, expected_release_id=args.expected_release_id
        )
    elif args.command == "split":
        manifest = split_archive(
            args.archive,
            output_dir=args.output_dir,
            part_bytes=args.part_bytes,
        )
        result = {
            "partsManifest": str(manifest),
            "verified": True,
        }
    else:
        archive = join_archive_parts(
            args.parts_manifest,
            output_dir=args.output_dir,
        )
        result = verify_archive(archive)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
