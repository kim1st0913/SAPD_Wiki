from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path
from typing import Any, Callable, Iterable
from urllib.parse import quote


ConnectFactory = Callable[..., sqlite3.Connection]
ConnectObserver = Callable[[dict[str, Any]], None]


class RuntimeProbeError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    return f"sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}"


def relative_snapshot(root: Path) -> list[str]:
    return sorted(
        str(path.relative_to(root))
        for path in root.rglob("*")
        if path.name not in {"synthetic-base.sqlite3"}
    )


class ReadOnlyRuntimeProbe:
    def __init__(
        self,
        *,
        test_root: Path,
        synthetic_base: Path,
        connect_factory: ConnectFactory = sqlite3.connect,
        connect_observer: ConnectObserver | None = None,
    ) -> None:
        self._test_root_input = test_root
        self._base_input = synthetic_base
        self._connect_factory = connect_factory
        self._connect_observer = connect_observer
        self._connection: sqlite3.Connection | None = None
        self._base_path: Path | None = None
        self._database_names: tuple[str, ...] = ()

    def _validate_paths(self) -> tuple[Path, Path]:
        if not self._test_root_input.is_absolute():
            raise RuntimeProbeError("test_root must be explicit and absolute")
        if self._test_root_input.is_symlink():
            raise RuntimeProbeError("test_root symlink is forbidden")
        try:
            root = self._test_root_input.resolve(strict=True)
        except OSError as exc:
            raise RuntimeProbeError("test_root is unavailable") from exc
        if not root.is_dir():
            raise RuntimeProbeError("test_root is not a directory")

        if not self._base_input.is_absolute():
            raise RuntimeProbeError("synthetic_base must be explicit and absolute")
        if str(self._base_input).startswith("file:"):
            raise RuntimeProbeError("caller-supplied SQLite URI is forbidden")
        if self._base_input.is_symlink():
            raise RuntimeProbeError("synthetic_base symlink is forbidden")
        try:
            base = self._base_input.resolve(strict=True)
        except OSError as exc:
            raise RuntimeProbeError("synthetic base is unavailable") from exc
        try:
            base.relative_to(root)
        except ValueError as exc:
            raise RuntimeProbeError("synthetic base escapes test_root") from exc
        if base.parent != root or base.name != "synthetic-base.sqlite3":
            raise RuntimeProbeError("synthetic base path is outside the fixed fixture slot")
        if not base.is_file():
            raise RuntimeProbeError("synthetic base is not a regular file")
        return root, base

    @staticmethod
    def _authorizer(action: int, _arg1: str, _arg2: str, _db: str, _trigger: str) -> int:
        denied_actions = {
            sqlite3.SQLITE_ATTACH,
            sqlite3.SQLITE_DETACH,
            sqlite3.SQLITE_INSERT,
            sqlite3.SQLITE_UPDATE,
            sqlite3.SQLITE_DELETE,
            sqlite3.SQLITE_CREATE_INDEX,
            sqlite3.SQLITE_CREATE_TABLE,
            sqlite3.SQLITE_CREATE_TEMP_INDEX,
            sqlite3.SQLITE_CREATE_TEMP_TABLE,
            sqlite3.SQLITE_CREATE_TEMP_TRIGGER,
            sqlite3.SQLITE_CREATE_TEMP_VIEW,
            sqlite3.SQLITE_CREATE_TRIGGER,
            sqlite3.SQLITE_CREATE_VIEW,
            sqlite3.SQLITE_DROP_INDEX,
            sqlite3.SQLITE_DROP_TABLE,
            sqlite3.SQLITE_DROP_TEMP_INDEX,
            sqlite3.SQLITE_DROP_TEMP_TABLE,
            sqlite3.SQLITE_DROP_TEMP_TRIGGER,
            sqlite3.SQLITE_DROP_TEMP_VIEW,
            sqlite3.SQLITE_DROP_TRIGGER,
            sqlite3.SQLITE_DROP_VIEW,
            sqlite3.SQLITE_ALTER_TABLE,
            sqlite3.SQLITE_REINDEX,
            sqlite3.SQLITE_ANALYZE,
            sqlite3.SQLITE_PRAGMA,
        }
        return sqlite3.SQLITE_DENY if action in denied_actions else sqlite3.SQLITE_OK

    def open(self) -> "ReadOnlyRuntimeProbe":
        if self._connection is not None:
            raise RuntimeProbeError("probe is already open")
        _root, base = self._validate_paths()
        uri = f"file:{quote(str(base), safe='/')}?mode=ro&immutable=1"
        if self._connect_observer is not None:
            self._connect_observer(
                {
                    "target_kind": "synthetic_base",
                    "mode": "ro",
                    "immutable": True,
                    "uri": True,
                }
            )
        try:
            connection = self._connect_factory(uri, uri=True, timeout=1.0)
        except (OSError, sqlite3.Error) as exc:
            raise RuntimeProbeError("synthetic base open failed") from exc
        try:
            connection.execute("PRAGMA query_only=ON")
            query_only = connection.execute("PRAGMA query_only").fetchone()
            databases = connection.execute("PRAGMA database_list").fetchall()
            if query_only != (1,):
                raise RuntimeProbeError("query_only is not enabled")
            if len(databases) != 1 or databases[0][1] != "main":
                raise RuntimeProbeError("only the main database is allowed")
            connection.set_authorizer(self._authorizer)
        except Exception:
            connection.close()
            raise
        self._base_path = base
        self._database_names = tuple(row[1] for row in databases)
        self._connection = connection
        return self

    @property
    def database_names(self) -> tuple[str, ...]:
        if self._connection is None:
            raise RuntimeProbeError("probe is not open")
        return self._database_names

    def execute_readonly(
        self,
        sql: str,
        parameters: Iterable[Any] = (),
    ) -> list[tuple[Any, ...]]:
        if self._connection is None:
            raise RuntimeProbeError("probe is not open")
        if "\x00" in sql or ";" in sql or "--" in sql or "/*" in sql:
            raise RuntimeProbeError("multi-statement and comment syntax is forbidden")
        leading = sql.lstrip().split(None, 1)[0].upper() if sql.strip() else ""
        if leading not in {"SELECT", "WITH"}:
            raise RuntimeProbeError("only SELECT/WITH queries are allowed")
        try:
            return self._connection.execute(sql, tuple(parameters)).fetchall()
        except sqlite3.Error as exc:
            raise RuntimeProbeError("read-only query failed") from exc

    def close(self) -> None:
        if self._connection is not None:
            self._connection.close()
            self._connection = None
            self._base_path = None
            self._database_names = ()

    def __enter__(self) -> "ReadOnlyRuntimeProbe":
        return self.open()

    def __exit__(self, _exc_type: Any, _exc: Any, _traceback: Any) -> None:
        self.close()


def run_probe(
    *,
    test_root: Path,
    synthetic_base: Path,
    connect_factory: ConnectFactory = sqlite3.connect,
) -> dict[str, Any]:
    before_hash = sha256_file(synthetic_base)
    before_snapshot = relative_snapshot(test_root)
    events: list[dict[str, Any]] = []
    with ReadOnlyRuntimeProbe(
        test_root=test_root,
        synthetic_base=synthetic_base,
        connect_factory=connect_factory,
        connect_observer=events.append,
    ) as probe:
        object_count = probe.execute_readonly(
            "SELECT COUNT(*) FROM knowledge_objects"
        )[0][0]
        public_count = probe.execute_readonly(
            """
            SELECT COUNT(*)
            FROM knowledge_objects
            WHERE effective_sensitive_level = ?
              AND ai_use_policy IN (?, ?)
            """,
            ("public", "public_summary", "metadata_only"),
        )[0][0]
        database_count = len(probe.database_names)
    after_hash = sha256_file(synthetic_base)
    after_snapshot = relative_snapshot(test_root)
    artifacts = [
        path.name
        for path in test_root.iterdir()
        if path.name.endswith(("-journal", "-wal", "-shm"))
    ]
    if before_hash != after_hash:
        raise RuntimeProbeError("synthetic base hash changed")
    if before_snapshot != after_snapshot:
        raise RuntimeProbeError("test root side effects detected")
    if artifacts:
        raise RuntimeProbeError("SQLite artifacts remain after close")
    return {
        "base_hash_before": before_hash,
        "base_hash_after": after_hash,
        "object_count": object_count,
        "public_or_metadata_count": public_count,
        "database_count": database_count,
        "connect_events": events,
        "user_store_access_attempts": 0,
        "business_directories_created": 0,
        "production_runtime_imports": 0,
        "residual_sqlite_artifacts": 0,
    }
