from __future__ import annotations

from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DB_DIR = PROJECT_ROOT / "data" / "database"
DEFAULT_DB_PATH = DB_DIR / "sapd_wiki.sqlite3"
MIGRATIONS_DIR = PROJECT_ROOT / "db" / "migrations"


def resolve_project_path(path: str | Path) -> Path:
    candidate = Path(path).expanduser()
    if candidate.is_absolute():
        return candidate
    return PROJECT_ROOT / candidate


def display_path(path: str | Path) -> str:
    resolved = resolve_project_path(path).resolve()
    try:
        return str(resolved.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(resolved)

