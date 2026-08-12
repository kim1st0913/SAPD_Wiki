from __future__ import annotations

import json
import os
import platform
import signal
import socket
import subprocess
import tempfile
import threading
import time
import unittest
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / "scripts/run_project_test_suite.mjs"


class DeliveryReleaseControlTests(unittest.TestCase):
    def run_runner(self, *args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["node", str(RUNNER), *args],
            cwd=ROOT,
            env={**os.environ, **(env or {})},
            capture_output=True,
            text=True,
            check=False,
        )

    @contextmanager
    def serve_smoke_fixture(self, responder):
        requests: list[tuple[str, str]] = []

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:  # noqa: N802 - stdlib handler contract
                requests.append(("GET", urlsplit(self.path).path))
                responder(self, "GET", self.path)

            def do_POST(self) -> None:  # noqa: N802 - stdlib handler contract
                requests.append(("POST", urlsplit(self.path).path))
                length = int(self.headers.get("Content-Length") or "0")
                body = self.rfile.read(length) if length else b""
                responder(self, "POST", self.path, body)

            def log_message(self, format: str, *args: object) -> None:
                return

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_port}", requests
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def run_smoke(
        self,
        base_url: str,
        page: str,
        route: str,
        *,
        env: dict[str, str] | None = None,
        timeout: float | None = None,
    ) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                "node",
                str(ROOT / "scripts/frontend_smoke_check.mjs"),
                "--url",
                base_url,
                "--page",
                page,
                "--route",
                route,
            ],
            cwd=ROOT,
            env={**os.environ, **(env or {})},
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )

    @staticmethod
    def send_json(handler: BaseHTTPRequestHandler, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        handler.send_response(status)
        handler.send_header("Content-Type", "application/json")
        handler.send_header("Content-Length", str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)

    @staticmethod
    def send_text(handler: BaseHTTPRequestHandler, text: str, status: int = 200) -> None:
        body = text.encode("utf-8")
        handler.send_response(status)
        handler.send_header("Content-Type", "text/html; charset=utf-8")
        handler.send_header("Content-Length", str(len(body)))
        handler.end_headers()
        handler.wfile.write(body)

    def test_standalone_artifact_validation_reuses_explicit_build_stamp(self) -> None:
        stamp = "20260804-210000Z"
        result = self.run_runner(
            "--suite",
            "artifact-validation",
            "--include-dmg-build",
            "--build-stamp",
            stamp,
            "--dry-run",
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f"SAPD_WIKI_BUILD_STAMP={stamp}", result.stdout)
        self.assertNotIn("SAPD_WIKI_BUILD_STAMP=2026-", result.stdout)

    def test_standalone_artifact_validation_requires_a_build_stamp(self) -> None:
        result = self.run_runner(
            "--suite",
            "artifact-validation",
            "--include-dmg-build",
            "--dry-run",
            env={"SAPD_WIKI_BUILD_STAMP": ""},
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("standalone artifact-validation requires --build-stamp", result.stderr)

    def test_invalid_build_stamp_is_rejected(self) -> None:
        result = self.run_runner(
            "--suite",
            "artifact-validation",
            "--include-dmg-build",
            "--build-stamp",
            "latest",
            "--dry-run",
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must use YYYYMMDD-HHMMSSZ", result.stderr)

    def test_dry_run_reports_a_plan_instead_of_a_pass(self) -> None:
        result = self.run_runner("--suite", "static", "--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("result=dry-run", result.stdout)
        self.assertIn("executed=0", result.stdout)
        self.assertNotIn("result=pass", result.stdout)

    def test_full_groups_include_the_mcp_regression_suite(self) -> None:
        for selector in (("--full",), ("--suite", "release-full", "--include-dmg-build")):
            with self.subTest(selector=selector):
                result = self.run_runner(*selector, "--dry-run")
                self.assertEqual(result.returncode, 0, result.stderr)
                selected = result.stdout.splitlines()[0]
                self.assertIn("mcp", selected.split("=", 1)[1].split(","))

    def test_full_groups_include_core_content_import_and_electron_regressions_once(self) -> None:
        expected_commands = (
            "core-regressions:content-import",
            "core-regressions:electron",
        )
        for selector in (("--full",), ("--suite", "release-full", "--include-dmg-build")):
            with self.subTest(selector=selector):
                result = self.run_runner(*selector, "--dry-run")
                self.assertEqual(result.returncode, 0, result.stderr)
                for command_id in expected_commands:
                    self.assertEqual(result.stdout.count(f"command={command_id}\n"), 1, result.stdout)
                for module in (
                    "tests.test_content_candidate_t1",
                    "tests.test_content_release_pipeline",
                    "tests.test_import_approval_lifecycle",
                ):
                    self.assertIn(module, result.stdout)
                self.assertIn("npm --prefix apps/electron test", result.stdout)

    def test_runtime_maturity_smoke_does_not_persist_a_report_in_real_user_state(self) -> None:
        persistent_user_state = True
        template = {
            "version": "V2.1",
            "readOnly": True,
            "stats": {
                "capabilities": 32,
                "focuses": 91,
                "services": 160,
                "serviceMappings": 160,
                "platformEvidenceReferences": 6,
                "serviceItems": 154,
                "focusItems": 31,
                "scoreItems": 185,
            },
        }

        def responder(handler, method: str, raw_path: str, body: bytes = b"") -> None:
            path = urlsplit(raw_path).path
            if method == "GET" and path == "/api/v1/health":
                self.send_json(handler, {"data": {"status": "ok", "auth": {"session_token": "fixture-token"}, "runtime": {"user_database": {"persistent": persistent_user_state}}}})
                return
            if method == "GET" and path == "/api/v1/maturity/workspace":
                self.send_json(handler, {"data": {"dataState": "ready", "template": template, "projectDetails": {"demo-project-002": {"project": {"id": "demo-project-002", "status": "completed", "readOnly": True}, "template": template, "scoreEntries": []}}}})
                return
            if method == "GET" and path in {"/components/MaturityAssessmentWorkbench.js", "/maturity-assessment-workbench.css"}:
                self.send_text(handler, "fixture")
                return
            if method == "POST" and path == "/api/v1/maturity/template/validate":
                self.send_json(handler, {"data": {"valid": True, "snapshotId": "fixture"}})
                return
            if method == "POST" and path == "/api/v1/maturity/calculate":
                request = json.loads(body or b"{}")
                if request.get("project", {}).get("status") == "scoring":
                    self.send_json(handler, {"data": {"ok": True, "summary": {"statisticsReady": False, "targetBelowCurrentCount": 1, "resultAvailability": "incomplete"}}})
                else:
                    self.send_json(handler, {"data": {"ok": True, "summary": {"statisticsReady": True, "completionRate": 100, "targetAchievementRate": 100}, "calculationRun": {"algorithmVersion": "sapd-maturity-v2.2.0"}}})
                return
            if method == "POST" and path == "/api/v1/maturity/score/export":
                self.send_json(handler, {"data": {"ok": True, "package": {"schemaVersion": "maturity-score-exchange-v2.2", "fileInfo": {"structureHash": "fixture"}}}})
                return
            if method == "POST" and path == "/api/v1/maturity/report":
                self.send_json(handler, {"data": {"ok": False, "dataState": "assessment_incomplete", "error": "assessment_must_be_completed_before_report_generation"}})
                return
            if method == "GET":
                self.send_text(handler, '<!doctype html><base href="/">fixture')
                return
            self.send_json(handler, {"error": "not found"}, status=404)

        with self.serve_smoke_fixture(responder) as (base_url, requests):
            result = self.run_smoke(base_url, "maturity", "/workbench/maturity")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn(("POST", "/api/v1/maturity/report"), requests)
        summary = json.loads(result.stdout)
        self.assertTrue(summary["checks"]["maturityReport"]["skipped"])
        self.assertTrue(summary["checks"]["maturityUserStateBoundary"]["persistent"])

        persistent_user_state = False
        with self.serve_smoke_fixture(responder) as (base_url, requests):
            result = self.run_smoke(base_url, "maturity", "/workbench/maturity")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(("POST", "/api/v1/maturity/report"), requests)
        summary = json.loads(result.stdout)
        self.assertFalse(summary["checks"]["maturityUserStateBoundary"]["persistent"])
        self.assertFalse(summary["checks"]["maturityReport"].get("skipped", False))

    def test_lightweight_page_smoke_rejects_shell_and_health_only_service(self) -> None:
        def responder(handler, method: str, raw_path: str, body: bytes = b"") -> None:
            path = urlsplit(raw_path).path
            if method == "GET" and path == "/api/v1/health":
                self.send_json(handler, {"data": {"status": "ok"}})
                return
            if method == "GET" and not path.startswith("/api/"):
                self.send_text(handler, '<!doctype html><base href="/">fixture')
                return
            self.send_json(handler, {"error": "not found"}, status=404)

        cases = (
            ("search", "/search?q=M-PM.PR-00", "searchIndex"),
            ("environment", "/environment-mapping", "environmentWorkbench"),
            ("lifecycle", "/dev-lifecycle", "lifecycleWorkbench"),
            ("standards", "/standards/dsp-level-2", "standardsIndex"),
        )
        with self.serve_smoke_fixture(responder) as (base_url, _requests):
            for page, route, check_name in cases:
                with self.subTest(page=page):
                    result = self.run_smoke(base_url, page, route)
                    self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                    summary = json.loads(result.stdout)
                    self.assertFalse(summary["checks"][check_name]["ok"])

    def test_capability_smoke_rejects_http_200_without_business_payload(self) -> None:
        def responder(handler, method: str, raw_path: str, body: bytes = b"") -> None:
            path = urlsplit(raw_path).path
            if method == "GET" and path.startswith("/api/"):
                self.send_json(handler, {"data": {}})
                return
            self.send_text(handler, '<!doctype html><base href="/">fixture')

        with self.serve_smoke_fixture(responder) as (base_url, _requests):
            result = self.run_smoke(base_url, "capability", "/capability-mapping")

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        summary = json.loads(result.stdout)
        self.assertFalse(summary["checks"]["capabilityInitial"]["ok"])

    def test_capability_smoke_accepts_minimal_business_contract(self) -> None:
        def responder(handler, method: str, raw_path: str, body: bytes = b"") -> None:
            path = urlsplit(raw_path).path
            if method == "GET" and path == "/api/v1/capabilities/workspace-initial":
                self.send_json(
                    handler,
                    {
                        "data": {
                            "data_state": "ready",
                            "navigator": {
                                "tree": [
                                    {
                                        "id": "capability-category-fixture",
                                        "type": "capability_category",
                                        "title": "Fixture",
                                    }
                                ]
                            },
                            "compatibility": {"mode": "initial_projection"},
                        }
                    },
                )
                return
            if method == "GET" and path == "/api/v1/health":
                self.send_json(handler, {"data": {"status": "ok"}})
                return
            self.send_text(handler, '<!doctype html><base href="/">fixture')

        with self.serve_smoke_fixture(responder) as (base_url, _requests):
            result = self.run_smoke(base_url, "capability", "/capability-mapping")

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        summary = json.loads(result.stdout)
        self.assertTrue(summary["checks"]["capabilityInitial"]["ok"])

    def test_smoke_hanging_request_times_out_and_listener_is_released(self) -> None:
        release_request = threading.Event()

        def responder(handler, method: str, raw_path: str, body: bytes = b"") -> None:
            release_request.wait(timeout=5)

        started = time.monotonic()
        port = 0
        try:
            with self.serve_smoke_fixture(responder) as (base_url, _requests):
                port = urlsplit(base_url).port or 0
                result = self.run_smoke(
                    base_url,
                    "capability",
                    "/capability-mapping",
                    env={"SAPD_WIKI_SMOKE_REQUEST_TIMEOUT_MS": "250"},
                    timeout=2,
                )
        finally:
            release_request.set()

        self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertLess(time.monotonic() - started, 1.5)
        with self.assertRaises(OSError):
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                pass

    def test_resource_warning_gate_fails_leak_and_allows_closed_connection(self) -> None:
        gate = ROOT / "scripts/run_python_resource_warning_gate.py"
        python = ROOT / ".venv-local-mcp-web/bin/python"
        cases = {
            "leaked": (
                """
import sqlite3
import unittest

class ResourceProbe(unittest.TestCase):
    def test_connection(self):
        connection = sqlite3.connect(\":memory:\")
        connection.execute(\"SELECT 1\")
""",
                False,
            ),
            "closed": (
                """
import sqlite3
import unittest
from contextlib import closing

class ResourceProbe(unittest.TestCase):
    def test_connection(self):
        with closing(sqlite3.connect(\":memory:\")) as connection:
            connection.execute(\"SELECT 1\")
""",
                True,
            ),
        }
        for name, (source, should_pass) in cases.items():
            with self.subTest(name=name), tempfile.TemporaryDirectory(prefix="sapd-resource-gate-") as temporary:
                module = Path(temporary) / f"test_{name}_resource.py"
                module.write_text(source, encoding="utf-8")
                result = subprocess.run(
                    [str(python), str(gate), module.stem],
                    cwd=temporary,
                    env={**os.environ, "PYTHONPATH": os.pathsep.join([temporary, str(ROOT / "src")])},
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if should_pass:
                    self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                else:
                    self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
                    self.assertIn("ResourceWarning gate detected", result.stderr)

    def test_document_governance_uses_the_maximum_dated_heading(self) -> None:
        audit = ROOT / "scripts/audit_document_governance.mjs"
        source = "\n".join(
            [
                f'import {{ latestDatedHeading }} from "{audit.as_uri()}";',
                'console.log(latestDatedHeading("## 2026-08-05\\nold\\n## 2026-08-06\\nnew"));',
            ]
        )
        result = subprocess.run(
            ["node", "--input-type=module", "-e", source],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines()[-1], "2026-08-06")

    @unittest.skipUnless(os.name == "posix", "requires POSIX signals")
    def test_runner_forwards_termination_to_the_active_child(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-runner-signal-probe-") as temporary:
            probe = Path(temporary) / "probe.mjs"
            child_pid_path = Path(temporary) / "child.pid"
            probe.write_text(
                "\n".join(
                    [
                        f'import {{ runCommand }} from "{RUNNER.as_uri()}";',
                        "try {",
                        "  await runCommand({ id: 'signal-probe', bin: process.execPath, args: "
                        f"['-e', 'require(\"fs\").writeFileSync(process.argv[1], String(process.pid)); setInterval(() => {{}}, 1000)', {json.dumps(str(child_pid_path))}] "
                        "}, { includeDmgBuild: false });",
                        "} catch {}",
                    ]
                ),
                encoding="utf-8",
            )
            process = subprocess.Popen(
                ["node", str(probe)],
                cwd=ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            child_pid: int | None = None
            try:
                deadline = time.monotonic() + 5
                while process.poll() is None and time.monotonic() < deadline:
                    if child_pid_path.is_file():
                        child_pid = int(child_pid_path.read_text(encoding="utf-8"))
                        break
                    time.sleep(0.02)
                self.assertIsNotNone(child_pid, "runner did not start a child process")
                process.terminate()
                process.communicate(timeout=5)
                with self.assertRaises(ProcessLookupError):
                    os.kill(child_pid, 0)
            finally:
                if child_pid is not None:
                    try:
                        os.kill(child_pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                if process.poll() is None:
                    process.kill()
                    process.communicate(timeout=3)

    @unittest.skipUnless(os.name == "posix", "requires POSIX process groups")
    def test_runner_cleans_descendants_after_direct_child_exit(self) -> None:
        for direct_exit_code in (0, 7):
            with self.subTest(direct_exit_code=direct_exit_code), tempfile.TemporaryDirectory(prefix="sapd-runner-exit-tree-") as temporary:
                root = Path(temporary)
                grandchild = root / "grandchild.mjs"
                child = root / "child.mjs"
                probe = root / "probe.mjs"
                grandchild_pid_path = root / "grandchild.pid"
                grandchild.write_text(
                    "import fs from 'node:fs'; fs.writeFileSync(process.argv[2], String(process.pid)); setInterval(() => {}, 1000);",
                    encoding="utf-8",
                )
                child.write_text(
                    "\n".join(
                        [
                            "import fs from 'node:fs';",
                            "import { spawn } from 'node:child_process';",
                            "spawn(process.execPath, [process.argv[2], process.argv[3]], { stdio: 'ignore' });",
                            "for (let index = 0; index < 100 && !fs.existsSync(process.argv[3]); index += 1) await new Promise((resolve) => setTimeout(resolve, 10));",
                            f"process.exit({direct_exit_code});",
                        ]
                    ),
                    encoding="utf-8",
                )
                probe.write_text(
                    "\n".join(
                        [
                            f'import {{ runCommand }} from "{RUNNER.as_uri()}";',
                            "try {",
                            "  await runCommand({ id: 'exit-tree-probe', bin: process.execPath, args: "
                            f"[{json.dumps(str(child))}, {json.dumps(str(grandchild))}, {json.dumps(str(grandchild_pid_path))}] "
                            "}, { includeDmgBuild: false });",
                            "} catch {}",
                        ]
                    ),
                    encoding="utf-8",
                )
                grandchild_pid: int | None = None
                try:
                    result = subprocess.run(
                        ["node", str(probe)],
                        cwd=ROOT,
                        capture_output=True,
                        text=True,
                        timeout=5,
                        check=False,
                    )
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertTrue(grandchild_pid_path.is_file(), "descendant did not start")
                    grandchild_pid = int(grandchild_pid_path.read_text(encoding="utf-8"))
                    with self.assertRaises(ProcessLookupError):
                        os.kill(grandchild_pid, 0)
                finally:
                    if grandchild_pid is not None:
                        try:
                            os.kill(grandchild_pid, signal.SIGKILL)
                        except ProcessLookupError:
                            pass

    @unittest.skipUnless(os.name == "posix", "requires POSIX process groups")
    def test_runner_terminates_descendants_and_escalates_an_ignored_signal(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-runner-process-tree-") as temporary:
            root = Path(temporary)
            probe = root / "probe.mjs"
            child = root / "child.mjs"
            grandchild = root / "grandchild.mjs"
            child_pid_path = root / "child.pid"
            grandchild_pid_path = root / "grandchild.pid"
            grandchild.write_text(
                "import fs from 'node:fs'; fs.writeFileSync(process.argv[2], String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);",
                encoding="utf-8",
            )
            child.write_text(
                "\n".join(
                    [
                        "import fs from 'node:fs';",
                        "import { spawn } from 'node:child_process';",
                        "fs.writeFileSync(process.argv[2], String(process.pid));",
                        "spawn(process.execPath, [process.argv[3], process.argv[4]], { stdio: 'ignore' });",
                        "setInterval(() => {}, 1000);",
                    ]
                ),
                encoding="utf-8",
            )
            probe.write_text(
                "\n".join(
                    [
                        f'import {{ runCommand }} from "{RUNNER.as_uri()}";',
                        "try {",
                        "  await runCommand({ id: 'tree-probe', bin: process.execPath, args: "
                        f"[{json.dumps(str(child))}, {json.dumps(str(child_pid_path))}, "
                        f"{json.dumps(str(grandchild))}, {json.dumps(str(grandchild_pid_path))}] "
                        "}, { includeDmgBuild: false });",
                        "} catch {}",
                    ]
                ),
                encoding="utf-8",
            )
            process = subprocess.Popen(
                ["node", str(probe)],
                cwd=ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            child_pid: int | None = None
            grandchild_pid: int | None = None
            try:
                deadline = time.monotonic() + 5
                while process.poll() is None and time.monotonic() < deadline:
                    if child_pid_path.is_file() and grandchild_pid_path.is_file():
                        child_pid = int(child_pid_path.read_text(encoding="utf-8"))
                        grandchild_pid = int(grandchild_pid_path.read_text(encoding="utf-8"))
                        break
                    time.sleep(0.02)
                self.assertIsNotNone(child_pid, "runner did not start the direct child")
                self.assertIsNotNone(grandchild_pid, "direct child did not start its descendant")
                started = time.monotonic()
                process.terminate()
                process.communicate(timeout=5)
                self.assertLess(time.monotonic() - started, 4.5)
                for pid in (child_pid, grandchild_pid):
                    with self.assertRaises(ProcessLookupError):
                        os.kill(pid, 0)
            finally:
                for pid in (grandchild_pid, child_pid):
                    if pid is None:
                        continue
                    try:
                        os.kill(pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                if process.poll() is None:
                    process.kill()
                    process.communicate(timeout=3)

    @unittest.skipUnless(os.name == "posix", "requires POSIX signals")
    def test_runner_second_signal_force_kills_an_ignoring_child(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-runner-second-signal-") as temporary:
            root = Path(temporary)
            child_pid_path = root / "child.pid"
            probe = root / "probe.mjs"
            probe.write_text(
                "\n".join(
                    [
                        f'import {{ runCommand }} from "{RUNNER.as_uri()}";',
                        "try {",
                        "  await runCommand({ id: 'ignore-probe', bin: process.execPath, args: "
                        f"['-e', 'require(\"fs\").writeFileSync(process.argv[1], String(process.pid)); process.on(\"SIGTERM\", () => {{}}); setInterval(() => {{}}, 1000)', {json.dumps(str(child_pid_path))}] "
                        "}, { includeDmgBuild: false });",
                        "} catch {}",
                    ]
                ),
                encoding="utf-8",
            )
            process = subprocess.Popen(
                ["node", str(probe)],
                cwd=ROOT,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            child_pid: int | None = None
            try:
                deadline = time.monotonic() + 5
                while process.poll() is None and time.monotonic() < deadline:
                    if child_pid_path.is_file():
                        child_pid = int(child_pid_path.read_text(encoding="utf-8"))
                        break
                    time.sleep(0.02)
                self.assertIsNotNone(child_pid)
                process.terminate()
                time.sleep(0.05)
                process.terminate()
                process.communicate(timeout=2)
                with self.assertRaises(ProcessLookupError):
                    os.kill(child_pid, 0)
            finally:
                if child_pid is not None:
                    try:
                        os.kill(child_pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                if process.poll() is None:
                    process.kill()
                    process.communicate(timeout=3)

    def test_package_script_rejects_a_concurrent_owner_before_building(self) -> None:
        script = ROOT / "apps/macos/SAPDWiki/script/package_dmg.sh"
        with tempfile.TemporaryDirectory(prefix="sapd-package-lock-") as temporary:
            lock_file = Path(temporary) / "package.lock"
            holder = subprocess.Popen(["lockf", "-t", "0", "-k", str(lock_file), "sleep", "5"])
            try:
                time.sleep(0.1)
                result = subprocess.run(
                    ["bash", str(script)],
                    cwd=ROOT,
                    env={
                        **os.environ,
                        "SAPD_WIKI_PACKAGE_LOCK_DIR": str(lock_file),
                        "SAPD_WIKI_MATURITY_REPORT_SEED": str(Path(temporary) / "missing-seed"),
                    },
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("already locked", result.stderr)
                self.assertIsNone(holder.poll())
            finally:
                holder.terminate()
                holder.wait(timeout=2)

    def test_package_script_releases_lock_on_early_failure(self) -> None:
        script = ROOT / "apps/macos/SAPDWiki/script/package_dmg.sh"
        with tempfile.TemporaryDirectory(prefix="sapd-package-lock-cleanup-") as temporary:
            lock_dir = Path(temporary) / "package.lock"
            result = subprocess.run(
                ["bash", str(script)],
                cwd=ROOT,
                env={
                    **os.environ,
                    "SAPD_WIKI_PACKAGE_LOCK_DIR": str(lock_dir),
                    "SAPD_WIKI_MATURITY_REPORT_SEED": str(Path(temporary) / "missing-seed"),
                },
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("maturity report seed does not exist", result.stderr)
            self.assertTrue(lock_dir.is_file())

    def test_package_script_recovers_stale_lock_file_and_legacy_empty_directory(self) -> None:
        script = ROOT / "apps/macos/SAPDWiki/script/package_dmg.sh"
        with tempfile.TemporaryDirectory(prefix="sapd-package-lock-recovery-") as temporary:
            root = Path(temporary)
            for legacy_directory in (False, True):
                with self.subTest(legacy_directory=legacy_directory):
                    lock_path = root / f"package-{legacy_directory}.lock"
                    if legacy_directory:
                        lock_path.mkdir()
                    else:
                        lock_path.write_text("dead-owner", encoding="utf-8")
                    result = subprocess.run(
                        ["bash", str(script)],
                        cwd=ROOT,
                        env={
                            **os.environ,
                            "SAPD_WIKI_PACKAGE_LOCK_DIR": str(lock_path),
                            "SAPD_WIKI_PACKAGE_LOCK_STALE_SECONDS": "0",
                            "SAPD_WIKI_MATURITY_REPORT_SEED": str(root / "missing-seed"),
                        },
                        capture_output=True,
                        text=True,
                        check=False,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("maturity report seed does not exist", result.stderr)
                    self.assertTrue(lock_path.is_file())

    def test_package_script_never_overwrites_an_existing_dmg(self) -> None:
        script = ROOT / "apps/macos/SAPDWiki/script/package_dmg.sh"
        with tempfile.TemporaryDirectory(prefix="sapd-package-history-") as temporary:
            root = Path(temporary)
            seed = root / "seed"
            seed.mkdir()
            stamp = "20260805-120000Z"
            architecture = platform.machine()
            historical = root / "dist/license" / f"SAPD-Wiki-0.4.1-license-{stamp}-mac-{architecture}.dmg"
            historical.parent.mkdir(parents=True)
            historical.write_bytes(b"historical-dmg")
            result = subprocess.run(
                ["bash", str(script)],
                cwd=ROOT,
                env={
                    **os.environ,
                    "SAPD_WIKI_DIST_DIR": str(root / "dist"),
                    "SAPD_WIKI_PACKAGE_LOCK_DIR": str(root / "package.lock"),
                    "SAPD_WIKI_MATURITY_REPORT_SEED": str(seed),
                    "SAPD_WIKI_BUILD_STAMP": stamp,
                    "SAPD_WIKI_DMG_VARIANT": "license",
                },
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("refusing to overwrite existing historical DMG", result.stderr)
            self.assertEqual(historical.read_bytes(), b"historical-dmg")

    def test_package_image_staging_is_external_and_cleaned_on_exit(self) -> None:
        source = (ROOT / "apps/macos/SAPDWiki/script/package_dmg.sh").read_text(encoding="utf-8")
        prefix = source.split('if [[ ! -d "$MATURITY_REPORT_SEED" ]]', 1)[0]
        with tempfile.TemporaryDirectory(prefix="sapd-dmg-image-staging-") as temporary:
            temporary_root = Path(temporary)
            image_temp_root = temporary_root / "image-temp"
            probe_script = temporary_root / "image-staging-probe.sh"
            probe_script.write_text(
                prefix
                + '\nif [[ -n "${3:-}" ]]; then REPO_ROOT="$3"; fi\n'
                + "prepare_dmg_image_staging license\n"
                + 'printf \'%s\\n\' "$ACTIVE_DMG_IMAGE_STAGING" >"$1"\n'
                + 'ln -s /Applications "$ACTIVE_DMG_IMAGE_STAGING/Applications"\n'
                + 'exit "$2"\n',
                encoding="utf-8",
            )
            for exit_code in (0, 7):
                with self.subTest(exit_code=exit_code):
                    staging_path_file = temporary_root / f"staging-{exit_code}.txt"
                    result = subprocess.run(
                        ["bash", str(probe_script), str(staging_path_file), str(exit_code), str(ROOT)],
                        env={
                            **os.environ,
                            "SAPD_WIKI_DMG_TEMP_ROOT": str(image_temp_root),
                            "SAPD_WIKI_INTERNAL_PACKAGE_LOCK_HELD": "1",
                        },
                        capture_output=True,
                        text=True,
                        check=False,
                    )
                    self.assertEqual(result.returncode, exit_code, result.stderr)
                    staging_path = Path(staging_path_file.read_text(encoding="utf-8").strip())
                    self.assertEqual(staging_path.parent, image_temp_root.resolve())
                    self.assertFalse(staging_path.exists())

            repository_alias = temporary_root / "repository-alias"
            repository_alias.symlink_to(ROOT, target_is_directory=True)
            rejected = subprocess.run(
                ["bash", str(probe_script), str(temporary_root / "rejected.txt"), "0", str(ROOT)],
                env={
                    **os.environ,
                    "SAPD_WIKI_DMG_TEMP_ROOT": str(repository_alias),
                    "SAPD_WIKI_INTERNAL_PACKAGE_LOCK_HELD": "1",
                },
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(rejected.returncode, 0)
            self.assertIn("DMG temporary staging must be outside the repository", rejected.stderr)

    def test_direct_macos_build_requires_content_asset_database_before_building(self) -> None:
        script = ROOT / "apps/macos/SAPDWiki/script/build_and_run.sh"
        with tempfile.TemporaryDirectory(prefix="sapd-required-content-asset-") as temporary:
            missing = Path(temporary) / "missing-content-assets.sqlite3"
            app = ROOT / "apps/macos/SAPDWiki/dist/SAPD Wiki.app"
            before_mtime = app.stat().st_mtime_ns if app.exists() else None
            result = subprocess.run(
                ["bash", str(script), "build"],
                cwd=ROOT,
                env={
                    **os.environ,
                    "SAPD_WIKI_CONTENT_ASSET_DB": str(missing),
                    "SAPD_WIKI_PACKAGE_LOCK_DIR": str(Path(temporary) / "package.lock"),
                },
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("required content asset database does not exist", result.stderr)
            self.assertEqual(app.stat().st_mtime_ns if app.exists() else None, before_mtime)

    def test_package_signal_handler_exits_before_releasing_the_lock(self) -> None:
        source = (ROOT / "apps/macos/SAPDWiki/script/package_dmg.sh").read_text(encoding="utf-8")
        prefix = source.split('if [[ ! -d "$MATURITY_REPORT_SEED" ]]', 1)[0]
        self.assertIn("trap 'terminate_package 143' TERM", prefix)
        self.assertIn("run_package_command env", source)
        self.assertIn("run_package_command hdiutil create", source)
        with tempfile.TemporaryDirectory(prefix="sapd-package-signal-lock-") as temporary:
            temporary_root = Path(temporary)
            lock_dir = temporary_root / "package.lock"
            lock_dir.touch()
            image_temp_root = temporary_root / "image-temp"
            staging_path_file = temporary_root / "staging-path.txt"
            probe_script = temporary_root / "package-lock-probe.sh"
            probe_script.write_text(
                prefix
                + "\nprepare_dmg_image_staging license\n"
                + 'printf \'%s\\n\' "$ACTIVE_DMG_IMAGE_STAGING" >"$1"\n'
                + 'ln -s /Applications "$ACTIVE_DMG_IMAGE_STAGING/Applications"\n'
                + "run_package_command sleep 5\n",
                encoding="utf-8",
            )
            process = subprocess.Popen(
                ["bash", str(probe_script), str(staging_path_file)],
                env={
                    **os.environ,
                    "SAPD_WIKI_PACKAGE_LOCK_DIR": str(lock_dir),
                    "SAPD_WIKI_DMG_TEMP_ROOT": str(image_temp_root),
                    "SAPD_WIKI_INTERNAL_PACKAGE_LOCK_HELD": "1",
                },
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            time.sleep(0.1)
            self.assertIsNone(process.poll())
            self.assertTrue(lock_dir.is_file(), process.communicate(timeout=1)[1] if process.poll() is not None else "")
            staging_path = Path(staging_path_file.read_text(encoding="utf-8").strip())
            self.assertTrue((staging_path / "Applications").is_symlink())
            started = time.monotonic()
            process.terminate()
            process.communicate(timeout=1)
            self.assertLess(time.monotonic() - started, 1)
            self.assertEqual(process.returncode, 143)
            self.assertTrue(lock_dir.is_file())
            self.assertFalse(staging_path.exists())

    def test_direct_app_build_participates_in_the_package_lock(self) -> None:
        script = ROOT / "apps/macos/SAPDWiki/script/build_and_run.sh"
        with tempfile.TemporaryDirectory(prefix="sapd-direct-build-lock-") as temporary:
            lock_file = Path(temporary) / "package.lock"
            holder = subprocess.Popen(["lockf", "-t", "0", "-k", str(lock_file), "sleep", "5"])
            try:
                time.sleep(0.1)
                result = subprocess.run(
                    ["bash", str(script), "build"],
                    cwd=ROOT,
                    env={**os.environ, "SAPD_WIKI_PACKAGE_LOCK_DIR": str(lock_file)},
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("already locked", result.stderr)
            finally:
                holder.terminate()
                holder.wait(timeout=2)

    def test_direct_app_build_terminates_its_running_child_before_releasing_lock(self) -> None:
        source = (ROOT / "apps/macos/SAPDWiki/script/build_and_run.sh").read_text(encoding="utf-8")
        prefix = source.split('export CLANG_MODULE_CACHE_PATH=', 1)[0]
        self.assertIn("trap 'terminate_build 143' TERM", prefix)
        self.assertIn('run_build_command "$SCRIPT_DIR/build_and_run.sh" --internal-stage', source)
        with tempfile.TemporaryDirectory(prefix="sapd-direct-build-signal-") as temporary:
            temporary_root = Path(temporary)
            lock_dir = temporary_root / "package.lock"
            lock_dir.touch()
            probe_script = temporary_root / "build-lock-probe.sh"
            probe_script.write_text(
                prefix
                + "\nacquire_package_lock\n"
                + "run_build_command sleep 5\n",
                encoding="utf-8",
            )
            process = subprocess.Popen(
                ["bash", str(probe_script)],
                env={
                    **os.environ,
                    "SAPD_WIKI_PACKAGE_LOCK_DIR": str(lock_dir),
                    "SAPD_WIKI_INTERNAL_PACKAGE_LOCK_HELD": "1",
                },
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            time.sleep(0.1)
            self.assertIsNone(process.poll())
            self.assertTrue(lock_dir.is_file(), process.communicate(timeout=1)[1] if process.poll() is not None else "")
            started = time.monotonic()
            process.terminate()
            process.communicate(timeout=1)
            self.assertLess(time.monotonic() - started, 1)
            self.assertEqual(process.returncode, 143)
            self.assertTrue(lock_dir.is_file())

    def test_internal_package_lock_handoff_requires_the_owner_directory(self) -> None:
        script = ROOT / "apps/macos/SAPDWiki/script/build_and_run.sh"
        with tempfile.TemporaryDirectory(prefix="sapd-package-lock-handoff-") as temporary:
            lock_dir = Path(temporary) / "missing-package.lock"
            result = subprocess.run(
                ["bash", str(script), "build"],
                cwd=ROOT,
                env={
                    **os.environ,
                    "SAPD_WIKI_PACKAGE_LOCK_DIR": str(lock_dir),
                    "SAPD_WIKI_INTERNAL_PACKAGE_LOCK_HELD": "1",
                },
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("internal package lock handoff is invalid", result.stderr)


if __name__ == "__main__":
    unittest.main()
