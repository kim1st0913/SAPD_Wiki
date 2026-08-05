#!/usr/bin/env python3
"""Assemble SAPD Wiki ZIP alpha release files.

This script copies verified platform ZIP artifacts into the local release
directory and writes checksums plus a release manifest. It does not build
platform binaries and does not run ETL.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import time
import zipfile
from pathlib import Path
from typing import Any

from check_bundle_runtime import sha256_file


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BUNDLE_DIR = Path(
    os.environ.get(
        "SAPD_WIKI_BUNDLE_ROOT",
        "/Users/kim1st/Documents/kim note/04_workspace/analysis/research/知识库工程/sapd wiki bundle",
    )
)
DEFAULT_SOURCE_DIR = Path(os.environ.get("SAPD_WIKI_BUNDLE_OUTPUT_DIR", str(DEFAULT_BUNDLE_DIR / "package-work")))
DEFAULT_RELEASE_DIR = Path(
    os.environ.get(
        "SAPD_WIKI_RELEASE_DIR",
        str(DEFAULT_BUNDLE_DIR / "dist" / "releases" / "0.1.0-alpha"),
    )
)
DEFAULT_VERSION = "v0.1.0"
DEFAULT_APP_VERSION = "0.1.0-alpha"
RELEASE_DOC_FILES = (
    "README-FIRST.md",
    "zip-uat-0-checklist.md",
    "zip-uat-feedback-template.md",
    "windows-validation-report.md",
)


def git_commit() -> str:
    result = subprocess.run(
        ["git", "rev-parse", "--short", "HEAD"],
        cwd=REPO_ROOT,
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )
    return result.stdout.strip() if result.returncode == 0 else ""


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def copy_file(source: Path, target: Path) -> None:
    if not source.exists():
        raise FileNotFoundError(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)


def remove_generated_release_extras(release_dir: Path, bundle_version: str) -> None:
    for path in release_dir.rglob(".DS_Store"):
        if path.is_file():
            path.unlink()
    for name in RELEASE_DOC_FILES:
        path = release_dir / name
        if path.exists() and path.is_file():
            path.unlink()
    for path in list(release_dir.glob("SAPD-Wiki-*.zip")) + list(release_dir.glob("SAPD-Wiki-*.sha256")):
        if path.is_file():
            path.unlink()
    for platform_name in ("mac-arm64", "mac-x64", "win-x64"):
        path = release_dir / f"SAPD-Wiki-{bundle_version}-{platform_name}"
        if path.exists() and path.is_dir():
            shutil.rmtree(path)


def write_sha256(zip_path: Path) -> str:
    digest = sha256_file(zip_path)
    checksum_path = zip_path.with_suffix(".sha256")
    write_text(checksum_path, f"{digest}  {zip_path.name}\n")
    return digest


def platform_release_dir(release_dir: Path, platform_name: str) -> Path:
    path = release_dir / platform_name
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def mac_platform_entry(release_dir: Path, bundle_dir: Path, zip_path: Path) -> dict[str, Any]:
    manifest = load_json(bundle_dir / "data" / "base" / "base-manifest.json")
    backend_path = bundle_dir / "SAPD-Wiki-Backend"
    return {
        "platform": "mac-arm64",
        "status": "ready",
        "verification_status": "local_macos_verified",
        "zip_filename": zip_path.name,
        "zip_sha256": sha256_file(zip_path),
        "zip_size_bytes": zip_path.stat().st_size,
        "build_time": manifest.get("build_time"),
        "bundle_type": manifest.get("bundle_type"),
        "app_version": manifest.get("app_version"),
        "data_version": manifest.get("base_database", {}).get("data_version"),
        "base_schema_version": manifest.get("base_database", {}).get("schema_version"),
        "user_schema_version": manifest.get("user_database", {}).get("schema_version"),
        "base_db_sha256": manifest.get("base_database", {}).get("sha256"),
        "backend_sha256": sha256_file(backend_path) if backend_path.exists() else "",
        "release_file": str(zip_path.resolve()),
        "known_limitations": [
            "unsigned_alpha_binary",
            "possible_gatekeeper_prompt",
            "not_a_dmg_or_installer",
            "internal_trial_only",
        ],
    }


def windows_platform_entry(release_dir: Path, windows_zip: Path | None) -> dict[str, Any]:
    windows_dir = platform_release_dir(release_dir, "win-x64")
    if windows_zip and windows_zip.exists():
        return {
            "platform": "win-x64",
            "status": "ready",
            "verification_status": "requires_windows_validation_report",
            "zip_filename": windows_zip.name,
            "zip_sha256": sha256_file(windows_zip),
            "zip_size_bytes": windows_zip.stat().st_size,
            "release_file": str((windows_dir / windows_zip.name).resolve()),
            "known_limitations": [
                "unsigned_alpha_binary",
                "possible_smartscreen_or_security_software_prompt",
                "not_an_msi_or_installer",
                "internal_trial_only",
            ],
        }
    return {
        "platform": "win-x64",
        "status": "pending",
        "verification_status": "not_verified",
        "zip_filename": "SAPD-Wiki-v0.1.0-win-x64.zip",
        "reason": "Windows x64 executable must be built and verified in a real Windows x64 machine, VM, or CI runner. Current environment is macOS arm64.",
        "known_limitations": [
            "SAPD-Wiki-Backend.exe not generated in this environment",
            "Windows ZIP not released",
            "Windows runtime validation pending",
        ],
    }


def windows_validation_report(pending: bool) -> str:
    status = "pending / not_verified" if pending else "ready / requires review"
    return f"""# Windows ZIP Validation Report

> Status: {status}
> Release: 0.1.0-alpha

## Environment

```text
Windows machine: pending
CPU / architecture: pending
Windows version: pending
Python version: pending
PyInstaller version: pending
Repository commit: {git_commit() or "unknown"}
```

## Build Result

```text
SAPD-Wiki-Backend.exe: pending
SAPD-Wiki-v0.1.0-win-x64.zip: pending
```

## Required Validation

- Build `SAPD-Wiki-Backend.exe` on Windows x64.
- Confirm it is a Windows PE executable.
- Generate `SAPD-Wiki-v0.1.0-win-x64.zip` with the real backend binary.
- Verify `start-windows.bat` starts without Python, Node, Docker, or ETL.
- Verify `GET /api/v1/base/summary`.
- Verify token-protected `POST /api/v1/user/favorites`.
- Verify base DB sha256 is unchanged after user writes.
- Verify diagnostics export does not contain `sapd_wiki_user.sqlite3` or user-sensitive text.
- Verify missing base DB failure path.
- Verify port fallback from `18765` to `18766` / `18767` / `18768`.
- Record Windows Defender, SmartScreen, and enterprise security software prompts.

## Current Note

This report is intentionally not marked complete because this macOS arm64
environment cannot produce or verify a real Windows x64 executable.
"""


def copy_trial_docs(release_dir: Path, bundle_dir: Path, windows_pending: bool) -> None:
    copy_file(bundle_dir / "README-FIRST.md", release_dir / "README-FIRST.md")
    copy_file(REPO_ROOT / "docs" / "09-delivery" / "zip-uat-0-checklist.md", release_dir / "zip-uat-0-checklist.md")
    copy_file(REPO_ROOT / "docs" / "09-delivery" / "zip-uat-feedback-template.md", release_dir / "zip-uat-feedback-template.md")
    write_text(release_dir / "windows-validation-report.md", windows_validation_report(windows_pending))


def update_package_entries(release_dir: Path) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for zip_path in sorted(release_dir.rglob("*-update-*.zip")):
        entry: dict[str, Any] = {
            "filename": zip_path.name,
            "sha256": sha256_file(zip_path),
            "size_bytes": zip_path.stat().st_size,
        }
        try:
            with zipfile.ZipFile(zip_path) as archive:
                manifest_member = next((name for name in archive.namelist() if name.endswith("/update-manifest.json")), "")
                if manifest_member:
                    entry["manifest"] = json.loads(archive.read(manifest_member).decode("utf-8"))
        except (OSError, json.JSONDecodeError, zipfile.BadZipFile):
            entry["manifest"] = {"error": "manifest_unreadable"}
        entries.append(entry)
    return entries


def build_release(args: argparse.Namespace) -> Path:
    release_dir = args.release_dir.resolve()
    source_dir = args.source_dir.resolve()
    release_dir.mkdir(parents=True, exist_ok=True)
    mac_dir = platform_release_dir(release_dir, "mac-arm64")
    windows_dir = platform_release_dir(release_dir, "win-x64")

    mac_zip_name = f"SAPD-Wiki-{args.bundle_version}-mac-arm64.zip"
    mac_zip_source = source_dir / mac_zip_name
    mac_zip_target = mac_dir / mac_zip_name
    copy_file(mac_zip_source, mac_zip_target)
    mac_zip_sha = write_sha256(mac_zip_target)

    bundle_dir = source_dir / f"SAPD-Wiki-{args.bundle_version}-mac-arm64"

    windows_zip_target: Path | None = None
    if args.windows_zip:
        windows_zip_target = windows_dir / args.windows_zip.name
        copy_file(args.windows_zip.resolve(), windows_zip_target)
        write_sha256(windows_zip_target)

    windows_entry = windows_platform_entry(release_dir, windows_zip_target)
    if args.include_trial_docs:
        copy_trial_docs(release_dir, bundle_dir, windows_entry["status"] == "pending")
    else:
        remove_generated_release_extras(release_dir, args.bundle_version)

    mac_entry = mac_platform_entry(release_dir, bundle_dir, mac_zip_target)
    release_manifest = {
        "app_name": "SAPD Wiki",
        "app_version": args.app_version,
        "release_version": args.app_version,
        "bundle_type": "zip-portable",
        "release_layout": "minimal",
        "release_layout_note": "Release directory keeps ZIP files, checksums, and release-manifest.json only. User-facing README is inside each full ZIP.",
        "release_directory": str(release_dir) + "/",
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "repository_commit": git_commit(),
        "data_version": mac_entry.get("data_version"),
        "schema_version": {
            "base": mac_entry.get("base_schema_version"),
            "user": mac_entry.get("user_schema_version"),
        },
        "platforms": {
            "mac-arm64": mac_entry,
            "win-x64": windows_entry,
        },
        "update_packages": update_package_entries(release_dir),
        "known_limitations": [
            "alpha_internal_trial_only",
            "not_signed",
            "not_an_installer",
            "no_auto_update",
            "windows_pending_real_machine_validation",
        ],
    }
    if mac_entry["zip_sha256"] != mac_zip_sha:
        raise RuntimeError("mac ZIP checksum changed during release assembly")
    write_text(release_dir / "release-manifest.json", json.dumps(release_manifest, ensure_ascii=False, indent=2) + "\n")
    return release_dir


def main() -> int:
    parser = argparse.ArgumentParser(description="Assemble SAPD Wiki 0.1.0-alpha release files.")
    parser.add_argument("--release-dir", type=Path, default=DEFAULT_RELEASE_DIR)
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--bundle-version", default=DEFAULT_VERSION)
    parser.add_argument("--app-version", default=DEFAULT_APP_VERSION)
    parser.add_argument("--windows-zip", type=Path, help="Optional real Windows ZIP produced in Windows x64.")
    parser.add_argument(
        "--include-trial-docs",
        action="store_true",
        help="Also copy README/checklist/feedback files into the release directory. Default keeps the directory minimal.",
    )
    args = parser.parse_args()

    release_dir = build_release(args)
    print(f"release_dir={release_dir}")
    print(f"manifest={release_dir / 'release-manifest.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
