#!/usr/bin/env python3
"""Semantic quality probes for the SAPD Wiki global search index."""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.sapd_wiki.api_server import search_index_payload  # noqa: E402


FORBIDDEN_PUBLIC_FIELDS = {
    "sheet",
    "row",
    "column",
    "raw_value",
    "source_file",
    "import_id",
    "source_id",
    "source_ref",
    "source_label",
    "debug",
    "raw",
    "metadata",
    "intermediate",
    "generated_at",
}

SEARCH_INDEX_COVERAGE_MATRIX = [
    {
        "slug": "capability",
        "domain": "能力",
        "golden_query": "RASP",
        "category": "安全能力",
        "route_prefixes": ["/capability-mapping"],
        "type_labels": ["能力安全技术模块"],
        "counter_query": "数据中心",
        "forbidden_route_prefixes": ["/capability-mapping"],
    },
    {
        "slug": "environment",
        "domain": "环境",
        "golden_query": "数据中心",
        "category": "信息化环境",
        "route_prefixes": ["/environment-mapping"],
        "object_types": ["information_environment", "information_object"],
        "counter_query": "ISSUE清单",
        "forbidden_route_prefixes": ["/environment-mapping"],
    },
    {
        "slug": "lc_ap",
        "domain": "LC-AP",
        "golden_query": "Ansible",
        "category": "生命周期",
        "route_prefixes": ["/development-security"],
        "type_labels": ["开发技术模块"],
        "counter_query": "人工智能",
        "forbidden_route_prefixes": ["/development-security"],
    },
    {
        "slug": "lc_dt",
        "domain": "LC-DT",
        "golden_query": "数据脱敏",
        "category": "生命周期",
        "route_prefixes": ["/data-security"],
        "object_types": ["security_technology_module", "security_technical_measure", "security_technical_service"],
        "counter_query": "Ansible",
        "forbidden_route_prefixes": ["/data-security"],
    },
    {
        "slug": "knowledge",
        "domain": "知识库",
        "golden_query": "WAF",
        "category": "知识库",
        "route_prefixes": ["/knowledge/"],
        "object_types": ["security_technology_module", "security_technical_service", "security_technical_measure", "route"],
        "counter_query": "ISSUE清单",
        "forbidden_route_prefixes": ["/knowledge/"],
    },
    {
        "slug": "standards",
        "domain": "标准",
        "golden_query": "人工智能",
        "category": "标准 / 框架",
        "route_prefixes": ["/standards/"],
        "object_types": ["standard_control"],
        "counter_query": "数据中心",
        "forbidden_route_prefixes": ["/standards/"],
    },
    {
        "slug": "workbench",
        "domain": "工作台",
        "golden_query": "ISSUE清单",
        "category": "工作台",
        "route_prefixes": ["/workbench/"],
        "object_types": ["route"],
        "counter_query": "人工智能",
        "forbidden_route_prefixes": ["/workbench/"],
    },
]


def listify(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def category_count(payload: dict[str, Any], label: str) -> int:
    for row in listify(payload.get("facets", {}).get("categories")):
        if row.get("label") == label:
            return int(row.get("count") or 0)
    return 0


def titles(payload: dict[str, Any]) -> list[str]:
    return [str(row.get("title") or "") for row in listify(payload.get("results"))]


def serialized_results(payload: dict[str, Any]) -> str:
    return json.dumps(payload.get("results") or [], ensure_ascii=False, sort_keys=True)


def result_type_label(row: dict[str, Any]) -> str:
    return str(row.get("typeLabel") or row.get("type_label") or row.get("object_label") or "")


def route_matches(row: dict[str, Any], prefixes: list[str]) -> bool:
    route = str(row.get("route") or "")
    return any(route == prefix.rstrip("/") or route.startswith(prefix) for prefix in prefixes)


def result_matches_matrix(row: dict[str, Any], entry: dict[str, Any]) -> bool:
    if entry.get("route_prefixes") and not route_matches(row, list(entry.get("route_prefixes") or [])):
        return False
    type_labels = {str(value) for value in listify(entry.get("type_labels"))}
    if type_labels and result_type_label(row) not in type_labels:
        return False
    object_types = {str(value) for value in listify(entry.get("object_types"))}
    if object_types and str(row.get("object_type") or "") not in object_types:
        return False
    return True


def find_matrix_match(payload: dict[str, Any], entry: dict[str, Any]) -> dict[str, Any] | None:
    for row in listify(payload.get("results")):
        if isinstance(row, dict) and result_matches_matrix(row, entry):
            return row
    return None


def result_has_locator(row: dict[str, Any] | None) -> bool:
    if not row:
        return False
    return bool(str(row.get("route") or "").strip() and (str(row.get("target_ref") or "").strip() or str(row.get("object_id") or "").strip()))


def forbidden_fields(payload: dict[str, Any]) -> list[str]:
    serialized = serialized_results(payload)
    return sorted(field for field in FORBIDDEN_PUBLIC_FIELDS if f'"{field}"' in serialized)


def has_forbidden_route(payload: dict[str, Any], prefixes: list[str]) -> bool:
    return any(isinstance(row, dict) and route_matches(row, prefixes) for row in listify(payload.get("results")))


def add_check(checks: list[dict[str, Any]], check_id: str, ok: bool, message: str, detail: dict[str, Any] | None = None) -> None:
    row: dict[str, Any] = {"id": check_id, "ok": bool(ok), "message": message}
    if detail is not None:
        row["detail"] = detail
    checks.append(row)


def payload_summary(query: str, payload: dict[str, Any]) -> dict[str, Any]:
    results = listify(payload.get("results"))
    return {
        "query": query,
        "data_state": payload.get("data_state"),
        "total": payload.get("facets", {}).get("total"),
        "returned": len(results),
        "truncated": payload.get("facets", {}).get("truncated"),
        "window": payload.get("window"),
        "categories": listify(payload.get("facets", {}).get("categories"))[:8],
        "match_kinds": dict(Counter(str(row.get("match_kind") or "") for row in results)),
        "first_titles": titles(payload)[:6],
    }


def main() -> int:
    checks: list[dict[str, Any]] = []
    probes = {
        "管理": search_index_payload("管理", limit=20, offset=0),
        "人工智能": search_index_payload("人工智能", limit=20, offset=0),
        "人工": search_index_payload("人工", limit=20, offset=0),
        "组织": search_index_payload("组织", limit=20, offset=0),
        "组织_101_120": search_index_payload("组织", limit=20, offset=100),
        "组织_461_end": search_index_payload("组织", limit=20, offset=460),
        "密码": search_index_payload("密码", limit=80, offset=0),
        "数据脱敏": search_index_payload("数据脱敏", limit=80, offset=0),
        "应用页面水印": search_index_payload("应用页面水印", limit=80, offset=0),
        "zzzz": search_index_payload("zzzz", limit=20, offset=0),
    }
    matrix_payloads: dict[str, dict[str, Any]] = {}
    for entry in SEARCH_INDEX_COVERAGE_MATRIX:
        matrix_payloads[entry["slug"]] = search_index_payload(str(entry["golden_query"]), limit=80, offset=0)
        matrix_payloads[f'{entry["slug"]}_counter'] = search_index_payload(str(entry["counter_query"]), limit=40, offset=0)

    management = probes["管理"]
    add_check(
        checks,
        "management_query_uses_full_facets_and_light_window",
        management.get("data_state") == "ready"
        and int(management.get("facets", {}).get("total") or 0) > 120
        and len(listify(management.get("results"))) == 20
        and bool(management.get("facets", {}).get("truncated")),
        "管理 must return a 20-row page window while facets keep the full count.",
        payload_summary("管理", management),
    )
    leaked_fields = forbidden_fields(management)
    add_check(
        checks,
        "public_result_field_boundary",
        not leaked_fields,
        "search results must not expose raw provenance, debug, or generated fields.",
        {"leaked_fields": leaked_fields},
    )
    add_check(
        checks,
        "normal_query_payload_budget",
        len(serialized_results(management).encode("utf-8")) < 800 * 1024,
        "a normal search result window must stay below the 800KB payload budget.",
        {"bytes": len(serialized_results(management).encode("utf-8"))},
    )

    ai = probes["人工智能"]
    broad_ai = probes["人工"]
    add_check(
        checks,
        "ai_query_covers_standard_framework_details",
        category_count(ai, "标准 / 框架") > 0 and int(ai.get("facets", {}).get("total") or 0) >= 40,
        "人工智能 must cover standard/framework detail rows, not only loaded page text.",
        payload_summary("人工智能", ai),
    )
    add_check(
        checks,
        "shorter_ai_query_keeps_full_facets",
        int(broad_ai.get("facets", {}).get("total") or 0) >= int(ai.get("facets", {}).get("total") or 0)
        and category_count(broad_ai, "标准 / 框架") >= category_count(ai, "标准 / 框架")
        and category_count(broad_ai, "标准 / 框架") > len([title for title in titles(broad_ai) if title]),
        "人工 must keep full facet counts even when the first result window is mixed.",
        payload_summary("人工", broad_ai),
    )

    org_start = probes["组织"]
    org_mid = probes["组织_101_120"]
    org_tail = probes["组织_461_end"]
    add_check(
        checks,
        "large_result_offsets_are_reachable",
        int(org_start.get("facets", {}).get("total") or 0) > 120
        and org_mid.get("window", {}).get("offset") == 100
        and len(listify(org_mid.get("results"))) == 20
        and org_tail.get("window", {}).get("offset") == 460
        and len(listify(org_tail.get("results"))) > 0,
        "large result sets such as 组织 must be reachable beyond the first 120 rows.",
        {
            "start": payload_summary("组织", org_start),
            "mid": payload_summary("组织@100", org_mid),
            "tail": payload_summary("组织@460", org_tail),
        },
    )

    password_titles = " ".join(titles(probes["密码"]))
    password_forbidden = ["T-AS.IA-02 应用身份认证", "T-AS.IA-04 管理和维护凭证", "特权账号管理"]
    add_check(
        checks,
        "password_query_prunes_weak_context_hits",
        not any(item in password_titles for item in password_forbidden),
        "密码 must not promote weak content/context hits into the main result queue.",
        {"forbidden": [item for item in password_forbidden if item in password_titles], "summary": payload_summary("密码", probes["密码"])},
    )

    desensitization_titles = " ".join(titles(probes["数据脱敏"]))
    desensitization_forbidden = ["数据安全网关", "数据安全防护", "云原生数据安全防护"]
    add_check(
        checks,
        "desensitization_query_stays_on_target_object_titles",
        not any(item in desensitization_titles for item in desensitization_forbidden),
        "数据脱敏 must not hit different-titled systems/modules through relation context.",
        {
            "forbidden": [item for item in desensitization_forbidden if item in desensitization_titles],
            "summary": payload_summary("数据脱敏", probes["数据脱敏"]),
        },
    )

    watermark_titles = " ".join(titles(probes["应用页面水印"]))
    add_check(
        checks,
        "application_watermark_does_not_cross_to_data_watermark",
        "数据内容水印" not in watermark_titles and int(probes["应用页面水印"].get("facets", {}).get("total") or 0) > 0,
        "应用页面水印 must not cross-hit DI 数据内容水印.",
        payload_summary("应用页面水印", probes["应用页面水印"]),
    )

    empty = probes["zzzz"]
    add_check(
        checks,
        "no_match_query_has_clean_empty_state",
        int(empty.get("facets", {}).get("total") or 0) == 0 and len(listify(empty.get("results"))) == 0,
        "a no-match query must return an empty result window and zero facets total.",
        payload_summary("zzzz", empty),
    )

    for entry in SEARCH_INDEX_COVERAGE_MATRIX:
        slug = str(entry["slug"])
        domain = str(entry["domain"])
        payload = matrix_payloads[slug]
        match = find_matrix_match(payload, entry)
        leaked = forbidden_fields(payload)
        counter_payload = matrix_payloads[f"{slug}_counter"]
        counter_forbidden = has_forbidden_route(counter_payload, list(entry.get("forbidden_route_prefixes") or []))
        add_check(
            checks,
            f"coverage_{slug}_golden_domain",
            category_count(payload, str(entry["category"])) > 0 and match is not None,
            f"{domain} golden example must be indexed in its own domain and route.",
            {
                "entry": entry,
                "match": match,
                "summary": payload_summary(str(entry["golden_query"]), payload),
            },
        )
        add_check(
            checks,
            f"coverage_{slug}_click_locator",
            result_has_locator(match),
            f"{domain} search result must carry route plus target_ref/object_id for click positioning.",
            {"match": match},
        )
        add_check(
            checks,
            f"coverage_{slug}_counterexample",
            not counter_forbidden,
            f"{domain} counterexample must not leak into this domain route by weak context.",
            {
                "counter_query": entry["counter_query"],
                "forbidden_route_prefixes": entry.get("forbidden_route_prefixes"),
                "summary": payload_summary(str(entry["counter_query"]), counter_payload),
            },
        )
        add_check(
            checks,
            f"coverage_{slug}_field_boundary",
            not leaked,
            f"{domain} result rows must not expose raw provenance, debug, or generated fields.",
            {"leaked_fields": leaked},
        )

    failures = [check for check in checks if not check["ok"]]
    output = {
        "result": "fail" if failures else "pass",
        "checkCount": len(checks),
        "failureCount": len(failures),
        "failures": failures,
        "coverageMatrix": [
            {
                "domain": entry["domain"],
                "golden_query": entry["golden_query"],
                "counter_query": entry["counter_query"],
                "category": entry["category"],
                "route_prefixes": entry["route_prefixes"],
            }
            for entry in SEARCH_INDEX_COVERAGE_MATRIX
        ],
        "probeSummaries": {key: payload_summary(key, value) for key, value in probes.items() if key in {"管理", "人工智能", "人工", "组织", "密码", "数据脱敏", "应用页面水印", "zzzz"}},
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
