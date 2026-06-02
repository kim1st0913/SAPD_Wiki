#!/usr/bin/env python3
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BACKUP_DIR = PROJECT_ROOT / "data" / "database" / "backups"


@dataclass(frozen=True)
class BackupFile:
    path: Path
    mtime: float
    size: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Keep only the newest SQLite database backups.",
    )
    parser.add_argument(
        "--backup-dir",
        default=str(DEFAULT_BACKUP_DIR),
        help="Backup directory to scan recursively. Defaults to data/database/backups.",
    )
    parser.add_argument(
        "--keep",
        type=int,
        default=5,
        help="Number of newest .sqlite3 backup files to keep. Defaults to 5.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Delete old backups. Without this flag, only prints the plan.",
    )
    return parser.parse_args()


def format_size(size: int) -> str:
    value = float(size)
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if value < 1024 or unit == "TB":
            if unit == "B":
                return f"{int(value)}{unit}"
            return f"{value:.1f}{unit}"
        value /= 1024
    return f"{value:.1f}TB"


def collect_backups(backup_dir: Path) -> list[BackupFile]:
    files: list[BackupFile] = []
    for path in backup_dir.rglob("*.sqlite3"):
        if not path.is_file():
            continue
        stat = path.stat()
        files.append(BackupFile(path=path, mtime=stat.st_mtime, size=stat.st_size))
    return sorted(files, key=lambda item: (item.mtime, str(item.path)), reverse=True)


def print_files(title: str, files: list[BackupFile]) -> None:
    print(title)
    if not files:
        print("  none")
        return
    for item in files:
        rel = item.path.relative_to(PROJECT_ROOT)
        print(f"  - {rel} ({format_size(item.size)})")


def main() -> int:
    args = parse_args()
    backup_dir = Path(args.backup_dir).expanduser()
    if not backup_dir.is_absolute():
        backup_dir = (PROJECT_ROOT / backup_dir).resolve()
    if args.keep < 1:
        raise SystemExit("--keep must be >= 1")
    if not backup_dir.exists():
        raise SystemExit(f"backup directory not found: {backup_dir}")

    backups = collect_backups(backup_dir)
    keep = backups[: args.keep]
    delete = backups[args.keep :]

    print(f"backup_dir: {backup_dir}")
    print(f"total_backups: {len(backups)}")
    print(f"keep_limit: {args.keep}")
    print(f"mode: {'apply' if args.apply else 'dry-run'}")
    print_files("keeping:", keep)
    print_files("deleting:" if args.apply else "would_delete:", delete)

    if args.apply:
        for item in delete:
            item.path.unlink()
        print(f"deleted_count: {len(delete)}")
    else:
        print("deleted_count: 0")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
