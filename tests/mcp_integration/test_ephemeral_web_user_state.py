from __future__ import annotations

import json
import multiprocessing
import sqlite3
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, call, patch

from sapd_wiki import api_server


def _persist_report_batch(user_db_path: str, start: int, count: int) -> None:
    api_server.configure_runtime_paths(
        user_db=Path(user_db_path),
        runtime_label="test-process",
        ephemeral_user_state=False,
    )
    for index in range(start, start + count):
        api_server.persist_maturity_report_artifact(
            {
                "id": f"report-{index}",
                "ok": True,
                "formal": True,
                "html": f"<p>{index}</p>",
                "markdown": str(index),
            },
            {"project": {"id": "multi-process-project"}, "operation": "create"},
        )


class EphemeralWebUserStateTests(unittest.TestCase):
    @staticmethod
    def report(report_id: str) -> dict[str, object]:
        return {
            "id": report_id,
            "ok": True,
            "formal": True,
            "html": f"<p>{report_id}</p>",
            "markdown": report_id,
        }

    def test_health_projects_release_safe_mcp_runtime_identity(self) -> None:
        payload = api_server.runtime_health_payload(
            mcp_runtime_id="runtime-release-test",
        )
        self.assertEqual(
            payload["runtime"]["runtime_id"],
            "runtime-release-test",
        )
        self.assertEqual(
            payload["runtime"]["settings_paths"]["user_home"],
            str(Path.home().resolve()),
        )

    def test_windows_manifest_lock_branch_locks_and_unlocks_one_byte(self) -> None:
        fake_msvcrt = SimpleNamespace(LK_LOCK=1, LK_UNLCK=2, locking=Mock())
        with tempfile.TemporaryDirectory(prefix="sapd-windows-lock-contract-") as temporary:
            lock_path = Path(temporary) / "manifest.lock"
            with lock_path.open("a+b") as handle, patch.dict(sys.modules, {"msvcrt": fake_msvcrt}):
                with api_server._maturity_report_file_lock(handle, platform_name="nt"):
                    self.assertEqual(handle.tell(), 0)
                file_descriptor = handle.fileno()
        self.assertEqual(
            fake_msvcrt.locking.call_args_list,
            [
                call(file_descriptor, fake_msvcrt.LK_LOCK, 1),
                call(file_descriptor, fake_msvcrt.LK_UNLCK, 1),
            ],
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

    def test_user_db_context_closes_the_connection(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-user-db-close-") as temporary:
            try:
                api_server.configure_runtime_paths(
                    user_db=Path(temporary) / "user.sqlite3",
                    runtime_label="test",
                    ephemeral_user_state=False,
                )
                with api_server.user_db_connection() as connection:
                    self.assertEqual(connection.execute("SELECT 1").fetchone()[0], 1)
                with self.assertRaises(sqlite3.ProgrammingError):
                    connection.execute("SELECT 1")
            finally:
                api_server.configure_runtime_paths(
                    user_db=original_user_db,
                    runtime_label=original_runtime_label,
                    ephemeral_user_state=False,
                )

    def test_user_db_context_closes_when_connection_setup_fails(self) -> None:
        class FailingConnection:
            row_factory = None
            closed = False

            def execute(self, *_args, **_kwargs):
                raise sqlite3.OperationalError("injected pragma failure")

            def close(self):
                self.closed = True

        connection = FailingConnection()
        with patch.object(api_server, "ensure_user_db"), patch.object(
            api_server.sqlite3,
            "connect",
            return_value=connection,
        ):
            with self.assertRaisesRegex(sqlite3.OperationalError, "injected pragma failure"):
                with api_server.user_db_connection():
                    self.fail("connection setup failure must not yield")
        self.assertTrue(connection.closed)

    def test_ephemeral_keeper_closes_when_schema_initialization_fails(self) -> None:
        class FailingConnection:
            closed = False

            def close(self):
                self.closed = True

        connection = FailingConnection()
        with patch.object(api_server, "USER_STATE_EPHEMERAL", True), patch.object(
            api_server,
            "_EPHEMERAL_USER_DB_URI",
            "file:test-ephemeral-init?mode=memory&cache=shared",
        ), patch.object(api_server, "_EPHEMERAL_USER_DB_KEEPER", None), patch.object(
            api_server.sqlite3,
            "connect",
            return_value=connection,
        ), patch.object(
            api_server,
            "_initialize_user_schema",
            side_effect=sqlite3.OperationalError("injected schema failure"),
        ):
            with self.assertRaisesRegex(sqlite3.OperationalError, "injected schema failure"):
                api_server.ensure_user_db()
        self.assertTrue(connection.closed)

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

    def test_web_dev_report_history_uses_disposable_artifact_storage(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-web-report-state-") as temporary:
            persistent_user_db = Path(temporary) / "persistent" / "user.sqlite3"
            try:
                api_server.configure_runtime_paths(
                    user_db=persistent_user_db,
                    runtime_label="dev",
                    ephemeral_user_state=False,
                )
                api_server.configure_runtime_paths(
                    runtime_label="dev",
                    ephemeral_user_state=True,
                )

                report_root = api_server.maturity_report_storage_root()
                self.assertNotEqual(
                    report_root,
                    persistent_user_db.parent / "maturity-reports",
                )
                persisted = api_server.persist_maturity_report_artifact(
                    {
                        "id": "report-1",
                        "ok": True,
                        "formal": True,
                        "html": "<p>isolated</p>",
                        "markdown": "isolated",
                    },
                    {"project": {"id": "project-1"}, "operation": "create"},
                )
                artifact_id = persisted["persistence"]["artifactId"]
                self.assertTrue(
                    (api_server._maturity_project_root("project-1") / "artifacts" / artifact_id / "report.json").is_file()
                )
                self.assertFalse((persistent_user_db.parent / "maturity-reports").exists())

                api_server.close_ephemeral_user_state()
                self.assertFalse(report_root.exists())
            finally:
                api_server.configure_runtime_paths(
                    user_db=original_user_db,
                    runtime_label=original_runtime_label,
                    ephemeral_user_state=False,
                )

    def test_web_dev_exports_stay_inside_disposable_user_state_root(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_export_dir = api_server.USER_EXPORT_DIR
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-web-export-state-") as temporary:
            persistent_export = Path(temporary) / "persistent-export"
            try:
                api_server.configure_runtime_paths(
                    user_db=Path(temporary) / "persistent-user.sqlite3",
                    export_dir=persistent_export,
                    runtime_label="dev",
                    ephemeral_user_state=False,
                )
                api_server.configure_runtime_paths(runtime_label="dev", ephemeral_user_state=True)
                ephemeral_root = Path(api_server._EPHEMERAL_USER_ARTIFACTS.name).resolve()
                self.assertTrue(api_server.USER_EXPORT_DIR.is_relative_to(ephemeral_root))
                result = api_server.save_markdown_export(
                    {"category": "issues", "filename": "ephemeral.md", "content": "isolated"}
                )
                self.assertTrue(Path(result["outputPath"]).is_relative_to(ephemeral_root))
                self.assertFalse(persistent_export.exists())
                api_server.configure_runtime_paths(runtime_label="dev", ephemeral_user_state=True)
                self.assertFalse(ephemeral_root.exists())
                replacement_root = Path(api_server._EPHEMERAL_USER_ARTIFACTS.name).resolve()
                self.assertTrue(api_server.USER_EXPORT_DIR.is_relative_to(replacement_root))
                api_server.configure_runtime_paths(runtime_label="dev", ephemeral_user_state=False)
                self.assertFalse(replacement_root.exists())
                self.assertEqual(api_server.USER_EXPORT_DIR, persistent_export.resolve())
            finally:
                api_server.configure_runtime_paths(
                    user_db=original_user_db,
                    export_dir=original_export_dir,
                    runtime_label=original_runtime_label,
                    ephemeral_user_state=False,
                )

    def test_concurrent_report_writes_preserve_every_manifest_entry(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-manifest-concurrency-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime" / "data" / "user" / "user.sqlite3"
            try:
                api_server.configure_runtime_paths(
                    user_db=isolated_user_db,
                    runtime_label="test",
                    ephemeral_user_state=False,
                )

                def persist(index: int) -> str:
                    persisted = api_server.persist_maturity_report_artifact(
                        {
                            "id": f"report-{index}",
                            "ok": True,
                            "formal": True,
                            "html": f"<p>{index}</p>",
                            "markdown": str(index),
                        },
                        {"project": {"id": "concurrent-project"}, "operation": "create"},
                    )
                    return persisted["persistence"]["artifactId"]

                with ThreadPoolExecutor(max_workers=12) as executor:
                    artifact_ids = list(executor.map(persist, range(48)))

                manifest_path = api_server._maturity_project_root("concurrent-project") / "manifest.json"
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                recorded_ids = [item["artifactId"] for item in manifest["artifacts"]]
                self.assertEqual(len(recorded_ids), 48)
                self.assertEqual(set(recorded_ids), set(artifact_ids))
            finally:
                api_server.configure_runtime_paths(
                    user_db=original_user_db,
                    runtime_label=original_runtime_label,
                    ephemeral_user_state=False,
                )

    def test_multi_process_report_writes_preserve_every_manifest_entry(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-report-manifest-process-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime" / "data" / "user" / "user.sqlite3"
            context = multiprocessing.get_context("spawn")
            processes = [
                context.Process(
                    target=_persist_report_batch,
                    args=(str(isolated_user_db), batch * 12, 12),
                )
                for batch in range(4)
            ]
            for process in processes:
                process.start()
            for process in processes:
                process.join(30)
                self.assertEqual(process.exitcode, 0)

            project_root = (
                isolated_user_db.parent
                / "maturity-reports"
                / api_server._maturity_project_segment("multi-process-project")
            )
            manifest = json.loads((project_root / "manifest.json").read_text(encoding="utf-8"))
            artifact_ids = [item["artifactId"] for item in manifest["artifacts"]]
            self.assertEqual(len(artifact_ids), 48)
            self.assertEqual(len(set(artifact_ids)), 48)
            self.assertEqual(len(list((project_root / "artifacts").iterdir())), 48)

    def test_report_write_failures_remove_only_the_incomplete_artifact(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-write-cleanup-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime/data/user/user.sqlite3"
            try:
                api_server.configure_runtime_paths(user_db=isolated_user_db, runtime_label="test", ephemeral_user_state=False)
                api_server.persist_maturity_report_artifact(self.report("baseline"), {"project": {"id": "cleanup-project"}})
                project_root = api_server._maturity_project_root("cleanup-project")
                manifest_path = project_root / "manifest.json"
                original_write_text = Path.write_text
                original_replace = Path.replace

                def fail_report_markdown(path: Path, *args, **kwargs):
                    if path.name == "report.md":
                        raise OSError("injected report failure")
                    return original_write_text(path, *args, **kwargs)

                def fail_manifest_replace(path: Path, target: Path):
                    if path.name.startswith("manifest-") and path.suffix == ".tmp":
                        raise OSError("injected manifest failure")
                    return original_replace(path, target)

                for label, target, replacement in (
                    ("report", Path, fail_report_markdown),
                    ("manifest", Path, fail_manifest_replace),
                ):
                    with self.subTest(label=label):
                        manifest_before = manifest_path.read_bytes()
                        artifacts_before = {path.name for path in (project_root / "artifacts").iterdir()}
                        method = "write_text" if label == "report" else "replace"
                        with patch.object(target, method, replacement):
                            with self.assertRaisesRegex(OSError, "injected"):
                                api_server.persist_maturity_report_artifact(self.report(f"failed-{label}"), {"project": {"id": "cleanup-project"}})
                        self.assertEqual(manifest_path.read_bytes(), manifest_before)
                        self.assertEqual({path.name for path in (project_root / "artifacts").iterdir()}, artifacts_before)
                        self.assertEqual(list(project_root.glob("manifest-*.tmp")), [])
                        api_server.persist_maturity_report_artifact(self.report(f"recovered-{label}"), {"project": {"id": "cleanup-project"}})
            finally:
                api_server.configure_runtime_paths(user_db=original_user_db, runtime_label=original_runtime_label, ephemeral_user_state=False)

    def test_project_storage_segments_do_not_collide_after_normalization(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        project_ids = [
            "team/a",
            "team a",
            "项目一",
            "项目二",
            "CaseProject",
            "caseproject",
            "CON",
            "AUX",
            f"{'x' * 96}a",
            f"{'x' * 96}b",
        ]
        with tempfile.TemporaryDirectory(prefix="sapd-report-project-segments-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime/data/user/user.sqlite3"
            try:
                api_server.configure_runtime_paths(user_db=isolated_user_db, runtime_label="test", ephemeral_user_state=False)
                segments = [api_server._maturity_project_segment(project_id) for project_id in project_ids]
                self.assertEqual(len(segments), len(set(segments)))
                self.assertEqual(len(segments), len({segment.casefold() for segment in segments}))
                self.assertRegex(api_server._maturity_project_segment("demo-project-001"), r"^demo-project-001-[0-9a-f]{12}$")
                self.assertNotIn(api_server._maturity_project_segment("CON").casefold(), {"con", "aux", "prn", "nul"})

                def persist(project_id: str) -> tuple[str, str]:
                    persisted = api_server.persist_maturity_report_artifact(self.report(f"report-{project_id}"), {"project": {"id": project_id}})
                    return project_id, persisted["persistence"]["artifactId"]

                with ThreadPoolExecutor(max_workers=len(project_ids)) as executor:
                    persisted = list(executor.map(persist, project_ids))
                for project_id, artifact_id in persisted:
                    loaded = api_server.load_maturity_report_artifact(project_id=project_id, artifact_id=artifact_id)
                    self.assertTrue(loaded["ok"])
                    self.assertEqual(loaded["persistence"]["projectId"], project_id)
            finally:
                api_server.configure_runtime_paths(user_db=original_user_db, runtime_label=original_runtime_label, ephemeral_user_state=False)

    def test_corrupt_legacy_manifest_fails_closed_without_splitting_history(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-legacy-corrupt-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime/data/user/user.sqlite3"
            try:
                api_server.configure_runtime_paths(user_db=isolated_user_db, runtime_label="test", ephemeral_user_state=False)
                storage_root = api_server.maturity_report_storage_root()
                legacy_root = storage_root / "team-a"
                legacy_root.mkdir(parents=True)
                (legacy_root / "manifest.json").write_text("{broken", encoding="utf-8")

                with self.assertRaisesRegex(RuntimeError, "legacy manifest is unreadable"):
                    api_server.persist_maturity_report_artifact(
                        self.report("after-upgrade"),
                        {"project": {"id": "team/a"}},
                    )

                self.assertEqual((legacy_root / "manifest.json").read_text(encoding="utf-8"), "{broken")
                self.assertFalse((storage_root / api_server._maturity_project_segment("team/a")).exists())
            finally:
                api_server.configure_runtime_paths(user_db=original_user_db, runtime_label=original_runtime_label, ephemeral_user_state=False)

    def test_valid_legacy_manifest_remains_the_compatible_project_root(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-legacy-compatible-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime/data/user/user.sqlite3"
            try:
                api_server.configure_runtime_paths(user_db=isolated_user_db, runtime_label="test", ephemeral_user_state=False)
                storage_root = api_server.maturity_report_storage_root()
                legacy_root = storage_root / "legacy-project"
                legacy_root.mkdir(parents=True)
                (legacy_root / "manifest.json").write_text(
                    json.dumps(
                        {
                            "schemaVersion": api_server.MATURITY_REPORT_ARTIFACT_SCHEMA,
                            "projectId": "legacy-project",
                            "artifacts": [],
                        }
                    ),
                    encoding="utf-8",
                )

                persisted = api_server.persist_maturity_report_artifact(
                    self.report("compatible-write"),
                    {"project": {"id": "legacy-project"}},
                )

                self.assertEqual(api_server._maturity_project_root("legacy-project"), legacy_root)
                self.assertTrue((legacy_root / "artifacts" / persisted["persistence"]["artifactId"] / "report.json").is_file())
                self.assertFalse((storage_root / api_server._maturity_project_segment("legacy-project")).exists())
            finally:
                api_server.configure_runtime_paths(user_db=original_user_db, runtime_label=original_runtime_label, ephemeral_user_state=False)

    def test_current_manifest_remains_authoritative_and_explicit_ids_never_fall_back(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-current-authority-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime/data/user/user.sqlite3"
            try:
                project_id = "authority-project"
                api_server.configure_runtime_paths(user_db=isolated_user_db, runtime_label="test", ephemeral_user_state=False)
                first = api_server.persist_maturity_report_artifact(
                    self.report("current-first"),
                    {"project": {"id": project_id}},
                )
                current_root = api_server.maturity_report_storage_root() / api_server._maturity_project_segment(project_id)
                legacy_root = api_server.maturity_report_storage_root() / project_id
                legacy_root.mkdir(parents=True)
                (legacy_root / "manifest.json").write_text(
                    json.dumps(
                        {
                            "schemaVersion": api_server.MATURITY_REPORT_ARTIFACT_SCHEMA,
                            "projectId": project_id,
                            "artifacts": [],
                        }
                    ),
                    encoding="utf-8",
                )
                second = api_server.persist_maturity_report_artifact(
                    self.report("current-second"),
                    {"project": {"id": project_id}},
                )

                self.assertEqual(api_server._maturity_project_root(project_id), current_root)
                current_manifest = json.loads((current_root / "manifest.json").read_text(encoding="utf-8"))
                legacy_manifest = json.loads((legacy_root / "manifest.json").read_text(encoding="utf-8"))
                self.assertEqual(len(current_manifest["artifacts"]), 2)
                self.assertEqual(legacy_manifest["artifacts"], [])
                self.assertEqual(
                    api_server.load_maturity_report_artifact(
                        project_id=project_id,
                        artifact_id=first["persistence"]["artifactId"],
                    )["id"],
                    "current-first",
                )
                for selector in (
                    {"artifact_id": "missing-artifact"},
                    {"report_id": "missing-report"},
                ):
                    missing = api_server.load_maturity_report_artifact(project_id=project_id, **selector)
                    self.assertFalse(missing["ok"])
                    self.assertEqual(missing["dataState"], "missing")
                    self.assertEqual(missing["error"], "report_artifact_not_found")
                self.assertNotEqual(first["persistence"]["artifactId"], second["persistence"]["artifactId"])
            finally:
                api_server.configure_runtime_paths(user_db=original_user_db, runtime_label=original_runtime_label, ephemeral_user_state=False)

    def test_old_receipt_recovers_latest_strictly_matching_report_version(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-version-reconcile-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime/data/user/user.sqlite3"

            def versioned_report(report_id: str, input_hash: str, result_hash: str) -> dict[str, object]:
                return {
                    **self.report(report_id),
                    "reportModel": {
                        "project": {"id": "reconcile-project"},
                        "resultSnapshot": {
                            "calculationRun": {
                                "inputHash": input_hash,
                                "resultHash": result_hash,
                            }
                        },
                        "resultVersion": {"resultHash": result_hash},
                    },
                }

            try:
                api_server.configure_runtime_paths(user_db=isolated_user_db, runtime_label="test", ephemeral_user_state=False)
                old = api_server.persist_maturity_report_artifact(
                    versioned_report("old-report", "old-input", "old-result"),
                    {"project": {"id": "reconcile-project"}},
                )
                api_server.persist_maturity_report_artifact(
                    versioned_report("matching-report-1", "new-input", "new-result"),
                    {"project": {"id": "reconcile-project"}},
                )
                newest = api_server.persist_maturity_report_artifact(
                    versioned_report("matching-report-2", "new-input", "new-result"),
                    {"project": {"id": "reconcile-project"}},
                )

                loaded = api_server.load_maturity_report_artifact(
                    project_id="reconcile-project",
                    artifact_id=old["persistence"]["artifactId"],
                    report_id=old["persistence"]["reportId"],
                    input_hash="new-input",
                    result_hash="new-result",
                )

                self.assertTrue(loaded["ok"])
                self.assertEqual(loaded["id"], "matching-report-2")
                self.assertEqual(loaded["persistence"]["artifactId"], newest["persistence"]["artifactId"])
            finally:
                api_server.configure_runtime_paths(user_db=original_user_db, runtime_label=original_runtime_label, ephemeral_user_state=False)

    def test_old_receipt_reconciliation_rejects_corrupt_and_cross_project_candidates(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-version-reconcile-invalid-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime/data/user/user.sqlite3"

            def versioned_report(report_id: str, project_id: str) -> dict[str, object]:
                return {
                    **self.report(report_id),
                    "reportModel": {
                        "project": {"id": project_id},
                        "resultSnapshot": {
                            "calculationRun": {
                                "inputHash": "new-input",
                                "resultHash": "new-result",
                            }
                        },
                        "resultVersion": {"resultHash": "new-result"},
                    },
                }

            try:
                api_server.configure_runtime_paths(user_db=isolated_user_db, runtime_label="test", ephemeral_user_state=False)
                old = api_server.persist_maturity_report_artifact(
                    {
                        **self.report("old-report"),
                        "reportModel": {
                            "project": {"id": "project-a"},
                            "resultSnapshot": {
                                "calculationRun": {
                                    "inputHash": "old-input",
                                    "resultHash": "old-result",
                                }
                            },
                            "resultVersion": {"resultHash": "old-result"},
                        },
                    },
                    {"project": {"id": "project-a"}},
                )
                corrupt = api_server.persist_maturity_report_artifact(
                    versioned_report("corrupt-candidate", "project-a"),
                    {"project": {"id": "project-a"}},
                )
                corrupt_path = (
                    api_server._maturity_project_root("project-a")
                    / "artifacts"
                    / corrupt["persistence"]["artifactId"]
                    / "report.json"
                )
                corrupt_payload = json.loads(corrupt_path.read_text(encoding="utf-8"))
                corrupt_payload["persistence"]["projectId"] = "project-b"
                corrupt_path.write_text(json.dumps(corrupt_payload), encoding="utf-8")
                api_server.persist_maturity_report_artifact(
                    versioned_report("foreign-valid-candidate", "project-b"),
                    {"project": {"id": "project-b"}},
                )

                loaded = api_server.load_maturity_report_artifact(
                    project_id="project-a",
                    artifact_id=old["persistence"]["artifactId"],
                    input_hash="new-input",
                    result_hash="new-result",
                )

                self.assertFalse(loaded["ok"])
                self.assertEqual(loaded["error"], "report_artifact_version_mismatch")
            finally:
                api_server.configure_runtime_paths(user_db=original_user_db, runtime_label=original_runtime_label, ephemeral_user_state=False)

    def test_report_loader_rejects_foreign_artifact_content(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-identity-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime/data/user/user.sqlite3"
            try:
                api_server.configure_runtime_paths(user_db=isolated_user_db, runtime_label="test", ephemeral_user_state=False)
                first = api_server.persist_maturity_report_artifact(
                    self.report("report-a"),
                    {"project": {"id": "project-a"}},
                )
                second = api_server.persist_maturity_report_artifact(
                    self.report("report-b"),
                    {"project": {"id": "project-b"}},
                )
                first_path = (
                    api_server._maturity_project_root("project-a")
                    / "artifacts"
                    / first["persistence"]["artifactId"]
                    / "report.json"
                )
                second_path = (
                    api_server._maturity_project_root("project-b")
                    / "artifacts"
                    / second["persistence"]["artifactId"]
                    / "report.json"
                )
                first_path.write_bytes(second_path.read_bytes())

                for version_filter in (
                    {},
                    {"input_hash": "expected-input", "result_hash": "expected-result"},
                ):
                    with self.subTest(version_filter=version_filter):
                        loaded = api_server.load_maturity_report_artifact(
                            project_id="project-a",
                            artifact_id=first["persistence"]["artifactId"],
                            **version_filter,
                        )

                        self.assertFalse(loaded["ok"])
                        self.assertEqual(loaded["dataState"], "invalid")
                        self.assertEqual(loaded["error"], "report_artifact_identity_mismatch")
            finally:
                api_server.configure_runtime_paths(user_db=original_user_db, runtime_label=original_runtime_label, ephemeral_user_state=False)

    def test_report_loader_rejects_artifact_directory_escape(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-artifact-escape-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime/data/user/user.sqlite3"
            try:
                project_id = "escape-project"
                api_server.configure_runtime_paths(user_db=isolated_user_db, runtime_label="test", ephemeral_user_state=False)
                persisted = api_server.persist_maturity_report_artifact(
                    self.report("escape-report"),
                    {"project": {"id": project_id}},
                )
                project_root = api_server._maturity_project_root(project_id)
                manifest_path = project_root / "manifest.json"
                manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                manifest["artifacts"][-1]["artifactId"] = ".."
                manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
                report_path = (
                    project_root
                    / "artifacts"
                    / persisted["persistence"]["artifactId"]
                    / "report.json"
                )
                report = json.loads(report_path.read_text(encoding="utf-8"))
                report["persistence"]["artifactId"] = ".."
                (project_root / "report.json").write_text(json.dumps(report), encoding="utf-8")

                with self.assertRaisesRegex(RuntimeError, "manifest has an invalid schema"):
                    api_server.load_maturity_report_artifact(
                        project_id=project_id,
                        artifact_id="..",
                    )
            finally:
                api_server.configure_runtime_paths(user_db=original_user_db, runtime_label=original_runtime_label, ephemeral_user_state=False)

    def test_report_storage_rejects_project_and_artifacts_symlink_escape(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-symlink-escape-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime/data/user/user.sqlite3"
            external_root = Path(temporary) / "outside"
            external_root.mkdir()
            sentinel = external_root / "sentinel.txt"
            sentinel.write_text("outside must remain unchanged", encoding="utf-8")
            try:
                api_server.configure_runtime_paths(user_db=isolated_user_db, runtime_label="test", ephemeral_user_state=False)
                storage_root = api_server.maturity_report_storage_root()
                storage_root.mkdir(parents=True)

                project_id = "project-link"
                project_link = storage_root / api_server._maturity_project_segment(project_id)
                project_link.symlink_to(external_root, target_is_directory=True)
                with self.assertRaisesRegex(RuntimeError, "project path must not be a symbolic link"):
                    api_server.persist_maturity_report_artifact(
                        self.report("project-link-report"),
                        {"project": {"id": project_id}},
                    )
                self.assertEqual({path.name for path in external_root.iterdir()}, {"sentinel.txt"})

                project_link.unlink()
                project_root = storage_root / api_server._maturity_project_segment(project_id)
                project_root.mkdir()
                (project_root / "artifacts").symlink_to(external_root, target_is_directory=True)
                with self.assertRaisesRegex(RuntimeError, "artifacts path must not be a symbolic link"):
                    api_server.persist_maturity_report_artifact(
                        self.report("artifacts-link-report"),
                        {"project": {"id": project_id}},
                    )
                with self.assertRaisesRegex(RuntimeError, "artifacts path must not be a symbolic link"):
                    api_server.load_maturity_report_artifact(
                        project_id=project_id,
                        artifact_id="missing-artifact",
                    )
                self.assertEqual({path.name for path in external_root.iterdir()}, {"sentinel.txt"})
            finally:
                api_server.configure_runtime_paths(user_db=original_user_db, runtime_label=original_runtime_label, ephemeral_user_state=False)

    def test_report_storage_rejects_top_level_storage_symlink_escape(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-root-symlink-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime/data/user/user.sqlite3"
            storage_path = isolated_user_db.parent / "maturity-reports"
            external_root = Path(temporary) / "outside"
            external_root.mkdir(parents=True)
            sentinel = external_root / "sentinel.txt"
            sentinel.write_text("outside must remain unchanged", encoding="utf-8")
            try:
                isolated_user_db.parent.mkdir(parents=True)
                storage_path.symlink_to(external_root, target_is_directory=True)
                api_server.configure_runtime_paths(user_db=isolated_user_db, runtime_label="test", ephemeral_user_state=False)

                with self.assertRaisesRegex(RuntimeError, "storage root.*symbolic link"):
                    api_server.persist_maturity_report_artifact(
                        self.report("root-link-report"),
                        {"project": {"id": "root-link-project"}},
                    )

                self.assertEqual({path.name for path in external_root.iterdir()}, {"sentinel.txt"})
            finally:
                api_server.configure_runtime_paths(user_db=original_user_db, runtime_label=original_runtime_label, ephemeral_user_state=False)

    def test_artifact_id_collision_never_deletes_existing_artifact(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-artifact-collision-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime/data/user/user.sqlite3"
            try:
                api_server.configure_runtime_paths(user_db=isolated_user_db, runtime_label="test", ephemeral_user_state=False)
                project_root = api_server._maturity_project_root("collision-project")
                artifact_id = "collision-report-20260101-000000Z-12345678"
                artifact_root = project_root / "artifacts" / artifact_id
                artifact_root.mkdir(parents=True)
                sentinel = artifact_root / "sentinel.txt"
                sentinel.write_text("existing user artifact", encoding="utf-8")

                def fixed_strftime(format_string, *_args):
                    return "20260101-000000Z" if format_string == "%Y%m%d-%H%M%SZ" else "2026-01-01T00:00:00Z"

                with patch.object(api_server.time, "strftime", side_effect=fixed_strftime), patch.object(
                    api_server.uuid,
                    "uuid4",
                    return_value=SimpleNamespace(hex="12345678deadbeef"),
                ):
                    with self.assertRaises(FileExistsError):
                        api_server.persist_maturity_report_artifact(
                            self.report("collision-report"),
                            {"project": {"id": "collision-project"}},
                        )

                self.assertEqual(sentinel.read_text(encoding="utf-8"), "existing user artifact")
            finally:
                api_server.configure_runtime_paths(user_db=original_user_db, runtime_label=original_runtime_label, ephemeral_user_state=False)

    def test_corrupt_manifest_fails_closed_without_creating_or_overwriting_artifacts(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-manifest-corrupt-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime" / "data" / "user" / "user.sqlite3"
            try:
                api_server.configure_runtime_paths(
                    user_db=isolated_user_db,
                    runtime_label="test",
                    ephemeral_user_state=False,
                )
                api_server.persist_maturity_report_artifact(
                    {
                        "id": "report-before-corruption",
                        "ok": True,
                        "formal": True,
                        "html": "<p>before</p>",
                        "markdown": "before",
                    },
                    {"project": {"id": "corrupt-project"}, "operation": "create"},
                )
                project_root = api_server._maturity_project_root("corrupt-project")
                manifest_path = project_root / "manifest.json"
                manifest_path.write_text("{broken", encoding="utf-8")
                artifact_count = len(list((project_root / "artifacts").iterdir()))

                with self.assertRaisesRegex(RuntimeError, "manifest is unreadable"):
                    api_server.persist_maturity_report_artifact(
                        {
                            "id": "report-after-corruption",
                            "ok": True,
                            "formal": True,
                            "html": "<p>after</p>",
                            "markdown": "after",
                        },
                        {"project": {"id": "corrupt-project"}, "operation": "create"},
                    )

                self.assertEqual(manifest_path.read_text(encoding="utf-8"), "{broken")
                self.assertEqual(len(list((project_root / "artifacts").iterdir())), artifact_count)
            finally:
                api_server.configure_runtime_paths(
                    user_db=original_user_db,
                    runtime_label=original_runtime_label,
                    ephemeral_user_state=False,
                )

    def test_conflicting_artifact_and_report_selectors_are_rejected(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-selector-conflict-") as temporary:
            try:
                api_server.configure_runtime_paths(
                    user_db=Path(temporary) / "user.sqlite3",
                    runtime_label="test",
                    ephemeral_user_state=False,
                )
                first = api_server.persist_maturity_report_artifact(
                    self.report("report-one"), {"project": {"id": "selector-project"}}
                )
                second = api_server.persist_maturity_report_artifact(
                    self.report("report-two"), {"project": {"id": "selector-project"}}
                )
                conflict = api_server.load_maturity_report_artifact(
                    project_id="selector-project",
                    artifact_id=first["persistence"]["artifactId"],
                    report_id=second["persistence"]["reportId"],
                )
                self.assertFalse(conflict["ok"])
                self.assertEqual(conflict["error"], "report_artifact_selector_mismatch")
                matched = api_server.load_maturity_report_artifact(
                    project_id="selector-project",
                    artifact_id=first["persistence"]["artifactId"],
                    report_id=first["persistence"]["reportId"],
                )
                self.assertEqual(matched["id"], "report-one")
            finally:
                api_server.configure_runtime_paths(
                    user_db=original_user_db,
                    runtime_label=original_runtime_label,
                    ephemeral_user_state=False,
                )

    def test_semantically_invalid_manifest_fails_closed_without_losing_history(self) -> None:
        original_user_db = api_server.USER_DB_PATH
        original_runtime_label = api_server.RUNTIME_LABEL
        with tempfile.TemporaryDirectory(prefix="sapd-report-manifest-schema-") as temporary:
            isolated_user_db = Path(temporary) / "Runtime" / "data" / "user" / "user.sqlite3"
            try:
                api_server.configure_runtime_paths(
                    user_db=isolated_user_db,
                    runtime_label="test",
                    ephemeral_user_state=False,
                )
                api_server.persist_maturity_report_artifact(
                    {
                        "id": "report-before-corruption",
                        "ok": True,
                        "formal": True,
                        "html": "<p>before</p>",
                        "markdown": "before",
                    },
                    {"project": {"id": "schema-project"}, "operation": "create"},
                )
                project_root = api_server._maturity_project_root("schema-project")
                manifest_path = project_root / "manifest.json"
                valid_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                artifact_count = len(list((project_root / "artifacts").iterdir()))
                invalid_manifests = [
                    {**valid_manifest, "schemaVersion": "wrong-schema"},
                    {**valid_manifest, "projectId": "another-project"},
                    {**valid_manifest, "artifacts": [*valid_manifest["artifacts"], "invalid-entry"]},
                    {**valid_manifest, "artifacts": [{**valid_manifest["artifacts"][0], "projectId": "another-project"}]},
                    {**valid_manifest, "artifacts": [{**valid_manifest["artifacts"][0], "reportId": ""}]},
                    {**valid_manifest, "artifacts": [{**valid_manifest["artifacts"][0], "artifactId": "../escape"}]},
                    {**valid_manifest, "artifacts": [{**valid_manifest["artifacts"][0], "relativePath": "outside/report.json"}]},
                ]

                for invalid_manifest in invalid_manifests:
                    with self.subTest(invalid_manifest=invalid_manifest):
                        serialized = json.dumps(invalid_manifest, ensure_ascii=False)
                        manifest_path.write_text(serialized, encoding="utf-8")
                        with self.assertRaisesRegex(RuntimeError, "manifest has an invalid schema"):
                            api_server.persist_maturity_report_artifact(
                                {
                                    "id": "report-after-corruption",
                                    "ok": True,
                                    "formal": True,
                                    "html": "<p>after</p>",
                                    "markdown": "after",
                                },
                                {"project": {"id": "schema-project"}, "operation": "create"},
                            )
                        self.assertEqual(manifest_path.read_text(encoding="utf-8"), serialized)
                        self.assertEqual(len(list((project_root / "artifacts").iterdir())), artifact_count)
            finally:
                api_server.configure_runtime_paths(
                    user_db=original_user_db,
                    runtime_label=original_runtime_label,
                    ephemeral_user_state=False,
                )


if __name__ == "__main__":
    unittest.main()
