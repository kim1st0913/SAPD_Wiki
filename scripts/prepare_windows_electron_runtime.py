#!/usr/bin/env python3
"""Assemble a clean Windows Electron Runtime from a CI backend artifact."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import PurePosixPath
from pathlib import Path

try:
    from windows_delivery_data import (
        SCHEMA_VERSION as DELIVERY_DATA_SCHEMA_VERSION,
        database_summary,
        sha256_file,
        validate_release_id,
        validate_revision,
    )
except ModuleNotFoundError:
    from scripts.windows_delivery_data import (
        SCHEMA_VERSION as DELIVERY_DATA_SCHEMA_VERSION,
        database_summary,
        sha256_file,
        validate_release_id,
        validate_revision,
    )


REPO_ROOT = Path(__file__).resolve().parents[1]
BUILD_ZIP_BUNDLE = REPO_ROOT / "scripts" / "build_zip_bundle.py"
DEFAULT_FRONTEND = REPO_ROOT / "frontend" / "capability-browser"
DEFAULT_BASE_DB = REPO_ROOT / "data" / "database" / "sapd_wiki.sqlite3"
DEFAULT_CONTENT_ASSET_DB = (
    REPO_ROOT / "data" / "database" / "sapd_content_assets.sqlite3"
)
DEFAULT_OUTPUT = REPO_ROOT / "apps" / "electron" / ".build" / "runtime-template"
BACKEND_NAME = "SAPD-Wiki-Backend.exe"
DELIVERY_MANIFEST_RUNTIME_NAME = "windows-delivery-data-manifest.json"
MAX_BACKEND_ARCHIVE_FILES = 20_000
MAX_BACKEND_ARCHIVE_BYTES = 2 * 1024 * 1024 * 1024


def safe_extract(zip_path: Path, destination: Path) -> None:
    with zipfile.ZipFile(zip_path) as archive:
        members = archive.infolist()
        if len(members) > MAX_BACKEND_ARCHIVE_FILES:
            raise ValueError("backend ZIP contains too many members")
        seen: set[str] = set()
        total_bytes = 0
        for member in members:
            if "\\" in member.filename:
                raise ValueError(f"unsafe ZIP member: {member.filename}")
            normalized = member.filename.rstrip("/")
            pure = PurePosixPath(normalized)
            if (
                pure.is_absolute()
                or ".." in pure.parts
                or normalized.startswith("//")
                or (
                    len(normalized) >= 2
                    and normalized[0].isalpha()
                    and normalized[1] == ":"
                )
            ):
                raise ValueError(f"unsafe ZIP member: {member.filename}")
            casefolded = normalized.casefold()
            if casefolded in seen:
                raise ValueError(f"duplicate ZIP member: {member.filename}")
            seen.add(casefolded)
            unix_mode = (member.external_attr >> 16) & 0o170000
            if unix_mode == 0o120000:
                raise ValueError(f"symlink ZIP member is forbidden: {member.filename}")
            total_bytes += member.file_size
            if total_bytes > MAX_BACKEND_ARCHIVE_BYTES:
                raise ValueError("backend ZIP uncompressed size is too large")
            target = (destination / normalized).resolve()
            if destination.resolve() not in target.parents:
                raise ValueError(f"unsafe ZIP member: {member.filename}")
            if member.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(member) as source, target.open("xb") as output:
                shutil.copyfileobj(source, output, length=1024 * 1024)


def locate_backend(root: Path) -> Path:
    candidates = [root / BACKEND_NAME, root / "SAPD-Wiki-Backend" / BACKEND_NAME]
    candidates.extend(sorted(root.rglob(BACKEND_NAME)))
    for candidate in candidates:
        if candidate.is_file() and (candidate.parent / "_internal").is_dir():
            return candidate
    raise FileNotFoundError(f"{BACKEND_NAME} with _internal was not found under {root}")


def backend_source(
    artifact: Path,
    temp_root: Path,
    *,
    expected_source_revision: str | None,
) -> tuple[Path, dict[str, object]]:
    artifact = artifact.expanduser().resolve()
    metadata: dict[str, object] = {}
    if artifact.is_file() and artifact.suffix.lower() == ".zip":
        metadata["artifactSha256"] = sha256_file(artifact)
        extracted = temp_root / "backend-artifact"
        extracted.mkdir(parents=True)
        safe_extract(artifact, extracted)
        source_root = extracted
    elif artifact.is_dir():
        source_root = artifact
    else:
        raise FileNotFoundError(f"backend artifact does not exist: {artifact}")

    backend = locate_backend(source_root)
    build_info = backend.parent / "build-info.json"
    if build_info.is_file():
        ci_build_info = json.loads(build_info.read_text(encoding="utf-8-sig"))
        metadata["ciBuildInfo"] = ci_build_info
    elif expected_source_revision is not None:
        raise ValueError("backend build-info.json is required for a CI runtime")
    backend_hash = sha256_file(backend)
    metadata["backendSha256"] = backend_hash
    if expected_source_revision is not None:
        if ci_build_info.get("schemaVersion") != "sapd-windows-backend-artifact-v1":
            raise ValueError("unsupported Windows backend build-info schema")
        if ci_build_info.get("sourceRevision") != expected_source_revision:
            raise ValueError("Windows backend source revision mismatch")
        if ci_build_info.get("platform") != "win-x64":
            raise ValueError("Windows backend platform mismatch")
        if ci_build_info.get("executable") != BACKEND_NAME:
            raise ValueError("Windows backend executable name mismatch")
        if ci_build_info.get("executableSha256") != backend_hash:
            raise ValueError("Windows backend executable hash mismatch")
    return backend, metadata


def load_delivery_manifest(
    manifest_path: Path,
    *,
    base_db: Path,
    content_asset_db: Path,
    source_revision: str,
) -> tuple[dict[str, object], str]:
    manifest_path = manifest_path.expanduser().resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    validate_revision(source_revision)
    if manifest.get("schemaVersion") != DELIVERY_DATA_SCHEMA_VERSION:
        raise ValueError("unsupported Windows delivery-data manifest schema")
    release_id = validate_release_id(str(manifest.get("releaseId", "")))
    data_source_revision = validate_revision(
        str(manifest.get("sourceMainRevision", ""))
    )
    if manifest.get("approvedForWindowsPackaging") is not True:
        raise ValueError("Windows delivery-data manifest is not approved")
    if manifest.get("databases", {}).get("user", {}).get("status") != "not_included":
        raise ValueError("Windows delivery-data manifest includes a user database")
    actual = {
        "base": database_summary(base_db, "base"),
        "contentAssets": database_summary(content_asset_db, "content-assets"),
    }
    for key in ("base", "contentAssets"):
        declared = manifest["databases"][key]
        for field in (
            "role",
            "bytes",
            "sha256",
            "integrityCheck",
            "foreignKeyViolations",
            "counts",
            "metadata",
        ):
            if declared.get(field) != actual[key].get(field):
                raise ValueError(
                    f"Windows delivery-data database mismatch: {key}.{field}"
                )
    manifest["sourceMainRevision"] = data_source_revision
    return manifest, release_id


def normalize_base_manifest(
    runtime_root: Path,
    *,
    delivery_manifest: dict[str, object],
    release_id: str,
) -> None:
    path = runtime_root / "data" / "base" / "base-manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    delivery_databases = delivery_manifest["databases"]
    base = delivery_databases["base"]
    assets = delivery_databases["contentAssets"]
    manifest["build_time"] = delivery_manifest["createdAtUtc"]
    manifest["data_release_id"] = release_id
    manifest["data_version"] = release_id
    manifest["base_database"]["data_version"] = release_id
    manifest["base_database"]["schema_version"] = (
        base.get("metadata", {}).get("schema_version") or "base-content-query-v1"
    )
    manifest["base_database"]["sha256"] = base["sha256"]
    manifest["content_asset_database"]["schema_version"] = (
        assets.get("metadata", {}).get("schema_version")
        or "content-asset-schema-v1"
    )
    manifest["content_asset_database"]["sha256"] = assets["sha256"]
    path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    delivery_copy = runtime_root / "data" / "base" / DELIVERY_MANIFEST_RUNTIME_NAME
    delivery_copy.write_text(
        json.dumps(
            delivery_manifest, ensure_ascii=False, indent=2, sort_keys=True
        )
        + "\n",
        encoding="utf-8",
    )


def write_runtime_fingerprint(runtime_root: Path) -> str:
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
    files: list[Path] = []
    for item in include_roots:
        if item.is_file():
            files.append(item)
        elif item.is_dir():
            files.extend(path for path in item.rglob("*") if path.is_file())

    digest = hashlib.sha256()
    for path in sorted(files):
        digest.update(path.relative_to(runtime_root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    fingerprint = digest.hexdigest()
    (runtime_root / ".sapd-runtime-fingerprint").write_text(fingerprint + "\n", encoding="utf-8")
    return fingerprint


def build_runtime(args: argparse.Namespace, backend: Path, output_dir: Path) -> Path:
    work_dir = output_dir.parent / "bundle-work"
    shutil.rmtree(work_dir, ignore_errors=True)
    work_dir.mkdir(parents=True, exist_ok=True)
    command = [
        sys.executable,
        str(BUILD_ZIP_BUNDLE),
        "--output-dir",
        str(work_dir),
        "--platform",
        "win-x64",
        "--bundle-version",
        args.app_version,
        "--app-version",
        args.app_version,
        "--frontend-dist",
        str(args.frontend_dist.resolve()),
        "--backend-binary",
        str(backend),
        "--base-db",
        str(args.base_db.resolve()),
    ]
    if args.content_asset_db is not None:
        command.extend(
            ["--content-asset-db", str(args.content_asset_db.resolve())]
        )
    subprocess.run(command, check=True, cwd=REPO_ROOT)
    bundles = sorted(work_dir.glob(f"SAPD-Wiki-*-win-x64"))
    if len(bundles) != 1:
        raise RuntimeError(f"expected one Windows Runtime bundle, found: {bundles}")
    shutil.rmtree(output_dir, ignore_errors=True)
    shutil.copytree(bundles[0], output_dir)
    if args.delivery_manifest is not None:
        normalize_base_manifest(
            output_dir,
            delivery_manifest=args.delivery_manifest,
            release_id=args.delivery_release_id,
        )
    fingerprint = write_runtime_fingerprint(output_dir)
    metadata = {
        "schemaVersion": "sapd-windows-electron-runtime-v2",
        "appVersion": args.app_version,
        "platform": "win-x64",
        "sourceRevision": args.source_revision,
        "deliveryData": (
            {
                "schemaVersion": args.delivery_manifest["schemaVersion"],
                "releaseId": args.delivery_release_id,
                "sourceMainRevision": args.delivery_manifest[
                    "sourceMainRevision"
                ],
                "manifestSha256": sha256_file(args.delivery_data_manifest),
                "baseSha256": args.delivery_manifest["databases"]["base"][
                    "sha256"
                ],
                "contentAssetsSha256": args.delivery_manifest["databases"][
                    "contentAssets"
                ]["sha256"],
            }
            if args.delivery_manifest is not None
            else None
        ),
        "runtimeFingerprint": fingerprint,
        "backend": args.backend_metadata,
    }
    (output_dir / "electron-runtime-build.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return output_dir


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare the Windows Runtime used by Electron Builder.")
    parser.add_argument("--backend-artifact", type=Path, required=True, help="Downloaded GitHub Actions ZIP or extracted artifact directory.")
    parser.add_argument("--frontend-dist", type=Path, default=DEFAULT_FRONTEND)
    parser.add_argument("--base-db", type=Path, default=DEFAULT_BASE_DB)
    parser.add_argument(
        "--content-asset-db",
        type=Path,
        default=DEFAULT_CONTENT_ASSET_DB,
    )
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--app-version", default="0.3.0")
    parser.add_argument("--source-revision")
    parser.add_argument("--delivery-data-manifest", type=Path)
    args = parser.parse_args()
    if not args.frontend_dist.is_dir():
        raise FileNotFoundError(f"frontend directory does not exist: {args.frontend_dist}")
    if not args.base_db.is_file():
        raise FileNotFoundError(f"base database does not exist: {args.base_db}")
    if args.content_asset_db is not None and not args.content_asset_db.is_file():
        raise FileNotFoundError(
            f"content asset database does not exist: {args.content_asset_db}"
        )
    if bool(args.source_revision) != bool(args.delivery_data_manifest):
        raise ValueError(
            "--source-revision and --delivery-data-manifest must be supplied together"
        )
    args.delivery_manifest = None
    args.delivery_release_id = None
    if args.source_revision is not None:
        args.source_revision = validate_revision(args.source_revision)
        args.delivery_manifest, args.delivery_release_id = load_delivery_manifest(
            args.delivery_data_manifest,
            base_db=args.base_db.resolve(),
            content_asset_db=args.content_asset_db.resolve(),
            source_revision=args.source_revision,
        )

    with tempfile.TemporaryDirectory(prefix="sapd-windows-backend-") as temp_dir:
        backend, metadata = backend_source(
            args.backend_artifact,
            Path(temp_dir),
            expected_source_revision=args.source_revision,
        )
        args.backend_metadata = metadata
        output_dir = build_runtime(args, backend, args.output_dir.resolve())
    print(f"runtime_template={output_dir}")
    print(f"backend_sha256={metadata['backendSha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
