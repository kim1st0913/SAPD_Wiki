from __future__ import annotations

import importlib.util
import json
import os
import plistlib
import re
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import Mock, patch

from scripts.create_user_db import initialize_user_db


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "verify_mac_dmg_artifacts.py"
SPEC = importlib.util.spec_from_file_location("verify_mac_dmg_artifacts", SCRIPT)
assert SPEC and SPEC.loader
verifier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verifier)


class VerifyMacDmgArtifactsTests(unittest.TestCase):
    def test_content_asset_database_is_required_and_matches_manifest_hash(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-mac-content-asset-") as temporary:
            runtime = Path(temporary) / "Runtime"
            asset = runtime / "data/base/sapd_content_assets.sqlite3"
            asset.parent.mkdir(parents=True)
            asset.write_bytes(b"content-assets")
            manifest = {
                "content_asset_database": {
                    "file": asset.name,
                    "sha256": verifier.sha256_file(asset),
                }
            }
            self.assertEqual(
                verifier._verify_required_content_asset_database(runtime, manifest),
                verifier.sha256_file(asset),
            )
            with self.assertRaisesRegex(RuntimeError, "manifest declaration is missing"):
                verifier._verify_required_content_asset_database(runtime, {})
            asset.write_bytes(b"tampered")
            with self.assertRaisesRegex(RuntimeError, "hash mismatch"):
                verifier._verify_required_content_asset_database(runtime, manifest)
            asset.unlink()
            with self.assertRaisesRegex(RuntimeError, "is missing"):
                verifier._verify_required_content_asset_database(runtime, manifest)

    def test_runtime_api_smoke_allows_realistic_frozen_backend_cold_start(self) -> None:
        self.assertGreaterEqual(verifier.RUNTIME_API_SMOKE_TIMEOUT_SECONDS, 45)
        self.assertEqual(
            verifier._smoke_runtime_api.__kwdefaults__["timeout_seconds"],
            verifier.RUNTIME_API_SMOKE_TIMEOUT_SECONDS,
        )

    def test_runtime_api_probe_forces_loopback_requests_to_bypass_proxies(self) -> None:
        class Response:
            def __init__(self, body: bytes):
                self.status = 200
                self.body = body

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def read(self):
                return self.body

        opener = Mock()

        def response_for(request, **_kwargs):
            if request.full_url.endswith("/api/v1/health"):
                return Response(b'{"ok": true}')
            if request.full_url.endswith("/api/v1/knowledge/version") or request.full_url.endswith("/api/v1/data-packages"):
                return Response(b'{"data": {}}')
            return Response(b"<html><body>ok</body></html>")

        opener.open.side_effect = response_for
        with patch.object(verifier, "build_opener", return_value=opener) as build:
            evidence = verifier._probe_runtime_api("http://127.0.0.1:19001")
        proxy_handler = build.call_args.args[0]
        self.assertIsInstance(proxy_handler, verifier.ProxyHandler)
        self.assertEqual(proxy_handler.proxies, {})
        self.assertEqual(opener.open.call_count, 4)
        self.assertEqual(evidence["/"]["status"], 200)

    def test_build_script_runtime_fingerprint_program_emits_valid_marker(self) -> None:
        build_script = (ROOT / "apps/macos/SAPDWiki/script/build_and_run.sh").read_text(encoding="utf-8")
        match = re.search(
            r"write_runtime_fingerprint\(\) \{.*?<<'PY'\n(?P<program>.*?)\nPY\n\}",
            build_script,
            re.DOTALL,
        )
        self.assertIsNotNone(match)
        with tempfile.TemporaryDirectory(prefix="sapd-runtime-fingerprint-program-") as temporary:
            runtime = Path(temporary)
            manifest = runtime / "data/base/base-manifest.json"
            manifest.parent.mkdir(parents=True)
            manifest.write_text(
                json.dumps({"app_version": "0.4.0", "build_time": "ignored"}),
                encoding="utf-8",
            )
            result = subprocess.run(
                [sys.executable, "-", str(runtime)],
                input=match.group("program"),
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            recorded = (runtime / ".sapd-runtime-fingerprint").read_text(encoding="utf-8").strip()
            self.assertRegex(recorded, r"^[0-9a-f]{64}$")
            self.assertIn(f"runtime_fingerprint={recorded}", result.stdout)

    def test_version_and_build_stamp_are_bound_to_the_current_release_environment(self) -> None:
        with patch.dict(os.environ, {"SAPD_WIKI_APP_VERSION": "9.9.9", "SAPD_WIKI_BUILD_STAMP": "20260804-120000Z"}, clear=False):
            self.assertEqual(verifier.current_app_version(), "9.9.9")
            self.assertEqual(verifier.current_build_stamp(), "20260804-120000Z")
            path = verifier.artifact_path("9.9.9", verifier.current_build_stamp(), "arm64", "license")
        self.assertEqual(path.name, "SAPD-Wiki-9.9.9-license-20260804-120000Z-mac-arm64.dmg")

    def test_missing_build_stamp_is_rejected_instead_of_selecting_an_old_dmg(self) -> None:
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "must identify the current release build"):
                verifier.current_build_stamp()

    def test_runtime_api_smoke_uses_isolated_config_and_stops_backend(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-runtime-api-smoke-") as temporary:
            runtime = Path(temporary)
            config_path = runtime / "config/app-config.json"
            config_path.parent.mkdir(parents=True)
            config_path.write_text(
                json.dumps({"preferred_port": 18765, "fallback_ports": [18766], "mcp_platform_integration": True}),
                encoding="utf-8",
            )
            backend = runtime / "SAPD-Wiki-Backend"
            backend.write_bytes(b"backend")
            process = Mock()
            process.poll.return_value = None
            process.wait.return_value = 0
            expected = {"/api/v1/health": {"ok": True}}
            with patch.object(verifier, "_available_loopback_port", return_value=19001), patch.object(verifier, "_probe_runtime_api", return_value=expected) as probe, patch.object(verifier.subprocess, "Popen", return_value=process) as popen:
                self.assertEqual(verifier._smoke_runtime_api(runtime, backend), expected)
            isolated = json.loads(config_path.read_text(encoding="utf-8"))
            self.assertEqual(isolated["preferred_port"], 19001)
            self.assertEqual(isolated["fallback_ports"], [])
            self.assertFalse(isolated["open_browser_on_start"])
            self.assertFalse(isolated["mcp_platform_integration"])
            popen.assert_called_once()
            probe.assert_called_once_with("http://127.0.0.1:19001")
            process.terminate.assert_called_once()
            process.wait.assert_called_once_with(timeout=5)

    def test_mounted_app_validation_checks_versions_license_user_db_backend_and_runtime(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-dmg-verifier-") as temporary:
            root = Path(temporary)
            volume = root / "volume"
            app = volume / "SAPD Wiki.app"
            contents = app / "Contents"
            runtime = contents / "Resources" / "Runtime"
            backend = runtime / "SAPD-Wiki-Backend"
            backend.parent.mkdir(parents=True)
            backend.write_bytes(b"current backend")
            backend.chmod(0o755)
            for relative in (
                "start-macos.command",
                "stop-macos.command",
                "diagnostics/export-diagnostics.command",
                "diagnostics/export-user-notes.command",
            ):
                command = runtime / relative
                command.parent.mkdir(parents=True, exist_ok=True)
                command.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
                command.chmod(0o755)
            current_backend = root / "current-backend"
            current_backend.write_bytes(backend.read_bytes())
            current_backend.chmod(0o755)
            (runtime / "app/frontend-dist").mkdir(parents=True)
            (runtime / "app/frontend-dist/index.html").write_text("ok", encoding="utf-8")
            (runtime / "config").mkdir()
            (runtime / "config/app-config.json").write_text("{}", encoding="utf-8")
            (runtime / "data/base").mkdir(parents=True)
            (runtime / "data/base/sapd_wiki_base.sqlite3").write_bytes(b"base")
            content_asset = runtime / "data/base/sapd_content_assets.sqlite3"
            content_asset.write_bytes(b"content-assets")
            source_sha256, source_file_count = verifier.tree_sha256(
                ROOT / "frontend/capability-browser",
                excluded_suffixes=verifier.FRONTEND_SOURCE_ARTIFACT_SUFFIXES,
            )
            runtime_sha256, runtime_file_count = verifier.tree_sha256(runtime / "app/frontend-dist")
            (runtime / "data/base/base-manifest.json").write_text(
                json.dumps(
                    {
                        "app_version": "0.4.0",
                        "platform": "mac-arm64",
                        "content_asset_database": {
                            "file": content_asset.name,
                            "sha256": verifier.sha256_file(content_asset),
                        },
                        "frontend": {
                            "source_sha256": source_sha256,
                            "source_file_count": source_file_count,
                            "runtime_sha256": runtime_sha256,
                            "runtime_file_count": runtime_file_count,
                        }
                    }
                ),
                encoding="utf-8",
            )
            user_db = runtime / "data/user/sapd_wiki_user.sqlite3"
            initialize_user_db(user_db, "user_schema_0.3")
            (contents / "MacOS").mkdir()
            (contents / "MacOS/SAPDWiki").write_bytes(b"app binary")
            with (contents / "Info.plist").open("wb") as handle:
                plistlib.dump(
                    {
                        "CFBundleShortVersionString": "0.4.0",
                        "SAPDWikiDisplayVersion": "0.4.0",
                        "SAPDWikiLicenseMode": "license",
                    },
                    handle,
                )
            volume.mkdir(exist_ok=True)
            (volume / "Applications").symlink_to("/Applications")
            (runtime / ".sapd-runtime-fingerprint").write_text("a" * 64 + "\n", encoding="utf-8")

            with patch.object(verifier, "_macho_architectures", return_value={"arm64"}), patch.object(verifier, "_smoke_runtime_api", return_value={"/api/v1/health": {"ok": True}}) as smoke, patch.object(verifier.subprocess, "run") as run:
                evidence = verifier._verify_mounted_app(
                    volume,
                    version="0.4.0",
                    variant="license",
                    architecture="arm64",
                    current_backend=current_backend,
                )

            self.assertRegex(evidence["app_binary_sha256"], r"^[0-9a-f]{64}$")
            self.assertRegex(evidence["runtime_core_sha256"], r"^[0-9a-f]{64}$")
            self.assertEqual(evidence["content_asset_database_sha256"], verifier.sha256_file(content_asset))
            commands = [call.args[0] for call in run.call_args_list]
            self.assertIn(["codesign", "--verify", "--deep", "--strict", str(app)], commands)
            self.assertTrue(any(command[-1] == "--check-only" for command in commands))
            smoke.assert_called_once()

            manifest_path = runtime / "data/base/base-manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["app_version"] = "9.9.9"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            with patch.object(verifier, "_macho_architectures", return_value={"arm64"}), self.assertRaisesRegex(RuntimeError, "version/platform mismatch"):
                verifier._verify_mounted_app(
                    volume,
                    version="0.4.0",
                    variant="license",
                    architecture="arm64",
                    current_backend=current_backend,
                )
            manifest["app_version"] = "0.4.0"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")

            with (contents / "Info.plist").open("wb") as handle:
                plistlib.dump(
                    {
                        "CFBundleShortVersionString": "0.4.0",
                        "SAPDWikiDisplayVersion": "0.4.0",
                        "SAPDWikiLicenseMode": "no-license",
                    },
                    handle,
                )
            with self.assertRaisesRegex(RuntimeError, "SAPDWikiLicenseMode"):
                verifier._verify_mounted_app(
                    volume,
                    version="0.4.0",
                    variant="license",
                    architecture="arm64",
                    current_backend=current_backend,
                )

    def test_user_database_rejects_data_outside_notes(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-dmg-user-db-") as temporary:
            user_db = Path(temporary) / "sapd_wiki_user.sqlite3"
            initialize_user_db(user_db, "user_schema_0.3")
            verifier._verify_user_database(user_db)
            with closing(sqlite3.connect(user_db)) as connection, connection:
                connection.execute(
                    "INSERT INTO user_favorites(id, target_ref) VALUES ('favorite-1', 'capability:test')"
                )
            with self.assertRaisesRegex(RuntimeError, "not an empty current-schema seed"):
                verifier._verify_user_database(user_db)

            user_db.unlink()
            initialize_user_db(user_db, "user_schema_0.3")
            with closing(sqlite3.connect(user_db)) as connection, connection:
                connection.execute("ALTER TABLE user_favorites RENAME TO user_favorites_original")
                connection.execute("CREATE TABLE user_favorites(id TEXT PRIMARY KEY)")
                connection.execute("DROP TABLE user_favorites_original")
            with self.assertRaisesRegex(RuntimeError, "not an empty current-schema seed"):
                verifier._verify_user_database(user_db)

            user_db.unlink()
            initialize_user_db(user_db, "user_schema_0.3")
            with closing(sqlite3.connect(user_db)) as connection, connection:
                connection.execute("CREATE TABLE leaked_private_data(secret TEXT NOT NULL)")
                connection.execute("INSERT INTO leaked_private_data(secret) VALUES ('private')")
            with self.assertRaisesRegex(RuntimeError, "not an empty current-schema seed"):
                verifier._verify_user_database(user_db)

    def test_backend_source_stamp_must_match_current_source(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-backend-source-stamp-") as temporary:
            root = Path(temporary)
            source = root / "src/sapd_wiki/api_server.py"
            source.parent.mkdir(parents=True)
            source.write_text("current = True\n", encoding="utf-8")
            backend = root / "apps/macos/SAPDWiki/.build/backend-work/backend/mac-arm64/SAPD-Wiki-Backend"
            backend.parent.mkdir(parents=True)
            backend.write_bytes(b"backend")
            stamp = backend.parents[2] / "backend-source.sha256"
            with patch.object(verifier, "ROOT", root):
                stamp.write_text(verifier.backend_source_sha256(), encoding="utf-8")
                verifier._verify_current_backend_source_stamp(backend)
                source.write_text("current = False\n", encoding="utf-8")
                with self.assertRaisesRegex(RuntimeError, "backend binary is stale"):
                    verifier._verify_current_backend_source_stamp(backend)

    def test_runtime_core_digest_reads_valid_build_marker_without_rehashing_signed_tree(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-runtime-core-") as temporary:
            runtime = Path(temporary)
            files = {
                "start-macos.command": "start",
                "stop-macos.command": "stop",
                "diagnostics/export.command": "diagnostics",
                "config/app-config.json": "{}",
                "config/extra.json": "{}",
                "data/base/base-manifest.json": json.dumps({"app_version": "0.4.0", "build_time": "one"}),
            }
            for relative, content in files.items():
                path = runtime / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")
            (runtime / ".sapd-runtime-fingerprint").write_text("a" * 64 + "\n", encoding="utf-8")
            initial = verifier._runtime_core_digest(runtime)
            (runtime / "data/base/base-manifest.json").write_text(
                json.dumps({"app_version": "0.4.0", "build_time": "two"}),
                encoding="utf-8",
            )
            (runtime / "README-FIRST.md").write_text("variant-specific", encoding="utf-8")
            self.assertEqual(verifier._runtime_core_digest(runtime), initial)
            (runtime / "config/extra.json").write_text('{"changed":true}', encoding="utf-8")
            self.assertEqual(verifier._runtime_core_digest(runtime), initial)
            (runtime / ".sapd-runtime-fingerprint").write_text("invalid\n", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "fingerprint is invalid"):
                verifier._runtime_core_digest(runtime)

    def test_runtime_commands_must_be_regular_executable_files(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-runtime-commands-") as temporary:
            runtime = Path(temporary)
            required = (
                "SAPD-Wiki-Backend",
                "start-macos.command",
                "stop-macos.command",
                "diagnostics/export-diagnostics.command",
                "diagnostics/export-user-notes.command",
            )
            for relative in required:
                path = runtime / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("#!/bin/sh\nexit 0\n", encoding="utf-8")
                path.chmod(0o755)
            verifier._verify_runtime_commands(runtime)
            target = runtime / "start-macos.command"
            target.chmod(0o644)
            with self.assertRaisesRegex(RuntimeError, "not executable"):
                verifier._verify_runtime_commands(runtime)

    def test_runtime_tree_rejects_symbolic_links(self) -> None:
        with tempfile.TemporaryDirectory(prefix="sapd-runtime-symlink-") as temporary:
            runtime = Path(temporary)
            external = runtime.parent / "external-runtime-file"
            external.write_text("outside", encoding="utf-8")
            (runtime / "linked").symlink_to(external)
            with self.assertRaisesRegex(RuntimeError, "must not contain symbolic links"):
                verifier._reject_symbolic_links(runtime, "mounted Runtime")
            external.unlink()


if __name__ == "__main__":
    unittest.main()
