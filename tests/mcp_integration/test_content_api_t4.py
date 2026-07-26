from __future__ import annotations

import hashlib
import importlib.util
import json
import sys
import threading
import unittest
import urllib.error
import urllib.parse
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

from sapd_wiki import api_server


ROOT = Path(__file__).resolve().parents[2]
QUERY_DB = (
    ROOT
    / "data/exports/worker-verify/base-content-unified-query/candidate"
    / "sapd_wiki.content-candidate.sqlite3"
)
ASSET_DB = (
    ROOT
    / "data/exports/worker-verify/base-content-unified-query/candidate"
    / "sapd_content_assets.candidate.sqlite3"
)
SVG_HASH = "2424b22f4d6f1add2d4d0d02cc716735581f7b7714f03a1ba333dc7d394d02dd"
PNG_HASH = "728027cc797d0ac609db6546b512d2f3a5a750f51badd8d34045f4ed2e5f4887"
PDF_HASH = "9e2a59b06d79c494a015fe57d3b151e82d7db84f321224f9f5bee03f1aa1f81b"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


class ContentApiT4Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not QUERY_DB.is_file() or not ASSET_DB.is_file():
            raise unittest.SkipTest("T4 candidate databases are unavailable")
        cls.before = {
            "query": sha256_file(QUERY_DB),
            "asset": sha256_file(ASSET_DB),
        }
        api_server.configure_runtime_paths(
            base_db=QUERY_DB,
            content_query_db=QUERY_DB,
            content_asset_db=ASSET_DB,
            ephemeral_user_state=True,
        )
        handler = lambda *args, **kwargs: api_server.SapdWikiRequestHandler(
            *args,
            directory=str(ROOT / "frontend/capability-browser"),
            **kwargs,
        )
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        cls.server.sapd_session_token = "t4-read-only"
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_address[1]}"

        scripts_dir = ROOT / "scripts"
        sys.path.insert(0, str(scripts_dir))
        try:
            spec = importlib.util.spec_from_file_location(
                "sapd_t4_bundle_server",
                scripts_dir / "run_local_server.py",
            )
            if spec is None or spec.loader is None:
                raise RuntimeError("bundle server module is unavailable")
            cls.bundle_server_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.bundle_server_module)
        finally:
            sys.path.remove(str(scripts_dir))
        bundle_projection = cls.bundle_server_module.projection_api
        if bundle_projection is None:
            raise RuntimeError(
                "bundle projection API failed to load: "
                + cls.bundle_server_module.projection_api_import_error
            )
        bundle_projection.configure_runtime_paths(
            base_db=QUERY_DB,
            content_query_db=QUERY_DB,
            content_asset_db=ASSET_DB,
            ephemeral_user_state=True,
            runtime_label="bundle-t4-test",
        )

        class TestLogger:
            @staticmethod
            def write(_level: str, _message: str, **_context: object) -> None:
                return None

        class TestRuntime:
            logger = TestLogger()

        cls.app_server = ThreadingHTTPServer(
            ("127.0.0.1", 0),
            cls.bundle_server_module.build_handler(
                TestRuntime(),
                {"port": 0},
                "t4-app-read-only",
            ),
        )
        cls.app_thread = threading.Thread(
            target=cls.app_server.serve_forever,
            daemon=True,
        )
        cls.app_thread.start()
        cls.app_url = f"http://127.0.0.1:{cls.app_server.server_address[1]}"

    @classmethod
    def tearDownClass(cls) -> None:
        if not hasattr(cls, "server"):
            return
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        cls.app_server.shutdown()
        cls.app_server.server_close()
        cls.app_thread.join(timeout=5)
        after = {
            "query": sha256_file(QUERY_DB),
            "asset": sha256_file(ASSET_DB),
        }
        if after != cls.before:
            raise AssertionError("T4 read APIs modified a candidate database")

    @classmethod
    def get_json(cls, path: str) -> dict:
        with urllib.request.urlopen(cls.base_url + path, timeout=10) as response:
            return json.loads(response.read())

    def test_same_origin_query_api_reuses_five_tool_contract(self) -> None:
        search = self.get_json(
            "/api/v1/knowledge/search?"
            + urllib.parse.urlencode({"q": "价值链", "limit": 8})
        )
        self.assertEqual(search["contract_version"], "sapd-mcp-tools-v1")
        refs = [item["canonical_ref"] for item in search["data"]["items"]]
        self.assertTrue(any(ref.startswith("base:content_document:") for ref in refs))

        object_payload = self.get_json(
            "/api/v1/knowledge/object?"
            + urllib.parse.urlencode(
                {
                    "canonical_ref": (
                        "base:content_document:"
                        "security-architecture-design-method-v2.0"
                    )
                }
            )
        )
        self.assertEqual(object_payload["data"]["format"], "pdf")

        version = self.get_json("/api/v1/knowledge/version")
        self.assertRegex(version["data"]["manifest_digest"], r"^sha256:[0-9a-f]{64}$")
        self.assertRegex(
            version["data"]["base_manifest_digest"],
            r"^sha256:[0-9a-f]{64}$",
        )
        self.assertRegex(
            version["data"]["content_manifest_digest"],
            r"^sha256:[0-9a-f]{64}$",
        )
        self.assertRegex(
            version["data"]["asset_manifest_digest"],
            r"^sha256:[0-9a-f]{64}$",
        )

    def test_asset_metadata_does_not_return_blob_or_local_path(self) -> None:
        payload = self.get_json(
            "/api/v1/content/assets?"
            + urllib.parse.urlencode(
                {"owner_ref": "base:content_document:sapd-security-architecture-model"}
            )
        )
        item = payload["data"]["items"][0]
        self.assertEqual(item["mime_type"], "image/svg+xml")
        serialized = json.dumps(payload, ensure_ascii=False)
        self.assertNotIn("content_bytes", serialized)
        self.assertNotIn(str(ROOT), serialized)
        self.assertNotIn("sample", item["logical_file_name"].lower())

    def test_svg_png_and_pdf_are_range_streamable(self) -> None:
        cases = (
            (SVG_HASH, "image/svg+xml", b"<svg"),
            (PNG_HASH, "image/png", b"\x89PNG\r\n\x1a\n"),
            (PDF_HASH, "application/pdf", b"%PDF-"),
        )
        for asset_hash, mime_type, marker in cases:
            with self.subTest(mime_type=mime_type):
                request = urllib.request.Request(
                    f"{self.base_url}/api/v1/content/assets/{asset_hash}",
                    headers={"Range": "bytes=0-255"},
                )
                with urllib.request.urlopen(request, timeout=10) as response:
                    body = response.read()
                    self.assertEqual(response.status, 206)
                    self.assertEqual(response.headers["Content-Type"], mime_type)
                    self.assertEqual(response.headers["Accept-Ranges"], "bytes")
                    self.assertTrue(response.headers["Content-Range"].startswith("bytes 0-"))
                    self.assertEqual(len(body), 256)
                    self.assertIn(marker, body)

    def test_original_asset_is_streamable_by_stable_owner_reference(self) -> None:
        path = (
            "/api/v1/content/assets/by-owner?"
            + urllib.parse.urlencode(
                {
                    "owner_ref": (
                        "base:content_document:"
                        "archimate-3.2-reference-poster-zh"
                    ),
                    "asset_role": "original",
                }
            )
        )
        for base_url in (self.base_url, self.app_url):
            with self.subTest(base_url=base_url):
                request = urllib.request.Request(
                    base_url + path,
                    headers={"Range": "bytes=0-63"},
                )
                with urllib.request.urlopen(request, timeout=10) as response:
                    self.assertEqual(response.status, 206)
                    self.assertEqual(
                        response.headers["Content-Type"],
                        "application/pdf",
                    )
                    self.assertTrue(response.read().startswith(b"%PDF-"))

    def test_unlinked_or_invalid_asset_is_not_available(self) -> None:
        with self.assertRaises(urllib.error.HTTPError) as caught:
            urllib.request.urlopen(
                f"{self.base_url}/api/v1/content/assets/{'0' * 64}",
                timeout=10,
            )
        self.assertEqual(caught.exception.code, 404)
        caught.exception.close()

    def test_bundle_app_handler_queries_and_streams_assets(self) -> None:
        with urllib.request.urlopen(
            self.app_url
            + "/api/v1/knowledge/search?"
            + urllib.parse.urlencode({"q": "价值链", "limit": 8}),
            timeout=10,
        ) as response:
            payload = json.loads(response.read())
        self.assertEqual(payload["contract_version"], "sapd-mcp-tools-v1")
        request = urllib.request.Request(
            f"{self.app_url}/api/v1/content/assets/{PDF_HASH}",
            headers={"Range": "bytes=0-63"},
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            self.assertEqual(response.status, 206)
            self.assertEqual(response.headers["Content-Type"], "application/pdf")
            self.assertTrue(response.read().startswith(b"%PDF-"))


if __name__ == "__main__":
    unittest.main()
