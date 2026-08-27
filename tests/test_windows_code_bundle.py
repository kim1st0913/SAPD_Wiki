from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path

from scripts import windows_code_bundle as bundle


SOURCE_SHA = "a" * 40
WORKFLOW_SHA = "b" * 40
REAL_WORKFLOW_SHA = "29557ae639f390daaeae7972868fb6e9216073d5"
REAL_SOURCE_SHA = "4f9090440c5e295bf7ac289c67e99990690adf61"


class WindowsCodeBundleTests(unittest.TestCase):
    def _policy_files(self, root: Path) -> tuple[Path, Path, str]:
        policy_path = root / "windows-build-policy.json"
        lock_path = root / "windows-build-py311-x64.lock"
        policy_path.write_text('{"schemaVersion":"test-policy"}\n', encoding="utf-8")
        lock_path.write_text(
            "test-package==1.0.0 --hash=sha256:" + ("0" * 64) + "\n",
            encoding="utf-8",
        )
        digest = hashlib.sha256(policy_path.read_bytes()).hexdigest()
        return policy_path, lock_path, digest

    def _repo(self, root: Path) -> tuple[Path, str]:
        repo = root / "repo"
        files = {
            "pyproject.toml": "[project]\nname='test'\n",
            "apps/electron/package.json": json.dumps({"version": "0.4.1"}),
            "apps/electron/package-lock.json": "{}\n",
            "apps/electron/main.cjs": "module.exports = {};\n",
            "config/runtime.json": "{}\n",
            "frontend/capability-browser/index.html": "ok\n",
            "src/sapd_wiki/__init__.py": "\n",
        }
        for required in bundle.ALLOWED_EXACT:
            files.setdefault(required, "# controlled test payload\n")
        for relative, content in files.items():
            path = repo / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        subprocess.run(["git", "init", "-q"], cwd=repo, check=True)
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=repo, check=True)
        subprocess.run(["git", "config", "user.name", "Test"], cwd=repo, check=True)
        subprocess.run(["git", "add", "."], cwd=repo, check=True)
        subprocess.run(["git", "commit", "-qm", "fixture"], cwd=repo, check=True)
        sha = subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=repo, check=True, capture_output=True, text=True
        ).stdout.strip()
        return repo, sha

    def _backend(self, root: Path, source_sha: str) -> Path:
        backend = root / "backend"
        (backend / "_internal").mkdir(parents=True)
        (backend / "SAPD-Wiki-Backend.exe").write_bytes(b"native-backend")
        (backend / "_internal/runtime.dll").write_bytes(b"runtime")
        (backend / "build-info.json").write_text(
            json.dumps({"schemaVersion": "sapd-windows-backend-artifact-v1", "sourceRevision": source_sha}),
            encoding="utf-8",
        )
        return backend

    def test_build_and_verify_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            repo, source_sha = self._repo(root)
            output = root / "output"
            policy_path, lock_path, policy_sha256 = self._policy_files(root)
            result = bundle.build(
                argparse.Namespace(
                    repo_root=repo,
                    backend_root=self._backend(root, source_sha),
                    output_dir=output,
                    policy_manifest=policy_path,
                    build_lock=lock_path,
                    workflow_sha=WORKFLOW_SHA,
                    source_sha=source_sha,
                    app_version="0.4.1",
                    repository="owner/public",
                    workflow=".github/workflows/windows-code-bundle.yml",
                    workflow_ref="owner/public/.github/workflows/windows-code-bundle.yml@refs/heads/main",
                    run_id="123",
                    run_attempt="1",
                )
            )
            verified = bundle.verify_archive(
                output / str(result["archive"]),
                output / bundle.MANIFEST_NAME,
                expected_policy_sha256=policy_sha256,
                expected_workflow_sha=WORKFLOW_SHA,
                expected_source_sha=source_sha,
                expected_app_version="0.4.1",
                expected_repository="owner/public",
                expected_workflow=".github/workflows/windows-code-bundle.yml",
                expected_run_id="123",
            )
            self.assertEqual(verified["archiveSha256"], result["archiveSha256"])
            manifest = json.loads((output / bundle.MANIFEST_NAME).read_text(encoding="utf-8"))
            self.assertEqual(manifest["workflowSha"], WORKFLOW_SHA)
            self.assertEqual(manifest["build"]["workflowSha"], WORKFLOW_SHA)
            self.assertEqual(manifest["build"]["sourceSha"], source_sha)
            self.assertEqual(manifest["build"]["policySha256"], policy_sha256)
            self.assertEqual(manifest["sourceSha"], source_sha)
            self.assertNotEqual(manifest["build"]["workflowSha"], manifest["sourceSha"])
            self.assertEqual(
                manifest["instance"],
                {
                    "schemaVersion": bundle.INSTANCE_SCHEMA_VERSION,
                    "appVersion": "0.4.1",
                    "workflowSha": WORKFLOW_SHA,
                    "sourceSha": source_sha,
                    "sourceTree": manifest["sourceTree"],
                    "policySha256": policy_sha256,
                    "payloadCoverage": "all-selected-files-by-sha256",
                },
            )
            with zipfile.ZipFile(output / str(result["archive"])) as archive:
                names = set(archive.namelist())
            self.assertIn("payload/frontend/capability-browser/index.html", names)
            self.assertIn("native-backend/win-x64/SAPD-Wiki-Backend.exe", names)
            self.assertIn(bundle.BUILD_POLICY_PATH, names)
            self.assertIn(bundle.BUILD_LOCK_PATH, names)
            self.assertNotIn(".git/config", names)
            declared = {record["path"] for record in manifest["files"]}
            self.assertEqual(names, declared)

    def test_product_change_changes_instance_but_not_stable_policy(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            policy_path, lock_path, policy_sha256 = self._policy_files(root)
            manifests = []
            for label, version in (("first", "0.4.1"), ("second", "0.4.2")):
                repo, source_sha = self._repo(root / label)
                package_path = repo / "apps/electron/package.json"
                if version != "0.4.1":
                    package_path.write_text(json.dumps({"version": version}), encoding="utf-8")
                    subprocess.run(["git", "add", "apps/electron/package.json"], cwd=repo, check=True)
                    subprocess.run(["git", "commit", "-qm", version], cwd=repo, check=True)
                source_sha = subprocess.run(
                    ["git", "rev-parse", "HEAD"], cwd=repo, check=True, capture_output=True, text=True
                ).stdout.strip()
                output = root / f"output-{label}"
                result = bundle.build(
                    argparse.Namespace(
                        repo_root=repo,
                        backend_root=self._backend(root / label, source_sha),
                        output_dir=output,
                        policy_manifest=policy_path,
                        build_lock=lock_path,
                        workflow_sha=WORKFLOW_SHA,
                        source_sha=source_sha,
                        app_version=version,
                        repository="owner/public",
                        workflow=".github/workflows/windows-code-bundle.yml",
                        workflow_ref="owner/public/.github/workflows/windows-code-bundle.yml@refs/heads/main",
                        run_id="123",
                        run_attempt="1",
                    )
                )
                self.assertEqual(result["policySha256"], policy_sha256)
                manifests.append(json.loads((output / bundle.MANIFEST_NAME).read_text()))
            self.assertNotEqual(manifests[0]["sourceSha"], manifests[1]["sourceSha"])
            self.assertNotEqual(manifests[0]["instance"], manifests[1]["instance"])
            self.assertNotEqual(manifests[0]["treeSha256"], manifests[1]["treeSha256"])

    def test_verify_rejects_tampered_payload(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            repo, source_sha = self._repo(root)
            output = root / "output"
            policy_path, lock_path, policy_sha256 = self._policy_files(root)
            result = bundle.build(
                argparse.Namespace(
                    repo_root=repo,
                    backend_root=self._backend(root, source_sha),
                    output_dir=output,
                    policy_manifest=policy_path,
                    build_lock=lock_path,
                    workflow_sha=WORKFLOW_SHA,
                    source_sha=source_sha,
                    app_version="0.4.1",
                    repository="owner/public",
                    workflow=".github/workflows/windows-code-bundle.yml",
                    workflow_ref="owner/public/.github/workflows/windows-code-bundle.yml@refs/heads/main",
                    run_id="123",
                    run_attempt="1",
                )
            )
            archive_path = output / str(result["archive"])
            with zipfile.ZipFile(archive_path, "a") as archive:
                archive.writestr("payload/frontend/capability-browser/index.html", b"tampered")
            with self.assertRaisesRegex(ValueError, "archive identity|file count|duplicate"):
                bundle.verify_archive(
                    archive_path,
                    output / bundle.MANIFEST_NAME,
                    expected_policy_sha256=policy_sha256,
                    expected_workflow_sha=WORKFLOW_SHA,
                    expected_source_sha=source_sha,
                    expected_app_version="0.4.1",
                    expected_repository="owner/public",
                    expected_workflow=".github/workflows/windows-code-bundle.yml",
                    expected_run_id="123",
                )

    def test_backend_rejects_private_key_marker(self) -> None:
        with tempfile.TemporaryDirectory() as name:
            root = Path(name)
            backend = self._backend(root, SOURCE_SHA)
            (backend / "_internal/private.pem").write_bytes(b"-----BEGIN PRIVATE KEY-----")
            with self.assertRaisesRegex(ValueError, "secret marker"):
                bundle.copy_backend(backend, root / "target")

    def test_current_workflow_and_product_checkpoint_contract(self) -> None:
        orchestration_root = Path(__file__).resolve().parents[1]
        bundle.validate_source_ancestry(orchestration_root, REAL_WORKFLOW_SHA, REAL_SOURCE_SHA)
        helper_at_product = subprocess.run(
            ["git", "cat-file", "-e", f"{REAL_SOURCE_SHA}:scripts/windows_code_bundle.py"],
            cwd=orchestration_root,
            capture_output=True,
        )
        self.assertNotEqual(helper_at_product.returncode, 0)
        self.assertTrue((orchestration_root / "scripts/windows_code_bundle.py").is_file())

    def test_non_ancestor_source_fails_closed(self) -> None:
        orchestration_root = Path(__file__).resolve().parents[1]
        with self.assertRaisesRegex(ValueError, "not an ancestor"):
            bundle.validate_source_ancestry(orchestration_root, REAL_SOURCE_SHA, REAL_WORKFLOW_SHA)

    def test_editable_source_artifacts_are_forbidden(self) -> None:
        self.assertTrue(bundle.forbidden_path("payload/frontend/architecture.drawio"))
        self.assertTrue(bundle.forbidden_path("payload/docs/review.pptx"))

    def test_workflow_uses_separate_trusted_and_product_roots(self) -> None:
        workflow = (
            Path(__file__).resolve().parents[1] / ".github/workflows/windows-code-bundle.yml"
        ).read_text(encoding="utf-8")
        self.assertIn("path: orchestration", workflow)
        self.assertIn("path: product-source", workflow)
        self.assertIn("working-directory: orchestration", workflow)
        self.assertIn("working-directory: product-source", workflow)
        self.assertIn("--repo-root $env:PRODUCT_ROOT", workflow)
        self.assertIn("--workflow-sha $env:WORKFLOW_SHA", workflow)
        self.assertIn("--source-sha $env:SOURCE_SHA", workflow)
        self.assertNotIn("$env:GITHUB_SHA -ne $env:SOURCE_SHA", workflow)
        self.assertNotIn("PUBLIC_ARTIFACT_READER_APP_ID", workflow)
        self.assertNotIn("PUBLIC_ARTIFACT_READER_PRIVATE_KEY", workflow)
        self.assertNotIn("secrets.", workflow)


if __name__ == "__main__":
    unittest.main()
