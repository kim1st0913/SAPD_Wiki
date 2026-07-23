from __future__ import annotations

import sqlite3
import tempfile
import unittest
from pathlib import Path

from support import ROOT, build_synthetic_base, sha256_file, snapshot
from sapd_wiki.local_mcp.errors import RuntimeBoundaryError
from sapd_wiki.local_mcp.readonly_runtime import ReadOnlyRuntimeContext


class ConnectSpy:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []

    def __call__(self, database: str, **kwargs: object) -> sqlite3.Connection:
        self.calls.append((database, dict(kwargs)))
        return sqlite3.connect(database, **kwargs)


class ReadOnlyRuntimeTests(unittest.TestCase):
    def test_open_is_readonly_immutable_single_main_and_side_effect_free(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            database = build_synthetic_base(root)
            before_hash = sha256_file(database)
            before_snapshot = snapshot(root)
            events: list[dict[str, object]] = []
            spy = ConnectSpy()
            with ReadOnlyRuntimeContext(
                synthetic_root=root,
                synthetic_base=database,
                connect_factory=spy,
                connect_observer=events.append,
            ) as runtime:
                count = runtime.connection.execute(
                    "SELECT COUNT(*) FROM knowledge_objects"
                ).fetchone()[0]
                self.assertEqual(count, 4)
            self.assertEqual(before_hash, sha256_file(database))
            self.assertEqual(before_snapshot, snapshot(root))
            self.assertEqual(len(spy.calls), 1)
            uri, kwargs = spy.calls[0]
            self.assertIn("mode=ro&immutable=1", uri)
            self.assertTrue(kwargs["uri"])
            self.assertEqual(
                events,
                [
                    {
                        "target_kind": "synthetic_base",
                        "mode": "ro",
                        "immutable": True,
                        "uri": True,
                    }
                ],
            )
            self.assertFalse(any(root.glob("*-wal")))
            self.assertFalse(any(root.glob("*-journal")))
            self.assertFalse(any(root.glob("*-shm")))

    def test_write_attach_and_pragma_are_denied_by_authorizer(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            database = build_synthetic_base(root)
            with ReadOnlyRuntimeContext(
                synthetic_root=root,
                synthetic_base=database,
            ) as runtime:
                for statement in (
                    "CREATE TABLE forbidden(value TEXT)",
                    "UPDATE knowledge_objects SET display_name='forbidden'",
                    "ATTACH DATABASE ':memory:' AS other",
                    "PRAGMA user_version",
                ):
                    with self.subTest(statement=statement):
                        with self.assertRaises(sqlite3.DatabaseError):
                            runtime.connection.execute(statement)

    def test_relative_uri_outside_slot_and_missing_paths_fail_before_connect(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            database = build_synthetic_base(root)
            spy = ConnectSpy()
            bad_inputs = [
                (Path("."), database),
                (root, Path("file:synthetic-base.sqlite3")),
                (root, root / "missing.sqlite3"),
            ]
            for synthetic_root, synthetic_base in bad_inputs:
                with self.subTest(root=synthetic_root, base=synthetic_base):
                    with self.assertRaises(RuntimeBoundaryError):
                        ReadOnlyRuntimeContext(
                            synthetic_root=synthetic_root,
                            synthetic_base=synthetic_base,
                            connect_factory=spy,
                        ).open()
            self.assertEqual(spy.calls, [])

    def test_symlink_database_is_rejected_before_connect(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target_root = root / "target"
            target_root.mkdir()
            target = build_synthetic_base(target_root)
            slot = root / "slot"
            slot.mkdir()
            link = slot / "synthetic-base.sqlite3"
            link.symlink_to(target)
            spy = ConnectSpy()
            with self.assertRaises(RuntimeBoundaryError):
                ReadOnlyRuntimeContext(
                    synthetic_root=slot,
                    synthetic_base=link,
                    connect_factory=spy,
                ).open()
            self.assertEqual(spy.calls, [])

    def test_no_user_or_business_directory_is_created(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            database = build_synthetic_base(root)
            before = set(root.iterdir())
            with ReadOnlyRuntimeContext(
                synthetic_root=root,
                synthetic_base=database,
            ):
                pass
            self.assertEqual(before, set(root.iterdir()))
            for forbidden in ("user", "import", "exports", "logs"):
                self.assertFalse((root / forbidden).exists())

    def test_core_has_no_spike_bundle_runtime_or_user_api_imports(self) -> None:
        source_root = ROOT / "src" / "sapd_wiki" / "local_mcp"
        source = "\n".join(
            path.read_text(encoding="utf-8")
            for path in sorted(source_root.glob("*.py"))
        )
        for forbidden in (
            "spikes.local",
            "spikes/local-mcp",
            "BundleRuntime",
            "sapd_wiki.api_server",
            "user_db_connection",
            "run_local_server",
        ):
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, source)


if __name__ == "__main__":
    unittest.main()
