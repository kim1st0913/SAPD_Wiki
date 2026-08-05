from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sapd_wiki import db, import_lifecycle
from sapd_wiki.content_asset_service import ContentAssetError, ContentAssetService


class FailingConnection:
    row_factory = None

    def __init__(self, *, rows: list[tuple[str]] | None = None) -> None:
        self.closed = False
        self.rows = rows

    def execute(self, *_args, **_kwargs):
        if self.rows is not None:
            return self.rows
        raise sqlite3.OperationalError("injected setup failure")

    def set_authorizer(self, *_args, **_kwargs) -> None:
        return None

    def close(self) -> None:
        self.closed = True


class ConnectionSetupSafetyTests(unittest.TestCase):
    def test_database_connection_closes_when_pragma_setup_fails(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-db-connect-failure-") as temporary:
            connection = FailingConnection()
            with patch.object(db.sqlite3, "connect", return_value=connection):
                with self.assertRaisesRegex(sqlite3.OperationalError, "injected setup failure"):
                    db.connect(Path(temporary) / "test.sqlite3")
            self.assertTrue(connection.closed)

    def test_import_connections_close_when_pragma_setup_fails(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-import-connect-failure-") as temporary:
            database = Path(temporary) / "test.sqlite3"
            database.touch()
            for factory_name in ("_connect_readonly", "_connect_write"):
                with self.subTest(factory_name=factory_name):
                    connection = FailingConnection()
                    with patch.object(import_lifecycle.sqlite3, "connect", return_value=connection):
                        with self.assertRaisesRegex(sqlite3.OperationalError, "injected setup failure"):
                            getattr(import_lifecycle, factory_name)(database)
                    self.assertTrue(connection.closed)

    def test_content_asset_connection_closes_on_setup_and_schema_failures(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-content-asset-connect-") as temporary:
            database = Path(temporary) / "assets.sqlite3"
            database.touch()
            service = ContentAssetService(database)
            cases = (
                (FailingConnection(), "open failed"),
                (FailingConnection(rows=[("asset_schema_meta",)]), "schema is incomplete"),
            )
            for connection, message in cases:
                with self.subTest(message=message):
                    with patch("sapd_wiki.content_asset_service.sqlite3.connect", return_value=connection):
                        with self.assertRaisesRegex(ContentAssetError, message):
                            service._connect()
                    self.assertTrue(connection.closed)


if __name__ == "__main__":
    unittest.main()
