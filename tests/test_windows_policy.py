from __future__ import annotations

import json
import re
import tempfile
import unittest
from pathlib import Path

from scripts import windows_policy as policy


LOCK_LINE_RE = re.compile(
    r"^([a-z0-9][a-z0-9-]*(?:\[[a-z0-9,-]+\])?)==([^\s]+) --hash=sha256:([0-9a-f]{64})$"
)


class WindowsPolicyTests(unittest.TestCase):
    def _root(self, root: Path) -> Path:
        policy_root = root / "orchestration"
        for relative in policy.REQUIRED_POLICY_PATHS:
            target = policy_root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(f"orchestration:{relative}\n", encoding="utf-8")
        return policy_root

    def test_manifest_is_canonical_and_deterministic(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            policy_root = self._root(root)
            first = policy.canonical_bytes(policy.build_document(policy_root))
            second = policy.canonical_bytes(policy.build_document(policy_root))
            self.assertEqual(first, second)
            manifest = root / "policy.json"
            manifest.write_bytes(first)
            result = policy.verify_manifest(manifest, policy_root)
            self.assertEqual(result["status"], "verified")

    def test_unsorted_duplicate_and_traversal_paths_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            policy_root = self._root(root)
            document = policy.build_document(policy_root)
            document["files"] = list(reversed(document["files"]))
            with self.assertRaisesRegex(ValueError, "deterministic order"):
                policy.validate_document(document)
            document = policy.build_document(policy_root)
            document["files"][1]["path"] = document["files"][0]["path"]
            with self.assertRaisesRegex(ValueError, "duplicate policy path"):
                policy.validate_document(document)
            document = policy.build_document(policy_root)
            document["files"][0]["path"] = "../escape"
            with self.assertRaisesRegex(ValueError, "unsafe policy path"):
                policy.validate_document(document)

    def test_symlink_and_tampering_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            policy_root = self._root(root)
            manifest = root / "policy.json"
            manifest.write_bytes(policy.canonical_bytes(policy.build_document(policy_root)))
            target = policy_root / policy.REQUIRED_POLICY_PATHS[0]
            target.write_text("tampered\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "digest mismatch"):
                policy.verify_manifest(manifest, policy_root)
            target.unlink()
            try:
                target.symlink_to(policy_root / policy.REQUIRED_POLICY_PATHS[1])
            except OSError as error:
                self.skipTest(f"symlink creation is unavailable: {error}")
            with self.assertRaisesRegex(ValueError, "symlink"):
                policy.verify_manifest(manifest, policy_root)

    def test_manifest_whitespace_and_line_endings_share_identity(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            policy_root = self._root(root)
            manifest = root / "policy.json"
            document = policy.build_document(policy_root)
            canonical = policy.canonical_bytes(document)
            expected = policy.sha256_bytes(canonical)
            representations = (
                canonical,
                json.dumps(document, indent=2).replace("\n", "\r\n").encode("utf-8")
                + b"\r\n",
                json.dumps(document, separators=(",", ":")).encode("utf-8"),
            )
            for representation in representations:
                with self.subTest(tail=representation[-8:]):
                    manifest.write_bytes(representation)
                    loaded, digest = policy.load_manifest(manifest)
                    self.assertEqual(loaded, document)
                    self.assertEqual(digest, expected)
                    self.assertEqual(
                        policy.verify_manifest(manifest, policy_root)["policySha256"],
                        expected,
                    )

    def test_policy_text_line_endings_normalize_but_content_tampering_fails(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            policy_root = self._root(root)
            baseline = policy.build_document(policy_root)
            for relative in policy.REQUIRED_POLICY_PATHS:
                target = policy_root / relative
                target.write_bytes(target.read_bytes().replace(b"\n", b"\r\n"))
            self.assertEqual(policy.build_document(policy_root), baseline)

            manifest = root / "policy.json"
            manifest.write_bytes(policy.canonical_bytes(baseline))
            target = policy_root / policy.REQUIRED_POLICY_PATHS[0]
            target.write_bytes(target.read_bytes() + b"content-change\r\n")
            with self.assertRaisesRegex(ValueError, "digest mismatch"):
                policy.verify_manifest(manifest, policy_root)

    def test_invalid_manifest_and_policy_text_fail_closed(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            policy_root = self._root(root)
            manifest = root / "policy.json"
            manifest.write_bytes(b"{invalid")
            with self.assertRaisesRegex(ValueError, "valid JSON"):
                policy.load_manifest(manifest)

            manifest.write_text('{"schemaVersion":"wrong"}', encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "fields are invalid"):
                policy.load_manifest(manifest)

            target = policy_root / policy.REQUIRED_POLICY_PATHS[0]
            target.write_bytes(b"not-utf8:\xff")
            with self.assertRaisesRegex(ValueError, "not UTF-8"):
                policy.build_document(policy_root)
            target.write_bytes(b"contains\x00nul")
            with self.assertRaisesRegex(ValueError, "NUL"):
                policy.build_document(policy_root)

    def test_windows_lock_is_fully_pinned_hashed_and_sorted(self) -> None:
        lock = Path(__file__).resolve().parents[1] / "requirements/windows-build-py311-x64.lock"
        lines = [line for line in lock.read_text(encoding="utf-8").splitlines() if line and not line.startswith("#")]
        matches = [LOCK_LINE_RE.fullmatch(line) for line in lines]
        self.assertTrue(all(matches))
        names = [match.group(1).split("[", 1)[0] for match in matches if match]
        self.assertEqual(names, sorted(names))
        self.assertEqual(len(names), 48)
        self.assertEqual(len(names), len(set(names)))
        self.assertTrue(
            {"pyinstaller", "openpyxl", "cryptography", "mcp", "rfc8785", "uvicorn"}
            <= set(names)
        )
        self.assertTrue({"colorama", "pefile", "pywin32", "pywin32-ctypes"} <= set(names))
        self.assertNotIn("macholib", names)
        self.assertNotRegex("\n".join(lines), r"(?:>=|<=|~=|!=|(?<![=])>(?!=)|(?<![=])<(?!=))")

    def test_workflow_uses_policy_and_hash_locked_install(self) -> None:
        workflow = (
            Path(__file__).resolve().parents[1] / ".github/workflows/windows-code-bundle.yml"
        ).read_text(encoding="utf-8")
        self.assertIn("scripts\\windows_policy.py verify", workflow)
        self.assertIn("--root $env:ORCHESTRATION_ROOT", workflow)
        self.assertIn("--require-hashes", workflow)
        self.assertIn("--only-binary=:all:", workflow)
        self.assertIn("windows-build-py311-x64.lock", workflow)
        self.assertNotRegex(workflow, r'pip install[\s\S]{0,300}"[^\"]+>=[^\"]+"')

        dispatch_header = workflow.split("permissions:", 1)[0]
        self.assertNotIn("app_version:", dispatch_header)
        self.assertIn('"APP_VERSION=$($package.version)"', workflow)

    def test_workflow_reads_package_lock_empty_root_with_hashtable_contract(self) -> None:
        root = Path(__file__).resolve().parents[1]
        workflow = (root / ".github/workflows/windows-code-bundle.yml").read_text(
            encoding="utf-8"
        )
        self.assertIn("ConvertFrom-Json -AsHashtable", workflow)
        self.assertIn("$rootLockPackage = $packageLock['packages']['']", workflow)
        self.assertIn("$packageLock['version']", workflow)
        self.assertIn("$rootLockPackage['version']", workflow)
        self.assertIn("$packageLock -isnot [System.Collections.IDictionary]", workflow)
        self.assertIn("$packageLock['packages'] -isnot [System.Collections.IDictionary]", workflow)
        self.assertIn("$packageLock['packages'][''] -isnot [System.Collections.IDictionary]", workflow)
        self.assertIn("$packageLock.Contains('packages')", workflow)
        self.assertIn("$packageLock['packages'].Contains('')", workflow)
        self.assertIn("$packageLock.Contains('version')", workflow)
        self.assertIn("$rootLockPackage.Contains('version')", workflow)
        self.assertNotIn("$packageLock.version", workflow)
        self.assertNotIn("$rootLockPackage.version", workflow)

        package = json.loads((root / "apps/electron/package.json").read_text(encoding="utf-8"))
        package_lock = json.loads(
            (root / "apps/electron/package-lock.json").read_text(encoding="utf-8")
        )
        self.assertEqual(package["version"], "0.4.1")
        self.assertEqual(package_lock["version"], "0.4.1")
        self.assertEqual(package_lock["packages"][""]["version"], "0.4.1")

    def test_stable_policy_excludes_product_identity_and_payload(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            policy_root = self._root(root)
            first = policy.canonical_bytes(policy.build_document(policy_root))
            product = root / "product/apps/electron/package.json"
            product.parent.mkdir(parents=True)
            product.write_text('{"version":"0.4.1"}\n', encoding="utf-8")
            product.write_text('{"version":"0.4.2"}\n', encoding="utf-8")
            second = policy.canonical_bytes(policy.build_document(policy_root))
            self.assertEqual(first, second)
            document = json.loads(first)
            self.assertNotIn("productSourceSha", document)
            self.assertFalse(any(record["path"].startswith("apps/") for record in document["files"]))

    def test_each_policy_owned_input_changes_stable_digest(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            policy_root = self._root(root)
            baseline = policy.sha256_bytes(policy.canonical_bytes(policy.build_document(policy_root)))
            for relative in policy.REQUIRED_POLICY_PATHS:
                with self.subTest(relative=relative):
                    target = policy_root / relative
                    original = target.read_bytes()
                    target.write_bytes(original + b"changed\n")
                    changed = policy.sha256_bytes(
                        policy.canonical_bytes(policy.build_document(policy_root))
                    )
                    self.assertNotEqual(changed, baseline)
                    target.write_bytes(original)


if __name__ == "__main__":
    unittest.main()
