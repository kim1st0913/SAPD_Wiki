from __future__ import annotations

import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from pathlib import Path

from sapd_wiki.db import run_migrations


class DatabaseMigrationTests(unittest.TestCase):
    def test_add_column_if_missing_marker_accepts_preexisting_column(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-migration-existing-column-") as temporary:
            root = Path(temporary)
            migrations = root / "migrations"
            migrations.mkdir()
            (migrations / "001_existing.sql").write_text(
                "-- sapd:add-column-if-missing\n"
                "ALTER TABLE sample ADD COLUMN stable_ref TEXT;",
                encoding="utf-8",
            )
            database = root / "test.sqlite3"
            with closing(sqlite3.connect(database)) as connection, connection:
                connection.execute(
                    "CREATE TABLE sample(id INTEGER PRIMARY KEY, stable_ref TEXT)"
                )

            results = run_migrations(database, migrations)

            self.assertTrue(results[0].applied)
            with closing(sqlite3.connect(database)) as connection:
                columns = [
                    str(row[1])
                    for row in connection.execute("PRAGMA table_info(sample)")
                ]
                self.assertEqual(columns.count("stable_ref"), 1)

    def test_failed_migration_rolls_back_ddl_and_migration_record(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-migration-atomic-") as temporary:
            root = Path(temporary)
            migrations = root / "migrations"
            migrations.mkdir()
            (migrations / "001_stable.sql").write_text(
                "CREATE TABLE stable(id INTEGER PRIMARY KEY);",
                encoding="utf-8",
            )
            failing = migrations / "002_failing.sql"
            failing.write_text(
                "CREATE TABLE partial(id INTEGER PRIMARY KEY); "
                "INSERT INTO missing_table VALUES (1);",
                encoding="utf-8",
            )
            database = root / "test.sqlite3"

            with self.assertRaisesRegex(sqlite3.OperationalError, "missing_table"):
                run_migrations(database, migrations)

            with closing(sqlite3.connect(database)) as connection:
                tables = {
                    str(row[0])
                    for row in connection.execute(
                        "SELECT name FROM sqlite_master WHERE type='table'"
                    )
                }
                applied = {
                    str(row[0])
                    for row in connection.execute(
                        "SELECT filename FROM schema_migrations"
                    )
                }
            self.assertIn("stable", tables)
            self.assertNotIn("partial", tables)
            self.assertEqual(applied, {"001_stable.sql"})

            failing.write_text(
                "CREATE TABLE recovered(id INTEGER PRIMARY KEY);",
                encoding="utf-8",
            )
            results = run_migrations(database, migrations)
            self.assertEqual(
                [(item.path.name, item.applied) for item in results],
                [("001_stable.sql", False), ("002_failing.sql", True)],
            )

    def test_migration_cannot_commit_partial_changes_from_inside_sql(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-migration-transaction-control-") as temporary:
            root = Path(temporary)
            migrations = root / "migrations"
            migrations.mkdir()
            (migrations / "001_escape.sql").write_text(
                "CREATE TABLE partial(id INTEGER PRIMARY KEY); COMMIT; "
                "INSERT INTO missing_table VALUES (1);",
                encoding="utf-8",
            )
            database = root / "test.sqlite3"

            with self.assertRaisesRegex(sqlite3.DatabaseError, "not authorized"):
                run_migrations(database, migrations)

            with closing(sqlite3.connect(database)) as connection:
                tables = {
                    str(row[0])
                    for row in connection.execute(
                        "SELECT name FROM sqlite_master WHERE type='table'"
                    )
                }
                applied = {
                    str(row[0])
                    for row in connection.execute(
                        "SELECT filename FROM schema_migrations"
                    )
                }
            self.assertNotIn("partial", tables)
            self.assertEqual(applied, set())

    def test_concurrent_migrators_recheck_applied_state_under_write_lock(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-migration-concurrent-") as temporary:
            root = Path(temporary)
            migrations = root / "migrations"
            migrations.mkdir()
            (migrations / "001_once.sql").write_text(
                "CREATE TABLE once_only(id INTEGER PRIMARY KEY); "
                "WITH RECURSIVE counter(value) AS ("
                "SELECT 1 UNION ALL SELECT value + 1 FROM counter WHERE value < 200000"
                ") INSERT INTO once_only SELECT value FROM counter;",
                encoding="utf-8",
            )
            database = root / "test.sqlite3"
            with closing(sqlite3.connect(database)) as connection, connection:
                connection.execute(
                    "CREATE TABLE schema_migrations ("
                    "filename TEXT PRIMARY KEY, "
                    "applied_at TEXT NOT NULL DEFAULT (datetime('now')))"
                )

            with ThreadPoolExecutor(max_workers=2) as executor:
                results = list(executor.map(lambda _index: run_migrations(database, migrations), range(2)))

            self.assertEqual(
                sorted(result[0].applied for result in results),
                [False, True],
            )
            with closing(sqlite3.connect(database)) as connection:
                self.assertEqual(connection.execute("SELECT COUNT(*) FROM once_only").fetchone()[0], 200000)
                self.assertEqual(connection.execute("SELECT COUNT(*) FROM schema_migrations").fetchone()[0], 1)


if __name__ == "__main__":
    unittest.main()
