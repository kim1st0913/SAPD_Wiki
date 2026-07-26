#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from sapd_wiki.local_mcp.base_query_service import (  # noqa: E402
    SCOPE,
    BaseKnowledgeQueryService,
)
from sapd_wiki.local_mcp.models import RequestContext  # noqa: E402


DEFAULT_MANIFEST = ROOT / "config/content-source-manifest.v1.json"
DEFAULT_CANDIDATE = (
    ROOT
    / "data/exports/worker-verify/base-content-unified-query/candidate/"
    "sapd_wiki.content-candidate.sqlite3"
)
DEFAULT_REPORT = (
    ROOT
    / "data/exports/worker-verify/base-content-unified-query/reports/"
    "t3-query-report.json"
)
ALLOWED_OUTPUT_ROOT = (
    ROOT / "data/exports/worker-verify/base-content-unified-query"
).resolve()
BASE_OBJECT_REF = "base:capability:capability::G-SP.SM"
VALUE_CHAIN_REF = (
    "base:content_document:"
    "strategic-consulting-planning-department-knowledge-base-v2.2:slide:032"
)
DRAWIO_PAGE_REF = (
    "base:content_document:sapd-security-architecture-model:page:003"
)
FORBIDDEN_OUTPUT_TERMS = (
    "content_bytes",
    "metadata_json",
    "source_file_id",
    "raw_value",
    "raw_xml",
    "raw_svg",
    "/users/",
    "/private/",
    "data/raw-samples",
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def bounded_output(path: Path) -> Path:
    resolved = path.resolve()
    if ALLOWED_OUTPUT_ROOT not in resolved.parents:
        raise ValueError(f"T3报告路径越界：{resolved}")
    return resolved


def request_context() -> RequestContext:
    return RequestContext(
        client_id="content-query-t3-audit",
        grant_version="content-query-t3-readonly",
        scope=SCOPE,
        correlation_id="content-query-t3-correlation",
    )


def response_data(response: Any) -> dict[str, Any]:
    return response.to_dict()["data"]


def run(args: argparse.Namespace) -> dict[str, Any]:
    manifest = read_json(Path(args.manifest).resolve())
    candidate = Path(args.candidate).resolve()
    report_path = bounded_output(Path(args.report).resolve())
    formal = (ROOT / manifest["database_targets"]["formal_query_database"]).resolve()
    expected_formal_hash = manifest["database_targets"][
        "formal_query_database_sha256_before"
    ]
    formal_before = sha256_file(formal)
    candidate_before = sha256_file(candidate)
    issues: list[str] = []
    if formal_before != expected_formal_hash:
        issues.append("formal base database hash differs from T0 manifest")

    request = request_context()
    with BaseKnowledgeQueryService.create(
        base_database=candidate,
        cursor_key=b"content-query-t3-cursor-" + (b"x" * 32),
    ) as service:
        base_search = response_data(
            service.search_knowledge(
                "安全战略管理能力",
                request=request,
                limit=15,
            )
        )["items"]
        content_search = response_data(
            service.search_knowledge(
                "价值链",
                request=request,
                limit=15,
            )
        )["items"]
        base_object = response_data(
            service.get_knowledge_object(BASE_OBJECT_REF, request=request)
        )
        value_chain = response_data(
            service.get_knowledge_object(VALUE_CHAIN_REF, request=request)
        )
        value_chain_evidence = response_data(
            service.get_source_evidence(
                VALUE_CHAIN_REF,
                include_excerpt=False,
                request=request,
                limit=15,
            )
        )["items"]
        drawio_page = response_data(
            service.get_knowledge_object(DRAWIO_PAGE_REF, request=request)
        )
        drawio_relations = response_data(
            service.get_related_knowledge(
                DRAWIO_PAGE_REF,
                "outgoing",
                request=request,
                limit=1,
            )
        )["items"]
        if not drawio_relations:
            issues.append("drawio page has no queryable content relation")
            content_relation = {}
            direct_content_relation: list[dict[str, Any]] = []
            content_relation_evidence: list[dict[str, Any]] = []
        else:
            content_relation = drawio_relations[0]
            direct_content_relation = response_data(
                service.get_related_knowledge(
                    content_relation["relation_ref"],
                    "both",
                    request=request,
                    limit=1,
                )
            )["items"]
            content_relation_evidence = response_data(
                service.get_source_evidence(
                    content_relation["relation_ref"],
                    include_excerpt=False,
                    request=request,
                    limit=15,
                )
            )["items"]

        base_relations = response_data(
            service.get_related_knowledge(
                BASE_OBJECT_REF,
                "both",
                request=request,
                limit=1,
            )
        )["items"]
        if not base_relations:
            issues.append("base object has no queryable business relation")
            direct_base_relation: list[dict[str, Any]] = []
            base_relation_evidence: list[dict[str, Any]] = []
        else:
            base_relation_ref = base_relations[0]["relation_ref"]
            direct_base_relation = response_data(
                service.get_related_knowledge(
                    base_relation_ref,
                    "both",
                    request=request,
                    limit=1,
                )
            )["items"]
            base_relation_evidence = response_data(
                service.get_source_evidence(
                    base_relation_ref,
                    include_excerpt=False,
                    request=request,
                    limit=15,
                )
            )["items"]
        version = response_data(service.get_knowledge_version(request=request))

    if not any(item["canonical_ref"] == BASE_OBJECT_REF for item in base_search):
        issues.append("base object search did not return the representative object")
    if not any(item["canonical_ref"] == VALUE_CHAIN_REF for item in content_search):
        issues.append("content FTS did not return the representative slide")
    if base_object.get("object_type") != "capability":
        issues.append("base exact object projection has wrong grain")
    if value_chain.get("object_type") != "pptx_slide":
        issues.append("content exact object projection has wrong grain")
    if "价值交付" not in value_chain.get("description", ""):
        issues.append("content exact object omitted reviewed business text")
    if value_chain.get("parent_ref") != VALUE_CHAIN_REF.rsplit(":slide:", 1)[0]:
        issues.append("content fragment parent identity is incorrect")
    if not value_chain_evidence or value_chain_evidence[0].get(
        "extraction_method"
    ) != "tesseract-ocr-reviewed":
        issues.append("content fragment provenance is missing")
    if drawio_page.get("object_type") != "drawio_page":
        issues.append("drawio page exact projection has wrong grain")
    if direct_content_relation != [content_relation]:
        issues.append("content relation_ref direct read is inconsistent")
    if not content_relation_evidence:
        issues.append("content relation provenance is missing")
    if base_relations and direct_base_relation != base_relations:
        issues.append("base relation_ref direct read is inconsistent")
    if base_relations and not base_relation_evidence:
        issues.append("base relation provenance is missing")

    serialized = json.dumps(
        {
            "baseSearch": base_search,
            "contentSearch": content_search,
            "baseObject": base_object,
            "valueChain": value_chain,
            "valueChainEvidence": value_chain_evidence,
            "drawioPage": drawio_page,
            "contentRelation": content_relation,
            "contentRelationEvidence": content_relation_evidence,
            "baseRelations": base_relations,
            "baseRelationEvidence": base_relation_evidence,
            "version": version,
        },
        ensure_ascii=False,
        sort_keys=True,
    ).casefold()
    leaked_terms = [
        term for term in FORBIDDEN_OUTPUT_TERMS if term.casefold() in serialized
    ]
    if leaked_terms:
        issues.append(f"query projection leaked forbidden terms: {leaked_terms}")

    formal_after = sha256_file(formal)
    candidate_after = sha256_file(candidate)
    if formal_after != formal_before:
        issues.append("formal base database changed during T3 audit")
    if candidate_after != candidate_before:
        issues.append("candidate database changed during immutable T3 audit")

    report = {
        "schemaVersion": "content-query-t3-report-v1",
        "result": "pass" if not issues else "fail",
        "contentQueryEnabled": True,
        "representativeReads": {
            "baseObjectRef": BASE_OBJECT_REF,
            "contentFragmentRef": VALUE_CHAIN_REF,
            "drawioPageRef": DRAWIO_PAGE_REF,
            "contentRelationRef": content_relation.get("relation_ref"),
            "baseRelationRef": (
                base_relations[0]["relation_ref"] if base_relations else None
            ),
        },
        "searchCounts": {
            "base": len(base_search),
            "content": len(content_search),
        },
        "evidenceCounts": {
            "contentFragment": len(value_chain_evidence),
            "contentRelation": len(content_relation_evidence),
            "baseRelation": len(base_relation_evidence),
        },
        "version": version,
        "formalBaseDatabase": {
            "sha256Before": formal_before,
            "sha256After": formal_after,
            "unchanged": formal_before == formal_after,
        },
        "candidateDatabase": {
            "sha256Before": candidate_before,
            "sha256After": candidate_after,
            "unchanged": candidate_before == candidate_after,
        },
        "userDatabaseAccess": "not_accessed",
        "forbiddenOutputTerms": leaked_terms,
        "issues": issues,
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    report["reportPath"] = str(report_path.relative_to(ROOT))
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit unified base/content query projections against the T3 candidate."
    )
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    parser.add_argument("--candidate", default=str(DEFAULT_CANDIDATE))
    parser.add_argument("--report", default=str(DEFAULT_REPORT))
    return parser.parse_args()


def main() -> int:
    report = run(parse_args())
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["result"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
