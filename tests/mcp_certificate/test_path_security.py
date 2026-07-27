from __future__ import annotations

import os
import secrets
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from sapd_wiki.local_mcp.path_security import (
    CtypesWindowsPathNativeApi,
    PathSecurityError,
    WindowsPathInspection,
    assert_secure_directory,
    assert_secure_regular_file,
    assert_windows_mcp_descendant,
    atomic_write_secure,
    ensure_secure_directory,
    windows_fixed_mcp_root,
)


def _inspection(
    *,
    exists: bool = True,
    directory: bool = False,
    reparse: bool = False,
    links: int = 1,
    owner: bool = True,
    protected: bool = True,
    current_user: bool = True,
    system: bool = True,
    unexpected: int = 0,
) -> WindowsPathInspection:
    return WindowsPathInspection(
        exists=exists,
        is_directory=directory,
        is_regular_file=exists and not directory and not reparse,
        is_reparse_point=reparse,
        hardlink_count=links,
        owner_is_current_user=owner,
        dacl_is_protected=protected,
        current_user_full_control=current_user,
        system_full_control=system,
        unexpected_ace_count=unexpected,
    )


class FakeWindowsPathNativeApi:
    def __init__(self) -> None:
        self.protected: set[Path] = set()
        self.overrides: dict[Path, WindowsPathInspection] = {}
        self.protect_calls: list[Path] = []

    def inspect(self, path: Path) -> WindowsPathInspection:
        candidate = Path(path)
        override = self.overrides.get(candidate)
        if override is not None:
            return override
        if not candidate.exists():
            return _inspection(exists=False)
        secure = candidate in self.protected
        return _inspection(
            directory=candidate.is_dir(),
            owner=secure,
            protected=secure,
            current_user=secure,
            system=secure,
            unexpected=0 if secure else 1,
        )

    def protect(self, path: Path) -> None:
        candidate = Path(path)
        if not candidate.exists():
            raise AssertionError("cannot protect a missing path")
        self.protect_calls.append(candidate)
        self.protected.add(candidate)


class PortableWindowsPathSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.native = FakeWindowsPathNativeApi()

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_windows_root_is_fixed_below_local_app_data(self) -> None:
        local_app_data = self.root / "LocalAppData"
        expected = local_app_data / "SAPD Wiki" / "LocalMCP"
        self.assertEqual(
            windows_fixed_mcp_root(local_app_data=local_app_data),
            expected,
        )
        self.assertEqual(
            assert_windows_mcp_descendant(
                expected / "Runtime" / "dev",
                local_app_data=local_app_data,
            ),
            expected / "Runtime" / "dev",
        )
        with self.assertRaises(PathSecurityError) as raised:
            assert_windows_mcp_descendant(
                local_app_data / "user-selected-runtime",
                local_app_data=local_app_data,
            )
        self.assertEqual(raised.exception.code, "WINDOWS_MCP_ROOT_UNSAFE")

    def test_directory_and_file_are_protected_then_revalidated(self) -> None:
        directory = self.root / "managed" / "control"
        result = ensure_secure_directory(directory, native_api=self.native)
        self.assertEqual(result, directory)
        self.assertEqual(
            assert_secure_directory(directory, native_api=self.native),
            directory,
        )
        target = directory / "state.json"
        atomic_write_secure(
            target,
            b'{"state":"enabled"}',
            native_api=self.native,
        )
        assert_secure_regular_file(target, native_api=self.native)
        self.assertEqual(target.read_bytes(), b'{"state":"enabled"}')
        self.assertIn(directory, self.native.protect_calls)
        self.assertIn(target, self.native.protect_calls)

    def test_reparse_points_and_hardlinks_fail_closed(self) -> None:
        directory = self.root / "reparse"
        directory.mkdir()
        self.native.overrides[directory] = _inspection(
            directory=True,
            reparse=True,
        )
        with self.assertRaises(PathSecurityError):
            ensure_secure_directory(directory, native_api=self.native)

        target = self.root / "linked.bin"
        target.write_bytes(b"x")
        self.native.overrides[target] = _inspection(links=2)
        with self.assertRaises(PathSecurityError) as raised:
            assert_secure_regular_file(target, native_api=self.native)
        self.assertEqual(raised.exception.code, "PATH_FILE_UNSAFE")

    def test_fixed_root_checks_every_managed_ancestor(self) -> None:
        local_app_data = self.root / "LocalAppData"
        local_app_data.mkdir()
        candidate = (
            local_app_data
            / "SAPD Wiki"
            / "LocalMCP"
            / "Runtime"
            / "dev"
        )
        with patch.dict(
            os.environ,
            {"LOCALAPPDATA": str(local_app_data)},
            clear=False,
        ):
            ensure_secure_directory(
                candidate,
                native_api=self.native,
                require_fixed_windows_mcp_root=True,
            )
            runtime = candidate.parent
            self.native.overrides[runtime] = _inspection(
                directory=True,
                reparse=True,
            )
            with self.assertRaises(PathSecurityError):
                assert_secure_directory(
                    candidate,
                    native_api=self.native,
                    require_fixed_windows_mcp_root=True,
                )

    def test_owner_dacl_and_exact_ace_contract_fail_closed(self) -> None:
        cases = (
            _inspection(owner=False),
            _inspection(protected=False),
            _inspection(current_user=False),
            _inspection(system=False),
            _inspection(unexpected=1),
        )
        target = self.root / "state.bin"
        target.write_bytes(b"x")
        for inspection in cases:
            with self.subTest(inspection=inspection):
                self.native.overrides[target] = inspection
                with self.assertRaises(PathSecurityError):
                    assert_secure_regular_file(
                        target,
                        native_api=self.native,
                    )


@unittest.skipUnless(os.name == "nt", "Windows native filesystem gate")
class WindowsNativePathSecurityTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_name = secrets.token_hex(12)
        self.root = (
            windows_fixed_mcp_root()
            / "NativePathSecurityTests"
            / self.temporary_name
        )
        self.native = CtypesWindowsPathNativeApi()
        ensure_secure_directory(
            self.root,
            native_api=self.native,
            require_fixed_windows_mcp_root=True,
        )

    def tearDown(self) -> None:
        if self.root.exists():
            for path in sorted(
                self.root.rglob("*"),
                key=lambda value: len(value.parts),
                reverse=True,
            ):
                if path.is_symlink() or path.is_file():
                    path.unlink(missing_ok=True)
                elif path.is_dir():
                    path.rmdir()
            self.root.rmdir()

    def test_native_owner_dacl_and_hardlink_gate(self) -> None:
        inspection = self.native.inspect(self.root)
        self.assertTrue(inspection.secure_directory)
        target = self.root / "control.sqlite3"
        atomic_write_secure(
            target,
            b"native-windows-path-security",
            native_api=self.native,
        )
        self.assertTrue(self.native.inspect(target).secure_regular_file)

        linked = self.root / "control-linked.sqlite3"
        os.link(target, linked)
        with self.assertRaises(PathSecurityError) as raised:
            assert_secure_regular_file(target, native_api=self.native)
        self.assertEqual(raised.exception.code, "PATH_FILE_UNSAFE")
        linked.unlink()
        assert_secure_regular_file(target, native_api=self.native)

    def test_native_reparse_point_gate_when_symlink_is_available(self) -> None:
        target = self.root / "target"
        ensure_secure_directory(target, native_api=self.native)
        link = self.root / "link"
        try:
            link.symlink_to(target, target_is_directory=True)
        except OSError as exc:
            self.skipTest(f"Windows symlink capability unavailable: {exc}")
        self.assertTrue(self.native.inspect(link).is_reparse_point)
        with self.assertRaises(PathSecurityError):
            assert_secure_directory(link, native_api=self.native)


if __name__ == "__main__":
    unittest.main()
