#!/usr/bin/env python3
"""Build and verify deterministic Windows build policy manifests."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path, PurePosixPath


SCHEMA_VERSION = "sapd-windows-stable-policy-v1"
POLICY_KIND = "public-build"
PLATFORM = "win-x64"
SHA40_RE = re.compile(r"^[0-9a-f]{40}$")
SHA64_RE = re.compile(r"^[0-9a-f]{64}$")

REQUIRED_POLICY_PATHS = (
    ".github/workflows/windows-code-bundle.yml",
    "requirements/windows-build-py311-x64.lock",
    "scripts/windows_code_bundle.py",
    "scripts/windows_policy.py",
    "tests/test_windows_code_bundle.py",
    "tests/test_windows_policy.py",
)


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_bytes(document: dict[str, object]) -> bytes:
    return (
        json.dumps(document, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode("utf-8")


def normalized_text_bytes(path: Path) -> bytes:
    raw = path.read_bytes()
    if b"\x00" in raw:
        raise ValueError(f"policy text file contains NUL bytes: {path}")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError(f"policy text file is not UTF-8: {path}") from error
    text = text.replace("\r\n", "\n")
    if "\r" in text:
        raise ValueError(f"policy text file uses unsupported line endings: {path}")
    return text.encode("utf-8")


def policy_file_sha256(path: Path) -> str:
    return sha256_bytes(normalized_text_bytes(path))


def safe_relative_path(value: str) -> PurePosixPath:
    if not value or "\\" in value:
        raise ValueError(f"invalid policy path: {value}")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or value.startswith("//"):
        raise ValueError(f"unsafe policy path: {value}")
    if len(value) >= 2 and value[0].isalpha() and value[1] == ":":
        raise ValueError(f"drive-qualified policy path: {value}")
    return path


def checked_file(root: Path, relative: str) -> Path:
    safe = safe_relative_path(relative)
    if root.is_symlink():
        raise ValueError(f"policy root is a symlink: {root}")
    current = root
    for part in safe.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f"policy path contains a symlink: {relative}")
    if not current.is_file():
        raise ValueError(f"policy file is missing: {relative}")
    return current


def expected_paths() -> set[str]:
    return set(REQUIRED_POLICY_PATHS)


def build_document(root: Path) -> dict[str, object]:
    records = []
    for path in sorted(expected_paths()):
        source = checked_file(root, path)
        records.append({"path": path, "sha256": policy_file_sha256(source)})
    return {
        "schemaVersion": SCHEMA_VERSION,
        "policyKind": POLICY_KIND,
        "platform": PLATFORM,
        "files": records,
    }


def validate_document(document: object) -> list[dict[str, str]]:
    if not isinstance(document, dict):
        raise ValueError("policy manifest must be an object")
    if set(document) != {
        "schemaVersion",
        "policyKind",
        "platform",
        "files",
    }:
        raise ValueError("policy manifest fields are invalid")
    if document.get("schemaVersion") != SCHEMA_VERSION:
        raise ValueError("policy schema version mismatch")
    if document.get("policyKind") != POLICY_KIND or document.get("platform") != PLATFORM:
        raise ValueError("policy kind or platform mismatch")
    files = document.get("files")
    if not isinstance(files, list):
        raise ValueError("policy files must be a list")
    normalized: list[dict[str, str]] = []
    seen_paths: set[str] = set()
    for record in files:
        if not isinstance(record, dict) or set(record) != {"path", "sha256"}:
            raise ValueError("policy file record is invalid")
        path = str(record["path"])
        digest = str(record["sha256"])
        safe_relative_path(path)
        if path in seen_paths:
            raise ValueError(f"duplicate policy path: {path}")
        if not SHA64_RE.fullmatch(digest):
            raise ValueError(f"invalid policy file SHA-256: {path}")
        seen_paths.add(path)
        normalized.append({"path": path, "sha256": digest})
    if normalized != sorted(normalized, key=lambda item: item["path"]):
        raise ValueError("policy files are not in deterministic order")
    if {item["path"] for item in normalized} != expected_paths():
        raise ValueError("policy file coverage is incomplete or unexpected")
    return normalized


def load_manifest_bytes(raw: bytes) -> tuple[dict[str, object], str]:
    if b"\x00" in raw:
        raise ValueError("policy manifest contains NUL bytes")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError as error:
        raise ValueError("policy manifest is not UTF-8") from error
    try:
        document = json.loads(text)
    except json.JSONDecodeError as error:
        raise ValueError("policy manifest is not valid JSON") from error
    validate_document(document)
    canonical = canonical_bytes(document)
    return document, sha256_bytes(canonical)


def load_manifest(path: Path) -> tuple[dict[str, object], str]:
    return load_manifest_bytes(path.read_bytes())


def verify_manifest(
    manifest_path: Path,
    root: Path,
) -> dict[str, object]:
    document, digest = load_manifest(manifest_path)
    for record in document["files"]:
        source = checked_file(root, str(record["path"]))
        if policy_file_sha256(source) != record["sha256"]:
            raise ValueError(f"policy file digest mismatch: {record['path']}")
    return {
        "schemaVersion": SCHEMA_VERSION,
        "policyKind": POLICY_KIND,
        "policySha256": digest,
        "fileCount": len(document["files"]),
        "status": "verified",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    for command in ("build", "verify"):
        sub = subparsers.add_parser(command)
        sub.add_argument("--manifest", type=Path, required=True)
        sub.add_argument("--root", type=Path, required=True)
    args = parser.parse_args()
    root = args.root.resolve()
    if args.command == "build":
        document = build_document(root)
        args.manifest.parent.mkdir(parents=True, exist_ok=True)
        args.manifest.write_bytes(canonical_bytes(document))
        result = {
            "policySha256": sha256_bytes(canonical_bytes(document)),
            "fileCount": len(document["files"]),
            "status": "built",
        }
    else:
        result = verify_manifest(args.manifest, root)
    print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
