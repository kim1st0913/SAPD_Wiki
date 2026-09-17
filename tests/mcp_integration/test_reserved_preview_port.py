from __future__ import annotations

import argparse
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

from sapd_wiki import api_server


ROOT = Path(__file__).resolve().parents[2]


def serve_args(**overrides: object) -> argparse.Namespace:
    values: dict[str, object] = {
        "port": 5173,
        "static_dir": "frontend/capability-browser",
        "base_db": None,
        "db": str(api_server.DEFAULT_DB_PATH),
        "user_db": None,
        "ephemeral_user_state": False,
        "data_root": None,
        "export_dir": None,
        "runtime_label": "stable",
        "mcp_port": 28775,
        "mcp_runtime_root": None,
    }
    values.update(overrides)
    return argparse.Namespace(**values)


def load_dev_server_guard():
    path = ROOT / "scripts" / "dev_server_guard.py"
    spec = importlib.util.spec_from_file_location("sapd_dev_server_guard", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("failed to load dev_server_guard")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ReservedPreviewPortTests(unittest.TestCase):
    def test_guard_batch1_projection_routes_all_200_pass(self) -> None:
        guard = load_dev_server_guard()
        responses = [
            {"status": 200, "ok": True, "time_seconds": 0.01},
            {"status": 200, "ok": True, "time_seconds": 0.02},
            {"status": 200, "ok": True, "time_seconds": 0.03},
        ]
        with patch.object(guard, "http_status", side_effect=responses) as request:
            routes = guard.batch1_projection_route_statuses(5173)

        self.assertEqual(
            [call.args[0] for call in request.call_args_list],
            [
                f"http://127.0.0.1:5173{path}"
                for path in guard.BATCH1_PROJECTION_ROUTES.values()
            ],
        )
        self.assertEqual(
            routes,
            {
                "capability_catalog": {
                    "status": 200,
                    "ok": True,
                    "time_seconds": 0.01,
                },
                "maintenance": {
                    "status": 200,
                    "ok": True,
                    "time_seconds": 0.02,
                },
                "shared_lookups": {
                    "status": 200,
                    "ok": True,
                    "time_seconds": 0.03,
                },
            },
        )
        self.assertEqual(
            guard.guard_result(
                stop_only=False,
                home={"ok": True},
                health={"ok": True},
                workspace_projection={"ok": True},
                batch1_projection_routes=routes,
                has_project_server=True,
                profile_ok=True,
            ),
            "pass",
        )

    def test_guard_batch1_projection_404_or_503_warns_and_restarts(self) -> None:
        guard = load_dev_server_guard()
        for status in (404, 503):
            with self.subTest(status=status):
                routes = {
                    name: {
                        "status": status if name == "maintenance" else 200,
                        "ok": name != "maintenance",
                        "time_seconds": 0.01,
                    }
                    for name in guard.BATCH1_PROJECTION_ROUTES
                }
                self.assertEqual(
                    guard.guard_result(
                        stop_only=False,
                        home={"ok": True},
                        health={"ok": True},
                        workspace_projection={"ok": True},
                        batch1_projection_routes=routes,
                        has_project_server=True,
                        profile_ok=True,
                    ),
                    "warn",
                )
                self.assertTrue(
                    guard.existing_server_requires_restart(
                        [{"is_project_server": True}],
                        {"ok": True, "json": {"data": {"runtime": {}}}},
                        {},
                        routes,
                    )
                )

    def test_guard_stop_only_still_passes_without_server(self) -> None:
        guard = load_dev_server_guard()
        self.assertEqual(
            guard.guard_result(
                stop_only=True,
                home={"ok": False},
                health={"ok": False},
                workspace_projection={"ok": False},
                batch1_projection_routes={},
                has_project_server=False,
                profile_ok=False,
            ),
            "pass",
        )

    def test_guard_prefers_isolated_mcp_python_for_integrated_web_runtime(self) -> None:
        guard = load_dev_server_guard()
        with self.subTest("local MCP runtime"):
            self.assertEqual(
                guard.server_python_executable(),
                ROOT / ".venv-local-mcp-web" / "bin" / "python",
            )

    def test_stable_default_runtime_is_allowed_on_5173(self) -> None:
        self.assertEqual(api_server.reserved_preview_port_blockers(serve_args()), [])

    def test_dev_runtime_is_blocked_on_5173(self) -> None:
        with self.assertRaisesRegex(ValueError, "reserved for the stable"):
            api_server.validate_reserved_preview_runtime(
                serve_args(runtime_label="dev")
            )

    def test_ephemeral_runtime_is_blocked_on_5173(self) -> None:
        with self.assertRaisesRegex(ValueError, "ephemeral user state"):
            api_server.validate_reserved_preview_runtime(
                serve_args(ephemeral_user_state=True)
            )

    def test_synthetic_database_is_blocked_on_5173(self) -> None:
        with self.assertRaisesRegex(ValueError, "base_db"):
            api_server.validate_reserved_preview_runtime(
                serve_args(base_db="/private/tmp/synthetic-base.sqlite3")
            )

    def test_fixture_runtime_is_allowed_on_non_reserved_port(self) -> None:
        api_server.validate_reserved_preview_runtime(
            serve_args(
                port=5187,
                runtime_label="dev",
                ephemeral_user_state=True,
                base_db="/private/tmp/synthetic-base.sqlite3",
                mcp_runtime_root="/private/tmp/sapd-mcp-runtime",
            )
        )

    def test_guard_blocks_fixture_runtime_on_5173(self) -> None:
        guard = load_dev_server_guard()
        blockers = guard.reserved_preview_port_blockers(
            5173,
            {
                "runtime_label": "dev",
                "ephemeral_user_state": "1",
                "base_db": "/private/tmp/synthetic-base.sqlite3",
                "mcp_runtime_root": "/private/tmp/sapd-mcp-runtime",
            },
        )
        self.assertGreaterEqual(len(blockers), 4)

    def test_guard_allows_same_fixture_runtime_on_non_reserved_port(self) -> None:
        guard = load_dev_server_guard()
        self.assertEqual(
            guard.reserved_preview_port_blockers(
                5187,
                {
                    "runtime_label": "dev",
                    "ephemeral_user_state": "1",
                    "base_db": "/private/tmp/synthetic-base.sqlite3",
                    "mcp_runtime_root": "/private/tmp/sapd-mcp-runtime",
                },
            ),
            [],
        )

    def test_guard_blocks_5173_from_linked_worktree(self) -> None:
        guard = load_dev_server_guard()
        with patch.object(guard, "primary_git_worktree_root", return_value=ROOT.parent / "primary"):
            blockers = guard.reserved_preview_port_blockers(
                5173,
                guard.expected_runtime(argparse.Namespace(
                    port=5173,
                    base_db="",
                    user_db="",
                    ephemeral_user_state=False,
                    data_root="",
                    export_dir="",
                    runtime_label="",
                    mcp_port=0,
                    mcp_runtime_root="",
                    mcp_platform_integration=False,
                )),
            )
        self.assertTrue(any("primary worktree" in blocker for blocker in blockers))

    def test_guard_restarts_project_server_with_wrong_project_root(self) -> None:
        guard = load_dev_server_guard()
        health = {
            "ok": True,
            "json": {
                "data": {
                    "runtime": {
                        "label": "stable",
                        "settings_paths": {"data_root": "/private/tmp/SAPD_Wiki-main-merged"},
                    }
                }
            },
        }
        self.assertTrue(
            guard.existing_server_requires_restart(
                [{"is_project_server": True}],
                health,
                {"runtime_label": "stable", "project_root": str(ROOT)},
            )
        )

    def test_guard_keeps_project_server_with_matching_project_root(self) -> None:
        guard = load_dev_server_guard()
        health = {
            "ok": True,
            "json": {
                "data": {
                    "runtime": {
                        "label": "stable",
                        "settings_paths": {"data_root": str(ROOT)},
                    }
                }
            },
        }
        self.assertFalse(
            guard.existing_server_requires_restart(
                [{"is_project_server": True}],
                health,
                {"runtime_label": "stable", "project_root": str(ROOT)},
            )
        )

    def test_guard_reuses_established_persistent_mcp_runtime_on_5173(self) -> None:
        guard = load_dev_server_guard()
        args = argparse.Namespace(
            port=5173,
            base_db="",
            user_db="",
            ephemeral_user_state=False,
            data_root="",
            export_dir="",
            runtime_label="",
            mcp_port=0,
            mcp_runtime_root="",
            mcp_platform_integration=False,
        )
        with patch.object(
            guard,
            "persistent_mcp_runtime_is_configured",
            return_value=True,
        ):
            runtime = guard.expected_runtime(args)
        self.assertEqual(runtime["mcp_platform_integration"], "1")

    def test_guard_restarts_5173_when_persistent_mcp_runtime_is_not_attached(
        self,
    ) -> None:
        guard = load_dev_server_guard()
        health = {
            "ok": True,
            "json": {
                "data": {
                    "runtime": {
                        "label": "stable",
                        "settings_paths": {"data_root": str(ROOT)},
                    }
                }
            },
        }
        expected = {
            "runtime_label": "stable",
            "project_root": str(ROOT),
            "mcp_platform_integration": "1",
        }
        self.assertTrue(
            guard.existing_server_requires_restart(
                [{"is_project_server": True, "command_line": "sapd_wiki.cli serve"}],
                health,
                expected,
            )
        )
        self.assertFalse(
            guard.existing_server_requires_restart(
                [
                    {
                        "is_project_server": True,
                        "command_line": (
                            "sapd_wiki.cli serve --mcp-platform-integration"
                        ),
                    }
                ],
                health,
                expected,
            )
        )


if __name__ == "__main__":
    unittest.main()
