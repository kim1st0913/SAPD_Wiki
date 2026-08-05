from __future__ import annotations

import json
import sys
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from sapd_wiki import api_server

ROOT = Path(__file__).resolve().parents[2]
sys.path.append(str(ROOT / "scripts"))
from scripts import run_local_server  # noqa: E402


class UserNotesExportSecurityTests(unittest.TestCase):
    def test_bundle_connections_close_when_setup_fails(self) -> None:
        class FailingConnection:
            row_factory = None
            closed = False

            def execute(self, *_args, **_kwargs):
                raise run_local_server.sqlite3.OperationalError("injected setup failure")

            def close(self):
                self.closed = True

        runtime = object.__new__(run_local_server.BundleRuntime)
        runtime.user_db = Path("/private/tmp/sapd-connection-close-user.sqlite3")
        runtime.base_db = Path("/private/tmp/sapd-connection-close-base.sqlite3")
        for method_name in ("open_connection", "open_user_connection"):
            with self.subTest(method_name=method_name):
                connection = FailingConnection()
                with patch.object(run_local_server.sqlite3, "connect", return_value=connection):
                    with self.assertRaisesRegex(run_local_server.sqlite3.OperationalError, "injected setup failure"):
                        with getattr(runtime, method_name)():
                            self.fail("connection setup failure must not yield")
                self.assertTrue(connection.closed)

    def test_api_save_requires_session_token_before_creating_export(self) -> None:
        handler = object.__new__(api_server.SapdWikiRequestHandler)
        handler.headers = {"Host": "127.0.0.1:5173"}
        handler.server = SimpleNamespace(
            server_port=5173,
            server_address=("127.0.0.1", 5173),
            sapd_session_token="test-session-token",
        )
        handler._send_json = Mock()
        handler._send_text_download = Mock()

        payload = {"ok": True, "summary": {"note_count": 0}}
        with patch.object(api_server, "user_notes_export_payload", return_value=payload) as export_payload, patch.object(
            api_server,
            "save_user_notes_export",
            return_value={"ok": True},
        ) as save_export:
            handler._handle_api("/api/v1/user/notes/export", {"save": ["1"]})
            save_export.assert_not_called()
            export_payload.assert_not_called()
            self.assertEqual(handler._send_json.call_args.kwargs["status"], 403)

            handler.headers[api_server.LOCAL_API_AUTH_HEADER] = "wrong-token"
            handler._send_json.reset_mock()
            handler._handle_api("/api/v1/user/notes/export", {"save": ["1"]})
            save_export.assert_not_called()
            export_payload.assert_not_called()
            self.assertEqual(handler._send_json.call_args.kwargs["status"], 403)

            handler.headers[api_server.LOCAL_API_AUTH_HEADER] = "test-session-token"
            handler._send_json.reset_mock()
            handler._handle_api("/api/v1/user/notes/export", {"save": ["1"]})
            save_export.assert_called_once_with(payload)
            export_payload.assert_called_once_with()
            self.assertNotEqual(handler._send_json.call_args.kwargs.get("status"), 403)

            export_payload.reset_mock()
            save_export.reset_mock()
            handler.headers.pop(api_server.LOCAL_API_AUTH_HEADER)
            handler._handle_api("/api/v1/user/notes/export", {"download": ["1"]})
            export_payload.assert_called_once_with()
            save_export.assert_not_called()
            handler._send_text_download.assert_called_once()

    def test_bundle_save_requires_session_token_before_creating_export(self) -> None:
        class Logger:
            def write(self, *_args, **_kwargs) -> None:
                return None

        class Runtime:
            logger = Logger()
            save_calls = 0
            payload_calls = 0
            saved_payload = None

            def user_notes_export_payload(self):
                self.payload_calls += 1
                return {"ok": True, "summary": {"note_count": 0}}

            def export_user_notes_file_result(self, payload=None):
                self.save_calls += 1
                self.saved_payload = payload
                return {"ok": True}

            def user_notes_export_file_name(self):
                return "user-notes.md"

        runtime = Runtime()
        handler_type = run_local_server.build_handler(
            runtime,
            {"port": 18765},
            "bundle-session-token",
        )
        handler = object.__new__(handler_type)
        handler.path = "/api/v1/user/notes/export?save=1"
        handler.headers = {"Host": "127.0.0.1:18765"}
        handler.send_json = Mock()
        handler.send_text_download = Mock()

        handler.do_GET()

        self.assertEqual(runtime.save_calls, 0)
        self.assertEqual(handler.send_json.call_args.args[0], 403)

        handler.headers[run_local_server.AUTH_HEADER] = "wrong-token"
        handler.send_json.reset_mock()
        handler.do_GET()
        self.assertEqual(runtime.save_calls, 0)
        self.assertEqual(runtime.payload_calls, 0)
        self.assertEqual(handler.send_json.call_args.args[0], 403)

        handler.headers[run_local_server.AUTH_HEADER] = "bundle-session-token"
        handler.send_json.reset_mock()
        handler.do_GET()
        self.assertEqual(runtime.save_calls, 1)
        self.assertEqual(runtime.payload_calls, 1)
        self.assertEqual(runtime.saved_payload["summary"]["note_count"], 0)
        self.assertEqual(handler.send_json.call_args.args[0], 200)

        runtime.payload_calls = 0
        runtime.save_calls = 0
        handler.path = "/api/v1/user/notes/export?download=1"
        handler.headers = {"Host": "127.0.0.1:18765"}
        handler.do_GET()
        self.assertEqual(runtime.payload_calls, 1)
        self.assertEqual(runtime.save_calls, 0)
        handler.send_text_download.assert_called_once()

    def test_bundle_user_state_get_rejects_untrusted_host_before_reading(self) -> None:
        runtime = SimpleNamespace(
            list_notes=Mock(return_value={"ok": True, "notes": []}),
            logger=SimpleNamespace(write=lambda *_args, **_kwargs: None),
        )
        handler_type = run_local_server.build_handler(runtime, {"port": 18765}, "session-token")
        handler = object.__new__(handler_type)
        handler.path = "/api/v1/user/notes"
        handler.headers = {"Host": "attacker.example:18765"}
        handler.send_json = Mock()

        handler.do_GET()

        runtime.list_notes.assert_not_called()
        handler.send_json.assert_called_once_with(403, {"ok": False, "error": "invalid Host header"})

    def test_bundle_report_restore_forwards_version_hashes(self) -> None:
        fake_projection_api = SimpleNamespace(
            load_maturity_report_artifact=Mock(return_value={"ok": True}),
            create_envelope=Mock(side_effect=lambda value: value),
        )
        with patch.object(run_local_server, "projection_api", fake_projection_api):
            handler_type = run_local_server.build_handler(
                SimpleNamespace(),
                {"port": 18765},
                "bundle-session-token",
            )
            handler = object.__new__(handler_type)
            handler.path = (
                "/api/v1/maturity/reports/artifact"
                "?project_id=project-1&artifact_id=old-artifact&report_id=old-report"
                "&input_hash=current-input&result_hash=current-result"
            )
            handler.headers = {"Host": "127.0.0.1:18765"}
            handler.send_json = Mock()

            handler.do_GET()

        fake_projection_api.load_maturity_report_artifact.assert_called_once_with(
            project_id="project-1",
            artifact_id="old-artifact",
            report_id="old-report",
            input_hash="current-input",
            result_hash="current-result",
        )
        handler.send_json.assert_called_once_with(200, {"ok": True})

    def test_frontend_sends_write_headers_only_for_configured_directory_save(self) -> None:
        source = (ROOT / "frontend" / "capability-browser" / "dataClient.js").read_text(encoding="utf-8")
        self.assertIn("const headers = shouldSave ? await userWriteHeaders() : {};", source)
        self.assertIn("headers.Accept = accept;", source)

    def test_web_export_rejects_category_symlink_before_writing(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-web-export-category-link-") as temporary:
            export_root = Path(temporary) / "export"
            outside = Path(temporary) / "outside"
            export_root.mkdir()
            outside.mkdir()
            (export_root / "issues").symlink_to(outside, target_is_directory=True)
            original_export_dir = api_server.USER_EXPORT_DIR
            api_server.USER_EXPORT_DIR = export_root.resolve()
            try:
                with self.assertRaisesRegex(RuntimeError, "category path escapes configured export root"):
                    api_server.save_markdown_export(
                        {
                            "category": "issues",
                            "filename": "must-not-exist.md",
                            "content": "must not escape",
                        }
                    )
                self.assertEqual(list(outside.iterdir()), [])
            finally:
                api_server.USER_EXPORT_DIR = original_export_dir

    def test_shared_maturity_export_rejects_project_symlink_before_writing(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-shared-export-project-link-") as temporary:
            export_root = Path(temporary) / "export"
            category_root = export_root / "maturity-reports"
            outside = Path(temporary) / "outside"
            category_root.mkdir(parents=True)
            outside.mkdir()
            project = {"id": "project-link", "name": "Project Link"}
            project_directory_name = (
                f"{api_server._user_export_segment(project['name'], '成熟度评估项目')}__"
                f"{api_server._user_export_segment(project['id'], 'project')[:32]}"
            )
            (category_root / project_directory_name).symlink_to(outside, target_is_directory=True)
            original_export_dir = api_server.USER_EXPORT_DIR
            api_server.USER_EXPORT_DIR = export_root.resolve()
            try:
                with self.assertRaisesRegex(RuntimeError, "project path escapes configured export category"):
                    directory = api_server._user_export_project_directory("maturity-reports", project)
                    api_server._write_unique_user_export(directory, "must-not-exist.html", "must not escape")
                self.assertEqual(list(outside.iterdir()), [])
            finally:
                api_server.USER_EXPORT_DIR = original_export_dir

    def test_project_export_directory_identity_does_not_collide(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-project-export-identity-") as temporary:
            original_export_dir = api_server.USER_EXPORT_DIR
            api_server.USER_EXPORT_DIR = Path(temporary).resolve()
            try:
                first = api_server._user_export_project_directory(
                    "maturity-reports", {"id": "project/unsafe", "name": "同名项目"}
                )
                second = api_server._user_export_project_directory(
                    "maturity-reports", {"id": "project:unsafe", "name": "同名项目"}
                )
                self.assertNotEqual(first, second)
                legal = api_server._user_export_project_directory(
                    "maturity-reports", {"id": "project-safe", "name": "同名项目"}
                )
                self.assertEqual(legal.name, "同名项目__project-safe")
            finally:
                api_server.USER_EXPORT_DIR = original_export_dir

    def test_bundle_export_rejects_category_symlink_before_writing(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-bundle-export-category-link-") as temporary:
            export_root = Path(temporary) / "export"
            outside = Path(temporary) / "outside"
            export_root.mkdir()
            outside.mkdir()
            (export_root / "issues").symlink_to(outside, target_is_directory=True)
            runtime = object.__new__(run_local_server.BundleRuntime)
            runtime.export_dir = export_root.resolve()
            runtime.logger = Mock()

            with self.assertRaisesRegex(RuntimeError, "category path escapes configured export root"):
                runtime.save_markdown_export(
                    {
                        "category": "issues",
                        "filename": "must-not-exist.md",
                        "content": "must not escape",
                    }
                )
            self.assertEqual(list(outside.iterdir()), [])

    def test_bundle_export_allocates_unique_files_without_overwriting(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-bundle-export-collision-") as temporary:
            runtime = object.__new__(run_local_server.BundleRuntime)
            runtime.export_dir = Path(temporary)
            runtime.logger = Mock()
            runtime.user_notes_export_file_name = Mock(return_value="user-notes-export-fixed.md")

            def payload(marker: str) -> dict[str, object]:
                return {
                    "export_created_at": marker,
                    "source": {"bundle_root": marker, "user_database": "data/user/test.sqlite3"},
                    "summary": {
                        "note_count": 0,
                        "by_status": {},
                        "by_page_route": {},
                        "by_anchor_type": {},
                        "by_object_type": {},
                    },
                    "notes": [],
                }

            markers = [f"marker-{index}" for index in range(10)]
            first = runtime.export_user_notes_file(payload(markers[0]))
            first_bytes = first.read_bytes()
            second = runtime.export_user_notes_file(payload(markers[1]))
            with ThreadPoolExecutor(max_workers=8) as executor:
                remaining = list(executor.map(lambda marker: runtime.export_user_notes_file(payload(marker)), markers[2:]))
            paths = [first, second, *remaining]
            self.assertEqual(len(paths), len(set(paths)))
            self.assertEqual(len(list((Path(temporary) / "issues").glob("*.md"))), 10)
            self.assertEqual(first.read_bytes(), first_bytes)
            for marker, path in zip(markers, paths):
                self.assertIn(marker, path.read_text(encoding="utf-8"))

    def test_web_export_allocates_unique_files_without_overwriting(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-web-export-collision-") as temporary:
            original_export_dir = api_server.USER_EXPORT_DIR
            api_server.USER_EXPORT_DIR = Path(temporary).resolve()
            try:
                markers = [f"marker-{index}" for index in range(10)]

                def export(marker: str) -> Path:
                    result = api_server.save_markdown_export(
                        {
                            "category": "issues",
                            "filename": "fixed-export.md",
                            "content": marker,
                        }
                    )
                    return Path(str(result["outputPath"]))

                with ThreadPoolExecutor(max_workers=10) as executor:
                    paths = list(executor.map(export, markers))
                self.assertEqual(len(paths), len(set(paths)))
                self.assertEqual(len(list((Path(temporary) / "issues").glob("*.md"))), 10)
                for marker, path in zip(markers, paths):
                    self.assertEqual(path.read_text(encoding="utf-8"), marker)
            finally:
                api_server.USER_EXPORT_DIR = original_export_dir

    def test_bundle_markdown_export_allocates_unique_files_without_overwriting(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-bundle-markdown-collision-") as temporary:
            runtime = object.__new__(run_local_server.BundleRuntime)
            runtime.export_dir = Path(temporary)
            runtime.logger = Mock()
            markers = [f"marker-{index}" for index in range(10)]

            def export(marker: str) -> Path:
                result = runtime.save_markdown_export(
                    {
                        "category": "issues",
                        "filename": "fixed-export.md",
                        "content": marker,
                    }
                )
                return Path(str(result["output_path"]))

            with ThreadPoolExecutor(max_workers=10) as executor:
                paths = list(executor.map(export, markers))
            self.assertEqual(len(paths), len(set(paths)))
            self.assertEqual(len(list((Path(temporary) / "issues").glob("*.md"))), 10)
            for marker, path in zip(markers, paths):
                self.assertEqual(path.read_text(encoding="utf-8"), marker)

    def test_web_and_bundle_markdown_exports_share_filename_sanitization(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-export-name-parity-") as temporary:
            root = Path(temporary)
            original_export_dir = api_server.USER_EXPORT_DIR
            web_root = root / "web"
            web_root.mkdir()
            api_server.USER_EXPORT_DIR = web_root.resolve()
            runtime = object.__new__(run_local_server.BundleRuntime)
            runtime.export_dir = root / "bundle"
            runtime.logger = Mock()
            payload = {
                "category": "issues",
                "filename": "审计:报告?.md",
                "content": "same",
            }
            try:
                web_result = api_server.save_markdown_export(payload)
                bundle_result = runtime.save_markdown_export(payload)
                self.assertEqual(web_result["fileName"], bundle_result["file_name"])
                self.assertNotRegex(web_result["fileName"], r'[:?<>|*"\\/]')
                generated_payload = {
                    "category": "issues",
                    "filename_prefix": "安全/报告",
                    "content": "same generated name",
                }
                with patch.object(api_server.time, "strftime", return_value="20260805-000000Z"):
                    generated_web = api_server.save_markdown_export(generated_payload)
                    generated_bundle = runtime.save_markdown_export(generated_payload)
                self.assertEqual(generated_web["fileName"], generated_bundle["file_name"])
                self.assertEqual(generated_web["fileName"], "报告-20260805-000000Z.md")
            finally:
                api_server.USER_EXPORT_DIR = original_export_dir

    def test_bundle_export_job_file_is_replaced_atomically(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-bundle-export-job-atomic-") as temporary:
            output_path = Path(temporary) / "user-export-job.json"
            markers = [f"marker-{index}" for index in range(20)]

            def write(marker: str) -> None:
                run_local_server.BundleRuntime.write_text_atomically(
                    output_path,
                    json.dumps({"marker": marker, "payload": marker * 1000}),
                )

            with ThreadPoolExecutor(max_workers=10) as executor:
                list(executor.map(write, markers))

            payload = json.loads(output_path.read_text(encoding="utf-8"))
            self.assertIn(payload["marker"], markers)
            self.assertEqual(payload["payload"], payload["marker"] * 1000)
            self.assertEqual(list(Path(temporary).glob(".*.tmp")), [])


if __name__ == "__main__":
    unittest.main()
