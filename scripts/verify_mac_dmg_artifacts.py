#!/usr/bin/env python3
"""Verify the two DMG artifacts produced by one explicit release build."""

from __future__ import annotations

import hashlib
import json
import os
import platform
import plistlib
import re
import shutil
import socket
import sqlite3
import subprocess
import tempfile
import time
from contextlib import closing
from pathlib import Path
from typing import Any
from urllib.request import ProxyHandler, Request, build_opener

try:
    from create_user_db import initialize_user_db
except ModuleNotFoundError:  # Imported as scripts.verify_mac_dmg_artifacts in tests.
    from scripts.create_user_db import initialize_user_db


ROOT = Path(__file__).resolve().parents[1]
MAC_ROOT = ROOT / "apps" / "macos" / "SAPDWiki"
PACKAGE_SCRIPT = MAC_ROOT / "script" / "package_dmg.sh"
VARIANTS = ("license", "no-license")
USER_SCHEMA_VERSION = "user_schema_0.3"
RUNTIME_API_SMOKE_TIMEOUT_SECONDS = 60
FRONTEND_SOURCE_ARTIFACT_SUFFIXES = {".drawio", ".pptx"}
USER_DATA_TABLES = {
    "user_capability_model_nodes",
    "user_capability_model_relations",
    "user_capability_models",
    "user_custom_items",
    "user_custom_relations",
    "user_data_basket_items",
    "user_data_baskets",
    "user_export_jobs",
    "user_export_profiles",
    "user_favorites",
    "user_import_jobs",
    "user_import_staging_items",
    "user_import_staging_relations",
    "user_item_tags",
    "user_notes",
    "user_review_decisions",
    "user_tags",
    "user_target_ref_migrations",
    "user_workspace_items",
    "user_workspaces",
}
USER_SCHEMA_TABLES = USER_DATA_TABLES | {"user_change_logs", "user_meta", "user_schema_migrations"}


def current_app_version() -> str:
    override = os.environ.get("SAPD_WIKI_APP_VERSION", "").strip()
    if override:
        return override
    source = PACKAGE_SCRIPT.read_text(encoding="utf-8")
    match = re.search(r'^APP_VERSION="\$\{SAPD_WIKI_APP_VERSION:-([^}]+)\}"$', source, re.MULTILINE)
    if not match:
        raise RuntimeError("package_dmg.sh does not declare SAPD_WIKI_APP_VERSION")
    return match.group(1)


def current_build_stamp() -> str:
    build_stamp = os.environ.get("SAPD_WIKI_BUILD_STAMP", "").strip()
    if not build_stamp or not re.fullmatch(r"[0-9]{8}-[0-9]{6}Z", build_stamp):
        raise RuntimeError("SAPD_WIKI_BUILD_STAMP must identify the current release build")
    return build_stamp


def current_architecture() -> str:
    architecture = platform.machine().strip()
    if architecture not in {"arm64", "x86_64"}:
        raise RuntimeError(f"unsupported macOS architecture: {architecture}")
    return architecture


def artifact_path(version: str, build_stamp: str, architecture: str, variant: str) -> Path:
    return MAC_ROOT / "dist" / variant / f"SAPD-Wiki-{version}-{variant}-{build_stamp}-mac-{architecture}.dmg"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def tree_sha256(root: Path, *, excluded_suffixes: set[str] | None = None) -> tuple[str, int]:
    _reject_symbolic_links(root, "frontend tree")
    excluded = {suffix.casefold() for suffix in (excluded_suffixes or set())}
    files = [
        path
        for path in root.rglob("*")
        if path.is_file() and path.suffix.casefold() not in excluded
    ]
    digest = hashlib.sha256()
    for path in sorted(files, key=lambda item: item.relative_to(root).as_posix()):
        relative = path.relative_to(root).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest(), len(files)


def _reject_symbolic_links(root: Path, label: str) -> None:
    if root.is_symlink():
        raise RuntimeError(f"{label} must not be a symbolic link: {root}")
    for path in root.rglob("*"):
        if path.is_symlink():
            raise RuntimeError(f"{label} must not contain symbolic links: {path.relative_to(root)}")


def _verify_required_content_asset_database(runtime: Path, manifest: dict[str, Any]) -> str:
    declaration = manifest.get("content_asset_database")
    if not isinstance(declaration, dict):
        raise RuntimeError("Runtime content asset database manifest declaration is missing")
    file_name = str(declaration.get("file") or "")
    expected_sha256 = str(declaration.get("sha256") or "").lower()
    if (
        not file_name
        or Path(file_name).name != file_name
        or file_name in {".", ".."}
        or not re.fullmatch(r"[0-9a-f]{64}", expected_sha256)
    ):
        raise RuntimeError("Runtime content asset database manifest declaration is invalid")
    base_root = (runtime / "data" / "base").resolve()
    asset_path = base_root / file_name
    if asset_path.is_symlink() or not asset_path.is_file():
        raise RuntimeError(f"required Runtime content asset database is missing: {asset_path}")
    try:
        asset_path.resolve().relative_to(base_root)
    except ValueError as error:
        raise RuntimeError(f"Runtime content asset database path escapes base data: {asset_path}") from error
    actual_sha256 = sha256_file(asset_path)
    if actual_sha256 != expected_sha256:
        raise RuntimeError(
            "Runtime content asset database hash mismatch: "
            f"expected={expected_sha256}; actual={actual_sha256}"
        )
    return actual_sha256


def backend_source_sha256(root: Path | None = None) -> str:
    source_root = root or ROOT
    paths = [
        source_root / "scripts" / "run_local_server.py",
        source_root / "scripts" / "check_bundle_runtime.py",
        source_root / "scripts" / "create_user_db.py",
        source_root / "scripts" / "export_diagnostics.py",
        source_root / "scripts" / "package_backend_pyinstaller.py",
    ]
    paths.extend(sorted((source_root / "src" / "sapd_wiki").rglob("*.py")))
    paths.extend(sorted((source_root / "docs" / "01-architecture" / "contracts" / "mcp").rglob("*.json")))
    digest = hashlib.sha256()
    for path in paths:
        if not path.exists():
            continue
        digest.update(path.relative_to(source_root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _verify_current_backend_source_stamp(current_backend: Path) -> None:
    source_stamp = current_backend.parents[2] / "backend-source.sha256"
    try:
        recorded = source_stamp.read_text(encoding="utf-8").strip()
    except OSError as error:
        raise RuntimeError(f"current backend source stamp is missing: {source_stamp}") from error
    current = backend_source_sha256()
    if recorded != current:
        raise RuntimeError(f"current backend binary is stale: source={current}; stamp={recorded}")


def _runtime_core_digest(runtime: Path) -> str:
    recorded_path = runtime / ".sapd-runtime-fingerprint"
    try:
        recorded = recorded_path.read_text(encoding="utf-8").strip()
    except OSError as error:
        raise RuntimeError(f"Runtime fingerprint is missing: {recorded_path}") from error
    if not re.fullmatch(r"[0-9a-f]{64}", recorded):
        raise RuntimeError(f"Runtime fingerprint is invalid: {recorded_path}")
    return recorded


def _verify_user_database(user_db: Path) -> None:
    if not user_db.is_file():
        raise RuntimeError(f"packaged user database is missing: {user_db}")
    try:
        with closing(sqlite3.connect(f"file:{user_db}?mode=ro", uri=True)) as connection, connection:
            table_names = {
                str(row[0])
                for row in connection.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
                )
            }
            schema_row = connection.execute(
                "SELECT value FROM user_meta WHERE key='schema_version'"
            ).fetchone()
            meta_rows = dict(connection.execute("SELECT key, value FROM user_meta"))
            migration_rows = [str(row[0]) for row in connection.execute("SELECT version FROM user_schema_migrations")]
            change_rows = connection.execute(
                "SELECT action, target_ref, payload_json FROM user_change_logs"
            ).fetchall()
            data_counts = {
                table: int(connection.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0])
                for table in USER_DATA_TABLES
            }
            schema_snapshot = connection.execute(
                """
                SELECT type, name, sql
                FROM sqlite_master
                WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
                ORDER BY type, name
                """
            ).fetchall()
    except sqlite3.Error as error:
        raise RuntimeError(f"packaged user database is invalid: {user_db}") from error
    with tempfile.TemporaryDirectory(prefix="sapd-user-schema-reference-") as temporary:
        reference_db = Path(temporary) / "reference.sqlite3"
        initialize_user_db(reference_db, USER_SCHEMA_VERSION)
        with closing(sqlite3.connect(f"file:{reference_db}?mode=ro", uri=True)) as connection, connection:
            reference_schema_snapshot = connection.execute(
                """
                SELECT type, name, sql
                FROM sqlite_master
                WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
                ORDER BY type, name
                """
            ).fetchall()
    schema_version = str(schema_row[0] if schema_row else "")
    invalid_seed_log = len(change_rows) != 1 or change_rows[0][0] != "initialize_user_db" or change_rows[0][1] is not None
    if not invalid_seed_log:
        try:
            seed_payload = json.loads(str(change_rows[0][2] or ""))
        except json.JSONDecodeError:
            invalid_seed_log = True
        else:
            invalid_seed_log = seed_payload != {
                "schema_version": USER_SCHEMA_VERSION,
                "previous_schema_version": None,
            }
    if (
        table_names != USER_SCHEMA_TABLES
        or schema_version != USER_SCHEMA_VERSION
        or meta_rows != {"schema_version": USER_SCHEMA_VERSION, "created_by": "sapd-wiki-zip-alpha"}
        or migration_rows != [USER_SCHEMA_VERSION]
        or invalid_seed_log
        or any(data_counts.values())
        or schema_snapshot != reference_schema_snapshot
    ):
        raise RuntimeError(
            "packaged user database is not an empty current-schema seed: "
            f"schema={schema_version}; tables={sorted(table_names)}; populated="
            f"{sorted(table for table, count in data_counts.items() if count)}"
        )


def _verify_runtime_commands(runtime: Path) -> None:
    required = (
        runtime / "SAPD-Wiki-Backend",
        runtime / "start-macos.command",
        runtime / "stop-macos.command",
        runtime / "diagnostics/export-diagnostics.command",
        runtime / "diagnostics/export-user-notes.command",
    )
    for path in required:
        if path.is_symlink() or not path.is_file() or not os.access(path, os.X_OK):
            raise RuntimeError(f"Runtime command is missing or not executable: {path.relative_to(runtime)}")


def _macho_architectures(path: Path) -> set[str]:
    result = subprocess.run(
        ["lipo", "-archs", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return set(result.stdout.split())


def _available_loopback_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        listener.bind(("127.0.0.1", 0))
        return int(listener.getsockname()[1])


def _probe_runtime_api(base_url: str) -> dict[str, Any]:
    evidence: dict[str, Any] = {}
    opener = build_opener(ProxyHandler({}))
    for path in ("/api/v1/health", "/api/v1/knowledge/version", "/api/v1/data-packages"):
        request = Request(f"{base_url}{path}", headers={"Accept": "application/json"})
        with opener.open(request, timeout=2) as response:  # noqa: S310 - fixed loopback URL without proxy inheritance.
            if response.status != 200:
                raise RuntimeError(f"Runtime API smoke returned HTTP {response.status}: {path}")
            payload = json.loads(response.read().decode("utf-8"))
        if not isinstance(payload, dict):
            raise RuntimeError(f"Runtime API smoke returned invalid JSON: {path}")
        evidence[path] = payload
    if evidence["/api/v1/health"].get("ok") is not True:
        raise RuntimeError("Runtime health API did not report ok")
    for path in ("/api/v1/knowledge/version", "/api/v1/data-packages"):
        if not isinstance(evidence[path].get("data"), dict):
            raise RuntimeError(f"Runtime API envelope is invalid: {path}")
    request = Request(f"{base_url}/", headers={"Accept": "text/html"})
    with opener.open(request, timeout=2) as response:  # noqa: S310 - fixed loopback URL without proxy inheritance.
        html = response.read().decode("utf-8", errors="replace")
    if response.status != 200 or "<html" not in html.lower():
        raise RuntimeError("Runtime frontend root smoke failed")
    evidence["/"] = {"status": 200, "html_bytes": len(html.encode("utf-8"))}
    return evidence


def _smoke_runtime_api(
    runtime: Path,
    backend: Path,
    *,
    timeout_seconds: float = RUNTIME_API_SMOKE_TIMEOUT_SECONDS,
) -> dict[str, Any]:
    config_path = runtime / "config" / "app-config.json"
    config = json.loads(config_path.read_text(encoding="utf-8"))
    port = _available_loopback_port()
    config.update(
        {
            "host": "127.0.0.1",
            "preferred_port": port,
            "fallback_ports": [],
            "open_browser_on_start": False,
            "mcp_platform_integration": False,
        }
    )
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    process = subprocess.Popen(  # noqa: S603 - verified packaged backend from mounted Runtime.
        [str(backend), "--bundle-root", str(runtime), "--no-browser"],
        cwd=runtime,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    last_error: Exception | None = None
    try:
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            if process.poll() is not None:
                output = process.communicate()[0]
                raise RuntimeError(f"Runtime backend exited before API smoke: {output[-2000:]}")
            try:
                return _probe_runtime_api(f"http://127.0.0.1:{port}")
            except (OSError, RuntimeError, json.JSONDecodeError) as error:
                last_error = error
                time.sleep(0.1)
        raise RuntimeError(f"Runtime API smoke timed out: {last_error}")
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)


def _verify_mounted_app(
    volume_root: Path,
    *,
    version: str,
    variant: str,
    architecture: str,
    current_backend: Path,
) -> dict[str, str]:
    app = volume_root / "SAPD Wiki.app"
    applications = volume_root / "Applications"
    runtime = app / "Contents" / "Resources" / "Runtime"
    backend = runtime / "SAPD-Wiki-Backend"
    app_binary = app / "Contents" / "MacOS" / "SAPDWiki"
    if not app.is_dir() or not backend.is_file() or not os.access(backend, os.X_OK):
        raise RuntimeError(f"incomplete mounted App Runtime for {variant}")
    if not applications.is_symlink() or applications.readlink() != Path("/Applications"):
        raise RuntimeError(f"invalid mounted Applications shortcut for {variant}")
    _reject_symbolic_links(runtime, "mounted Runtime")
    _verify_runtime_commands(runtime)

    with (app / "Contents" / "Info.plist").open("rb") as handle:
        info = plistlib.load(handle)
    expected_info = {
        "CFBundleShortVersionString": version,
        "SAPDWikiDisplayVersion": version,
        "SAPDWikiLicenseMode": variant,
    }
    for key, expected in expected_info.items():
        actual = str(info.get(key) or "")
        if actual != expected:
            raise RuntimeError(f"{variant} Info.plist mismatch: {key}={actual}; expected={expected}")

    manifest_path = runtime / "data" / "base" / "base-manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"{variant} mounted Runtime manifest is invalid") from error
    recorded_frontend = manifest.get("frontend") if isinstance(manifest.get("frontend"), dict) else {}
    expected_platform = "mac-arm64" if architecture == "arm64" else "mac-x64"
    if manifest.get("app_version") != version or manifest.get("platform") != expected_platform:
        raise RuntimeError(
            f"{variant} Runtime manifest version/platform mismatch: "
            f"version={manifest.get('app_version')}; platform={manifest.get('platform')}"
        )
    content_asset_sha256 = _verify_required_content_asset_database(runtime, manifest)
    source_frontend = ROOT / "frontend" / "capability-browser"
    source_sha256, source_file_count = tree_sha256(
        source_frontend,
        excluded_suffixes=FRONTEND_SOURCE_ARTIFACT_SUFFIXES,
    )
    runtime_sha256, runtime_file_count = tree_sha256(runtime / "app" / "frontend-dist")
    if (
        recorded_frontend.get("source_sha256") != source_sha256
        or int(recorded_frontend.get("source_file_count") or 0) != source_file_count
        or recorded_frontend.get("runtime_sha256") != runtime_sha256
        or int(recorded_frontend.get("runtime_file_count") or 0) != runtime_file_count
    ):
        raise RuntimeError(f"{variant} mounted frontend is not the current source projection")

    subprocess.run(["codesign", "--verify", "--deep", "--strict", str(app)], check=True)
    if not current_backend.is_file() or sha256_file(backend) != sha256_file(current_backend):
        raise RuntimeError(f"{variant} backend is not the current-source release binary")
    _verify_user_database(runtime / "data" / "user" / "sapd_wiki_user.sqlite3")

    with tempfile.TemporaryDirectory(prefix=f"sapd-dmg-runtime-{variant}-") as temporary:
        runtime_copy = Path(temporary) / "Runtime"
        shutil.copytree(runtime, runtime_copy, symlinks=True)
        copied_backend = runtime_copy / "SAPD-Wiki-Backend"
        subprocess.run(
            [str(copied_backend), "--bundle-root", str(runtime_copy), "--check-only"],
            cwd=runtime_copy,
            check=True,
        )
        _smoke_runtime_api(runtime_copy, copied_backend)

    if not app_binary.is_file():
        raise RuntimeError(f"mounted App executable is missing for {variant}")
    if architecture not in _macho_architectures(app_binary):
        raise RuntimeError(f"mounted App executable does not support {architecture}: {variant}")
    return {
        "app_binary_sha256": sha256_file(app_binary),
        "runtime_core_sha256": _runtime_core_digest(runtime),
        "content_asset_database_sha256": content_asset_sha256,
    }


def verify_variant(version: str, build_stamp: str, architecture: str, variant: str) -> dict[str, Any]:
    dmg_path = artifact_path(version, build_stamp, architecture, variant)
    if not dmg_path.is_file() or dmg_path.stat().st_size <= 0:
        raise RuntimeError(f"missing current-build {variant} DMG: {dmg_path}")
    subprocess.run(["hdiutil", "verify", str(dmg_path)], check=True)

    platform_name = "mac-arm64" if architecture == "arm64" else "mac-x64"
    current_backend = MAC_ROOT / ".build" / "backend-work" / "backend" / platform_name / "SAPD-Wiki-Backend"
    _verify_current_backend_source_stamp(current_backend)
    with tempfile.TemporaryDirectory(prefix=f"sapd-dmg-mount-{variant}-") as temporary:
        mount_point = Path(temporary) / "volume"
        mount_point.mkdir()
        subprocess.run(
            ["hdiutil", "attach", "-readonly", "-nobrowse", "-mountpoint", str(mount_point), str(dmg_path)],
            check=True,
        )
        try:
            evidence = _verify_mounted_app(
                mount_point,
                version=version,
                variant=variant,
                architecture=architecture,
                current_backend=current_backend,
            )
        finally:
            subprocess.run(["hdiutil", "detach", str(mount_point)], check=True)
    _verify_current_backend_source_stamp(current_backend)
    return {
        "variant": variant,
        "path": dmg_path,
        "dmg_sha256": sha256_file(dmg_path),
        **evidence,
    }


def main() -> None:
    version = current_app_version()
    build_stamp = current_build_stamp()
    architecture = current_architecture()
    verified = [verify_variant(version, build_stamp, architecture, variant) for variant in VARIANTS]
    if len({item["app_binary_sha256"] for item in verified}) != 1:
        raise RuntimeError("license variants contain different App executables")
    if len({item["runtime_core_sha256"] for item in verified}) != 1:
        raise RuntimeError("license variants contain different core Runtime payloads")
    print(f"result=pass version={version} build_stamp={build_stamp} artifacts={len(verified)}")
    for item in verified:
        print(f"variant={item['variant']} sha256={item['dmg_sha256']} path={item['path'].relative_to(ROOT)}")


if __name__ == "__main__":
    main()
