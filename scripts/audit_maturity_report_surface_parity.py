#!/usr/bin/env python3
"""Audit persisted maturity reports against their canonical result snapshots.

The audit is read-only. It compares every current report-model surface used by
the result page, report page and exported HTML without recalculating scores.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REPORT_ROOT = ROOT / "data" / "user" / "maturity-reports"
REQUIRED_SECTIONS = {
    "overall",
    "narratives",
    "radars",
    "hierarchy_statistics",
    "evaluation",
    "capability_results",
    "overall_rankings",
    "dimension_rankings",
    "improvement_roadmap",
    "score_appendix",
    "traceability",
}
DIMENSIONS = ("organization", "process", "tool", "data")


def comparable(value: Any) -> Any:
    if isinstance(value, float):
        return round(value, 6)
    if isinstance(value, dict):
        return {key: comparable(item) for key, item in sorted(value.items())}
    if isinstance(value, list):
        return [comparable(item) for item in value]
    return value


def same(left: Any, right: Any) -> bool:
    return comparable(left) == comparable(right)


def identity_rows(rows: list[dict[str, Any]], key: str = "id") -> dict[str, dict[str, Any]]:
    return {str(row.get(key, "")): row for row in rows}


def rows_cover_source(rendered: list[dict[str, Any]], source: list[dict[str, Any]]) -> bool:
    rendered_by_id = identity_rows(rendered)
    return len(rendered) == len(source) and all(
        source_row.get("id") in rendered_by_id
        and all(same(rendered_by_id[source_row["id"]].get(key), value) for key, value in source_row.items())
        for source_row in source
    )


def html_series(html: str, kind: str) -> str:
    match = re.search(
        rf"<g class='radar-series radar-series-{re.escape(kind)}'>(.*?)</g>",
        html,
        flags=re.DOTALL,
    )
    return match.group(1) if match else ""


def result_matrix(report_path: Path) -> dict[str, Any]:
    payload = json.loads(report_path.read_text(encoding="utf-8"))
    model = payload.get("reportModel") or {}
    result = model.get("resultSnapshot") or {}
    sections = {
        section.get("id"): section.get("data")
        for section in model.get("sections") or []
        if section.get("id")
    }
    html_path = report_path.with_name("report.html")
    markdown_path = report_path.with_name("report.md")
    disk_html = html_path.read_text(encoding="utf-8") if html_path.exists() else ""
    disk_markdown = markdown_path.read_text(encoding="utf-8") if markdown_path.exists() else ""
    html = payload.get("html") or ""
    markdown = payload.get("markdown") or ""
    checks: list[dict[str, Any]] = []

    def check(name: str, ok: bool, expected: Any = None, actual: Any = None) -> None:
        row: dict[str, Any] = {"item": name, "ok": bool(ok)}
        if expected is not None:
            row["expected"] = expected
        if actual is not None:
            row["actual"] = actual
        checks.append(row)

    section_ids = set(sections)
    check("报告模型版本", model.get("schemaVersion") == "sapd-maturity-report-model-v2")
    check("11 个报告章节", section_ids == REQUIRED_SECTIONS, sorted(REQUIRED_SECTIONS), sorted(section_ids))
    check(
        "结果版本哈希",
        model.get("resultVersion", {}).get("resultHash")
        == result.get("calculationRun", {}).get("resultHash"),
    )
    check("JSON 内 HTML 与磁盘 HTML", bool(html) and html == disk_html)
    check("JSON 内 Markdown 与磁盘 Markdown", bool(markdown) and markdown == disk_markdown)
    check("HTML 报告模型标识", "data-report-model='sapd-maturity-report-model-v2'" in html)
    check("HTML 无结果哈希业务展示", "结果哈希" not in html and "报告快照：" not in html)

    summary = result.get("summary") or {}
    overall = sections.get("overall") or {}
    traceability = sections.get("traceability") or {}
    check("总体摘要", same(overall.get("summary"), summary))
    check("追溯摘要", same(traceability.get("summary"), summary))
    check("T/G/M 类别统计", same(overall.get("categories"), result.get("categoryResults")))

    radars = sections.get("radars") or {}
    capability_radar = radars.get("capabilityRadar") or {}
    axes = capability_radar.get("axes") or []
    capabilities = result.get("capabilityResults") or []
    capability_by_id = identity_rows(capabilities)
    axis_ids = [str(axis.get("id", "")) for axis in axes]
    check("L2 雷达轴数量与唯一性", len(axes) == len(capabilities) == len(set(axis_ids)), len(capabilities), len(axes))
    capability_axis_fields = all(
        axis.get("id") in capability_by_id
        and same(axis.get("code"), capability_by_id[axis["id"]].get("code"))
        and same(axis.get("label"), capability_by_id[axis["id"]].get("name"))
        and same(axis.get("current"), capability_by_id[axis["id"]].get("currentIndex"))
        and same(axis.get("target"), capability_by_id[axis["id"]].get("targetIndex"))
        for axis in axes
    )
    check("L2 雷达 32 轴 ID/名称/当前/目标", capability_axis_fields, len(capabilities), sum(1 for axis in axes if axis.get("id") in capability_by_id))
    hierarchy_groups = (sections.get("hierarchy_statistics") or {}).get("groups") or []
    flattened_ids = [capability.get("id") for group in hierarchy_groups for capability in group.get("capabilities") or []]
    check("L2 雷达顺序与 T/G/M 分组", axis_ids == flattened_ids)
    group_counts = Counter(axis.get("groupCode") for axis in axes)
    check(
        "T/G/M 轴数量",
        all(group_counts.get(group.get("code"), 0) == group.get("count") for group in capability_radar.get("groups") or []),
        {group.get("code"): group.get("count") for group in capability_radar.get("groups") or []},
        dict(group_counts),
    )

    dimension_radar = radars.get("dimensionRadar") or {}
    dimension_axes = dimension_radar.get("axes") or []
    dimension_ok = len(dimension_axes) == 4 and all(
        axis.get("id") in DIMENSIONS
        and same(axis.get("current"), summary.get("dimensionResults", {}).get(axis["id"]))
        and same(axis.get("target"), summary.get("targetIndex"))
        for axis in dimension_axes
    )
    check("四维雷达 4 轴当前/目标", dimension_ok, 4, len(dimension_axes))

    current_values = [axis.get("current") for axis in axes]
    valid_adjacent_edges = sum(
        1
        for index, value in enumerate(current_values)
        if value is not None and current_values[(index + 1) % len(current_values)] is not None
    ) if current_values else 0
    expected_points = sum(value is not None for value in current_values)
    current_series = html_series(html, "current")
    html_current_lines = len(re.findall(r"<line\b", current_series))
    html_current_circles = len(re.findall(r"<circle\b", current_series))
    html_current_polygons = len(re.findall(r"<polygon\b", current_series))
    html_edge_ok = (
        html_current_polygons == 1 and expected_points == len(axes)
    ) or (
        html_current_polygons == 0
        and html_current_lines == valid_adjacent_edges
        and html_current_circles == expected_points
    )
    check(
        "HTML L2 雷达有效相邻边与点",
        html_edge_ok,
        {"edges": valid_adjacent_edges, "points": expected_points},
        {"lines": html_current_lines, "circles": html_current_circles, "polygons": html_current_polygons},
    )
    if axes and axes[0].get("current") is not None and axes[-1].get("current") is not None:
        check("HTML L2 雷达末轴到首轴闭合", html_current_polygons == 1 or html_current_lines == valid_adjacent_edges)

    evaluation = sections.get("evaluation") or {}
    check("成熟度分布", same(evaluation.get("maturityDistribution"), result.get("maturityDistribution")))
    check("证据分布", same(evaluation.get("evidenceDistribution"), result.get("evidenceDistribution")))
    check("服务评估点分布", same(evaluation.get("serviceDistribution"), result.get("serviceDistribution")))
    check("L2 能力结果 32 项", rows_cover_source(sections.get("capability_results") or [], capabilities), len(capabilities), len(sections.get("capability_results") or []))
    score_results = result.get("scoreItemResults") or []
    check("完整评分附录 185 项", rows_cover_source(sections.get("score_appendix") or [], score_results), len(score_results), len(sections.get("score_appendix") or []))

    overall_rankings = sections.get("overall_rankings") or {}
    expected_leading = sorted(
        [row for row in capabilities if row.get("currentIndex") is not None],
        key=lambda row: (-float(row.get("currentIndex") or 0), -float(row.get("targetAchievementRate") or 0), str(row.get("code") or "")),
    )[:10]
    check("总体领先 Top 10", same(overall_rankings.get("leading"), expected_leading))
    check("改进优先 Top 10", same(overall_rankings.get("improvement"), (result.get("gapItems") or [])[:10]))
    roadmap = sections.get("improvement_roadmap") or []
    roadmap_ids = [row.get("capabilityId") for row in roadmap]
    gap_ids = [row.get("capabilityId") for row in (result.get("gapItems") or [])[: len(roadmap)]]
    check("改进路线图能力顺序", roadmap_ids == gap_ids, gap_ids, roadmap_ids)

    l1_statistics = (sections.get("hierarchy_statistics") or {}).get("l1") or []
    subcategories = result.get("subCategoryResults") or []
    subcategory_by_id = identity_rows(subcategories)
    l1_fields_ok = len(l1_statistics) == len(subcategories) and all(
        row.get("id") in subcategory_by_id
        and all(same(row.get(field), subcategory_by_id[row["id"]].get(field)) for field in ("code", "name", "currentIndex", "targetIndex"))
        for row in l1_statistics
    )
    check("L1 分层统计", l1_fields_ok, len(subcategories), len(l1_statistics))

    all_codes_visible = all(str(row.get("code") or "") in html for row in capabilities)
    all_names_visible = all(str(row.get("name") or "") in html for row in capabilities)
    check("HTML 包含全部 L2 编号与名称", all_codes_visible and all_names_visible)
    check("HTML 三页结构", all(f"第 {page} 页" in html for page in (1, 2, 3)))

    return {
        "projectId": model.get("project", {}).get("id") or summary.get("id"),
        "reportId": payload.get("id"),
        "resultHash": model.get("resultVersion", {}).get("resultHash"),
        "reportPath": str(report_path.relative_to(ROOT)),
        "counts": {
            "capabilities": len(capabilities),
            "dimensions": len(dimension_axes),
            "l1": len(l1_statistics),
            "scoreItems": len(score_results),
            "validRadarEdges": valid_adjacent_edges,
            "validRadarPoints": expected_points,
        },
        "checks": checks,
        "ok": all(row["ok"] for row in checks),
    }


def latest_report_paths(project_id: str) -> list[Path]:
    project_dirs = [REPORT_ROOT / project_id] if project_id else sorted(path for path in REPORT_ROOT.iterdir() if path.is_dir())
    paths: list[Path] = []
    for project_dir in project_dirs:
        candidates = sorted(project_dir.glob("artifacts/*/report.json"), key=lambda path: path.stat().st_mtime)
        if candidates:
            paths.append(candidates[-1])
    return paths


def source_contract_checks() -> list[dict[str, Any]]:
    component = (ROOT / "frontend" / "capability-browser" / "components" / "MaturityAssessmentWorkbench.js").read_text(encoding="utf-8")
    styles = (ROOT / "frontend" / "capability-browser" / "maturity-assessment-workbench.css").read_text(encoding="utf-8")
    restore_source = component[
        component.index("async function restorePersistedReports()") : component.index("function activeProjectId()")
    ]
    ready_report_branch = re.search(
        r"if \(reportExportReady\(detail\.report\) && reportMatchesCurrentAssessment\(detail, detail\.report\)\) \{\s*(.*?)\s*\}",
        restore_source,
        flags=re.DOTALL,
    )
    contracts = {
        "下载入口位于第 6 步": "index === 5 && reportDownloadAvailable" in component,
        "已有报告刷新后可恢复": all(token in component for token in (
            "async function restorePersistedReports()",
            "formalAssessmentReady(detail)",
            "reportMatchesCurrentAssessment(detail, report)",
            "inputHash: requestContext.inputHash",
            "resultHash: requestContext.resultHash",
            "getMaturityReportArtifact",
        )) and bool(ready_report_branch)
            and "return;" in ready_report_branch.group(1)
            and "persistDetail" not in ready_report_branch.group(1)
            and "persistDetail(detail)" in restore_source,
        "项目 Tab 刷新保留": all(token in component for token in (
            "TAB_STORAGE_KEY",
            "rememberedProjectTab(nextRoute)",
            "rememberProjectTab(model.activeTab, detail.project.id)",
        )),
        "页面与 HTML 使用相同相邻轴规则": "const nextIndex = (index + 1) % normalizedValues.length" in component,
        "报告页自动章节统一读取报告快照": all(token in component for token in (
            "function reportSurfaceDetail(detail)",
            "const reportDetail = reportSurfaceDetail(detail)",
        )),
        "报告页复用共享主体几何": ".maturity-v1-project-page:has(.maturity-v37-report-shell) > .maturity-v1-project-body" not in styles,
    }
    return [{"item": name, "ok": ok} for name, ok in contracts.items()]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-id", default="", help="Audit only one project; default audits every latest local artifact.")
    args = parser.parse_args()
    paths = latest_report_paths(args.project_id)
    if not paths:
        print(json.dumps({"ok": False, "error": "no persisted maturity report artifacts found"}, ensure_ascii=False, indent=2))
        return 2
    reports = [result_matrix(path) for path in paths]
    source_checks = source_contract_checks()
    output = {
        "ok": all(report["ok"] for report in reports) and all(check["ok"] for check in source_checks),
        "sourceChecks": source_checks,
        "reports": reports,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0 if output["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
