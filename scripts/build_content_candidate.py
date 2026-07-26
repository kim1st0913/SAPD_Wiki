#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import mimetypes
import posixpath
import re
import sqlite3
import subprocess
import tempfile
import urllib.parse
import uuid
import zlib
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "config/content-source-manifest.v1.json"
DEFAULT_QUERY_SCHEMA = ROOT / "config/sql/content-query-schema-v1.sql"
DEFAULT_ASSET_SCHEMA = ROOT / "config/sql/content-asset-schema-v1.sql"
DEFAULT_OCR_REVIEW = ROOT / "config/content-ocr-review.v1.json"
ALLOWED_OUTPUT_ROOT = (
    ROOT / "data/exports/worker-verify/base-content-unified-query"
).resolve()
CONTENT_SCHEMA_VERSION = "content-query-schema-v1"
ASSET_SCHEMA_VERSION = "content-asset-schema-v1"
XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"
DRAWIO_NS = uuid.UUID("276b6db1-5b52-4f33-9438-4249d01b43f4")


def json_text(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def stable_id(stable_ref: str) -> str:
    return str(uuid.uuid5(DRAWIO_NS, stable_ref))


def normalize_text(value: str) -> str:
    value = html.unescape(value or "")
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"</(?:p|div|li|tr|h[1-6])\s*>", "\n", value, flags=re.IGNORECASE)
    value = re.sub(r"<[^>]+>", "", value)
    value = value.replace("\u00a0", " ")
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in value.splitlines()]
    return "\n".join(line for line in lines if line).strip()


def first_line(value: str, fallback: str) -> str:
    for line in value.splitlines():
        line = line.strip()
        if line:
            return line[:240]
    return fallback


def require_bounded_output(path: Path) -> Path:
    resolved = path.resolve()
    if resolved == ALLOWED_OUTPUT_ROOT or ALLOWED_OUTPUT_ROOT not in resolved.parents:
        raise ValueError(f"候选输出越界：{resolved}")
    return resolved


def sqlite_backup(source_path: Path, destination_path: Path) -> None:
    source = sqlite3.connect(f"{source_path.resolve().as_uri()}?mode=ro", uri=True)
    destination = sqlite3.connect(destination_path)
    try:
        source.execute("PRAGMA query_only = ON")
        source.backup(destination)
    finally:
        destination.close()
        source.close()


def connect_database(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = DELETE")
    return connection


def table_exists(connection: sqlite3.Connection, table: str) -> bool:
    return (
        connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
            (table,),
        ).fetchone()
        is not None
    )


def table_digest(
    connection: sqlite3.Connection,
    table: str,
    *,
    columns: Iterable[str] | None = None,
) -> str:
    if columns is None:
        columns = [
            row["name"] for row in connection.execute(f"PRAGMA table_info({table})")
        ]
    selected = list(columns)
    order = ", ".join(selected)
    digest = hashlib.sha256()
    for row in connection.execute(
        f"SELECT {', '.join(selected)} FROM {table} ORDER BY {order}"
    ):
        digest.update(json_text(list(row)).encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


def database_integrity(connection: sqlite3.Connection) -> dict[str, str]:
    return {
        "integrityCheck": connection.execute("PRAGMA integrity_check").fetchone()[0],
        "foreignKeyCheck": "pass"
        if not connection.execute("PRAGMA foreign_key_check").fetchall()
        else "fail",
    }


@dataclass
class Fragment:
    stable_ref: str
    fragment_type: str
    ordinal: int
    title: str
    body: str
    notes: str
    source_locator: str
    extraction_status: str
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Relation:
    stable_ref: str
    source_ref: str
    target_ref: str
    relation_type: str
    relation_label: str | None
    ordinal: int | None
    metadata: dict[str, Any] = field(default_factory=dict)


def content_hash(fragment: Fragment) -> str:
    return sha256_bytes(
        json_text(
            {
                "title": fragment.title,
                "body": fragment.body,
                "notes": fragment.notes,
                "metadata": fragment.metadata,
            }
        ).encode("utf-8")
    )


def decode_drawio_diagram(diagram: ET.Element) -> ET.Element:
    if len(diagram):
        return diagram[0]
    encoded = (diagram.text or "").strip()
    if not encoded:
        raise ValueError(f"Draw.io 页面为空：{diagram.attrib.get('name', '')}")
    compressed = base64.b64decode(encoded)
    inflated = zlib.decompress(compressed, -15).decode("utf-8")
    xml_text = urllib.parse.unquote(inflated)
    return ET.fromstring(xml_text)


def drawio_cell_ref(document_ref: str, page_index: int, cell_id: str) -> str:
    cell_key = hashlib.sha256(cell_id.encode("utf-8")).hexdigest()[:20]
    return f"{document_ref}:page:{page_index:03d}:cell:{cell_key}"


def parse_drawio(path: Path, document: dict[str, Any]) -> tuple[list[Fragment], list[Relation]]:
    root = ET.parse(path).getroot()
    fragments: list[Fragment] = []
    relations: list[Relation] = []
    document_ref = document["stable_ref"]

    for page_index, diagram in enumerate(root.findall("diagram"), start=1):
        page_title = normalize_text(diagram.attrib.get("name", "")) or f"Page {page_index}"
        page_ref = f"{document_ref}:page:{page_index:03d}"
        graph = decode_drawio_diagram(diagram)
        cells = list(graph.iter("mxCell"))
        vertices = [cell for cell in cells if cell.attrib.get("vertex") == "1"]
        edges = [cell for cell in cells if cell.attrib.get("edge") == "1"]
        fragments.append(
            Fragment(
                stable_ref=page_ref,
                fragment_type="drawio_page",
                ordinal=page_index,
                title=page_title,
                body="\n".join(
                    value
                    for value in (
                        normalize_text(cell.attrib.get("value", "")) for cell in vertices
                    )
                    if value
                ),
                notes="",
                source_locator=f"drawio-page:{page_index}",
                extraction_status="parsed",
                metadata={
                    "drawioPageId": diagram.attrib.get("id"),
                    "vertexCount": len(vertices),
                    "edgeCount": len(edges),
                },
            )
        )
        relations.append(
            Relation(
                stable_ref=f"{document_ref}:contains:page:{page_index:03d}",
                source_ref=document_ref,
                target_ref=page_ref,
                relation_type="contains",
                relation_label="contains page",
                ordinal=page_index,
            )
        )

        for cell_ordinal, cell in enumerate(vertices, start=1):
            cell_id = cell.attrib.get("id") or f"vertex-{cell_ordinal}"
            node_ref = drawio_cell_ref(document_ref, page_index, cell_id)
            geometry = cell.find("mxGeometry")
            metadata: dict[str, Any] = {
                "drawioCellId": cell_id,
                "parentCellId": cell.attrib.get("parent"),
                "style": cell.attrib.get("style", ""),
            }
            if geometry is not None:
                metadata["geometry"] = {
                    key: geometry.attrib.get(key)
                    for key in ("x", "y", "width", "height", "relative")
                    if key in geometry.attrib
                }
            node_text = normalize_text(cell.attrib.get("value", ""))
            fragments.append(
                Fragment(
                    stable_ref=node_ref,
                    fragment_type="drawio_node",
                    ordinal=cell_ordinal,
                    title=first_line(node_text, f"{page_title} node {cell_ordinal}"),
                    body=node_text,
                    notes="",
                    source_locator=f"drawio-page:{page_index}#cell:{cell_id}",
                    extraction_status="parsed" if node_text else "structural_only",
                    metadata=metadata,
                )
            )
            relations.append(
                Relation(
                    stable_ref=f"{page_ref}:contains:node:{cell_ordinal:05d}",
                    source_ref=page_ref,
                    target_ref=node_ref,
                    relation_type="contains",
                    relation_label="contains node",
                    ordinal=cell_ordinal,
                )
            )

        for edge_ordinal, cell in enumerate(edges, start=1):
            cell_id = cell.attrib.get("id") or f"edge-{edge_ordinal}"
            edge_ref = drawio_cell_ref(document_ref, page_index, cell_id)
            edge_text = normalize_text(cell.attrib.get("value", ""))
            source_cell = cell.attrib.get("source")
            target_cell = cell.attrib.get("target")
            fragments.append(
                Fragment(
                    stable_ref=edge_ref,
                    fragment_type="drawio_edge",
                    ordinal=edge_ordinal,
                    title=first_line(edge_text, f"{page_title} edge {edge_ordinal}"),
                    body=edge_text,
                    notes="",
                    source_locator=f"drawio-page:{page_index}#cell:{cell_id}",
                    extraction_status="parsed",
                    metadata={
                        "drawioCellId": cell_id,
                        "sourceCellId": source_cell,
                        "targetCellId": target_cell,
                        "style": cell.attrib.get("style", ""),
                    },
                )
            )
            relations.append(
                Relation(
                    stable_ref=f"{page_ref}:contains:edge:{edge_ordinal:05d}",
                    source_ref=page_ref,
                    target_ref=edge_ref,
                    relation_type="contains",
                    relation_label="contains edge",
                    ordinal=edge_ordinal,
                )
            )
            if source_cell and target_cell:
                relations.append(
                    Relation(
                        stable_ref=f"{edge_ref}:connects",
                        source_ref=drawio_cell_ref(
                            document_ref,
                            page_index,
                            source_cell,
                        ),
                        target_ref=drawio_cell_ref(
                            document_ref,
                            page_index,
                            target_cell,
                        ),
                        relation_type="drawio_connects",
                        relation_label=edge_text or None,
                        ordinal=edge_ordinal,
                        metadata={"edgeRef": edge_ref},
                    )
                )
    return fragments, relations


def parse_pdf(path: Path, document: dict[str, Any]) -> tuple[list[Fragment], list[Relation]]:
    if not document.get("semantic_source"):
        return [], []
    result = subprocess.run(
        ["pdftotext", "-layout", str(path), "-"],
        check=True,
        capture_output=True,
    )
    pages = result.stdout.decode("utf-8", errors="replace").split("\f")
    if pages and not pages[-1].strip():
        pages.pop()
    expected_pages = int(document.get("expected_pages") or 0)
    if expected_pages and len(pages) != expected_pages:
        raise ValueError(
            f"PDF页数不符：{document['document_id']} expected={expected_pages} actual={len(pages)}"
        )
    fragments: list[Fragment] = []
    relations: list[Relation] = []
    document_ref = document["stable_ref"]
    for page_number, raw_text in enumerate(pages, start=1):
        body = normalize_text(raw_text)
        page_ref = f"{document_ref}:page:{page_number:03d}"
        fragments.append(
            Fragment(
                stable_ref=page_ref,
                fragment_type="pdf_page",
                ordinal=page_number,
                title=first_line(body, f"{document['business_title']} · {page_number}"),
                body=body,
                notes="",
                source_locator=f"pdf-page:{page_number}",
                extraction_status="text_layer" if body else "ocr_pending",
                metadata={"pageNumber": page_number},
            )
        )
        relations.append(
            Relation(
                stable_ref=f"{document_ref}:contains:page:{page_number:03d}",
                source_ref=document_ref,
                target_ref=page_ref,
                relation_type="contains",
                relation_label="contains page",
                ordinal=page_number,
            )
        )
    return fragments, relations


def xml_text_nodes(xml_bytes: bytes) -> list[str]:
    root = ET.fromstring(xml_bytes)
    values: list[str] = []
    for element in root.iter():
        if element.tag.endswith("}t") and element.text:
            text = normalize_text(element.text)
            if text:
                values.append(text)
    return values


def relationship_targets(archive: ZipFile, rels_path: str, base_path: str) -> dict[str, tuple[str, str]]:
    if rels_path not in archive.namelist():
        return {}
    root = ET.fromstring(archive.read(rels_path))
    targets: dict[str, tuple[str, str]] = {}
    for element in root:
        rel_id = element.attrib.get("Id")
        target = element.attrib.get("Target")
        rel_type = element.attrib.get("Type", "")
        if rel_id and target:
            targets[rel_id] = (
                posixpath.normpath(posixpath.join(base_path, target)),
                rel_type,
            )
    return targets


def presentation_slide_paths(archive: ZipFile) -> list[str]:
    presentation_path = "ppt/presentation.xml"
    relationships = relationship_targets(
        archive,
        "ppt/_rels/presentation.xml.rels",
        "ppt",
    )
    root = ET.fromstring(archive.read(presentation_path))
    paths: list[str] = []
    for element in root.iter():
        if not element.tag.endswith("}sldId"):
            continue
        rel_id = next(
            (value for key, value in element.attrib.items() if key.endswith("}id")),
            None,
        )
        if rel_id and rel_id in relationships:
            paths.append(relationships[rel_id][0])
    return paths


def parse_pptx(path: Path, document: dict[str, Any]) -> tuple[list[Fragment], list[Relation]]:
    fragments: list[Fragment] = []
    relations: list[Relation] = []
    document_ref = document["stable_ref"]
    with ZipFile(path) as archive:
        slide_paths = presentation_slide_paths(archive)
        expected_pages = int(document.get("expected_pages") or 0)
        if expected_pages and len(slide_paths) != expected_pages:
            raise ValueError(
                f"PPTX页数不符：{document['document_id']} expected={expected_pages} actual={len(slide_paths)}"
            )
        for slide_number, slide_path in enumerate(slide_paths, start=1):
            slide_lines = xml_text_nodes(archive.read(slide_path))
            rels_path = (
                f"{posixpath.dirname(slide_path)}/_rels/"
                f"{posixpath.basename(slide_path)}.rels"
            )
            relationships = relationship_targets(
                archive,
                rels_path,
                posixpath.dirname(slide_path),
            )
            notes_lines: list[str] = []
            media_refs: list[str] = []
            for target, rel_type in relationships.values():
                if rel_type.endswith("/notesSlide") and target in archive.namelist():
                    notes_lines.extend(xml_text_nodes(archive.read(target)))
                elif rel_type.endswith(("/image", "/audio", "/video", "/media")):
                    media_refs.append(posixpath.basename(target))
            body = normalize_text("\n".join(slide_lines))
            notes = normalize_text("\n".join(notes_lines))
            slide_ref = f"{document_ref}:slide:{slide_number:03d}"
            fragments.append(
                Fragment(
                    stable_ref=slide_ref,
                    fragment_type="pptx_slide",
                    ordinal=slide_number,
                    title=first_line(
                        body,
                        f"{document['business_title']} · {slide_number}",
                    ),
                    body=body,
                    notes=notes,
                    source_locator=f"pptx-slide:{slide_number}",
                    extraction_status=(
                        "presentationml"
                        if body or notes
                        else (
                            "ocr_pending"
                            if document["ocr_policy"] == "image-only-slide-fallback"
                            else "empty"
                        )
                    ),
                    metadata={
                        "slideNumber": slide_number,
                        "mediaCount": len(media_refs),
                        "mediaNames": sorted(media_refs),
                    },
                )
            )
            relations.append(
                Relation(
                    stable_ref=f"{document_ref}:contains:slide:{slide_number:03d}",
                    source_ref=document_ref,
                    target_ref=slide_ref,
                    relation_type="contains",
                    relation_label="contains slide",
                    ordinal=slide_number,
                )
            )
    return fragments, relations


def strip_unsafe_html(value: str) -> str:
    value = re.sub(
        r"<(?:script|style|nav)\b[^>]*>.*?</(?:script|style|nav)>",
        "",
        value,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return normalize_text(value)


def parse_markdown(path: Path, document: dict[str, Any]) -> tuple[list[Fragment], list[Relation]]:
    source = path.read_text(encoding="utf-8")
    heading_pattern = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
    sections: list[tuple[str, int, list[str]]] = []
    current_title = document["business_title"]
    current_level = 0
    current_lines: list[str] = []
    for line in source.splitlines():
        match = heading_pattern.match(line)
        if match:
            if current_lines or sections:
                sections.append((current_title, current_level, current_lines))
            current_title = strip_unsafe_html(match.group(2))
            current_level = len(match.group(1))
            current_lines = []
        else:
            current_lines.append(line)
    if current_lines or not sections:
        sections.append((current_title, current_level, current_lines))

    fragments: list[Fragment] = []
    relations: list[Relation] = []
    document_ref = document["stable_ref"]
    for ordinal, (title, level, lines) in enumerate(sections, start=1):
        body = strip_unsafe_html("\n".join(lines))
        section_ref = f"{document_ref}:section:{ordinal:04d}"
        fragments.append(
            Fragment(
                stable_ref=section_ref,
                fragment_type="markdown_section",
                ordinal=ordinal,
                title=title or f"Section {ordinal}",
                body=body,
                notes="",
                source_locator=f"markdown-section:{ordinal}",
                extraction_status="commonmark",
                metadata={"headingLevel": level},
            )
        )
        relations.append(
            Relation(
                stable_ref=f"{document_ref}:contains:section:{ordinal:04d}",
                source_ref=document_ref,
                target_ref=section_ref,
                relation_type="contains",
                relation_label="contains section",
                ordinal=ordinal,
            )
        )
    return fragments, relations


class SemanticHTMLParser(HTMLParser):
    SKIP_TAGS = {"script", "style", "nav", "noscript", "template"}
    BLOCK_TAGS = {
        "p",
        "div",
        "section",
        "article",
        "li",
        "tr",
        "td",
        "th",
        "br",
        "blockquote",
        "pre",
    }

    def __init__(self, default_title: str) -> None:
        super().__init__(convert_charrefs=True)
        self.default_title = default_title
        self.skip_depth = 0
        self.heading_tag: str | None = None
        self.heading_text: list[str] = []
        self.current_title = default_title
        self.current_level = 0
        self.current_parts: list[str] = []
        self.current_anchors: list[str] = []
        self.current_links: list[str] = []
        self.sections: list[dict[str, Any]] = []

    def _flush(self) -> None:
        body = normalize_text("".join(self.current_parts))
        if body or not self.sections:
            self.sections.append(
                {
                    "title": self.current_title,
                    "level": self.current_level,
                    "body": body,
                    "anchors": sorted(set(self.current_anchors)),
                    "internalLinks": sorted(set(self.current_links)),
                }
            )
        self.current_parts = []
        self.current_anchors = []
        self.current_links = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attr = {key.lower(): value or "" for key, value in attrs}
        hidden = (
            "hidden" in attr
            or attr.get("aria-hidden", "").lower() == "true"
            or "display:none" in attr.get("style", "").replace(" ", "").lower()
            or any(
                token in f"{attr.get('class', '')} {attr.get('id', '')}".lower()
                for token in ("toolbar", "download-control", "download-button")
            )
        )
        if self.skip_depth:
            self.skip_depth += 1
            return
        if tag in self.SKIP_TAGS or hidden:
            self.skip_depth = 1
            return
        if re.fullmatch(r"h[1-6]", tag):
            self._flush()
            self.heading_tag = tag
            self.heading_text = []
            self.current_level = int(tag[1])
        if tag in self.BLOCK_TAGS:
            self.current_parts.append("\n")
        anchor = attr.get("id")
        if anchor:
            self.current_anchors.append(anchor)
        href = attr.get("href", "")
        if href.startswith("#") and len(href) > 1:
            self.current_links.append(href[1:])
        if tag == "img" and attr.get("alt"):
            self.current_parts.append(f"\n{attr['alt']}\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if self.skip_depth:
            self.skip_depth -= 1
            return
        if self.heading_tag == tag:
            self.current_title = normalize_text("".join(self.heading_text)) or self.default_title
            self.heading_tag = None
            self.heading_text = []
        if tag in self.BLOCK_TAGS:
            self.current_parts.append("\n")

    def handle_startendtag(
        self,
        tag: str,
        attrs: list[tuple[str, str | None]],
    ) -> None:
        self.handle_starttag(tag, attrs)
        if not self.skip_depth:
            self.handle_endtag(tag)

    def handle_data(self, data: str) -> None:
        if self.skip_depth:
            return
        if self.heading_tag:
            self.heading_text.append(data)
        else:
            self.current_parts.append(data)

    def close(self) -> None:
        super().close()
        self._flush()


def parse_html(path: Path, document: dict[str, Any]) -> tuple[list[Fragment], list[Relation]]:
    parser = SemanticHTMLParser(document["business_title"])
    parser.feed(path.read_text(encoding="utf-8", errors="replace"))
    parser.close()
    fragments: list[Fragment] = []
    relations: list[Relation] = []
    document_ref = document["stable_ref"]
    for ordinal, section in enumerate(parser.sections, start=1):
        section_ref = f"{document_ref}:section:{ordinal:04d}"
        fragments.append(
            Fragment(
                stable_ref=section_ref,
                fragment_type="html_section",
                ordinal=ordinal,
                title=section["title"],
                body=section["body"],
                notes="",
                source_locator=f"html-section:{ordinal}",
                extraction_status="semantic_html",
                metadata={
                    "headingLevel": section["level"],
                    "anchors": section["anchors"],
                    "internalLinks": section["internalLinks"],
                },
            )
        )
        relations.append(
            Relation(
                stable_ref=f"{document_ref}:contains:section:{ordinal:04d}",
                source_ref=document_ref,
                target_ref=section_ref,
                relation_type="contains",
                relation_label="contains section",
                ordinal=ordinal,
            )
        )
    return fragments, relations


def poster_region_slug(path: Path) -> str:
    slug = path.stem
    prefix = "archimate-poster-"
    if slug.startswith(prefix):
        slug = slug[len(prefix) :]
    return re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")


def parse_manual_catalog(
    document: dict[str, Any],
    manifest: dict[str, Any],
) -> tuple[list[Fragment], list[Relation]]:
    document_ref = document["stable_ref"]
    collection = next(
        (
            item
            for item in manifest["derived_collections"]
            if item["document_id"] == document["document_id"]
        ),
        None,
    )
    if not collection:
        return [], []
    directory = ROOT / collection["source_directory"]
    paths = sorted(
        path
        for path in directory.iterdir()
        if path.is_file() and re.search(collection["file_filter"], path.name)
    )
    fragments: list[Fragment] = []
    relations: list[Relation] = []
    for ordinal, path in enumerate(paths, start=1):
        slug = poster_region_slug(path)
        region_ref = f"{document_ref}:region:{slug}"
        title = slug.replace("-", " ").title()
        fragments.append(
            Fragment(
                stable_ref=region_ref,
                fragment_type="manual_catalog",
                ordinal=ordinal,
                title=title,
                body="",
                notes="",
                source_locator=f"manual-region:{slug}",
                extraction_status="manual_catalog_only",
                metadata={"regionKey": slug, "ocrApplied": False},
            )
        )
        relations.append(
            Relation(
                stable_ref=f"{document_ref}:contains:region:{slug}",
                source_ref=document_ref,
                target_ref=region_ref,
                relation_type="contains",
                relation_label="contains manual region",
                ordinal=ordinal,
            )
        )
    return fragments, relations


def run_tesseract(
    path: Path,
    *,
    language: str,
    psm: int,
) -> str:
    result = subprocess.run(
        [
            "tesseract",
            str(path),
            "stdout",
            "-l",
            language,
            "--psm",
            str(psm),
        ],
        check=True,
        capture_output=True,
    )
    return normalize_text(result.stdout.decode("utf-8", errors="replace"))


def pdf_page_preview(
    document: dict[str, Any],
    fragment: Fragment,
    manifest: dict[str, Any],
) -> tuple[Path, str]:
    collection = next(
        (
            item
            for item in manifest["derived_collections"]
            if item["document_id"] == document["document_id"]
            and "{page:03d}" in item["logical_file_name_pattern"]
        ),
        None,
    )
    if not collection:
        raise ValueError(f"PDF OCR缺少页面预览集合：{document['document_id']}")
    paths = collection_paths(collection)
    if fragment.ordinal < 1 or fragment.ordinal > len(paths):
        raise ValueError(f"PDF OCR页码越界：{fragment.stable_ref}")
    path = paths[fragment.ordinal - 1]
    return path, sha256_file(path)


def pptx_slide_image(
    source_path: Path,
    fragment: Fragment,
) -> tuple[bytes, str, str]:
    with ZipFile(source_path) as archive:
        slide_paths = presentation_slide_paths(archive)
        if fragment.ordinal < 1 or fragment.ordinal > len(slide_paths):
            raise ValueError(f"PPTX OCR页码越界：{fragment.stable_ref}")
        slide_path = slide_paths[fragment.ordinal - 1]
        rels_path = (
            f"{posixpath.dirname(slide_path)}/_rels/"
            f"{posixpath.basename(slide_path)}.rels"
        )
        relationships = relationship_targets(
            archive,
            rels_path,
            posixpath.dirname(slide_path),
        )
        image_paths = [
            target
            for target, rel_type in relationships.values()
            if rel_type.endswith("/image") and target in archive.namelist()
        ]
        if not image_paths:
            raise ValueError(f"PPTX OCR页缺少嵌入图片：{fragment.stable_ref}")
        image_path = max(
            image_paths,
            key=lambda value: archive.getinfo(value).file_size,
        )
        payload = archive.read(image_path)
        return payload, sha256_bytes(payload), Path(image_path).suffix


def apply_ocr_fallbacks(
    document: dict[str, Any],
    fragments: list[Fragment],
    manifest: dict[str, Any],
    review_manifest: dict[str, Any],
) -> None:
    entries = {
        entry["stable_ref"]: entry
        for entry in review_manifest.get("entries", [])
    }
    policy = review_manifest["policy"]
    if document["parser"] == "manual-catalog-only":
        if any(fragment.stable_ref in entries for fragment in fragments):
            raise ValueError("ArchiMate Poster不得出现在OCR复核清单")
        return
    for fragment in fragments:
        if fragment.extraction_status != "ocr_pending":
            continue
        review = entries.get(fragment.stable_ref)
        if not review or review.get("review_status") != "approved":
            raise ValueError(f"空文本内容缺少已批准OCR复核：{fragment.stable_ref}")
        if fragment.fragment_type == "pdf_page":
            visual_path, visual_hash = pdf_page_preview(
                document,
                fragment,
                manifest,
            )
            raw_ocr = run_tesseract(
                visual_path,
                language=policy["language"],
                psm=int(review["ocr_psm"]),
            )
        elif fragment.fragment_type == "pptx_slide":
            payload, visual_hash, suffix = pptx_slide_image(
                ROOT / document["source_path"],
                fragment,
            )
            with tempfile.NamedTemporaryFile(suffix=suffix) as handle:
                handle.write(payload)
                handle.flush()
                raw_ocr = run_tesseract(
                    Path(handle.name),
                    language=policy["language"],
                    psm=int(review["ocr_psm"]),
                )
        else:
            raise ValueError(f"未知OCR fallback类型：{fragment.fragment_type}")
        if visual_hash != review["visual_asset_sha256"]:
            raise ValueError(
                f"OCR视觉资产hash漂移：{fragment.stable_ref} "
                f"expected={review['visual_asset_sha256']} actual={visual_hash}"
            )
        if not raw_ocr:
            raise ValueError(f"OCR未识别到任何文本：{fragment.stable_ref}")
        fragment.title = review["reviewed_title"]
        fragment.body = normalize_text(review["reviewed_text"])
        fragment.extraction_status = "ocr_reviewed"
        fragment.metadata["ocr"] = {
            "engine": policy["engine"],
            "language": policy["language"],
            "psm": int(review["ocr_psm"]),
            "visualAssetRole": review["visual_asset_role"],
            "visualAssetHash": visual_hash,
            "rawTextHash": sha256_bytes(raw_ocr.encode("utf-8")),
            "rawTextStored": bool(policy["store_raw_ocr_text"]),
            "reviewId": review_manifest["review_id"],
            "reviewVersion": review_manifest["review_version"],
            "reviewStatus": review["review_status"],
        }


PARSERS = {
    "drawio": parse_drawio,
    "pdf": parse_pdf,
    "pptx": parse_pptx,
    "md": parse_markdown,
    "html": parse_html,
}


def insert_document(
    connection: sqlite3.Connection,
    document: dict[str, Any],
    manifest: dict[str, Any],
    review_manifest: dict[str, Any],
    timestamp: str,
) -> None:
    document_ref = document["stable_ref"]
    document_id = stable_id(document_ref)
    metadata = {
        key: value
        for key, value in document.items()
        if key
        not in {
            "source_path",
            "stable_ref",
            "business_title",
            "format",
            "semantic_source",
            "parser",
            "ocr_policy",
            "logical_file_name",
            "sha256",
        }
    }
    connection.execute(
        """
        INSERT INTO content_documents(
          id, stable_ref, document_key, title, format, semantic_source,
          parser, ocr_policy, logical_file_name, source_asset_hash,
          manifest_id, manifest_version, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            document_id,
            document_ref,
            document["document_id"],
            document["business_title"],
            document["format"],
            int(bool(document["semantic_source"])),
            document["parser"],
            document["ocr_policy"],
            document["logical_file_name"],
            document["sha256"],
            manifest["manifest_id"],
            manifest["manifest_version"],
            json_text(metadata),
            timestamp,
            timestamp,
        ),
    )
    connection.execute(
        """
        INSERT INTO content_source_evidence(
          id, target_ref, source_asset_hash, source_locator,
          extraction_method, evidence_hash, metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            stable_id(f"evidence:{document_ref}"),
            document_ref,
            document["sha256"],
            "document",
            document["parser"],
            document["sha256"],
            json_text({"logicalFileName": document["logical_file_name"]}),
            timestamp,
        ),
    )

    if document["parser"] == "manual-catalog-only":
        fragments, relations = parse_manual_catalog(document, manifest)
    else:
        parser = PARSERS[document["format"]]
        fragments, relations = parser(ROOT / document["source_path"], document)
    apply_ocr_fallbacks(
        document,
        fragments,
        manifest,
        review_manifest,
    )

    for fragment in fragments:
        connection.execute(
            """
            INSERT INTO content_fragments(
              id, stable_ref, document_id, fragment_type, ordinal, title,
              body, notes, source_locator, extraction_status, content_hash,
              metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                stable_id(fragment.stable_ref),
                fragment.stable_ref,
                document_id,
                fragment.fragment_type,
                fragment.ordinal,
                fragment.title,
                fragment.body,
                fragment.notes,
                fragment.source_locator,
                fragment.extraction_status,
                content_hash(fragment),
                json_text(fragment.metadata),
                timestamp,
                timestamp,
            ),
        )
        extraction_method = (
            "tesseract-ocr-reviewed"
            if fragment.extraction_status == "ocr_reviewed"
            else document["parser"]
        )
        evidence_key = (
            f"evidence:{fragment.stable_ref}:{fragment.source_locator}:{extraction_method}"
        )
        connection.execute(
            """
            INSERT INTO content_source_evidence(
              id, target_ref, source_asset_hash, source_locator,
              extraction_method, evidence_hash, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                stable_id(evidence_key),
                fragment.stable_ref,
                document["sha256"],
                fragment.source_locator,
                extraction_method,
                content_hash(fragment),
                json_text({"documentRef": document_ref}),
                timestamp,
            ),
        )

    fragment_locators = {
        fragment.stable_ref: fragment.source_locator
        for fragment in fragments
    }
    for relation in relations:
        connection.execute(
            """
            INSERT INTO content_relations(
              id, stable_ref, source_ref, target_ref, relation_type,
              relation_label, ordinal, metadata_json, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                stable_id(relation.stable_ref),
                relation.stable_ref,
                relation.source_ref,
                relation.target_ref,
                relation.relation_type,
                relation.relation_label,
                relation.ordinal,
                json_text(relation.metadata),
                timestamp,
                timestamp,
            ),
        )
        relation_locator = fragment_locators.get(
            str(relation.metadata.get("edgeRef") or relation.target_ref),
            f"content-relation:{relation.ordinal or 0}",
        )
        relation_evidence_hash = sha256_bytes(
            json_text(
                {
                    "stableRef": relation.stable_ref,
                    "sourceRef": relation.source_ref,
                    "targetRef": relation.target_ref,
                    "relationType": relation.relation_type,
                    "relationLabel": relation.relation_label,
                    "metadata": relation.metadata,
                }
            ).encode("utf-8")
        )
        connection.execute(
            """
            INSERT INTO content_source_evidence(
              id, target_ref, source_asset_hash, source_locator,
              extraction_method, evidence_hash, metadata_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                stable_id(f"evidence:{relation.stable_ref}:{relation_locator}"),
                relation.stable_ref,
                document["sha256"],
                relation_locator,
                (
                    "drawio-mxgraph-relation"
                    if relation.relation_type == "drawio_connects"
                    else f"{document['parser']}-relation"
                ),
                relation_evidence_hash,
                json_text({"documentRef": document_ref}),
                timestamp,
            ),
        )


def reset_and_import_query_content(
    connection: sqlite3.Connection,
    manifest: dict[str, Any],
    review_manifest: dict[str, Any],
) -> None:
    timestamp = manifest["frozen_at"]
    with connection:
        connection.execute("DELETE FROM content_source_evidence")
        connection.execute("DELETE FROM content_bindings")
        connection.execute("DELETE FROM content_relations")
        connection.execute("DELETE FROM content_documents")
        for document in manifest["documents"]:
            insert_document(
                connection,
                document,
                manifest,
                review_manifest,
                timestamp,
            )
        meta = {
            "schema_version": CONTENT_SCHEMA_VERSION,
            "manifest_id": manifest["manifest_id"],
            "manifest_version": manifest["manifest_version"],
            "ocr_review_id": review_manifest["review_id"],
            "ocr_review_version": review_manifest["review_version"],
            "base_database_sha256": manifest["database_targets"][
                "formal_query_database_sha256_before"
            ],
        }
        for key, value in meta.items():
            connection.execute(
                """
                INSERT INTO content_schema_meta(key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                  value=excluded.value,
                  updated_at=excluded.updated_at
                """,
                (key, value, timestamp),
            )


def mime_type(path: Path) -> str:
    known = {
        ".drawio": "application/vnd.jgraph.mxfile",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".md": "text/markdown",
        ".svg": "image/svg+xml",
        ".json": "application/json",
    }
    return known.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def insert_asset(
    connection: sqlite3.Connection,
    *,
    source_path: Path,
    expected_hash: str,
    owner_ref: str,
    role: str,
    logical_file_name: str,
    ordinal: int | None,
    metadata: dict[str, Any],
    timestamp: str,
) -> None:
    payload = source_path.read_bytes()
    actual_hash = sha256_bytes(payload)
    if actual_hash != expected_hash:
        raise ValueError(
            f"资产hash不符：{logical_file_name} expected={expected_hash} actual={actual_hash}"
        )
    suffix = Path(logical_file_name).suffix.lower().lstrip(".")
    connection.execute(
        """
        INSERT INTO content_assets(
          asset_hash, mime_type, format, byte_count, content_bytes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(asset_hash) DO UPDATE SET
          mime_type=excluded.mime_type,
          format=excluded.format,
          byte_count=excluded.byte_count,
          content_bytes=excluded.content_bytes
        """,
        (
            actual_hash,
            mime_type(source_path),
            suffix,
            len(payload),
            payload,
            timestamp,
        ),
    )
    link_ref = f"asset-link:{owner_ref}:{role}:{logical_file_name}"
    connection.execute(
        """
        INSERT INTO document_assets(
          id, owner_ref, asset_hash, asset_role, ordinal,
          logical_file_name, metadata_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            stable_id(link_ref),
            owner_ref,
            actual_hash,
            role,
            ordinal,
            logical_file_name,
            json_text(metadata),
            timestamp,
            timestamp,
        ),
    )


def collection_paths(collection: dict[str, Any]) -> list[Path]:
    directory = ROOT / collection["source_directory"]
    pattern = re.compile(collection["file_filter"])
    return sorted(
        path for path in directory.iterdir() if path.is_file() and pattern.search(path.name)
    )


def verify_collection_manifest(
    collection: dict[str, Any],
    paths: list[Path],
) -> None:
    digest = hashlib.sha256()
    total_bytes = 0
    for path in paths:
        payload = path.read_bytes()
        total_bytes += len(payload)
        digest.update(path.name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(hashlib.sha256(payload).digest())
    actual_digest = digest.hexdigest()
    if len(paths) != int(collection["expected_count"]):
        raise ValueError(
            f"派生集合计数不符：{collection['collection_id']} "
            f"expected={collection['expected_count']} actual={len(paths)}"
        )
    if total_bytes != int(collection["expected_bytes"]):
        raise ValueError(
            f"派生集合字节数不符：{collection['collection_id']} "
            f"expected={collection['expected_bytes']} actual={total_bytes}"
        )
    if actual_digest != collection["manifest_sha256"]:
        raise ValueError(
            f"派生集合清单hash不符：{collection['collection_id']} "
            f"expected={collection['manifest_sha256']} actual={actual_digest}"
        )


def collection_logical_name(
    collection: dict[str, Any],
    path: Path,
    ordinal: int,
) -> str:
    pattern = collection["logical_file_name_pattern"]
    if "{page:03d}" in pattern:
        match = re.search(r"(\d+)", path.stem)
        page = int(match.group(1)) if match else ordinal
        return pattern.replace("{page:03d}", f"{page:03d}")
    if "{region}" in pattern:
        return pattern.replace("{region}", poster_region_slug(path))
    raise ValueError(f"未知逻辑文件名模板：{pattern}")


def reset_and_import_assets(
    connection: sqlite3.Connection,
    manifest: dict[str, Any],
) -> None:
    timestamp = manifest["frozen_at"]
    document_refs = {
        document["document_id"]: document["stable_ref"]
        for document in manifest["documents"]
    }
    with connection:
        connection.execute("DELETE FROM document_assets")
        connection.execute("DELETE FROM content_assets")
        for document in manifest["documents"]:
            insert_asset(
                connection,
                source_path=ROOT / document["source_path"],
                expected_hash=document["sha256"],
                owner_ref=document["stable_ref"],
                role="original",
                logical_file_name=document["logical_file_name"],
                ordinal=None,
                metadata={"documentKey": document["document_id"]},
                timestamp=timestamp,
            )
        for asset in manifest["derived_assets"]:
            source_path = ROOT / asset["source_paths"][0]
            insert_asset(
                connection,
                source_path=source_path,
                expected_hash=asset["sha256"],
                owner_ref=document_refs[asset["document_id"]],
                role=asset["asset_role"],
                logical_file_name=asset["logical_file_name"],
                ordinal=None,
                metadata={"assetKey": asset["asset_id"]},
                timestamp=timestamp,
            )
        for collection in manifest["derived_collections"]:
            paths = collection_paths(collection)
            verify_collection_manifest(collection, paths)
            document_ref = document_refs[collection["document_id"]]
            for ordinal, source_path in enumerate(paths, start=1):
                logical_name = collection_logical_name(collection, source_path, ordinal)
                file_hash = sha256_file(source_path)
                if "{page:03d}" in collection["logical_file_name_pattern"]:
                    owner_ref = f"{document_ref}:page:{ordinal:03d}"
                    role = "page-preview"
                else:
                    region = poster_region_slug(source_path)
                    owner_ref = f"{document_ref}:region:{region}"
                    role = "region-preview"
                insert_asset(
                    connection,
                    source_path=source_path,
                    expected_hash=file_hash,
                    owner_ref=owner_ref,
                    role=role,
                    logical_file_name=logical_name,
                    ordinal=ordinal,
                    metadata={"collectionKey": collection["collection_id"]},
                    timestamp=timestamp,
                )
        connection.execute(
            """
            DELETE FROM content_assets
            WHERE asset_hash NOT IN (SELECT DISTINCT asset_hash FROM document_assets)
            """
        )
        meta = {
            "schema_version": ASSET_SCHEMA_VERSION,
            "manifest_id": manifest["manifest_id"],
            "manifest_version": manifest["manifest_version"],
        }
        for key, value in meta.items():
            connection.execute(
                """
                INSERT INTO asset_schema_meta(key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                  value=excluded.value,
                  updated_at=excluded.updated_at
                """,
                (key, value, timestamp),
            )


def source_hashes(manifest: dict[str, Any]) -> dict[str, str]:
    result: dict[str, str] = {}
    for document in manifest["documents"]:
        result[f"document:{document['document_id']}"] = sha256_file(
            ROOT / document["source_path"]
        )
    for asset in manifest["derived_assets"]:
        for index, source_path in enumerate(asset["source_paths"], start=1):
            result[f"asset:{asset['asset_id']}:{index}"] = sha256_file(ROOT / source_path)
    for collection in manifest["derived_collections"]:
        digest = hashlib.sha256()
        for path in collection_paths(collection):
            digest.update(path.name.encode("utf-8"))
            digest.update(b"\0")
            digest.update(sha256_file(path).encode("ascii"))
            digest.update(b"\n")
        result[f"collection:{collection['collection_id']}"] = digest.hexdigest()
    return result


def query_snapshot(connection: sqlite3.Connection) -> dict[str, Any]:
    tables = (
        "content_documents",
        "content_fragments",
        "content_relations",
        "content_bindings",
        "content_source_evidence",
    )
    return {
        "counts": {
            table: connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in tables
        },
        "digests": {table: table_digest(connection, table) for table in tables},
        "fragmentTypes": {
            row[0]: row[1]
            for row in connection.execute(
                """
                SELECT fragment_type, COUNT(*)
                FROM content_fragments
                GROUP BY fragment_type
                ORDER BY fragment_type
                """
            )
        },
        "extractionStatuses": {
            row[0]: row[1]
            for row in connection.execute(
                """
                SELECT extraction_status, COUNT(*)
                FROM content_fragments
                GROUP BY extraction_status
                ORDER BY extraction_status
                """
            )
        },
    }


def quality_gates(
    query_connection: sqlite3.Connection,
    asset_connection: sqlite3.Connection,
) -> dict[str, Any]:
    fragment_types = {
        row[0]: row[1]
        for row in query_connection.execute(
            """
            SELECT fragment_type, COUNT(*)
            FROM content_fragments
            GROUP BY fragment_type
            """
        )
    }
    dangling_endpoints = query_connection.execute(
        """
        WITH refs AS (
          SELECT stable_ref FROM content_documents
          UNION
          SELECT stable_ref FROM content_fragments
        )
        SELECT COUNT(*)
        FROM content_relations
        WHERE source_ref NOT IN (SELECT stable_ref FROM refs)
           OR target_ref NOT IN (SELECT stable_ref FROM refs)
        """
    ).fetchone()[0]
    poster_ocr = query_connection.execute(
        """
        SELECT COUNT(*)
        FROM content_fragments AS fragment
        JOIN content_documents AS document ON document.id=fragment.document_id
        WHERE document.document_key='archimate-3.2-reference-poster-zh'
          AND fragment.extraction_status!='manual_catalog_only'
        """
    ).fetchone()[0]
    pending_ocr = query_connection.execute(
        """
        SELECT COUNT(*)
        FROM content_fragments
        WHERE extraction_status='ocr_pending'
        """
    ).fetchone()[0]
    reviewed_ocr = query_connection.execute(
        """
        SELECT COUNT(*)
        FROM content_fragments
        WHERE extraction_status='ocr_reviewed'
        """
    ).fetchone()[0]
    unsafe_html_terms = query_connection.execute(
        """
        SELECT COUNT(*)
        FROM content_fragments
        WHERE fragment_type IN ('html_section', 'markdown_section')
          AND (
            lower(body) LIKE '%<script%'
            OR lower(body) LIKE '%document.queryselector%'
            OR lower(body) LIKE '%<nav%'
          )
        """
    ).fetchone()[0]
    bad_logical_names = asset_connection.execute(
        """
        SELECT COUNT(*)
        FROM document_assets
        WHERE lower(logical_file_name) LIKE '%sample%'
           OR lower(logical_file_name) LIKE '%samle%'
           OR logical_file_name LIKE '~$%'
        """
    ).fetchone()[0]
    expected = {
        "drawio_page": 3,
        "pdf_page": 164,
        "pptx_slide": 80,
        "manual_catalog": 7,
    }
    expected_counts_match = all(
        fragment_types.get(fragment_type) == count
        for fragment_type, count in expected.items()
    )
    return {
        "expectedCountsMatch": expected_counts_match,
        "expectedFragmentCounts": expected,
        "actualFragmentCounts": fragment_types,
        "pendingOcrCount": pending_ocr,
        "reviewedOcrCount": reviewed_ocr,
        "posterOcrCount": poster_ocr,
        "danglingRelationEndpoints": dangling_endpoints,
        "unsafeHtmlTerms": unsafe_html_terms,
        "badLogicalFileNames": bad_logical_names,
        "pass": (
            expected_counts_match
            and pending_ocr == 0
            and reviewed_ocr == 2
            and poster_ocr == 0
            and dangling_endpoints == 0
            and unsafe_html_terms == 0
            and bad_logical_names == 0
        ),
    }


def asset_snapshot(connection: sqlite3.Connection) -> dict[str, Any]:
    asset_columns = (
        "asset_hash",
        "mime_type",
        "format",
        "byte_count",
        "created_at",
    )
    link_columns = (
        "id",
        "owner_ref",
        "asset_hash",
        "asset_role",
        "ordinal",
        "logical_file_name",
        "metadata_json",
        "created_at",
        "updated_at",
    )
    roundtrip_issues = []
    for row in connection.execute(
        "SELECT asset_hash, byte_count, content_bytes FROM content_assets ORDER BY asset_hash"
    ):
        payload = bytes(row["content_bytes"])
        if len(payload) != row["byte_count"] or sha256_bytes(payload) != row["asset_hash"]:
            roundtrip_issues.append(row["asset_hash"])
    return {
        "counts": {
            "content_assets": connection.execute(
                "SELECT COUNT(*) FROM content_assets"
            ).fetchone()[0],
            "document_assets": connection.execute(
                "SELECT COUNT(*) FROM document_assets"
            ).fetchone()[0],
        },
        "digests": {
            "content_assets": table_digest(
                connection,
                "content_assets",
                columns=asset_columns,
            ),
            "document_assets": table_digest(
                connection,
                "document_assets",
                columns=link_columns,
            ),
        },
        "storedBytes": connection.execute(
            "SELECT COALESCE(SUM(byte_count), 0) FROM content_assets"
        ).fetchone()[0],
        "roundtripIssues": roundtrip_issues,
    }


def sync_runtime_digests(
    query_connection: sqlite3.Connection,
    asset_connection: sqlite3.Connection,
    query_state: dict[str, Any],
    asset_state: dict[str, Any],
    *,
    timestamp: str,
) -> dict[str, str]:
    content_digest = "sha256:" + sha256_bytes(
        json_text(
            {
                "counts": query_state["counts"],
                "digests": query_state["digests"],
                "fragmentTypes": query_state["fragmentTypes"],
                "extractionStatuses": query_state["extractionStatuses"],
            }
        ).encode("utf-8")
    )
    asset_manifest_digest = "sha256:" + sha256_bytes(
        json_text(
            {
                "counts": asset_state["counts"],
                "digests": asset_state["digests"],
                "storedBytes": asset_state["storedBytes"],
            }
        ).encode("utf-8")
    )
    values = {
        "content_manifest_digest": content_digest,
        "asset_manifest_digest": asset_manifest_digest,
    }
    with query_connection:
        for key, value in values.items():
            query_connection.execute(
                """
                INSERT INTO content_schema_meta(key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                  value=excluded.value,
                  updated_at=excluded.updated_at
                """,
                (key, value, timestamp),
            )
    with asset_connection:
        for key, value in values.items():
            asset_connection.execute(
                """
                INSERT INTO asset_schema_meta(key, value, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(key) DO UPDATE SET
                  value=excluded.value,
                  updated_at=excluded.updated_at
                """,
                (key, value, timestamp),
            )
    return values


def prepare_databases(
    manifest: dict[str, Any],
    query_schema_path: Path,
    asset_schema_path: Path,
) -> tuple[Path, Path, sqlite3.Connection, sqlite3.Connection]:
    targets = manifest["database_targets"]
    formal_db = (ROOT / targets["formal_query_database"]).resolve()
    candidate_query = require_bounded_output(ROOT / targets["candidate_query_database"])
    candidate_asset = require_bounded_output(ROOT / targets["candidate_asset_database"])
    candidate_query.parent.mkdir(parents=True, exist_ok=True)
    candidate_asset.parent.mkdir(parents=True, exist_ok=True)
    if candidate_query == formal_db:
        raise ValueError("候选查询库不得等于正式查询库")
    if not candidate_query.exists():
        sqlite_backup(formal_db, candidate_query)
    query_connection = connect_database(candidate_query)
    query_connection.executescript(query_schema_path.read_text(encoding="utf-8"))
    existing_base_hash = query_connection.execute(
        "SELECT value FROM content_schema_meta WHERE key='base_database_sha256'"
    ).fetchone()
    expected_base_hash = targets["formal_query_database_sha256_before"]
    if existing_base_hash and existing_base_hash[0] != expected_base_hash:
        raise ValueError("候选查询库记录的基础库哈希与T0清单不一致")

    asset_connection = connect_database(candidate_asset)
    asset_connection.executescript(asset_schema_path.read_text(encoding="utf-8"))
    existing_manifest = asset_connection.execute(
        "SELECT value FROM asset_schema_meta WHERE key='manifest_id'"
    ).fetchone()
    if existing_manifest and existing_manifest[0] != manifest["manifest_id"]:
        raise ValueError("候选资产库已属于其他内容清单")
    return candidate_query, candidate_asset, query_connection, asset_connection


def run(args: argparse.Namespace) -> dict[str, Any]:
    manifest_path = Path(args.manifest).resolve()
    query_schema_path = Path(args.query_schema).resolve()
    asset_schema_path = Path(args.asset_schema).resolve()
    review_path = Path(args.ocr_review).resolve()
    manifest = read_json(manifest_path)
    review_manifest = read_json(review_path)
    if (
        review_manifest.get("status") != "approved"
        or not review_manifest.get("policy", {}).get("poster_ocr_forbidden")
    ):
        raise ValueError("OCR复核清单必须已批准且继续禁止Poster OCR")
    formal_db = (ROOT / manifest["database_targets"]["formal_query_database"]).resolve()
    formal_hash_before = sha256_file(formal_db)
    expected_formal_hash = manifest["database_targets"][
        "formal_query_database_sha256_before"
    ]
    if formal_hash_before != expected_formal_hash:
        raise ValueError(
            f"正式基础库hash与T0清单不符：expected={expected_formal_hash} "
            f"actual={formal_hash_before}"
        )
    sources_before = source_hashes(manifest)
    for document in manifest["documents"]:
        if sources_before[f"document:{document['document_id']}"] != document["sha256"]:
            raise ValueError(f"正式源hash不符：{document['document_id']}")

    (
        candidate_query,
        candidate_asset,
        query_connection,
        asset_connection,
    ) = prepare_databases(manifest, query_schema_path, asset_schema_path)
    try:
        reset_and_import_query_content(
            query_connection,
            manifest,
            review_manifest,
        )
        reset_and_import_assets(asset_connection, manifest)
        first_query = query_snapshot(query_connection)
        first_asset = asset_snapshot(asset_connection)
        sync_runtime_digests(
            query_connection,
            asset_connection,
            first_query,
            first_asset,
            timestamp=manifest["frozen_at"],
        )
        first = {
            "query": first_query,
            "asset": first_asset,
            "quality": quality_gates(query_connection, asset_connection),
        }
        reset_and_import_query_content(
            query_connection,
            manifest,
            review_manifest,
        )
        reset_and_import_assets(asset_connection, manifest)
        second_query = query_snapshot(query_connection)
        second_asset = asset_snapshot(asset_connection)
        runtime_digests = sync_runtime_digests(
            query_connection,
            asset_connection,
            second_query,
            second_asset,
            timestamp=manifest["frozen_at"],
        )
        second = {
            "query": second_query,
            "asset": second_asset,
            "quality": quality_gates(query_connection, asset_connection),
        }
        query_connection.execute(
            "INSERT INTO content_fragments_fts(content_fragments_fts) VALUES('integrity-check')"
        )
        query_integrity = database_integrity(query_connection)
        asset_integrity = database_integrity(asset_connection)
    finally:
        query_connection.close()
        asset_connection.close()

    formal_hash_after = sha256_file(formal_db)
    sources_after = source_hashes(manifest)
    issues: list[str] = []
    if first != second:
        issues.append("repeat import changed the logical candidate snapshot")
    if formal_hash_after != formal_hash_before:
        issues.append("formal base database changed")
    if sources_after != sources_before:
        issues.append("source assets changed")
    if second["asset"]["roundtripIssues"]:
        issues.append("asset roundtrip verification failed")
    if not second["quality"]["pass"]:
        issues.append("content quality gates failed")
    if query_integrity != {"integrityCheck": "ok", "foreignKeyCheck": "pass"}:
        issues.append("candidate query database integrity failed")
    if asset_integrity != {"integrityCheck": "ok", "foreignKeyCheck": "pass"}:
        issues.append("candidate asset database integrity failed")

    report = {
        "schemaVersion": "content-candidate-report-v2",
        "result": "pass" if not issues else "fail",
        "manifestId": manifest["manifest_id"],
        "manifestVersion": manifest["manifest_version"],
        "querySchemaVersion": CONTENT_SCHEMA_VERSION,
        "assetSchemaVersion": ASSET_SCHEMA_VERSION,
        "ocrReviewId": review_manifest["review_id"],
        "ocrReviewVersion": review_manifest["review_version"],
        "candidateQueryDatabase": str(candidate_query.relative_to(ROOT)),
        "candidateAssetDatabase": str(candidate_asset.relative_to(ROOT)),
        "formalBaseDatabase": {
            "sha256Before": formal_hash_before,
            "sha256After": formal_hash_after,
            "unchanged": formal_hash_before == formal_hash_after,
        },
        "userDatabaseAccess": "not_accessed",
        "sourceAssetsUnchanged": sources_before == sources_after,
        "idempotentRepeatImport": first == second,
        "queryIntegrity": query_integrity,
        "assetIntegrity": asset_integrity,
        "snapshot": second,
        "runtimeDigests": runtime_digests,
        "issues": issues,
    }
    report_path = (
        Path(args.report).resolve()
        if args.report
        else require_bounded_output(
            ROOT / manifest["database_targets"]["report_directory"] / "t1-report.json"
        )
    )
    report_path = require_bounded_output(report_path)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    report["reportPath"] = str(report_path.relative_to(ROOT))
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "从T0正式内容清单构建候选查询库和独立内容资产库，"
            "并执行两次导入幂等与资产round-trip验收。"
        )
    )
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--query-schema", default=str(DEFAULT_QUERY_SCHEMA))
    parser.add_argument("--asset-schema", default=str(DEFAULT_ASSET_SCHEMA))
    parser.add_argument("--ocr-review", default=str(DEFAULT_OCR_REVIEW))
    parser.add_argument("--report")
    return parser.parse_args()


def main() -> int:
    report = run(parse_args())
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["result"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
