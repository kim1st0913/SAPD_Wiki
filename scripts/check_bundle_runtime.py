#!/usr/bin/env python3
"""Check a SAPD Wiki ZIP alpha bundle runtime directory."""

from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import socket
import sqlite3
from pathlib import Path
from typing import Any

from create_user_db import DEFAULT_SCHEMA_VERSION, initialize_user_db


REQUIRED_MANIFEST_FIELDS = [
    "app_version",
    "bundle_type",
    "platform",
    "build_time",
    "base_database",
    "user_database",
    "frontend",
    "backend",
]

SUPPORTED_PLATFORMS = {"win-x64", "mac-arm64", "mac-x64"}


def is_loopback_host(host: str) -> bool:
    value = str(host or "").strip().strip("[]").lower()
    if value == "localhost":
        return True
    try:
        return ipaddress.ip_address(value).is_loopback
    except ValueError:
        return False


def expected_backend_name(platform_name: str) -> str:
    return "SAPD-Wiki-Backend.exe" if platform_name.startswith("win") else "SAPD-Wiki-Backend"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def is_port_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex((host, port)) != 0


def user_schema_version(db_path: Path) -> str | None:
    if not db_path.exists():
        return None
    try:
        with sqlite3.connect(db_path) as connection:
            row = connection.execute("SELECT value FROM user_meta WHERE key = 'schema_version'").fetchone()
            return row[0] if row else None
    except sqlite3.Error:
        return None


def check_bundle(bundle_root: Path, create_user: bool = False) -> dict[str, Any]:
    root = bundle_root.resolve()
    frontend = root / "app" / "frontend-dist"
    manifest_path = root / "data" / "base" / "base-manifest.json"
    config_path = root / "config" / "app-config.json"
    logs_dir = root / "logs"
    diagnostics_dir = root / "diagnostics"

    checks: list[dict[str, Any]] = []

    def add(name: str, ok: bool, detail: str = "") -> None:
        checks.append({"name": name, "ok": ok, "detail": detail})

    add("bundle_root_exists", root.exists(), str(root))
    add("frontend_dist_exists", frontend.exists(), str(frontend))
    add("manifest_exists", manifest_path.exists(), str(manifest_path))
    add("config_exists", config_path.exists(), str(config_path))
    add("logs_dir_exists", logs_dir.exists(), str(logs_dir))
    add("diagnostics_dir_exists", diagnostics_dir.exists(), str(diagnostics_dir))

    manifest: dict[str, Any] = {}
    if manifest_path.exists():
        try:
            manifest = load_json(manifest_path)
            add("manifest_json_valid", True)
        except json.JSONDecodeError as error:
            add("manifest_json_valid", False, str(error))
    else:
        add("manifest_json_valid", False, "manifest missing")

    for field in REQUIRED_MANIFEST_FIELDS:
        add(f"manifest_has_{field}", field in manifest)

    platform_name = str(manifest.get("platform", ""))
    add("platform_supported", platform_name in SUPPORTED_PLATFORMS, platform_name)
    if platform_name:
        backend_path = root / expected_backend_name(platform_name)
        add("backend_component_exists", backend_path.exists(), str(backend_path))

    base_info = manifest.get("base_database", {}) if isinstance(manifest.get("base_database"), dict) else {}
    user_info = manifest.get("user_database", {}) if isinstance(manifest.get("user_database"), dict) else {}
    base_file = base_info.get("file", "sapd_wiki_base.sqlite3")
    user_file = user_info.get("file", "sapd_wiki_user.sqlite3")
    expected_user_schema = user_info.get("schema_version", DEFAULT_SCHEMA_VERSION)
    base_db = root / "data" / "base" / base_file
    user_db = root / "data" / "user" / user_file

    add("base_db_exists", base_db.exists(), str(base_db))
    if base_db.exists() and base_info.get("sha256"):
        actual_hash = sha256_file(base_db)
        add("base_db_sha256_matches", actual_hash == base_info["sha256"], actual_hash)
    elif base_db.exists():
        add("base_db_sha256_matches", False, "manifest missing base_database.sha256")
    else:
        add("base_db_sha256_matches", False, "base database missing")

    if not user_db.exists() and create_user:
        initialize_user_db(user_db, expected_user_schema)
    add("user_db_exists", user_db.exists(), str(user_db))
    actual_user_schema = user_schema_version(user_db)
    add("user_schema_matches", actual_user_schema == expected_user_schema, f"actual={actual_user_schema}; expected={expected_user_schema}")

    logs_writable = False
    try:
        logs_dir.mkdir(parents=True, exist_ok=True)
        probe = logs_dir / ".write-check"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink()
        logs_writable = True
    except OSError as error:
        add("logs_writable", False, str(error))
    if logs_writable:
        add("logs_writable", True)

    config = load_json(config_path) if config_path.exists() else {}
    add("config_frontend_path_set", bool(config.get("frontend_dist")), str(config.get("frontend_dist", "")))
    add("config_base_db_path_set", bool(config.get("base_database")), str(config.get("base_database", "")))
    add("config_user_db_path_set", bool(config.get("user_database")), str(config.get("user_database", "")))
    host = str(config.get("host", "127.0.0.1")).strip() or "127.0.0.1"
    host_is_loopback = is_loopback_host(host)
    add("config_host_loopback", host_is_loopback, host)
    preferred = int(config.get("preferred_port", 18765))
    fallbacks = [int(port) for port in config.get("fallback_ports", [18766, 18767, 18768])]
    selected_port = None
    if host_is_loopback:
        for port in [preferred, *fallbacks]:
            if is_port_available(host, port):
                selected_port = port
                break
    add("available_port_found", selected_port is not None, f"{host}:{selected_port}" if selected_port else "none")

    ok = all(check["ok"] for check in checks)
    return {"bundle_root": str(root), "ok": ok, "selected_port": selected_port, "checks": checks}


def main() -> int:
    parser = argparse.ArgumentParser(description="Check a SAPD Wiki ZIP alpha bundle.")
    parser.add_argument("bundle_root", type=Path)
    parser.add_argument("--create-user-db", action="store_true")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON.")
    args = parser.parse_args()

    result = check_bundle(args.bundle_root, create_user=args.create_user_db)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        for check in result["checks"]:
            status = "PASS" if check["ok"] else "FAIL"
            detail = f" - {check['detail']}" if check.get("detail") else ""
            print(f"{status} {check['name']}{detail}")
        print(f"selected_port={result['selected_port']}")
        print(f"result={'pass' if result['ok'] else 'fail'}")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
