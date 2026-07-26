from __future__ import annotations

import importlib.util
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT / "scripts/build_content_candidate.py"
SPEC = importlib.util.spec_from_file_location("build_content_candidate", SCRIPT_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ContentCandidateT1Tests(unittest.TestCase):
    def test_query_schema_is_additive_and_has_all_content_owners(self) -> None:
        connection = sqlite3.connect(":memory:")
        connection.executescript(
            (ROOT / "config/sql/content-query-schema-v1.sql").read_text(
                encoding="utf-8"
            )
        )
        tables = {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        }
        self.assertTrue(
            {
                "content_documents",
                "content_fragments",
                "content_relations",
                "content_bindings",
                "content_source_evidence",
                "content_fragments_fts",
            }.issubset(tables)
        )

    def test_asset_schema_enforces_blob_length(self) -> None:
        connection = sqlite3.connect(":memory:")
        connection.executescript(
            (ROOT / "config/sql/content-asset-schema-v1.sql").read_text(
                encoding="utf-8"
            )
        )
        with self.assertRaises(sqlite3.IntegrityError):
            connection.execute(
                """
                INSERT INTO content_assets(
                  asset_hash, mime_type, format, byte_count, content_bytes, created_at
                ) VALUES ('hash', 'text/plain', 'txt', 2, X'00', '2026-07-26T00:00:00Z')
                """
            )

    def test_manifest_logical_names_exclude_sample_tokens(self) -> None:
        manifest = json.loads(
            (ROOT / "config/content-source-manifest.v1.json").read_text(
                encoding="utf-8"
            )
        )
        names = [
            document["logical_file_name"] for document in manifest["documents"]
        ]
        names.extend(asset["logical_file_name"] for asset in manifest["derived_assets"])
        for name in names:
            folded = name.lower()
            self.assertNotIn("sample", folded)
            self.assertNotIn("samle", folded)
            self.assertFalse(name.startswith("~$"))

    def test_drawio_empty_page_is_not_imported_as_content(self) -> None:
        source = """<?xml version="1.0" encoding="UTF-8"?>
<mxfile>
  <diagram id="legend" name="图例">
    <mxGraphModel><root>
      <mxCell id="0"/>
      <mxCell id="1" parent="0"/>
      <mxCell id="legend-node" value="图例内容" vertex="1" parent="1"/>
    </root></mxGraphModel>
  </diagram>
  <diagram id="empty" name="元模型">
    <mxGraphModel><root>
      <mxCell id="0"/>
      <mxCell id="1" parent="0"/>
    </root></mxGraphModel>
  </diagram>
  <diagram id="basemap" name="信息化环境及对象底图">
    <mxGraphModel><root>
      <mxCell id="0"/>
      <mxCell id="1" parent="0"/>
      <mxCell id="basemap-node" value="业务底图" vertex="1" parent="1"/>
    </root></mxGraphModel>
  </diagram>
</mxfile>
"""
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "architecture.drawio"
            path.write_text(source, encoding="utf-8")
            fragments, relations = MODULE.parse_drawio(
                path,
                {"stable_ref": "base:content_document:test-architecture"},
            )

        pages = [
            fragment
            for fragment in fragments
            if fragment.fragment_type == "drawio_page"
        ]
        self.assertEqual(
            [page.stable_ref for page in pages],
            [
                "base:content_document:test-architecture:page:001",
                "base:content_document:test-architecture:page:003",
            ],
        )
        self.assertEqual([page.title for page in pages], ["图例", "信息化环境及对象底图"])
        self.assertFalse(any(":page:002" in item.stable_ref for item in fragments))
        self.assertFalse(
            any(
                ":page:002" in relation.source_ref
                or ":page:002" in relation.target_ref
                for relation in relations
            )
        )

    def test_markdown_raw_html_does_not_expose_script_or_navigation(self) -> None:
        source = (
            "visible<script>document.querySelector('secret')</script>"
            "<nav>hidden navigation</nav><strong>business text</strong>"
        )
        normalized = MODULE.strip_unsafe_html(source)
        self.assertEqual(normalized, "visiblebusiness text")

    def test_candidate_output_must_stay_in_worker_verify_boundary(self) -> None:
        safe_path = (
            ROOT
            / "data/exports/worker-verify/base-content-unified-query/candidate/test.sqlite3"
        )
        self.assertEqual(MODULE.require_bounded_output(safe_path), safe_path.resolve())
        with self.assertRaises(ValueError):
            MODULE.require_bounded_output(ROOT / "data/database/sapd_wiki.sqlite3")

    def test_ocr_review_is_bounded_to_two_ordinary_content_fragments(self) -> None:
        review = json.loads(
            (ROOT / "config/content-ocr-review.v1.json").read_text(encoding="utf-8")
        )
        refs = {entry["stable_ref"] for entry in review["entries"]}
        self.assertEqual(len(refs), 2)
        self.assertTrue(review["policy"]["poster_ocr_forbidden"])
        self.assertFalse(any("archimate" in ref for ref in refs))
        self.assertTrue(all(entry["review_status"] == "approved" for entry in review["entries"]))


if __name__ == "__main__":
    unittest.main()
