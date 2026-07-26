#!/usr/bin/env python3
"""Lightweight guard for the SAPD Wiki local development server.

The script intentionally prints a short summary only. It avoids broad process
listing and focuses on the configured port.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PORT = 5173
DEFAULT_RUNTIME_PATHS = {
    "base_db": (ROOT / "data" / "database" / "sapd_wiki.sqlite3").resolve(),
    "content_asset_db": (
        ROOT / "data" / "database" / "sapd_content_assets.sqlite3"
    ).resolve(),
    "user_db": (ROOT / "data" / "user" / "sapd_wiki_user.sqlite3").resolve(),
    "data_root": (ROOT / "frontend" / "capability-browser" / "public" / "data").resolve(),
    "export_dir": (ROOT / "data" / "exports").resolve(),
}


def default_persistent_mcp_runtime_root() -> Path | None:
    """Return the CurrentUser MCP Runtime root without creating it."""

    if os.name == "nt":
        local_app_data = os.environ.get("LOCALAPPDATA", "").strip()
        if not local_app_data:
            return None
        return Path(local_app_data) / "SAPD Wiki" / "LocalMCP" / "Runtime" / "dev"
    return (
        Path.home()
        / "Library"
        / "Application Support"
        / "SAPD Wiki"
        / "LocalMCP"
        / "Runtime"
        / "dev"
    )


def persistent_mcp_runtime_is_configured() -> bool:
    """Reuse platform integration only after the user has established it."""

    runtime_root = default_persistent_mcp_runtime_root()
    if runtime_root is None:
        return False
    return (
        runtime_root.is_dir()
        and (runtime_root / "control" / "control.sqlite3").is_file()
        and (runtime_root / "instance-id.txt").is_file()
        and (runtime_root / "runtime-id.txt").is_file()
    )


def server_python_executable(root: Path = ROOT) -> Path:
    """Use the isolated MCP runtime for the Web server when it is available."""

    configured = os.environ.get("SAPD_WIKI_SERVER_PYTHON", "").strip()
    candidates = []
    if configured:
        candidate = Path(configured).expanduser()
        candidates.append(candidate if candidate.is_absolute() else root / candidate)
    candidates.extend(
        (
            root / ".venv-local-mcp-web" / "bin" / "python",
            root / ".venv-local-mcp-web" / "Scripts" / "python.exe",
            Path(sys.executable),
        )
    )
    for candidate in candidates:
        if candidate.is_file() and os.access(candidate, os.X_OK):
            # Keep the virtual-environment launcher path intact. Resolving its
            # symlink would execute the base interpreter without the venv site
            # packages that provide the MCP certificate dependencies.
            return candidate.absolute()
    raise RuntimeError(
        "no usable SAPD Wiki server Python was found; "
        "create .venv-local-mcp-web with the local-mcp dependencies"
    )


def primary_git_worktree_root(root: Path = ROOT) -> Path:
    try:
        common_dir_value = subprocess.check_output(
            ["git", "-C", str(root), "rev-parse", "--path-format=absolute", "--git-common-dir"],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return root.resolve()
    common_dir = Path(common_dir_value).expanduser()
    if not common_dir.is_absolute():
        common_dir = root / common_dir
    common_dir = common_dir.resolve()
    return common_dir.parent if common_dir.name == ".git" else root.resolve()


def run_lsof(port: int) -> list[dict[str, str]]:
    try:
        output = subprocess.check_output(
            ["lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except subprocess.CalledProcessError:
        return []
    rows: list[dict[str, str]] = []
    for line in output.splitlines()[1:]:
        parts = line.split(None, 8)
        if len(parts) < 9:
            continue
        command, pid, user, fd, typ, device, size_off, node, name = parts
        rows.append(
            {
                "command": command,
                "pid": pid,
                "user": user,
                "name": name,
                "is_project_server": is_project_server_command(command_line(pid)),
                "command_line": command_line(pid),
            }
        )
    return rows


def is_project_server_command(cmd: str) -> bool:
    return "scripts/sapd_wiki.py" in cmd or "-m sapd_wiki.cli serve" in cmd


def command_line(pid: str) -> str:
    try:
        return subprocess.check_output(["ps", "-p", pid, "-o", "command="], text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        return ""


def http_status(url: str, timeout: float = 2.5) -> dict[str, object]:
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            body = response.read(200)
            return {
                "ok": 200 <= response.status < 400,
                "status": response.status,
                "time_seconds": round(time.perf_counter() - started, 3),
                "sample": body.decode("utf-8", errors="ignore")[:80],
            }
    except urllib.error.HTTPError as error:
        return {"ok": False, "status": error.code, "time_seconds": round(time.perf_counter() - started, 3), "sample": ""}
    except Exception as error:  # noqa: BLE001 - concise diagnostic script
        return {"ok": False, "status": 0, "time_seconds": round(time.perf_counter() - started, 3), "error": str(error)}


def http_json_status(url: str, timeout: float = 2.5) -> dict[str, object]:
    started = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            raw = response.read()
            data = json.loads(raw.decode("utf-8"))
            return {
                "ok": 200 <= response.status < 400,
                "status": response.status,
                "time_seconds": round(time.perf_counter() - started, 3),
                "json": data,
            }
    except urllib.error.HTTPError as error:
        return {"ok": False, "status": error.code, "time_seconds": round(time.perf_counter() - started, 3)}
    except Exception as error:  # noqa: BLE001 - concise diagnostic script
        return {"ok": False, "status": 0, "time_seconds": round(time.perf_counter() - started, 3), "error": str(error)}


def expected_runtime(args: argparse.Namespace) -> dict[str, str]:
    values: dict[str, str] = {}
    if args.base_db:
        values["base_db"] = args.base_db
    if getattr(args, "content_asset_db", ""):
        values["content_asset_db"] = args.content_asset_db
    if args.user_db:
        values["user_db"] = args.user_db
    if args.ephemeral_user_state:
        values["ephemeral_user_state"] = "1"
    if args.data_root:
        values["data_root"] = args.data_root
    if args.export_dir:
        values["export_dir"] = args.export_dir
    if args.mcp_port:
        values["mcp_port"] = str(args.mcp_port)
    if args.mcp_runtime_root:
        values["mcp_runtime_root"] = args.mcp_runtime_root
    if args.mcp_platform_integration or (
        args.port == DEFAULT_PORT and persistent_mcp_runtime_is_configured()
    ):
        values["mcp_platform_integration"] = "1"
    values["runtime_label"] = args.runtime_label or "stable"
    values["project_root"] = str(ROOT.resolve())
    if args.port == DEFAULT_PORT:
        for key, default_path in DEFAULT_RUNTIME_PATHS.items():
            values.setdefault(key, str(default_path))
    return values


def reserved_preview_port_blockers(port: int, runtime: dict[str, str]) -> list[str]:
    if port != DEFAULT_PORT:
        return []
    blockers: list[str] = []
    if runtime.get("runtime_label", "stable") != "stable":
        blockers.append("runtime_label must be stable")
    primary_root = primary_git_worktree_root()
    if ROOT.resolve() != primary_root:
        blockers.append(f"must be launched from the primary worktree: {primary_root}")
    if runtime.get("ephemeral_user_state") == "1":
        blockers.append("ephemeral user state is test-only")
    for key, default_path in DEFAULT_RUNTIME_PATHS.items():
        value = runtime.get(key)
        if value:
            candidate = Path(value).expanduser()
            resolved = candidate if candidate.is_absolute() else ROOT / candidate
            if resolved.resolve() != default_path:
                blockers.append(f"{key} must use the stable default path")
    if runtime.get("mcp_runtime_root"):
        blockers.append("explicit MCP runtime roots are test-only")
    return blockers


def display_project_path(path_value: str) -> str:
    path = Path(path_value).expanduser()
    resolved = path if path.is_absolute() else ROOT / path
    try:
        return str(resolved.resolve().relative_to(ROOT))
    except ValueError:
        return str(resolved.resolve())


def runtime_health_checks(health: dict[str, object], expected: dict[str, str]) -> list[dict[str, object]]:
    payload = health.get("json")
    data = payload.get("data") if isinstance(payload, dict) and isinstance(payload.get("data"), dict) else {}
    runtime = data.get("runtime") if isinstance(data, dict) and isinstance(data.get("runtime"), dict) else {}
    checks: list[dict[str, object]] = []
    if "runtime_label" in expected:
        actual = str(runtime.get("label") or "")
        checks.append({"name": "runtime_label", "ok": actual == expected["runtime_label"], "expected": expected["runtime_label"], "actual": actual})
    if "project_root" in expected:
        settings_paths = runtime.get("settings_paths") if isinstance(runtime.get("settings_paths"), dict) else {}
        actual_value = str(settings_paths.get("data_root") or "")
        actual_root = Path(actual_value).expanduser().resolve() if actual_value else None
        expected_root = Path(expected["project_root"]).expanduser().resolve()
        checks.append({
            "name": "project_root",
            "ok": actual_root == expected_root,
            "expected": str(expected_root),
            "actual": str(actual_root) if actual_root else "",
        })
    path_checks = [
        ("base_db", "base_database"),
        ("content_asset_db", "content_asset_database"),
        ("user_db", "user_database"),
        ("data_root", "data_root"),
    ]
    for expected_key, runtime_key in path_checks:
        if expected_key not in expected:
            continue
        if expected_key == "user_db" and expected.get("ephemeral_user_state") == "1":
            continue
        runtime_value = runtime.get(runtime_key) if isinstance(runtime.get(runtime_key), dict) else {}
        actual = str(runtime_value.get("path") or "")
        expected_path = display_project_path(expected[expected_key])
        checks.append({"name": runtime_key, "ok": actual == expected_path, "expected": expected_path, "actual": actual})
    if expected.get("ephemeral_user_state") == "1":
        user_runtime = runtime.get("user_database") if isinstance(runtime.get("user_database"), dict) else {}
        actual_path = str(user_runtime.get("path") or "")
        actual_persistent = user_runtime.get("persistent")
        checks.append({
            "name": "ephemeral_user_state",
            "ok": actual_path == "memory://isolated-web-dev" and actual_persistent is False,
            "expected": "memory://isolated-web-dev; persistent=false",
            "actual": f"{actual_path}; persistent={actual_persistent}",
        })
    return checks


def existing_server_requires_restart(
    processes: list[dict[str, str]],
    health: dict[str, object],
    expected: dict[str, str],
) -> bool:
    if not any(row.get("is_project_server") for row in processes):
        return False
    if not health.get("ok"):
        return True
    if not all(check["ok"] for check in runtime_health_checks(health, expected)):
        return True
    if expected.get("mcp_platform_integration") == "1":
        return not any(
            row.get("is_project_server")
            and "--mcp-platform-integration" in row.get("command_line", "")
            for row in processes
        )
    return False


def mcp_integration_process_check(
    processes: list[dict[str, str]],
    expected: dict[str, str],
) -> dict[str, object] | None:
    if expected.get("mcp_platform_integration") != "1":
        return None
    enabled = any(
        row.get("is_project_server")
        and "--mcp-platform-integration" in row.get("command_line", "")
        for row in processes
    )
    return {
        "name": "mcp_platform_integration",
        "ok": enabled,
        "expected": "persistent CurrentUser Runtime",
        "actual": "persistent CurrentUser Runtime" if enabled else "temporary Web Runtime",
    }


def kill_plain_http_servers(processes: list[dict[str, str]]) -> list[str]:
    killed: list[str] = []
    for row in processes:
        if row["is_project_server"]:
            continue
        cmd = row.get("command_line", "")
        command = row.get("command", "").lower()
        is_stale_python_preview = command.startswith("python") and not cmd
        if "http.server" not in cmd and not is_stale_python_preview:
            continue
        os.kill(int(row["pid"]), signal.SIGTERM)
        killed.append(row["pid"])
    return killed


def start_project_server(port: int, runtime: dict[str, str]) -> int | None:
    processes = run_lsof(port)
    if any(row["is_project_server"] for row in processes):
        return None
    if processes:
        return None
    env = os.environ.copy()
    src = str(ROOT / "src")
    env["PYTHONPATH"] = src if not env.get("PYTHONPATH") else f"{src}{os.pathsep}{env['PYTHONPATH']}"
    command = [
        str(server_python_executable()),
        "-m",
        "sapd_wiki.cli",
        "serve",
        "--host",
        "127.0.0.1",
        "--port",
        str(port),
    ]
    if runtime.get("base_db"):
        command.extend(["--base-db", runtime["base_db"]])
    if runtime.get("content_asset_db"):
        command.extend(["--content-asset-db", runtime["content_asset_db"]])
    if runtime.get("user_db"):
        command.extend(["--user-db", runtime["user_db"]])
    if runtime.get("ephemeral_user_state") == "1":
        command.append("--ephemeral-user-state")
    if runtime.get("data_root"):
        command.extend(["--data-root", runtime["data_root"]])
    if runtime.get("runtime_label"):
        command.extend(["--runtime-label", runtime["runtime_label"]])
    if runtime.get("export_dir"):
        command.extend(["--export-dir", runtime["export_dir"]])
    if runtime.get("mcp_port"):
        command.extend(["--mcp-port", runtime["mcp_port"]])
    if runtime.get("mcp_runtime_root"):
        command.extend(["--mcp-runtime-root", runtime["mcp_runtime_root"]])
    if runtime.get("mcp_platform_integration") == "1":
        command.append("--mcp-platform-integration")
    subprocess.Popen(
        command,
        cwd=ROOT,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    return 1


def stop_project_servers(processes: list[dict[str, str]]) -> list[str]:
    stopped: list[str] = []
    for row in processes:
        if not row["is_project_server"]:
            continue
        os.kill(int(row["pid"]), signal.SIGTERM)
        stopped.append(row["pid"])
    return stopped


def main() -> int:
    parser = argparse.ArgumentParser(description="Check and guard the SAPD Wiki local dev server.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--base-db", default="", help="Runtime base database path for this port.")
    parser.add_argument(
        "--content-asset-db",
        default="",
        help="Runtime content asset database path for this port.",
    )
    parser.add_argument("--user-db", default="", help="Runtime user database path for this port.")
    parser.add_argument(
        "--ephemeral-user-state",
        action="store_true",
        help="Use isolated in-memory Web user state and do not open or create a user database file.",
    )
    parser.add_argument("--data-root", default="", help="Runtime frontend data package root for this port.")
    parser.add_argument("--export-dir", default="", help="Runtime export directory for this port.")
    parser.add_argument("--runtime-label", default="", help="Expected runtime label for /api/v1/health.")
    parser.add_argument("--mcp-port", type=int, default=0, help="Initial isolated Web-dev MCP port.")
    parser.add_argument("--mcp-runtime-root", default="", help="Explicit isolated Web-dev MCP runtime root.")
    parser.add_argument(
        "--mcp-platform-integration",
        action="store_true",
        help="Enable separately authorized persistent CurrentUser MCP integration.",
    )
    parser.add_argument("--status", action="store_true", help="Print current status.")
    parser.add_argument("--start", action="store_true", help="Start project server if it is not running.")
    parser.add_argument("--stop", action="store_true", help="Stop project server processes on the selected port.")
    parser.add_argument("--restart", action="store_true", help="Restart project server processes on the selected port.")
    parser.add_argument("--fix-duplicates", action="store_true", help="Stop stale plain http.server processes on the selected port.")
    args = parser.parse_args()
    runtime = expected_runtime(args)
    reserved_port_blockers = reserved_preview_port_blockers(args.port, runtime)
    if (args.start or args.restart) and reserved_port_blockers:
        print(json.dumps({
            "port": args.port,
            "result": "blocked",
            "error": "port 5173 is reserved for the stable SAPD Wiki preview",
            "blockers": reserved_port_blockers,
            "required_action": "use a non-5173 port for fixture, dev, or ephemeral runtimes",
        }, ensure_ascii=False, indent=2))
        return 2

    stopped: list[str] = []
    killed: list[str] = []
    if args.start and not args.restart:
        existing_processes = run_lsof(args.port)
        existing_health = http_json_status(f"http://127.0.0.1:{args.port}/api/v1/health")
        if existing_server_requires_restart(existing_processes, existing_health, runtime):
            stopped = stop_project_servers(existing_processes)
            if stopped:
                time.sleep(0.3)
    if args.stop or args.restart:
        stopped = stop_project_servers(run_lsof(args.port))
        if stopped:
            time.sleep(0.3)

    if args.fix_duplicates:
        killed = kill_plain_http_servers(run_lsof(args.port))
        if killed:
            time.sleep(0.3)

    started = None
    if args.start or args.restart:
        started = start_project_server(args.port, runtime)
        time.sleep(0.6)

    processes = run_lsof(args.port)

    home = http_status(f"http://127.0.0.1:{args.port}/")
    health = http_json_status(f"http://127.0.0.1:{args.port}/api/v1/health")
    projection = http_status(f"http://127.0.0.1:{args.port}/api/v1/capabilities/workspace-projection")
    profile_checks = runtime_health_checks(health, runtime)
    mcp_integration_check = mcp_integration_process_check(processes, runtime)
    if mcp_integration_check is not None:
        profile_checks.append(mcp_integration_check)
    has_healthy_project_response = bool(home.get("ok") and projection.get("ok") and processes)
    has_project_server = any(row["is_project_server"] for row in processes) or has_healthy_project_response
    profile_ok = all(check["ok"] for check in profile_checks)
    if args.stop and not args.start:
        result = "pass" if not has_project_server else "warn"
    else:
        result = "pass" if home.get("ok") and projection.get("ok") and health.get("ok") and has_project_server and profile_ok else "warn"
    summary = {
        "port": args.port,
        "listeners": [
            {
                "pid": row["pid"],
                "command": row["command"],
                "is_project_server": row["is_project_server"] or has_healthy_project_response,
            }
            for row in processes
        ],
        "stopped_project_pids": stopped,
        "killed_duplicate_pids": killed,
        "started_project_server": bool(started),
        "home": {"status": home.get("status"), "ok": home.get("ok"), "time_seconds": home.get("time_seconds")},
        "health": {"status": health.get("status"), "ok": health.get("ok"), "time_seconds": health.get("time_seconds")},
        "workspace_projection": {
            "status": projection.get("status"),
            "ok": projection.get("ok"),
            "time_seconds": projection.get("time_seconds"),
        },
        "runtime_profile": runtime,
        "runtime_profile_checks": profile_checks,
        "result": result,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["result"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
