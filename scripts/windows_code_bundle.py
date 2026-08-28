#!/usr/bin/env python3
"""Build and verify a public, data-free Windows Code Bundle."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

try:
    from scripts import windows_policy
except ImportError:  # Direct execution adds scripts/ rather than the repository root.
    import windows_policy  # type: ignore[no-redef]


SCHEMA_VERSION = "sapd-windows-code-bundle-v1"
INSTANCE_SCHEMA_VERSION = "sapd-windows-code-bundle-instance-v1"
PLATFORM = "win-x64"
MANIFEST_NAME = "code-bundle-manifest.json"
BUILD_POLICY_PATH = "build-policy/windows-build-policy.json"
BUILD_LOCK_PATH = "build-policy/windows-build-py311-x64.lock"
MAX_FILES = 50_000
MAX_UNCOMPRESSED_BYTES = 3 * 1024 * 1024 * 1024
APP_VERSION_RE = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$")
SHA40_RE = re.compile(r"^[0-9a-f]{40}$")

ALLOWED_PREFIXES = (
    "apps/electron/",
    "config/",
    "frontend/capability-browser/",
    "src/sapd_wiki/",
)
ALLOWED_EXACT = {
    "pyproject.toml",
    "scripts/audit_capability_viewmodel_contract.mjs",
    "scripts/audit_frontend_p1_3_lifecycle_workbench_contract.mjs",
    "scripts/audit_frontend_p1_4_reference_tables_contract.mjs",
    "scripts/audit_frontend_system_settings_contract.mjs",
    "scripts/audit_phase2_batch1_owner_switch_contract.mjs",
    "scripts/build_zip_bundle.py",
    "scripts/check_bundle_runtime.py",
    "scripts/create_user_db.py",
    "scripts/prepare_windows_electron_runtime.py",
    "scripts/verify_windows_installer.ps1",
    "scripts/verify_windows_runtime.py",
    "scripts/windows_delivery_data.py",
    "tests/test_capability_focus_projection.py",
    "tests/test_capability_maintenance_projection.py",
    "tests/test_phase2_batch1_owner_switch.py",
}
FORBIDDEN_SUFFIXES = {
    ".bak",
    ".backup",
    ".db",
    ".dmg",
    ".doc",
    ".docx",
    ".drawio",
    ".key",
    ".log",
    ".pdf",
    ".pfx",
    ".p12",
    ".pptx",
    ".sqlite",
    ".sqlite3",
    ".xls",
    ".xlsm",
    ".xlsx",
}
FORBIDDEN_PARTS = {
    ".git",
    ".build",
    "dist",
    "node_modules",
    "releases",
    "__pycache__",
}
SECRET_MARKERS = (
    b"-----BEGIN PRIVATE KEY-----",
    b"-----BEGIN RSA PRIVATE KEY-----",
    b"-----BEGIN EC PRIVATE KEY-----",
    b"github_pat_",
    b"ghp_",
)


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_output(repo_root: Path, *args: str) -> str:
    return subprocess.run(
        ["git", *args],
        cwd=repo_root,
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


def validate_identity(workflow_sha: str, source_sha: str, app_version: str) -> None:
    if not SHA40_RE.fullmatch(workflow_sha):
        raise ValueError("workflow SHA must be a full lowercase Git SHA")
    if not SHA40_RE.fullmatch(source_sha):
        raise ValueError("source SHA must be a full lowercase Git SHA")
    if not APP_VERSION_RE.fullmatch(app_version):
        raise ValueError("app version is not a semantic version")


def validate_source_ancestry(repo_root: Path, workflow_sha: str, source_sha: str) -> None:
    validate_identity(workflow_sha, source_sha, "0.0.0")
    for revision, label in ((workflow_sha, "workflow"), (source_sha, "source")):
        try:
            git_output(repo_root, "cat-file", "-e", f"{revision}^{{commit}}")
        except subprocess.CalledProcessError as error:
            raise ValueError(f"{label} SHA is not available in the orchestration repository") from error
    result = subprocess.run(
        ["git", "merge-base", "--is-ancestor", source_sha, workflow_sha],
        cwd=repo_root,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise ValueError("product source SHA is not an ancestor of workflow SHA")


def validate_relative_path(value: str) -> PurePosixPath:
    if "\\" in value:
        raise ValueError(f"backslash is forbidden in bundle path: {value}")
    path = PurePosixPath(value)
    if not value or path.is_absolute() or ".." in path.parts or value.startswith("//"):
        raise ValueError(f"unsafe bundle path: {value}")
    if len(value) >= 2 and value[0].isalpha() and value[1] == ":":
        raise ValueError(f"drive-qualified bundle path is forbidden: {value}")
    return path


def forbidden_path(value: str, *, backend: bool = False) -> bool:
    path = validate_relative_path(value)
    lowered_parts = {part.casefold() for part in path.parts}
    if lowered_parts & FORBIDDEN_PARTS:
        return True
    suffix = path.suffix.casefold()
    if suffix in FORBIDDEN_SUFFIXES:
        return True
    if any(part.casefold().startswith(".env") for part in path.parts):
        return True
    if backend:
        lowered_name = path.name.casefold()
        if "private-key" in lowered_name or "client-secret" in lowered_name:
            return True
    return False


def selected_tracked_files(repo_root: Path) -> list[str]:
    raw = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=repo_root,
        check=True,
        capture_output=True,
    ).stdout.decode("utf-8")
    selected = []
    for value in raw.split("\0"):
        if not value:
            continue
        if value in ALLOWED_EXACT or value.startswith(ALLOWED_PREFIXES):
            if forbidden_path(value):
                raise ValueError(f"forbidden tracked path selected for Code Bundle: {value}")
            selected.append(value)
    missing = sorted(path for path in ALLOWED_EXACT if path not in selected)
    if missing:
        raise ValueError(f"required Code Bundle payload files are missing: {missing}")
    return sorted(selected)


def copy_payload(repo_root: Path, payload_root: Path) -> None:
    for relative in selected_tracked_files(repo_root):
        source = repo_root / relative
        if source.is_symlink() or not source.is_file():
            raise ValueError(f"Code Bundle payload must contain regular files only: {relative}")
        target = payload_root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)


def copy_backend(backend_root: Path, target_root: Path) -> None:
    backend_root = backend_root.resolve()
    if not (backend_root / "SAPD-Wiki-Backend.exe").is_file():
        raise ValueError("native backend executable is missing")
    if not (backend_root / "_internal").is_dir():
        raise ValueError("native backend dependency tree is missing")
    if not (backend_root / "build-info.json").is_file():
        raise ValueError("native backend build-info.json is missing")
    for source in sorted(backend_root.rglob("*")):
        if source.is_symlink():
            raise ValueError(f"native backend symlink is forbidden: {source}")
        if not source.is_file():
            continue
        relative = source.relative_to(backend_root).as_posix()
        bundle_relative = f"native-backend/{PLATFORM}/{relative}"
        if forbidden_path(bundle_relative, backend=True):
            raise ValueError(f"forbidden native backend path: {relative}")
        if source.stat().st_size <= 1024 * 1024:
            content = source.read_bytes()
            if any(marker in content for marker in SECRET_MARKERS):
                raise ValueError(f"native backend contains a secret marker: {relative}")
        target = target_root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)


def copy_control_file(source: Path, target: Path, label: str) -> None:
    if source.is_symlink() or not source.is_file():
        raise ValueError(f"{label} must be a regular file")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def copy_canonical_policy(source: Path, target: Path) -> str:
    if source.is_symlink() or not source.is_file():
        raise ValueError("build policy manifest must be a regular file")
    document, digest = windows_policy.load_manifest(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(windows_policy.canonical_bytes(document))
    return digest


def file_records(bundle_root: Path) -> list[dict[str, object]]:
    records = []
    total_bytes = 0
    for path in sorted(bundle_root.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Code Bundle symlink is forbidden: {path}")
        if not path.is_file() or path.name == MANIFEST_NAME:
            continue
        relative = path.relative_to(bundle_root).as_posix()
        size = path.stat().st_size
        total_bytes += size
        if total_bytes > MAX_UNCOMPRESSED_BYTES:
            raise ValueError("Code Bundle is too large")
        records.append({"path": relative, "bytes": size, "sha256": sha256_file(path)})
    if not records or len(records) > MAX_FILES:
        raise ValueError("Code Bundle file count is invalid")
    return records


def tree_sha256(records: list[dict[str, object]]) -> str:
    digest = hashlib.sha256()
    for record in records:
        digest.update(str(record["path"]).encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(record["sha256"]).encode("ascii"))
        digest.update(b"\0")
        digest.update(str(record["bytes"]).encode("ascii"))
        digest.update(b"\0")
    return digest.hexdigest()


def zip_timestamp(epoch: int) -> tuple[int, int, int, int, int, int]:
    moment = datetime.fromtimestamp(max(epoch, 315532800), tz=timezone.utc)
    second = moment.second - (moment.second % 2)
    return (moment.year, moment.month, moment.day, moment.hour, moment.minute, second)


def write_zip(bundle_root: Path, output: Path, epoch: int) -> None:
    timestamp = zip_timestamp(epoch)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(item for item in bundle_root.rglob("*") if item.is_file()):
            relative = path.relative_to(bundle_root).as_posix()
            info = zipfile.ZipInfo(relative, date_time=timestamp)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, path.read_bytes())


def build(args: argparse.Namespace) -> dict[str, object]:
    repo_root = args.repo_root.resolve()
    workflow_sha = args.workflow_sha.lower()
    source_sha = args.source_sha.lower()
    validate_identity(workflow_sha, source_sha, args.app_version)
    if git_output(repo_root, "rev-parse", "HEAD") != source_sha:
        raise ValueError("repository HEAD does not match source SHA")
    if git_output(repo_root, "status", "--porcelain"):
        raise ValueError("repository must be clean before Code Bundle assembly")
    package = json.loads((repo_root / "apps/electron/package.json").read_text(encoding="utf-8"))
    if package.get("version") != args.app_version:
        raise ValueError("Electron package version does not match requested app version")

    output_dir = args.output_dir.resolve()
    work_root = output_dir / "work"
    bundle_root = work_root / "bundle"
    shutil.rmtree(work_root, ignore_errors=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    (bundle_root / "payload").mkdir(parents=True)
    copy_payload(repo_root, bundle_root / "payload")
    copy_backend(args.backend_root.resolve(), bundle_root / "native-backend" / PLATFORM)
    policy_manifest = args.policy_manifest.resolve()
    build_lock = args.build_lock.resolve()
    policy_sha256 = copy_canonical_policy(
        policy_manifest,
        bundle_root / BUILD_POLICY_PATH,
    )
    copy_control_file(build_lock, bundle_root / BUILD_LOCK_PATH, "Windows build lock")

    records = file_records(bundle_root)
    source_epoch = int(git_output(repo_root, "show", "-s", "--format=%ct", source_sha))
    manifest = {
        "schemaVersion": SCHEMA_VERSION,
        "platform": PLATFORM,
        "appVersion": args.app_version,
        "workflowSha": workflow_sha,
        "sourceSha": source_sha,
        "sourceTree": git_output(repo_root, "rev-parse", f"{source_sha}^{{tree}}"),
        "treeSha256": tree_sha256(records),
        "fileCount": len(records),
        "totalBytes": sum(int(record["bytes"]) for record in records),
        "build": {
            "workflowSha": workflow_sha,
            "sourceSha": source_sha,
            "policySha256": policy_sha256,
            "repository": args.repository,
            "workflow": args.workflow,
            "workflowRef": args.workflow_ref,
            "runId": str(args.run_id),
            "runAttempt": str(args.run_attempt),
            "runner": "windows-2022",
        },
        "instance": {
            "schemaVersion": INSTANCE_SCHEMA_VERSION,
            "appVersion": args.app_version,
            "workflowSha": workflow_sha,
            "sourceSha": source_sha,
            "sourceTree": git_output(repo_root, "rev-parse", f"{source_sha}^{{tree}}"),
            "policySha256": policy_sha256,
            "payloadCoverage": "all-selected-files-by-sha256",
        },
        "components": {
            "buildPolicy": BUILD_POLICY_PATH,
            "windowsBuildLock": BUILD_LOCK_PATH,
            "frontend": "payload/frontend/capability-browser",
            "nativeBackend": f"native-backend/{PLATFORM}",
            "electronPackaging": "payload/apps/electron",
            "packagingHelpers": "payload/scripts",
        },
        "dataBoundary": {
            "deliveryData": "not_included",
            "baseDatabase": "not_included",
            "contentAssetDatabase": "not_included",
            "userDatabase": "not_included",
            "privateCredentials": "not_included",
            "sourceDocuments": "not_included",
        },
        "files": records,
    }
    archive_name = f"SAPD-Wiki-Code-Bundle-{args.app_version}-{source_sha[:12]}-{PLATFORM}.zip"
    archive_path = output_dir / archive_name
    if archive_path.exists():
        archive_path.unlink()
    write_zip(bundle_root, archive_path, source_epoch)
    manifest["bundle"] = {
        "name": archive_name,
        "bytes": archive_path.stat().st_size,
        "sha256": sha256_file(archive_path),
    }
    manifest_text = json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    manifest_path = output_dir / MANIFEST_NAME
    manifest_path.write_text(manifest_text, encoding="utf-8")
    result = {
        "archive": archive_path.name,
        "archiveSha256": sha256_file(archive_path),
        "archiveBytes": archive_path.stat().st_size,
        "manifest": manifest_path.name,
        "manifestSha256": sha256_file(manifest_path),
        "treeSha256": manifest["treeSha256"],
        "fileCount": manifest["fileCount"],
        "policySha256": policy_sha256,
        "workflowSha": workflow_sha,
        "sourceSha": source_sha,
    }
    (output_dir / "code-bundle-output.json").write_text(
        json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    shutil.rmtree(work_root)
    return result


def verify_archive(
    archive_path: Path,
    manifest_path: Path,
    *,
    expected_policy_sha256: str,
    expected_workflow_sha: str,
    expected_source_sha: str,
    expected_app_version: str,
    expected_repository: str,
    expected_workflow: str,
    expected_run_id: str,
) -> dict[str, object]:
    validate_identity(expected_workflow_sha, expected_source_sha, expected_app_version)
    if not re.fullmatch(r"[0-9a-f]{64}", expected_policy_sha256):
        raise ValueError("expected policy SHA-256 is invalid")
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes.decode("utf-8"))
    expected = {
        "schemaVersion": SCHEMA_VERSION,
        "platform": PLATFORM,
        "workflowSha": expected_workflow_sha,
        "sourceSha": expected_source_sha,
        "appVersion": expected_app_version,
    }
    for field, value in expected.items():
        if manifest.get(field) != value:
            raise ValueError(f"Code Bundle manifest mismatch: {field}")
    build_identity = manifest.get("build") or {}
    for field, value in {
        "workflowSha": expected_workflow_sha,
        "sourceSha": expected_source_sha,
        "policySha256": expected_policy_sha256,
        "repository": expected_repository,
        "workflow": expected_workflow,
        "runId": str(expected_run_id),
    }.items():
        if build_identity.get(field) != value:
            raise ValueError(f"Code Bundle build identity mismatch: {field}")
    instance = manifest.get("instance") or {}
    expected_instance = {
        "schemaVersion": INSTANCE_SCHEMA_VERSION,
        "appVersion": expected_app_version,
        "workflowSha": expected_workflow_sha,
        "sourceSha": expected_source_sha,
        "sourceTree": manifest.get("sourceTree"),
        "policySha256": expected_policy_sha256,
        "payloadCoverage": "all-selected-files-by-sha256",
    }
    if instance != expected_instance:
        raise ValueError("Code Bundle instance identity mismatch")
    boundary = manifest.get("dataBoundary") or {}
    if not boundary or any(value != "not_included" for value in boundary.values()):
        raise ValueError("Code Bundle data boundary is not closed")
    bundle_identity = manifest.get("bundle") or {}
    if (
        bundle_identity.get("name") != archive_path.name
        or bundle_identity.get("bytes") != archive_path.stat().st_size
        or bundle_identity.get("sha256") != sha256_file(archive_path)
    ):
        raise ValueError("Code Bundle archive identity mismatch")
    records = manifest.get("files")
    if not isinstance(records, list) or len(records) != manifest.get("fileCount"):
        raise ValueError("Code Bundle manifest file list is invalid")
    declared: dict[str, dict[str, object]] = {}
    for record in records:
        if not isinstance(record, dict):
            raise ValueError("Code Bundle file record is invalid")
        relative = str(record.get("path") or "")
        validate_relative_path(relative)
        if relative in declared or forbidden_path(relative, backend=relative.startswith("native-backend/")):
            raise ValueError(f"Code Bundle contains a forbidden or duplicate path: {relative}")
        declared[relative] = record
    for required in (BUILD_POLICY_PATH, BUILD_LOCK_PATH):
        if required not in declared:
            raise ValueError(f"Code Bundle is missing required policy path: {required}")
    if tree_sha256(records) != manifest.get("treeSha256"):
        raise ValueError("Code Bundle tree digest mismatch")

    with zipfile.ZipFile(archive_path) as archive:
        members = archive.infolist()
        if len(members) != len(records) or len(members) > MAX_FILES:
            raise ValueError("Code Bundle archive file count mismatch")
        seen: set[str] = set()
        total_bytes = 0
        for member in members:
            relative = member.filename.rstrip("/")
            validate_relative_path(relative)
            casefolded = relative.casefold()
            if casefolded in seen or member.is_dir():
                raise ValueError(f"Code Bundle archive contains a duplicate or directory: {relative}")
            seen.add(casefolded)
            unix_mode = (member.external_attr >> 16) & 0o170000
            if unix_mode == 0o120000:
                raise ValueError(f"Code Bundle archive symlink is forbidden: {relative}")
            data = archive.read(member)
            total_bytes += len(data)
            if total_bytes > MAX_UNCOMPRESSED_BYTES:
                raise ValueError("Code Bundle archive is too large")
            record = declared.get(relative)
            if record is None:
                raise ValueError(f"undeclared Code Bundle archive path: {relative}")
            if int(record.get("bytes", -1)) != len(data) or record.get("sha256") != sha256_bytes(data):
                raise ValueError(f"Code Bundle file digest mismatch: {relative}")
        if seen != {path.casefold() for path in declared}:
            raise ValueError("Code Bundle archive and manifest path sets differ")
        _, embedded_policy_sha256 = windows_policy.load_manifest_bytes(
            archive.read(BUILD_POLICY_PATH)
        )
        if embedded_policy_sha256 != expected_policy_sha256:
            raise ValueError("embedded build policy digest mismatch")
    return {
        "archiveSha256": sha256_file(archive_path),
        "manifestSha256": sha256_file(manifest_path),
        "treeSha256": manifest["treeSha256"],
        "fileCount": manifest["fileCount"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    build_parser = subparsers.add_parser("build")
    build_parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    build_parser.add_argument("--backend-root", type=Path, required=True)
    build_parser.add_argument("--output-dir", type=Path, required=True)
    build_parser.add_argument("--policy-manifest", type=Path, required=True)
    build_parser.add_argument("--build-lock", type=Path, required=True)
    build_parser.add_argument("--workflow-sha", required=True)
    build_parser.add_argument("--source-sha", required=True)
    build_parser.add_argument("--app-version", required=True)
    build_parser.add_argument("--repository", required=True)
    build_parser.add_argument("--workflow", required=True)
    build_parser.add_argument("--workflow-ref", required=True)
    build_parser.add_argument("--run-id", required=True)
    build_parser.add_argument("--run-attempt", required=True)

    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("--archive", type=Path, required=True)
    verify_parser.add_argument("--manifest", type=Path, required=True)
    verify_parser.add_argument("--expected-policy-sha256", required=True)
    verify_parser.add_argument("--expected-workflow-sha", required=True)
    verify_parser.add_argument("--expected-source-sha", required=True)
    verify_parser.add_argument("--expected-app-version", required=True)
    verify_parser.add_argument("--expected-repository", required=True)
    verify_parser.add_argument("--expected-workflow", required=True)
    verify_parser.add_argument("--expected-run-id", required=True)
    ancestry_parser = subparsers.add_parser("ancestry")
    ancestry_parser.add_argument("--repo-root", type=Path, required=True)
    ancestry_parser.add_argument("--workflow-sha", required=True)
    ancestry_parser.add_argument("--source-sha", required=True)
    args = parser.parse_args()
    if args.command == "build":
        result = build(args)
    elif args.command == "verify":
        result = verify_archive(
            args.archive.resolve(),
            args.manifest.resolve(),
            expected_policy_sha256=args.expected_policy_sha256,
            expected_workflow_sha=args.expected_workflow_sha,
            expected_source_sha=args.expected_source_sha,
            expected_app_version=args.expected_app_version,
            expected_repository=args.expected_repository,
            expected_workflow=args.expected_workflow,
            expected_run_id=args.expected_run_id,
        )
    else:
        validate_source_ancestry(args.repo_root.resolve(), args.workflow_sha, args.source_sha)
        result = {"workflowSha": args.workflow_sha, "sourceSha": args.source_sha, "status": "verified"}
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
