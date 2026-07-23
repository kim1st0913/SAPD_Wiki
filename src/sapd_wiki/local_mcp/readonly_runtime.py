"""A side-effect-free SQLite runtime restricted to a synthetic fixture slot."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Callable
from urllib.parse import quote

from .errors import RuntimeBoundaryError


ConnectFactory = Callable[..., sqlite3.Connection]
ConnectObserver = Callable[[dict[str, Any]], None]


def _sqlite_action(name: str) -> int | None:
    return getattr(sqlite3, name, None)


_DENIED_ACTIONS = frozenset(
    action
    for action in (
        _sqlite_action("SQLITE_ATTACH"),
        _sqlite_action("SQLITE_DETACH"),
        _sqlite_action("SQLITE_INSERT"),
        _sqlite_action("SQLITE_UPDATE"),
        _sqlite_action("SQLITE_DELETE"),
        _sqlite_action("SQLITE_CREATE_INDEX"),
        _sqlite_action("SQLITE_CREATE_TABLE"),
        _sqlite_action("SQLITE_CREATE_TEMP_INDEX"),
        _sqlite_action("SQLITE_CREATE_TEMP_TABLE"),
        _sqlite_action("SQLITE_CREATE_TEMP_TRIGGER"),
        _sqlite_action("SQLITE_CREATE_TEMP_VIEW"),
        _sqlite_action("SQLITE_CREATE_TRIGGER"),
        _sqlite_action("SQLITE_CREATE_VIEW"),
        _sqlite_action("SQLITE_CREATE_VTABLE"),
        _sqlite_action("SQLITE_DROP_INDEX"),
        _sqlite_action("SQLITE_DROP_TABLE"),
        _sqlite_action("SQLITE_DROP_TEMP_INDEX"),
        _sqlite_action("SQLITE_DROP_TEMP_TABLE"),
        _sqlite_action("SQLITE_DROP_TEMP_TRIGGER"),
        _sqlite_action("SQLITE_DROP_TEMP_VIEW"),
        _sqlite_action("SQLITE_DROP_TRIGGER"),
        _sqlite_action("SQLITE_DROP_VIEW"),
        _sqlite_action("SQLITE_DROP_VTABLE"),
        _sqlite_action("SQLITE_ALTER_TABLE"),
        _sqlite_action("SQLITE_REINDEX"),
        _sqlite_action("SQLITE_ANALYZE"),
        _sqlite_action("SQLITE_PRAGMA"),
        _sqlite_action("SQLITE_TRANSACTION"),
        _sqlite_action("SQLITE_SAVEPOINT"),
    )
    if action is not None
)


class ReadOnlyRuntimeContext:
    """Own exactly one immutable, read-only synthetic SQLite connection."""

    def __init__(
        self,
        *,
        synthetic_root: Path,
        synthetic_base: Path,
        connect_factory: ConnectFactory = sqlite3.connect,
        connect_observer: ConnectObserver | None = None,
    ) -> None:
        self._root_input = synthetic_root
        self._base_input = synthetic_base
        self._connect_factory = connect_factory
        self._connect_observer = connect_observer
        self._connection: sqlite3.Connection | None = None

    def _validated_paths(self) -> tuple[Path, Path]:
        if not self._root_input.is_absolute() or self._root_input.is_symlink():
            raise RuntimeBoundaryError("synthetic root must be an absolute non-symlink directory")
        try:
            root = self._root_input.resolve(strict=True)
        except OSError as exc:
            raise RuntimeBoundaryError("synthetic root is unavailable") from exc
        if not root.is_dir():
            raise RuntimeBoundaryError("synthetic root is not a directory")
        raw_base = str(self._base_input)
        if not self._base_input.is_absolute() or raw_base.startswith("file:"):
            raise RuntimeBoundaryError("synthetic base must be an explicit absolute path")
        if self._base_input.is_symlink():
            raise RuntimeBoundaryError("synthetic base symlink is forbidden")
        try:
            base = self._base_input.resolve(strict=True)
        except OSError as exc:
            raise RuntimeBoundaryError("synthetic base is unavailable") from exc
        if base.parent != root or base.name != "synthetic-base.sqlite3" or not base.is_file():
            raise RuntimeBoundaryError("synthetic base is outside the fixed fixture slot")
        return root, base

    @staticmethod
    def _authorizer(
        action: int,
        _arg1: str | None,
        _arg2: str | None,
        _database: str | None,
        _trigger: str | None,
    ) -> int:
        return sqlite3.SQLITE_DENY if action in _DENIED_ACTIONS else sqlite3.SQLITE_OK

    def open(self) -> "ReadOnlyRuntimeContext":
        if self._connection is not None:
            raise RuntimeBoundaryError("read-only runtime is already open")
        _root, base = self._validated_paths()
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
            raise RuntimeBoundaryError("synthetic base open failed") from exc
        try:
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA query_only=ON")
            query_only = connection.execute("PRAGMA query_only").fetchone()
            databases = connection.execute("PRAGMA database_list").fetchall()
            if query_only is None or query_only[0] != 1:
                raise RuntimeBoundaryError("query_only is not enabled")
            if len(databases) != 1 or databases[0][1] != "main":
                raise RuntimeBoundaryError("only the main database is allowed")
            try:
                opened_path = Path(str(databases[0][2])).resolve(strict=True)
            except OSError as exc:
                raise RuntimeBoundaryError("opened synthetic database path is unavailable") from exc
            if opened_path != base:
                raise RuntimeBoundaryError("opened database does not match the validated fixture")
            connection.set_authorizer(self._authorizer)
        except Exception:
            connection.close()
            raise
        self._connection = connection
        return self

    @property
    def connection(self) -> sqlite3.Connection:
        if self._connection is None:
            raise RuntimeBoundaryError("read-only runtime is not open")
        return self._connection

    def close(self) -> None:
        if self._connection is not None:
            self._connection.close()
            self._connection = None

    def __enter__(self) -> "ReadOnlyRuntimeContext":
        return self.open()

    def __exit__(self, _exc_type: Any, _exc: Any, _traceback: Any) -> None:
        self.close()
