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
                "is_project_server": "scripts/sapd_wiki.py" in command_line(pid),
                "command_line": command_line(pid),
            }
        )
    return rows


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


def kill_duplicate_servers(processes: list[dict[str, str]]) -> list[str]:
    project_servers = [row for row in processes if row["is_project_server"]]
    if not project_servers:
        return []
    killed: list[str] = []
    for row in processes:
        if row["is_project_server"]:
            continue
        cmd = row.get("command_line", "")
        if "http.server" not in cmd:
            continue
        os.kill(int(row["pid"]), signal.SIGTERM)
        killed.append(row["pid"])
    return killed


def start_project_server(port: int) -> int | None:
    processes = run_lsof(port)
    if any(row["is_project_server"] for row in processes):
        return None
    subprocess.Popen(
        [sys.executable, "scripts/sapd_wiki.py", "serve", "--host", "127.0.0.1", "--port", str(port)],
        cwd=ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        start_new_session=True,
    )
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Check and guard the SAPD Wiki local dev server.")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--status", action="store_true", help="Print current status.")
    parser.add_argument("--start", action="store_true", help="Start project server if it is not running.")
    parser.add_argument("--fix-duplicates", action="store_true", help="Stop duplicate plain http.server processes when project server exists.")
    args = parser.parse_args()

    if args.start:
        start_project_server(args.port)
        time.sleep(0.6)

    processes = run_lsof(args.port)
    killed = kill_duplicate_servers(processes) if args.fix_duplicates else []
    if killed:
        time.sleep(0.3)
        processes = run_lsof(args.port)

    home = http_status(f"http://127.0.0.1:{args.port}/")
    projection = http_status(f"http://127.0.0.1:{args.port}/api/v1/capabilities/workspace-projection")
    summary = {
        "port": args.port,
        "listeners": [
            {
                "pid": row["pid"],
                "command": row["command"],
                "is_project_server": row["is_project_server"],
            }
            for row in processes
        ],
        "killed_duplicate_pids": killed,
        "home": {"status": home.get("status"), "ok": home.get("ok"), "time_seconds": home.get("time_seconds")},
        "workspace_projection": {
            "status": projection.get("status"),
            "ok": projection.get("ok"),
            "time_seconds": projection.get("time_seconds"),
        },
        "result": "pass" if home.get("ok") and projection.get("ok") and any(row["is_project_server"] for row in processes) else "warn",
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if summary["result"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
