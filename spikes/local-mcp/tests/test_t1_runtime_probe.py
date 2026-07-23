from __future__ import annotations

import hashlib
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
M0T = ROOT / "spikes/local-mcp/m0t"
sys.path.insert(0, str(M0T))

from build_synthetic_base import build_synthetic_base  # noqa: E402
from runtime_probe import (  # noqa: E402
    ReadOnlyRuntimeProbe,
    RuntimeProbeError,
    run_probe,
)


class ConnectSpy:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []

    def __call__(self, database: str, **kwargs: object) -> sqlite3.Connection:
        self.calls.append((database, kwargs))
        return sqlite3.connect(database, **kwargs)


class T1RuntimeProbeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(prefix="sapd-m0t-t1-test-")
        self.test_root = Path(self.temp.name).resolve()
        self.base = self.test_root / "synthetic-base.sqlite3"
        self.initial_hash = build_synthetic_base(self.test_root, self.base)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def file_hash(self, path: Path) -> str:
        return f"sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}"

    def test_build_and_read_synthetic_base(self) -> None:
        with ReadOnlyRuntimeProbe(
            test_root=self.test_root,
            synthetic_base=self.base,
        ) as probe:
            self.assertEqual(
                probe.execute_readonly("SELECT COUNT(*) FROM knowledge_objects"),
                [(3,)],
            )
            self.assertEqual(
                probe.database_names,
                ("main",),
            )

    def test_hash_is_unchanged(self) -> None:
        result = run_probe(test_root=self.test_root, synthetic_base=self.base)
        self.assertEqual(result["base_hash_before"], self.initial_hash)
        self.assertEqual(result["base_hash_after"], self.initial_hash)

    def test_connect_spy_observes_only_one_readonly_immutable_uri(self) -> None:
        spy = ConnectSpy()
        result = run_probe(
            test_root=self.test_root,
            synthetic_base=self.base,
            connect_factory=spy,
        )
        self.assertEqual(len(spy.calls), 1)
        database, kwargs = spy.calls[0]
        self.assertTrue(database.startswith("file:"))
        self.assertIn("mode=ro", database)
        self.assertIn("immutable=1", database)
        self.assertEqual(kwargs["uri"], True)
        self.assertEqual(
            result["connect_events"],
            [
                {
                    "target_kind": "synthetic_base",
                    "mode": "ro",
                    "immutable": True,
                    "uri": True,
                }
            ],
        )

    def test_nonexistent_and_existing_user_sentinels_are_never_opened(self) -> None:
        nonexistent = self.test_root / "synthetic-user-missing.sqlite3"
        existing = self.test_root / "synthetic-user-existing.sqlite3"
        existing.write_bytes(b"fixture user sentinel")
        existing_hash = self.file_hash(existing)
        spy = ConnectSpy()
        result = run_probe(
            test_root=self.test_root,
            synthetic_base=self.base,
            connect_factory=spy,
        )
        self.assertFalse(nonexistent.exists())
        self.assertEqual(self.file_hash(existing), existing_hash)
        self.assertEqual(len(spy.calls), 1)
        self.assertEqual(result["user_store_access_attempts"], 0)

    def test_outside_root_formal_sentinel_is_rejected_before_connect(self) -> None:
        spy = ConnectSpy()
        outside = self.test_root.parent / "formal-base-sentinel.sqlite3"
        with self.assertRaises(RuntimeProbeError):
            ReadOnlyRuntimeProbe(
                test_root=self.test_root,
                synthetic_base=outside,
                connect_factory=spy,
            ).open()
        self.assertEqual(spy.calls, [])

    def test_symlink_escape_is_rejected_before_connect(self) -> None:
        target_root = Path(tempfile.mkdtemp(prefix="sapd-m0t-t1-target-"))
        try:
            target = target_root / "synthetic-base.sqlite3"
            target.write_bytes(self.base.read_bytes())
            link = self.test_root / "synthetic-base-link.sqlite3"
            link.symlink_to(target)
            spy = ConnectSpy()
            with self.assertRaises(RuntimeProbeError):
                ReadOnlyRuntimeProbe(
                    test_root=self.test_root,
                    synthetic_base=link,
                    connect_factory=spy,
                ).open()
            self.assertEqual(spy.calls, [])
        finally:
            target.unlink(missing_ok=True)
            target_root.rmdir()

    def test_caller_supplied_uri_and_relative_path_are_rejected(self) -> None:
        spy = ConnectSpy()
        for candidate in (
            Path("file:synthetic-base.sqlite3?mode=rw"),
            Path("synthetic-base.sqlite3"),
        ):
            with self.assertRaises(RuntimeProbeError):
                ReadOnlyRuntimeProbe(
                    test_root=self.test_root,
                    synthetic_base=candidate,
                    connect_factory=spy,
                ).open()
        self.assertEqual(spy.calls, [])

    def test_attach_is_rejected(self) -> None:
        with ReadOnlyRuntimeProbe(
            test_root=self.test_root,
            synthetic_base=self.base,
        ) as probe:
            with self.assertRaises(RuntimeProbeError):
                probe.execute_readonly("ATTACH DATABASE 'fixture.sqlite3' AS other")

    def test_write_and_pragma_are_rejected(self) -> None:
        with ReadOnlyRuntimeProbe(
            test_root=self.test_root,
            synthetic_base=self.base,
        ) as probe:
            for statement in (
                "INSERT INTO knowledge_objects(canonical_ref) VALUES ('fixture://x')",
                "UPDATE knowledge_objects SET display_name = 'x'",
                "DELETE FROM knowledge_objects",
                "PRAGMA journal_mode=WAL",
            ):
                with self.assertRaises(RuntimeProbeError):
                    probe.execute_readonly(statement)
        self.assertEqual(self.file_hash(self.base), self.initial_hash)

    def test_missing_file_fails_closed(self) -> None:
        missing = self.test_root / "synthetic-base-missing.sqlite3"
        spy = ConnectSpy()
        with self.assertRaises(RuntimeProbeError):
            ReadOnlyRuntimeProbe(
                test_root=self.test_root,
                synthetic_base=missing,
                connect_factory=spy,
            ).open()
        self.assertEqual(spy.calls, [])
        self.assertFalse(missing.exists())

    def test_permission_failure_fails_closed(self) -> None:
        original_mode = self.base.stat().st_mode
        os.chmod(self.base, 0)
        try:
            with self.assertRaises(RuntimeProbeError):
                ReadOnlyRuntimeProbe(
                    test_root=self.test_root,
                    synthetic_base=self.base,
                ).open()
        finally:
            os.chmod(self.base, original_mode)

    def test_no_business_directories_or_sqlite_artifacts(self) -> None:
        before = sorted(path.name for path in self.test_root.iterdir())
        result = run_probe(test_root=self.test_root, synthetic_base=self.base)
        after = sorted(path.name for path in self.test_root.iterdir())
        self.assertEqual(before, after)
        self.assertEqual(result["business_directories_created"], 0)
        self.assertEqual(result["residual_sqlite_artifacts"], 0)
        for name in ("import", "export", "diagnostics", "maturity"):
            self.assertFalse((self.test_root / name).exists())

    def test_no_production_runtime_imports(self) -> None:
        sources = [
            (M0T / "runtime_probe.py").read_text(encoding="utf-8"),
            (M0T / "build_synthetic_base.py").read_text(encoding="utf-8"),
        ]
        forbidden_import_fragments = [
            "scripts.run_local_server",
            "src.sapd_wiki.db",
            "from src",
            "import src",
        ]
        for source in sources:
            for fragment in forbidden_import_fragments:
                self.assertNotIn(fragment, source)
        self.assertFalse(any(name.startswith("src.sapd_wiki") for name in sys.modules))


if __name__ == "__main__":
    unittest.main()
