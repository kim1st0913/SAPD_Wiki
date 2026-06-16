#!/usr/bin/env python3
from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from audit_lcdt_source_update import OUT_DIR, audit, write_json, write_md


ROOT = Path(__file__).resolve().parents[1]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def lifecycle_relations(lifecycle_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    relations: list[dict[str, Any]] = []
    for row in lifecycle_rows:
        stage = {
            "stageId": row["stageId"],
            "stageName": row["stageName"],
            "stageOrder": row["stageOrder"],
        }
        for service in row["securityTechnicalServices"]:
            relations.append(
                {
                    "relationType": "security_technical_service_maps_to_lifecycle_stage",
                    **stage,
                    "targetKind": "security_technical_service",
                    "targetCode": service["code"],
                    "targetTitle": service["canonical"].get("title") or service["title"],
                    "sourceTables": ["LC-DT 数据生命周期", "LC-DT 安全技术服务、模块、策略映射表"],
                    "requiresUserConfirmation": service["validationStatus"] != "matched",
                }
            )
        for item in row["securityTechnologyModulesOrMeasures"]:
            target_title = item.get("resolvedTitle") or item.get("canonical", {}).get("title") or item["title"]
            relations.append(
                {
                    "relationType": "module_or_measure_maps_to_lifecycle_stage",
                    **stage,
                    "targetKind": item["kind"],
                    "targetTitle": target_title,
                    "sourceTitle": item["title"],
                    "sourceTables": ["LC-DT 数据生命周期", "LC-DT 安全技术服务、模块、策略映射表"],
                    "requiresUserConfirmation": item["kind"] == "security_technical_measure_candidate",
                }
            )
    return relations


def build_candidate() -> dict[str, Any]:
    audit()
    lifecycle = load_json(OUT_DIR / "lcdt-lifecycle-table-normalized.json")
    mapping = load_json(OUT_DIR / "lcdt-service-module-policy-mapping-normalized.json")
    consistency = load_json(OUT_DIR / "lcdt-table-consistency-audit.json")
    dictionary = load_json(OUT_DIR / "lcdt-dictionary-validation-report.json")
    issues = load_json(OUT_DIR / "lcdt-issues-for-user-confirmation.json")

    measure_titles = dictionary.get("newMeasureCandidates", [])
    measure_refs = {
        title: [
            {
                "sourceTable": item["sourceTable"],
                "stageName": item["stageName"],
                "excelRow": item["excelRow"],
            }
            for item in dictionary.get("moduleOrMeasureIssues", [])
            if item["title"] == title
        ]
        for title in measure_titles
    }
    measure_additions = [
        {
            "name": title,
            "type": "security_technical_measure",
            "category": None,
            "source": "LC-DT",
            "reason": "LC-DT 源表中安全技术模块字段未命中安全技术模块清单，也未命中现有安全技术措施清单。",
            "references": measure_refs[title],
            "requiresUserConfirmation": True,
        }
        for title in measure_titles
    ]

    corrections = [
        {
            "moduleTitle": issue["moduleTitle"],
            "fromSecuritySystems": issue.get("currentSecuritySystems", []),
            "toSecuritySystem": issue["targetSecuritySystem"],
            "status": issue["status"],
            "reason": issue["message"],
            "requiresUserConfirmation": issue["status"] != "info_only",
        }
        for issue in issues.get("issues", [])
        if issue["type"] == "security_system_category_correction"
    ]

    relation_rows = lifecycle_relations(lifecycle["rows"])
    issue_counts = Counter(issue["status"] for issue in issues.get("issues", []))
    target_counts = Counter(relation["targetKind"] for relation in relation_rows)
    candidate = {
        "version": 1,
        "generatedAt": now_iso(),
        "candidateName": "LC-DT Source Update Audit & Candidate 1.0",
        "sourceWorkbook": lifecycle["sourceWorkbook"],
        "requiresUserConfirmation": True,
        "readiness": "blocked_by_issues" if issue_counts.get("blocking_issue", 0) else "ready_for_user_confirmation",
        "formalWriteScope": "none",
        "candidateLifecycleRows": lifecycle["rows"],
        "candidateMappingRows": mapping["rows"],
        "candidateLifecycleRelations": relation_rows,
        "candidateMeasureAdditions": measure_additions,
        "candidateSecuritySystemCategoryCorrections": corrections,
        "candidateDiffSummary": {
            "lifecycleStageCount": lifecycle["rowCount"],
            "mappingRowCount": mapping["rowCount"],
            "relationCount": len(relation_rows),
            "relationTargetCounts": dict(target_counts),
            "newMeasureCandidateCount": len(measure_additions),
            "securitySystemCategoryCorrectionCount": sum(1 for item in corrections if item["status"] == "confirmed_change"),
            "tableConsistency": consistency["summary"],
            "dictionaryValidation": dictionary["summary"],
            "issueStatusCounts": dict(issue_counts),
        },
        "blockedFormalTargets": [
            "frontend/capability-browser/public/data/lifecycle-workbench.json",
            "frontend/capability-browser/public/data/maintenance-knowledge.json",
            "frontend/capability-browser/public/data/maintenance/measures.json",
            "frontend/capability-browser/public/data/maintenance-index.json",
            "frontend/capability-browser/public/data/capability-workbench.json",
            "frontend/capability-browser/public/data/environment-workbench.json",
            "frontend/capability-browser/public/data/environmentBasemap.node-details.json",
            "frontend/capability-browser/public/data/standards-data.json",
            "frontend/capability-browser/public/data/standards-index.json",
            "data/database/sapd_wiki.sqlite3",
            "data/raw-samples/wiki sample.xlsx",
        ],
        "inputReports": [
            "lcdt-lifecycle-table-normalized.json",
            "lcdt-service-module-policy-mapping-normalized.json",
            "lcdt-table-consistency-audit.json",
            "lcdt-dictionary-validation-report.json",
            "lcdt-issues-for-user-confirmation.json",
        ],
    }
    return candidate


def render_candidate_md(candidate: dict[str, Any]) -> str:
    lines = [
        "# LC-DT 更新候选包",
        "",
        f"- 生成时间：`{candidate['generatedAt']}`",
        f"- 准备状态：`{candidate['readiness']}`",
        f"- 正式写入范围：`{candidate['formalWriteScope']}`",
        f"- 需要用户确认：`{candidate['requiresUserConfirmation']}`",
        "",
        "## 候选差异摘要",
        "",
    ]
    for key, value in candidate["candidateDiffSummary"].items():
        lines.append(f"- `{key}`: {value}")
    lines.extend(["", "## 新增安全技术措施候选", ""])
    if candidate["candidateMeasureAdditions"]:
        for item in candidate["candidateMeasureAdditions"]:
            lines.append(f"- {item['name']}（引用 {len(item['references'])} 处）")
    else:
        lines.append("- 无")
    lines.extend(["", "## 安全系统分类候选更正", ""])
    if candidate["candidateSecuritySystemCategoryCorrections"]:
        for item in candidate["candidateSecuritySystemCategoryCorrections"]:
            lines.append(
                f"- {item['moduleTitle']}: {item.get('fromSecuritySystems') or ['未分组安全系统']} -> {item['toSecuritySystem']}（{item['status']}）"
            )
    else:
        lines.append("- 无")
    lines.extend(["", "## 未写入的正式目标", ""])
    for path in candidate["blockedFormalTargets"]:
        lines.append(f"- `{path}`")
    return "\n".join(lines)


def main() -> None:
    candidate = build_candidate()
    write_json(OUT_DIR / "lcdt-update-candidate.json", candidate)
    write_md(OUT_DIR / "lcdt-update-candidate.md", render_candidate_md(candidate))
    print(json.dumps(candidate["candidateDiffSummary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
