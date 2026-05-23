from __future__ import annotations

import subprocess
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]

FORBIDDEN_PREFIXES = (
    "data/raw/",
    "data/raw-samples/",
    "data/processed/",
    "data/database/",
    "data/previews/",
    "data/exports/",
    "data/maturity/",
    "frontend/capability-browser/public/data/assets/",
    "frontend/capability-browser/public/data/guides/",
    "frontend/capability-browser/public/data/standards/",
)

FORBIDDEN_SUFFIXES = (
    ".db",
    ".sqlite",
    ".sqlite3",
    ".bak",
    ".backup",
    ".zip",
)

ALLOWED_EXACT = {
    "frontend/capability-browser/public/data/.gitkeep",
}


def tracked_files() -> list[str]:
    completed = subprocess.run(
        ["git", "ls-files", "-z"],
        cwd=PROJECT_ROOT,
        check=True,
        capture_output=True,
        text=False,
    )
    raw = completed.stdout.decode("utf-8")
    return [item for item in raw.split("\0") if item]


def is_forbidden(path: str) -> bool:
    if path in ALLOWED_EXACT:
        return False
    if path.startswith(FORBIDDEN_PREFIXES):
        return True
    return path.endswith(FORBIDDEN_SUFFIXES)


def main() -> int:
    offenders = [path for path in tracked_files() if is_forbidden(path)]
    if not offenders:
        print("GitHub data boundary check: OK")
        return 0

    print("GitHub data boundary check: FAILED")
    print("以下文件不应提交到 GitHub：")
    for path in offenders:
        print(f"  - {path}")
    print("\n处理方式：从 Git 追踪中移除这些文件，保留本地文件即可。")
    print("示例：git rm --cached <path>")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
