from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from sapd_wiki import api_server


class EphemeralWebUserStateTests(unittest.TestCase):
    def test_health_projects_release_safe_mcp_runtime_identity(self) -> None:
        payload = api_server.runtime_health_payload(
            mcp_runtime_id="runtime-release-test",
        )
        self.assertEqual(
            payload["runtime"]["runtime_id"],
            "runtime-release-test",
        )

    def test_schema_check_does_not_rewrite_unchanged_user_metadata(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-user-schema-metadata-") as temporary:
            isolated_user_db = Path(temporary) / "isolated-user.sqlite3"
            try:
                api_server.configure_runtime_paths(
                    user_db=isolated_user_db,
                    runtime_label="dev",
                    ephemeral_user_state=False,
                )
                api_server.ensure_user_db()
                with api_server.user_db_connection() as connection:
                    connection.execute(
                        """
                        UPDATE user_meta
                        SET updated_at = '2000-01-01 00:00:00'
                        WHERE key = 'schema_version'
                        """
                    )
                    connection.commit()

                api_server.ensure_user_db()

                with api_server.user_db_connection() as connection:
                    row = connection.execute(
                        """
                        SELECT value, updated_at
                        FROM user_meta
                        WHERE key = 'schema_version'
                        """
                    ).fetchone()
                self.assertEqual(row[0], api_server.USER_SCHEMA_VERSION)
                self.assertEqual(row[1], "2000-01-01 00:00:00")
            finally:
                api_server.configure_runtime_paths(
                    user_db=original_user_db,
                    runtime_label=original_runtime_label,
                    ephemeral_user_state=False,
                )

    def test_web_dev_state_never_opens_or_creates_user_database_file(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-web-user-state-") as temporary:
            sentinel = Path(temporary) / "must-not-exist.sqlite3"
            try:
                api_server.configure_runtime_paths(
                    user_db=sentinel,
                    runtime_label="dev",
                    ephemeral_user_state=True,
                )
                before = api_server.runtime_health_payload()["runtime"]["user_database"]
                self.assertEqual(before["path"], "memory://isolated-web-dev")
                self.assertFalse(before["persistent"])
                self.assertFalse(sentinel.exists())

                with api_server.user_db_connection() as connection:
                    row = connection.execute(
                        "SELECT value FROM user_meta WHERE key='schema_version'"
                    ).fetchone()
                self.assertEqual(row[0], api_server.USER_SCHEMA_VERSION)
                self.assertFalse(sentinel.exists())
                self.assertEqual(list(Path(temporary).iterdir()), [])
            finally:
                api_server.configure_runtime_paths(
                    user_db=original_user_db,
                    runtime_label=original_runtime_label,
                    ephemeral_user_state=False,
                )


if __name__ == "__main__":
    unittest.main()
