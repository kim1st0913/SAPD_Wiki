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
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
BUILD_ZIP_BUNDLE = REPO_ROOT / "scripts" / "build_zip_bundle.py"
DEFAULT_FRONTEND = REPO_ROOT / "frontend" / "capability-browser"
DEFAULT_BASE_DB = REPO_ROOT / "data" / "database" / "sapd_wiki.sqlite3"
DEFAULT_CONTENT_ASSET_DB = (
    REPO_ROOT / "data" / "database" / "sapd_content_assets.sqlite3"
)
DEFAULT_OUTPUT = REPO_ROOT / "apps" / "electron" / ".build" / "runtime-template"
BACKEND_NAME = "SAPD-Wiki-Backend.exe"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_extract(zip_path: Path, destination: Path) -> None:
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            target = (destination / member.filename).resolve()
            if destination.resolve() not in target.parents and target != destination.resolve():
                raise ValueError(f"unsafe ZIP member: {member.filename}")
        archive.extractall(destination)


def locate_backend(root: Path) -> Path:
    candidates = [root / BACKEND_NAME, root / "SAPD-Wiki-Backend" / BACKEND_NAME]
    candidates.extend(sorted(root.rglob(BACKEND_NAME)))
    for candidate in candidates:
        if candidate.is_file() and (candidate.parent / "_internal").is_dir():
            return candidate
    raise FileNotFoundError(f"{BACKEND_NAME} with _internal was not found under {root}")


def backend_source(artifact: Path, temp_root: Path) -> tuple[Path, dict[str, object]]:
    artifact = artifact.expanduser().resolve()
    metadata: dict[str, object] = {
        "artifactPath": str(artifact),
        "artifactSha256": sha256_file(artifact) if artifact.is_file() else "",
    }
    if artifact.is_file() and artifact.suffix.lower() == ".zip":
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
        metadata["ciBuildInfo"] = json.loads(build_info.read_text(encoding="utf-8"))
    metadata["backendSha256"] = sha256_file(backend)
    return backend, metadata


def write_runtime_fingerprint(runtime_root: Path) -> str:
    include_roots = [
        runtime_root / BACKEND_NAME,
        runtime_root / "_internal",
        runtime_root / "README-FIRST.md",
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
    fingerprint = write_runtime_fingerprint(output_dir)
    metadata = {
        "schemaVersion": "sapd-windows-electron-runtime-v1",
        "appVersion": args.app_version,
        "platform": "win-x64",
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
    parser.add_argument("--content-asset-db", type=Path)
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--app-version", default="0.2.0")
    args = parser.parse_args()
    if not args.frontend_dist.is_dir():
        raise FileNotFoundError(f"frontend directory does not exist: {args.frontend_dist}")
    if not args.base_db.is_file():
        raise FileNotFoundError(f"base database does not exist: {args.base_db}")
    if args.content_asset_db is not None and not args.content_asset_db.is_file():
        raise FileNotFoundError(
            f"content asset database does not exist: {args.content_asset_db}"
        )

    with tempfile.TemporaryDirectory(prefix="sapd-windows-backend-") as temp_dir:
        backend, metadata = backend_source(args.backend_artifact, Path(temp_dir))
        args.backend_metadata = metadata
        output_dir = build_runtime(args, backend, args.output_dir.resolve())
    print(f"runtime_template={output_dir}")
    print(f"backend_sha256={metadata['backendSha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
