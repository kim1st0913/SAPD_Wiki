#!/usr/bin/env python3
"""Export a redacted diagnostics package for a ZIP alpha bundle."""

from __future__ import annotations

import argparse
import json
import platform
import time
import zipfile
from pathlib import Path
from typing import Any

from check_bundle_runtime import check_bundle, load_json, safe_bundle_child, sha256_file


SENSITIVE_KEYS = {
    "authorization",
    "payload_json",
    "session_token",
    "target_ref",
    "token",
    "x-sapd-session-token",
}


def file_info(path: Path) -> dict[str, object]:
    return {
        "exists": path.exists(),
        "size": path.stat().st_size if path.exists() else 0,
        "sha256": sha256_file(path) if path.exists() else None,
    }


def unavailable_file_info(error: str) -> dict[str, object]:
    return {"exists": False, "size": 0, "sha256": None, "error": error}


def load_json_for_diagnostics(path: Path) -> dict[str, Any]:
    try:
        return load_json(path)
    except json.JSONDecodeError as error:
        return {"__diagnostic_error": "invalid_json", "message": str(error)}
    except OSError as error:
        return {"__diagnostic_error": "read_error", "message": str(error)}


def redact_text(value: str, root: Path) -> str:
    redacted = value
    replacements = [
        (str(root), "<bundle-root>"),
        (str(Path.home()), "<home>"),
    ]
    for source, replacement in replacements:
        if source and source != "/" and source in redacted:
            redacted = redacted.replace(source, replacement)
    return redacted


def redact_value(value: Any, root: Path, key: str = "") -> Any:
    if key.lower() in SENSITIVE_KEYS:
        return "<redacted>"
    if isinstance(value, dict):
        return {item_key: redact_value(item_value, root, item_key) for item_key, item_value in value.items()}
    if isinstance(value, list):
        return [redact_value(item, root, key) for item in value]
    if isinstance(value, str):
        return redact_text(value, root)
    return value


def diagnostic_json(payload: Any, root: Path) -> str:
    return json.dumps(redact_value(payload, root), ensure_ascii=False, indent=2)


def redacted_runtime_log(path: Path, root: Path) -> str:
    if not path.exists():
        return ""
    rows: list[str] = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            rows.append(json.dumps(redact_value(json.loads(line), root), ensure_ascii=False))
        except json.JSONDecodeError:
            rows.append(redact_text(line, root))
    return "\n".join(rows) + ("\n" if rows else "")


def export_diagnostics(bundle_root: Path) -> Path:
    root = bundle_root.resolve()
    diagnostics_dir = root / "diagnostics"
    diagnostics_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    output = diagnostics_dir / f"sapd-wiki-diagnostics-{stamp}.zip"

    runtime_log = root / "logs" / "runtime.log"
    manifest_path = root / "data" / "base" / "base-manifest.json"
    config_path = root / "config" / "app-config.json"
    runtime_state_path = root / "logs" / "runtime-state.json"
    manifest = load_json_for_diagnostics(manifest_path) if manifest_path.exists() else {}
    base_info = manifest.get("base_database", {}) if isinstance(manifest.get("base_database"), dict) else {}
    user_info = manifest.get("user_database", {}) if isinstance(manifest.get("user_database"), dict) else {}
    base_db_error = ""
    user_db_error = ""
    try:
        base_db = safe_bundle_child(root / "data" / "base", base_info.get("file"), "sapd_wiki_base.sqlite3")
    except ValueError as error:
        base_db = None
        base_db_error = str(error)
    try:
        user_db = safe_bundle_child(root / "data" / "user", user_info.get("file"), "sapd_wiki_user.sqlite3")
    except ValueError as error:
        user_db = None
        user_db_error = str(error)
    startup_check = check_bundle(root, create_user=False)
    runtime_state = load_json_for_diagnostics(runtime_state_path) if runtime_state_path.exists() else {}

    summary = {
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "bundle_root_name": root.name,
        "startup_ok": startup_check["ok"],
        "current_url": runtime_state.get("url"),
        "current_port": runtime_state.get("port"),
    }
    platform_info = {
        "system": platform.system(),
        "release": platform.release(),
        "machine": platform.machine(),
        "python_version": platform.python_version(),
    }
    database_files = {
        "base": file_info(base_db) if base_db else unavailable_file_info(base_db_error),
        "user": file_info(user_db) if user_db else unavailable_file_info(user_db_error),
    }
    redaction_note = (
        "This diagnostics package excludes SQLite database contents, raw import files, exports, "
        "and user note text by default. Local home/bundle paths, session tokens, target refs, "
        "and write payload fields are redacted before export. Platform info, file sizes, hashes, "
        "and non-sensitive runtime status are retained for troubleshooting.\n"
    )

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("diagnostic-summary.json", diagnostic_json(summary, root))
        archive.writestr("startup-check-result.json", diagnostic_json(startup_check, root))
        archive.writestr("platform-info.json", diagnostic_json(platform_info, root))
        archive.writestr("runtime-state.json", diagnostic_json(runtime_state, root))
        archive.writestr("database-files.json", diagnostic_json(database_files, root))
        archive.writestr("redaction-note.txt", redaction_note)
        if manifest_path.exists():
            archive.writestr("base-manifest.json", diagnostic_json(load_json_for_diagnostics(manifest_path), root))
        if config_path.exists():
            archive.writestr("app-config.json", diagnostic_json(load_json_for_diagnostics(config_path), root))
        if runtime_log.exists():
            archive.writestr("runtime.log", redacted_runtime_log(runtime_log, root))
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description="Export ZIP alpha diagnostics.")
    parser.add_argument("bundle_root", type=Path)
    args = parser.parse_args()

    output = export_diagnostics(args.bundle_root)
    print(f"diagnostics={output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
