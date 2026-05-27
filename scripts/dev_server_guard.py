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


def start_project_server(port: int) -> int | None:
    processes = run_lsof(port)
    if any(row["is_project_server"] for row in processes):
        return None
    if processes:
        return None
    env = os.environ.copy()
    src = str(ROOT / "src")
    env["PYTHONPATH"] = src if not env.get("PYTHONPATH") else f"{src}{os.pathsep}{env['PYTHONPATH']}"
    subprocess.Popen(
        [sys.executable, "-m", "sapd_wiki.cli", "serve", "--host", "127.0.0.1", "--port", str(port)],
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
    parser.add_argument("--status", action="store_true", help="Print current status.")
    parser.add_argument("--start", action="store_true", help="Start project server if it is not running.")
    parser.add_argument("--stop", action="store_true", help="Stop project server processes on the selected port.")
    parser.add_argument("--restart", action="store_true", help="Restart project server processes on the selected port.")
    parser.add_argument("--fix-duplicates", action="store_true", help="Stop stale plain http.server processes on the selected port.")
    args = parser.parse_args()

    stopped: list[str] = []
    killed: list[str] = []
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
        started = start_project_server(args.port)
        time.sleep(0.6)

    processes = run_lsof(args.port)

    home = http_status(f"http://127.0.0.1:{args.port}/")
    projection = http_status(f"http://127.0.0.1:{args.port}/api/v1/capabilities/workspace-projection")
    has_healthy_project_response = bool(home.get("ok") and projection.get("ok") and processes)
    has_project_server = any(row["is_project_server"] for row in processes) or has_healthy_project_response
    if args.stop and not args.start:
        result = "pass" if not has_project_server else "warn"
    else:
        result = "pass" if home.get("ok") and projection.get("ok") and has_project_server else "warn"
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
        "workspace_projection": {
            "status": projection.get("status"),
            "ok": projection.get("ok"),
            "time_seconds": projection.get("time_seconds"),
        },
        "result": result,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["result"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
