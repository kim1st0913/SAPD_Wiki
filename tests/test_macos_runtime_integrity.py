from __future__ import annotations

import hashlib
import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "apps/macos/SAPDWiki/Sources/SAPDWiki/RuntimeIntegrity.swift"


class MacOSRuntimeIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temporary = tempfile.TemporaryDirectory(
            prefix="sapd-runtime-integrity-tests-",
            dir="/private/tmp",
        )
        cls.root = Path(cls.temporary.name).resolve()
        harness = cls.root / "main.swift"
        harness.write_text(
            """
import Foundation

let arguments = CommandLine.arguments
do {
    switch arguments[1] {
    case "content":
        try RuntimeIntegrity.validateRequiredContentAssetDatabase(
            root: URL(fileURLWithPath: arguments[2], isDirectory: true)
        )
        print("valid")
    case "guard":
        try RuntimeIntegrity.rejectSymbolicLinksInWritePath(
            URL(fileURLWithPath: arguments[2], isDirectory: true)
        )
        print("safe")
    default:
        fatalError("unsupported mode")
    }
} catch {
    FileHandle.standardError.write(Data("\\(error)\\n".utf8))
    exit(1)
}
""",
            encoding="utf-8",
        )
        cls.binary = cls.root / "runtime-integrity-probe"
        result = subprocess.run(
            [
                "swiftc",
                "-target",
                "arm64-apple-macosx15.2",
                str(HELPER),
                str(harness),
                "-o",
                str(cls.binary),
            ],
            cwd=ROOT,
            env={**os.environ, "CLANG_MODULE_CACHE_PATH": str(cls.root / "module-cache")},
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise AssertionError(result.stderr)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.temporary.cleanup()

    def run_probe(self, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(self.binary), *arguments],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_runtime_installer_keeps_bounded_checks_without_startup_tree_rehash(self) -> None:
        source = (ROOT / "apps/macos/SAPDWiki/Sources/SAPDWiki/main.swift").read_text(encoding="utf-8")
        self.assertIn("try RuntimeIntegrity.validateRequiredContentAssetDatabase(root: sourceRuntime)", source)
        self.assertIn("try RuntimeIntegrity.rejectSymbolicLinksInWritePath(runtimeRoot)", source)
        self.assertIn("sourceFingerprint == targetFingerprint", source)
        self.assertNotIn("RuntimeIntegrity.isCurrent", source)
        self.assertNotIn("RuntimeIntegrity.verifyInstalledRuntime", source)

    @staticmethod
    def create_runtime(root: Path) -> None:
        files = {
            "SAPD-Wiki-Backend": b"backend",
            "app/frontend-dist/index.html": b"frontend",
            "config/app-config.json": json.dumps(
                {"platform": "mac-arm64", "app_data_root": "/source/path"}
            ).encode("utf-8"),
            "diagnostics/export.command": b"diagnostics",
            "start-macos.command": b"start",
            "stop-macos.command": b"stop",
            "data/base/sapd_wiki_base.sqlite3": b"base",
            "data/base/sapd_content_assets.sqlite3": b"assets",
        }
        for relative, content in files.items():
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        manifest = {
            "app_version": "0.4.0",
            "platform": "mac-arm64",
            "content_asset_database": {
                "file": "sapd_content_assets.sqlite3",
                "sha256": hashlib.sha256(b"assets").hexdigest(),
            },
        }
        (root / "data/base/base-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")

    def test_runtime_install_write_path_rejects_symlink_without_touching_external_target(self) -> None:
        external = self.root / "external-target"
        external.mkdir()
        sentinel = external / "sentinel.txt"
        sentinel.write_text("preserve", encoding="utf-8")
        data_root = self.root / "linked-data-root"
        data_root.symlink_to(external, target_is_directory=True)

        result = self.run_probe("guard", str(data_root / "Runtime"))

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("symbolic link", result.stderr)
        self.assertEqual(sentinel.read_text(encoding="utf-8"), "preserve")
        self.assertEqual(sorted(path.name for path in external.iterdir()), ["sentinel.txt"])

    def test_content_asset_database_is_required_and_hash_verified(self) -> None:
        runtime = self.root / "runtime-content"
        self.create_runtime(runtime)
        self.assertEqual(self.run_probe("content", str(runtime)).returncode, 0)

        asset = runtime / "data/base/sapd_content_assets.sqlite3"
        asset.unlink()
        missing = self.run_probe("content", str(runtime))
        self.assertNotEqual(missing.returncode, 0)
        self.assertIn("content asset database", missing.stderr)

        asset.write_bytes(b"tampered")
        mismatch = self.run_probe("content", str(runtime))
        self.assertNotEqual(mismatch.returncode, 0)
        self.assertIn("hash mismatch", mismatch.stderr)

        manifest_path = runtime / "data/base/base-manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest.pop("content_asset_database")
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        undeclared = self.run_probe("content", str(runtime))
        self.assertNotEqual(undeclared.returncode, 0)
        self.assertIn("manifest declaration", undeclared.stderr)


if __name__ == "__main__":
    unittest.main()
