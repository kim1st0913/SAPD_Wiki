#!/usr/bin/env python3
"""Generate the self-contained OI-197 maturity rubric review workbench.

The generated HTML is an offline review artifact. It does not update the
protected capability dictionary, the source workbook, runtime JSON/SQLite, or
the maturity scoring implementation.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import html
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
WORKBENCH_PATH = ROOT / "frontend/capability-browser/public/data/capability-workbench.json"
TREE_PATH = ROOT / "frontend/capability-browser/public/data/capability-tree.json"
AUDIT_PATH = ROOT / "docs/08-maturity/assessment-rubric-dictionary-mapping-audit-2026-07-17.md"
APPENDIX_PATH = ROOT / "docs/08-maturity/assessment-rubric-source-appendix-2026-07-17.md"
SOURCE_XLSX_PATH = ROOT / "data/raw-samples/assesment samples.xlsx"
DEFAULT_OUTPUT_PATH = ROOT / "docs/08-maturity/oi-197-maturity-rubric-review-workbench.html"

DIMENSIONS = (
    ("organization", "组织与角色"),
    ("process", "制度与流程"),
    ("tool", "平台与工具"),
    ("data", "数据与信息"),
)
LEVELS = ("L1", "L2", "L3", "L4", "L5")
KNOWN_SUPPLEMENT_CAPABILITY_CODES = {"T-OF.AT", "M-SA.OP"}
OBJECT_CODE_PATTERN = r"[A-Z](?:-[A-Z]+)?(?:\.[A-Z]+)?(?:-\d+)?"
FOCUS_CODE_PATTERN = r"[A-Z](?:-[A-Z]+)?\.[A-Z]+-\d+"


def sha256_path(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def clean_md(value: str) -> str:
    text = value.strip()
    text = re.sub(r"^`|`$", "", text)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = html.unescape(text)
    return text.strip()


def parse_md_row(line: str) -> list[str]:
    stripped = line.strip()
    if not stripped.startswith("|") or not stripped.endswith("|"):
        return []
    return [clean_md(cell) for cell in stripped[1:-1].split("|")]


def section_between(text: str, start_pattern: str, end_pattern: str) -> str:
    start = re.search(start_pattern, text, flags=re.MULTILINE)
    if not start:
        raise ValueError(f"section start not found: {start_pattern}")
    end = re.search(end_pattern, text[start.end() :], flags=re.MULTILINE)
    return text[start.end() : start.end() + end.start()] if end else text[start.end() :]


def code_and_name(value: str) -> tuple[str, str]:
    match = re.search(rf"`?({OBJECT_CODE_PATTERN})`?\s*(.*)", value.strip())
    if not match:
        return "", value.strip()
    return match.group(1), match.group(2).strip()


def parse_focus_mapping_audit(text: str) -> dict[str, dict[str, Any]]:
    section = section_between(text, r"^## 7\. 91 个当前关注点映射总表\s*$", r"^## 8\.")
    mappings: dict[str, dict[str, Any]] = {}
    for line in section.splitlines():
        cells = parse_md_row(line)
        if len(cells) != 10 or not re.fullmatch(r"[TMG]", cells[0]):
            continue
        focus_code, focus_name = code_and_name(cells[3])
        rubric_match = re.search(r"ARS-\d{3}", cells[7])
        status_match = re.search(
            r"(MAPPED_[A-Z_]+|REVIEW_[A-Z_]+|BLOCKED_[A-Z_]+)",
            cells[9],
        )
        if not focus_code or not status_match:
            continue
        l2_code, l2_name = code_and_name(cells[2])
        mappings[focus_code] = {
            "l0Code": cells[0],
            "l1Code": cells[1],
            "l2Code": l2_code,
            "l2Name": l2_name,
            "focusCode": focus_code,
            "focusName": focus_name,
            "itemType": cells[4],
            "serviceRelationCount": int(cells[5]),
            "scoreItemCount": int(cells[6]),
            "rubricSetId": rubric_match.group(0) if rubric_match else None,
            "sourceRows": cells[8] if cells[8] != "—" else None,
            "mappingStatus": status_match.group(1),
        }
    return mappings


def parse_focus_decisions(text: str) -> dict[str, dict[str, Any]]:
    section = section_between(text, r"^### 6\.1 用户业务裁定记录\s*$", r"^## 7\.")
    decisions: dict[str, dict[str, Any]] = {}
    for line in section.splitlines():
        cells = parse_md_row(line)
        if len(cells) != 7 or not cells[0].isdigit():
            continue
        focus_code, focus_name = code_and_name(cells[2])
        rubric_match = re.search(r"ARS-\d{3}", cells[3])
        decisions[focus_code] = {
            "sequence": int(cells[0]),
            "type": cells[1],
            "focusCode": focus_code,
            "focusName": focus_name,
            "candidateRubricSetId": rubric_match.group(0) if rubric_match else None,
            "allowedDecisionText": cells[4],
            "initialDecision": cells[5],
            "initialNote": None if cells[6] == "—" else cells[6],
        }
    return decisions


def parse_title_mismatches(text: str) -> dict[str, dict[str, str]]:
    section = section_between(text, r"^## 6\. 关注点身份复核", r"^### 6\.1")
    result: dict[str, dict[str, str]] = {}
    for line in section.splitlines():
        cells = parse_md_row(line)
        if len(cells) != 5:
            continue
        code_match = re.fullmatch(FOCUS_CODE_PATTERN, cells[0])
        if not code_match:
            continue
        result[cells[0]] = {
            "currentTitle": cells[1],
            "sourceTitle": cells[2],
            "candidateRubricSetId": cells[3],
            "status": cells[4],
        }
    return result


def parse_service_drift_focus_codes(text: str) -> set[str]:
    section = section_between(text, r"^## 5\. 源服务清单漂移审计\s*$", r"^## 6\.")
    result: set[str] = set()
    for line in section.splitlines():
        cells = parse_md_row(line)
        if len(cells) != 5:
            continue
        if re.fullmatch(FOCUS_CODE_PATTERN, cells[0]):
            result.add(cells[0])
    return result


def source_state_for_dimension(criteria: str, level_state: str) -> str:
    if criteria and criteria != "—":
        return "AVAILABLE_OBJECT_SPECIFIC"
    if level_state == "UNAVAILABLE_BY_DESIGN":
        return "UNAVAILABLE_BY_DESIGN"
    if level_state == "UNSTRUCTURED_PENDING":
        return "UNSTRUCTURED_PENDING"
    if level_state == "MISSING_PENDING":
        return "MISSING_PENDING"
    if level_state == "PARTIAL":
        return "MISSING_PENDING"
    if level_state == "NO_RUBRIC":
        return "NO_RUBRIC"
    return "PENDING_CLASSIFICATION"


def classify_level(criteria: dict[str, str], status: str, quality: str, raw_text: str = "") -> str:
    present = sum(1 for value in criteria.values() if value and value != "—")
    if quality == "UNSTRUCTURED" or raw_text:
        return "UNSTRUCTURED_PENDING"
    if present == 4:
        return "AVAILABLE_OBJECT_SPECIFIC"
    if present:
        return "PARTIAL"
    if "业务不可评分" in status:
        return "UNAVAILABLE_BY_DESIGN"
    if "确认遗漏" in status:
        return "MISSING_PENDING"
    if "未按四维拆分" in status:
        return "UNSTRUCTURED_PENDING"
    return "PENDING_CLASSIFICATION"


def parse_rubric_appendix(text: str) -> dict[str, dict[str, Any]]:
    heading_matches = list(
        re.finditer(r"^### 10\.\d+ `?(ARS-\d{3})`?\s*$", text, flags=re.MULTILINE)
    )
    rubrics: dict[str, dict[str, Any]] = {}
    for index, match in enumerate(heading_matches):
        rubric_id = match.group(1)
        end = heading_matches[index + 1].start() if index + 1 < len(heading_matches) else len(text)
        section = text[match.end() : end]
        focus_line = re.search(r"^- 关注点：(.*)$", section, flags=re.MULTILINE)
        capability_line = re.search(r"^- 能力：`?([^`\n]+)`?\s*$", section, flags=re.MULTILINE)
        source_line = re.search(
            r"^- 源行：`?([^`;]+)`?；源服务行数：`?(\d+)`?；当前评估点数：`?(\d+)`?",
            section,
            flags=re.MULTILINE,
        )
        sharing_line = re.search(r"^- 共享证据：(.*)$", section, flags=re.MULTILINE)
        quality_line = re.search(
            r"^- 源矩阵状态：`?([A-Z]+)`?；问题：(.*)$",
            section,
            flags=re.MULTILINE,
        )
        focus_codes = re.findall(rf"`({FOCUS_CODE_PATTERN})`", focus_line.group(1) if focus_line else "")
        quality = quality_line.group(1) if quality_line else "UNKNOWN"
        issue = clean_md(quality_line.group(2)) if quality_line else "未记录"
        levels: dict[str, dict[str, Any]] = {}

        table_lines = [line for line in section.splitlines() if line.strip().startswith("|")]
        is_unstructured = any("原始文字" in line for line in table_lines[:2])
        for line in table_lines:
            cells = parse_md_row(line)
            if not cells or cells[0] not in LEVELS:
                continue
            if is_unstructured:
                if len(cells) != 4:
                    continue
                level, raw_text, source_range, status = cells
                criteria = {code: "" for code, _ in DIMENSIONS}
            else:
                if len(cells) != 7:
                    continue
                level = cells[0]
                criteria = {
                    DIMENSIONS[0][0]: "" if cells[1] == "—" else cells[1],
                    DIMENSIONS[1][0]: "" if cells[2] == "—" else cells[2],
                    DIMENSIONS[2][0]: "" if cells[3] == "—" else cells[3],
                    DIMENSIONS[3][0]: "" if cells[4] == "—" else cells[4],
                }
                raw_text = ""
                source_range = cells[5]
                status = cells[6]
            level_state = classify_level(criteria, status, quality, raw_text)
            levels[level] = {
                "level": level,
                "criteria": criteria,
                "rawText": raw_text,
                "sourceRange": source_range,
                "sourceStatus": status,
                "sourceState": level_state,
                "dimensionStates": {
                    code: source_state_for_dimension(value, level_state)
                    for code, value in criteria.items()
                },
            }
        for level in LEVELS:
            levels.setdefault(
                level,
                {
                    "level": level,
                    "criteria": {code: "" for code, _ in DIMENSIONS},
                    "rawText": "",
                    "sourceRange": "",
                    "sourceStatus": "附录未提取该等级",
                    "sourceState": "PENDING_CLASSIFICATION",
                    "dimensionStates": {code: "PENDING_CLASSIFICATION" for code, _ in DIMENSIONS},
                },
            )
        rubrics[rubric_id] = {
            "id": rubric_id,
            "capabilityCode": clean_md(capability_line.group(1)) if capability_line else "",
            "focusCodes": focus_codes,
            "sourceRows": clean_md(source_line.group(1)) if source_line else "",
            "sourceServiceRowCount": int(source_line.group(2)) if source_line else 0,
            "currentScoreItemCount": int(source_line.group(3)) if source_line else 0,
            "sharingEvidence": clean_md(sharing_line.group(1)) if sharing_line else "",
            "qualityStatus": quality,
            "issue": issue,
            "levels": levels,
        }
    return rubrics


def build_template() -> dict[str, Any]:
    sys.path.insert(0, str(ROOT / "src"))
    from sapd_wiki.maturity import build_maturity_base_template  # noqa: PLC0415

    workbench = json.loads(WORKBENCH_PATH.read_text(encoding="utf-8"))
    return build_maturity_base_template(workbench)


def build_workbench_data() -> dict[str, Any]:
    audit_text = AUDIT_PATH.read_text(encoding="utf-8")
    appendix_text = APPENDIX_PATH.read_text(encoding="utf-8")
    focus_mappings = parse_focus_mapping_audit(audit_text)
    focus_decisions = parse_focus_decisions(audit_text)
    title_mismatches = parse_title_mismatches(audit_text)
    drift_focuses = parse_service_drift_focus_codes(audit_text)
    rubrics = parse_rubric_appendix(appendix_text)
    template = build_template()

    categories_by_id = {item["id"]: item for item in template["categories"]}
    capabilities_by_id = {item["id"]: item for item in template["capabilities"]}
    focuses_by_id = {item["id"]: item for item in template["focuses"]}
    services_by_id = {item["id"]: item for item in template["services"]}

    hierarchy_categories: list[dict[str, Any]] = []
    for top in sorted(
        (item for item in template["categories"] if item["capabilityLevel"] == "L0"),
        key=lambda item: item["sortOrder"],
    ):
        domains = []
        for domain in sorted(
            (
                item
                for item in template["categories"]
                if item["capabilityLevel"] == "L1" and item["parentId"] == top["id"]
            ),
            key=lambda item: item["sortOrder"],
        ):
            capabilities = []
            for capability in sorted(
                (item for item in template["capabilities"] if item["categoryId"] == domain["id"]),
                key=lambda item: item["sortOrder"],
            ):
                focus_rows = [
                    {
                        "code": focuses_by_id[focus_id]["code"],
                        "name": focuses_by_id[focus_id]["name"],
                        "id": focus_id,
                        "scoreItemCount": len(focuses_by_id[focus_id]["scoreItemIds"]),
                    }
                    for focus_id in capability["focusIds"]
                ]
                capabilities.append(
                    {
                        "id": capability["id"],
                        "code": capability["code"],
                        "name": capability["name"],
                        "focuses": focus_rows,
                    }
                )
            domains.append(
                {
                    "id": domain["id"],
                    "code": domain["code"],
                    "name": domain["name"],
                    "capabilities": capabilities,
                }
            )
        hierarchy_categories.append(
            {
                "id": top["id"],
                "code": top["code"],
                "name": top["name"],
                "domains": domains,
            }
        )

    rows: list[dict[str, Any]] = []
    status_counts = {"mapped": 0, "review": 0, "noSource": 0}
    rubric_usage: dict[str, dict[str, set[str]]] = {}
    for score_item in template["scoreItems"]:
        focus = focuses_by_id[score_item["focusId"]]
        capability = capabilities_by_id[score_item["capabilityId"]]
        domain = categories_by_id[capability["categoryId"]]
        top = categories_by_id[capability["topCategoryId"]]
        mapping = focus_mappings[focus["code"]]
        decision_record = focus_decisions.get(focus["code"])
        mapping_status = mapping["mappingStatus"]
        if mapping_status.startswith("REVIEW_"):
            mapping_bucket = "review"
        elif mapping_status.startswith("BLOCKED_"):
            mapping_bucket = "noSource"
        else:
            mapping_bucket = "mapped"
        status_counts[mapping_bucket] += 1
        rubric_id = mapping["rubricSetId"]
        candidate_id = decision_record["candidateRubricSetId"] if decision_record else rubric_id
        # Candidate sets are maintenance evidence only. A point with no source rubric
        # remains "missing criteria" until the user supplies or approves real criteria.
        effective_review_rubric_id = rubric_id
        rubric = rubrics.get(effective_review_rubric_id) if effective_review_rubric_id else None
        if rubric:
            usage = rubric_usage.setdefault(rubric["id"], {"focusCodes": set(), "rowIds": set()})
            usage["focusCodes"].add(focus["code"])
            usage["rowIds"].add(score_item["id"])
        service = services_by_id.get(score_item.get("serviceId"))
        if service:
            assessment_code = service["code"]
            assessment_name = service["name"]
            assessment_context = f'{service["scopeCode"]} · {service["scopeName"]}'
        else:
            assessment_code = focus["code"]
            assessment_name = focus["name"]
            assessment_context = "关注点级评估"
        source_states = (
            [rubric["levels"][level]["sourceState"] for level in LEVELS]
            if rubric
            else ["NO_RUBRIC"] * len(LEVELS)
        )
        flags: list[str] = []
        if mapping_bucket == "review":
            flags.append("MAPPING_REVIEW")
        if mapping_bucket == "noSource":
            flags.append("NO_SOURCE_RUBRIC")
        if focus["code"] in drift_focuses:
            flags.append("SOURCE_SERVICE_DRIFT")
        if rubric:
            if rubric["qualityStatus"] == "PARTIAL":
                flags.append("RUBRIC_PARTIAL")
            elif rubric["qualityStatus"] == "EMPTY":
                flags.append("RUBRIC_EMPTY")
            elif rubric["qualityStatus"] == "UNSTRUCTURED":
                flags.append("RUBRIC_UNSTRUCTURED")
            if "PARTIAL" in source_states:
                flags.append("MISSING_DIMENSION")
            if any(
                state in {"MISSING_PENDING", "PENDING_CLASSIFICATION"}
                for state in source_states
            ):
                flags.append("MISSING_OR_UNCLASSIFIED_LEVEL")
        rows.append(
            {
                "id": score_item["id"],
                "itemType": score_item["itemType"],
                "l0Code": top["code"],
                "l0Name": top["name"],
                "l1Code": domain["code"],
                "l1Name": domain["name"],
                "l2Code": capability["code"],
                "l2Name": capability["name"],
                "focusCode": focus["code"],
                "focusName": focus["name"],
                "focusDescription": focus["description"],
                "assessmentCode": assessment_code,
                "assessmentName": assessment_name,
                "assessmentContext": assessment_context,
                "mappingStatus": mapping_status,
                "mappingBucket": mapping_bucket,
                "rubricSetId": rubric_id,
                "candidateRubricSetId": candidate_id,
                "reviewRubricSetId": effective_review_rubric_id,
                "assessmentCriteriaType": (
                    "HAS_ASSESSMENT_CRITERIA"
                    if effective_review_rubric_id
                    else "MISSING_ASSESSMENT_CRITERIA"
                ),
                "reviewClassification": (
                    "KNOWN_SUPPLEMENT_GAP"
                    if capability["code"] in KNOWN_SUPPLEMENT_CAPABILITY_CODES
                    else "LEVEL_RANGE_REVIEW"
                ),
                "flags": flags,
                "sourceStates": source_states,
            }
        )

    for rubric_id, usage in rubric_usage.items():
        rubrics[rubric_id]["boundFocusCount"] = len(usage["focusCodes"])
        rubrics[rubric_id]["reviewRowCount"] = len(usage["rowIds"])

    shared_availability_risk = {
        "title": "共享 Rubric 的等级状态可能要求拆组",
        "severity": "high",
        "description": (
            "同一 Rubric set 的 20 个状态槽理论上由所有绑定关注点共享；"
            "若不同关注点对同一等级作出不同业务裁定，不能继续保持一个共享组，"
            "必须拆分 Rubric set。ARS-009 的 L1 已出现这一风险。"
        ),
    }
    applicability_risk = {
        "title": "模板级不适用与项目级不适用必须分开",
        "severity": "high",
        "description": (
            "模板级不适用表示该评估点不应进入固定模板；项目级不适用只表示某个客户或项目"
            "暂不评估，不能据此删除字典对象或评分依据。"
        ),
    }
    generic_fallback_risk = {
        "title": "通用矩阵不能自动补齐对象专用依据",
        "severity": "high",
        "description": (
            "当前运行模板仍生成通用 fallback，但 OI-197 合同要求固定模板默认禁止自动回退。"
            "只有逐组业务批准并记录原因后，才能使用 GENERIC_FALLBACK_APPROVED。"
        ),
    }
    source_vs_runtime_risk = {
        "title": "本工作台展示审计候选，不代表已在运行时生效",
        "severity": "medium",
        "description": (
            "对象专用 Rubric 尚未写入正式字典、API、模板或评分规则。"
            "本 HTML 只承载业务裁定，不能作为运行态已经采用这些依据的证明。"
        ),
    }
    mapping_is_not_release_risk = {
        "title": "完成 15 项映射决定后，仍有第二层内容门禁",
        "severity": "high",
        "description": (
            "OI-197 的 15 项先解决对象身份和 Rubric 绑定；映射通过后仍需处理 "
            "13 个 PARTIAL 组、2 个 EMPTY 组、1 个 UNSTRUCTURED 组，"
            "包括整级空白、单维缺项和 KPI 原文未拆四维。映射 PASS 不等于模板可发布。"
        ),
    }
    service_drift_risk = {
        "title": "22 个关注点存在源服务清单漂移",
        "severity": "medium",
        "description": (
            "服务关系与评估点结构必须以当前工程字典为准。源 Excel 服务行只作证据，"
            "本次裁定不得顺带删除、补写或覆盖当前 160 条服务关系。"
        ),
    }

    source_files = {
        "capabilityWorkbench": {
            "path": str(WORKBENCH_PATH.relative_to(ROOT)),
            "sha256": sha256_path(WORKBENCH_PATH),
        },
        "capabilityTree": {
            "path": str(TREE_PATH.relative_to(ROOT)),
            "sha256": sha256_path(TREE_PATH),
        },
        "mappingAudit": {
            "path": str(AUDIT_PATH.relative_to(ROOT)),
            "sha256": sha256_path(AUDIT_PATH),
        },
        "rubricAppendix": {
            "path": str(APPENDIX_PATH.relative_to(ROOT)),
            "sha256": sha256_path(APPENDIX_PATH),
        },
        "sourceWorkbook": {
            "path": str(SOURCE_XLSX_PATH.relative_to(ROOT)),
            "sha256": sha256_path(SOURCE_XLSX_PATH),
        },
    }
    data = {
        "schemaVersion": "sapd-oi197-review-workbench-v2",
        "generatedAt": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "template": {
            "id": template["id"],
            "snapshotId": template["snapshotId"],
            "version": template["version"],
            "rubricVersion": template["rubricVersion"],
            "stats": template["stats"],
        },
        "reviewContract": {
            "objectAuthority": "CURRENT_DICTIONARY",
            "authoritativeObjectTypes": [
                "L0",
                "L1",
                "L2",
                "CAPABILITY_FOCUS",
                "SECURITY_TECHNICAL_SERVICE",
            ],
            "criteriaSourceRole": "L1_L5_CRITERIA_TEXT_ONLY",
            "assessmentCriteriaTypes": [
                "HAS_ASSESSMENT_CRITERIA",
                "MISSING_ASSESSMENT_CRITERIA",
            ],
            "reviewClassifications": [
                "KNOWN_SUPPLEMENT_GAP",
                "LEVEL_RANGE_REVIEW",
            ],
            "levelCriteriaStates": [
                "COMPLETE",
                "INCOMPLETE",
                "MISSING",
                "RAW_TEXT_AVAILABLE",
            ],
            "allowedLevelDecisions": [
                "APPROVE_AS_IS",
                "NEEDS_REVISION",
                "NOT_REQUIRED",
            ],
            "levelRangeRule": (
                "APPLICABLE_LEVELS_MUST_FORM_ONE_CONTIGUOUS_RANGE_PER_ASSESSMENT_POINT"
            ),
            "knownSupplementCapabilityCodes": sorted(
                KNOWN_SUPPLEMENT_CAPABILITY_CODES
            ),
            "conflictResolution": (
                "CORRECT_OBJECT_IDENTITY_NAMES_AND_RELATIONSHIPS_TO_CURRENT_DICTIONARY"
            ),
            "userDecisionScope": (
                "PER_ASSESSMENT_POINT_LEVEL_RANGE_AND_LEVEL_CRITERIA_REASONABLENESS"
            ),
        },
        "sourceFiles": source_files,
        "counts": {
            "l0": template["stats"]["topCategories"],
            "l1": template["stats"]["domains"],
            "l2": template["stats"]["capabilities"],
            "focuses": template["stats"]["focuses"],
            "serviceRelations": template["stats"]["serviceMappings"],
            "serviceAssessmentPoints": template["stats"]["serviceItems"],
            "focusAssessmentPoints": template["stats"]["focusItems"],
            "assessmentPoints": template["stats"]["scoreItems"],
            "rubricSets": len(rubrics),
            "mappingDecisionFocuses": len(focus_decisions),
            "mappedAssessmentPoints": status_counts["mapped"],
            "reviewAssessmentPoints": status_counts["review"],
            "noSourceAssessmentPoints": status_counts["noSource"],
            "hasAssessmentCriteriaPoints": sum(
                row["assessmentCriteriaType"] == "HAS_ASSESSMENT_CRITERIA"
                for row in rows
            ),
            "missingAssessmentCriteriaPoints": sum(
                row["assessmentCriteriaType"] == "MISSING_ASSESSMENT_CRITERIA"
                for row in rows
            ),
            "knownSupplementAssessmentPoints": sum(
                row["reviewClassification"] == "KNOWN_SUPPLEMENT_GAP"
                for row in rows
            ),
            "levelRangeReviewAssessmentPoints": sum(
                row["reviewClassification"] == "LEVEL_RANGE_REVIEW"
                for row in rows
            ),
        },
        "hierarchy": hierarchy_categories,
        "rows": rows,
        "rubrics": rubrics,
        "focusMappings": focus_mappings,
        "focusDecisions": focus_decisions,
        "titleMismatches": title_mismatches,
        "knownIssues": [
            shared_availability_risk,
            applicability_risk,
            generic_fallback_risk,
            source_vs_runtime_risk,
            mapping_is_not_release_risk,
            service_drift_risk,
        ],
    }
    validate_data(data)
    return data


def validate_data(data: dict[str, Any]) -> None:
    counts = data["counts"]
    expected = {
        "l0": 3,
        "l1": 10,
        "l2": 32,
        "focuses": 91,
        "serviceRelations": 160,
        "serviceAssessmentPoints": 154,
        "focusAssessmentPoints": 31,
        "assessmentPoints": 185,
        "rubricSets": 32,
        "mappingDecisionFocuses": 15,
        "mappedAssessmentPoints": 147,
        "reviewAssessmentPoints": 28,
        "noSourceAssessmentPoints": 10,
        "hasAssessmentCriteriaPoints": 175,
        "missingAssessmentCriteriaPoints": 10,
        "knownSupplementAssessmentPoints": 5,
        "levelRangeReviewAssessmentPoints": 180,
    }
    errors = [
        f"{key}: expected {value}, got {counts.get(key)}"
        for key, value in expected.items()
        if counts.get(key) != value
    ]
    if errors:
        raise ValueError("OI-197 workbench count validation failed: " + "; ".join(errors))
    if any(len(rubric["levels"]) != 5 for rubric in data["rubrics"].values()):
        raise ValueError("every rubric set must expose exactly five levels")
    if any(
        set(level["criteria"]) != {code for code, _ in DIMENSIONS}
        for rubric in data["rubrics"].values()
        for level in rubric["levels"].values()
    ):
        raise ValueError("every rubric level must expose the four dimensions")
    contract = data["reviewContract"]
    if contract["objectAuthority"] != "CURRENT_DICTIONARY":
        raise ValueError("current dictionary must remain the object authority")
    if contract["criteriaSourceRole"] != "L1_L5_CRITERIA_TEXT_ONLY":
        raise ValueError("the source rubric may only supply L1-L5 criteria text")
    if set(contract["knownSupplementCapabilityCodes"]) != KNOWN_SUPPLEMENT_CAPABILITY_CODES:
        raise ValueError("known supplement capabilities must match the confirmed OI-197 rule")
    if any(
        row["assessmentCriteriaType"] == "MISSING_ASSESSMENT_CRITERIA"
        and row["reviewRubricSetId"]
        for row in data["rows"]
    ):
        raise ValueError("missing criteria points must not display candidate rubric content")


HTML_TEMPLATE = r"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
  <meta name="referrer" content="no-referrer">
  <meta name="sapd-artifact" content="oi-197-maturity-rubric-review-workbench">
  <title>SAPD OI-197 成熟度评分标准审阅表</title>
  <style>
    :root {
      --bg: #f5f4f0;
      --surface: #fbfbfa;
      --surface-strong: #ffffff;
      --surface-muted: #f0f1f2;
      --line: #d9dbdd;
      --line-strong: #c7cbd0;
      --text: #20252b;
      --muted: #66707a;
      --faint: #8a929a;
      --blue: #1976d2;
      --blue-soft: #e9f2fb;
      --green: #39765a;
      --green-soft: #eaf3ed;
      --gold: #9b6b1f;
      --gold-soft: #f7efe0;
      --clay: #9b5e50;
      --clay-soft: #f5e9e5;
      --lavender: #6e668b;
      --lavender-soft: #efedf5;
      --slate: #596875;
      --slate-soft: #ebeff2;
      --danger: #a13d3d;
      --danger-soft: #f8e8e8;
      --shadow: 0 12px 34px rgba(44, 52, 60, .12);
      --radius-sm: 6px;
      --radius-md: 10px;
      --radius-lg: 14px;
      --sidebar-w: 286px;
      --object-w: 340px;
      --dimension-col-w: 320px;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC",
        "Microsoft YaHei", "Segoe UI", sans-serif;
      color: var(--text);
      background: var(--bg);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg); }
    body { min-width: 760px; font-size: 14px; line-height: 1.5; }
    button, select, input, textarea { font: inherit; color: inherit; }
    button { cursor: pointer; }
    button:focus-visible, select:focus-visible, input:focus-visible, textarea:focus-visible {
      outline: 3px solid rgba(25, 118, 210, .22);
      outline-offset: 1px;
    }
    .app { min-height: 100vh; display: grid; grid-template-rows: auto auto minmax(0, 1fr); }
    .topbar {
      position: sticky; top: 0; z-index: 40;
      display: flex; align-items: center; gap: 16px;
      min-height: 58px; padding: 10px 18px;
      background: rgba(251, 251, 250, .96);
      border-bottom: 1px solid var(--line);
      backdrop-filter: blur(16px);
    }
    .brand { min-width: 290px; }
    .brand strong { display: block; font-size: 16px; letter-spacing: -.01em; }
    .brand span { color: var(--muted); font-size: 12px; }
    .top-progress { flex: 1; display: grid; gap: 5px; min-width: 220px; }
    .progress-track { height: 7px; background: #e4e6e8; border-radius: 999px; overflow: hidden; }
    .progress-fill { height: 100%; width: 0; background: var(--blue); transition: width .18s ease; }
    .progress-copy { display: flex; justify-content: space-between; color: var(--muted); font-size: 12px; }
    .actions { display: flex; gap: 8px; align-items: center; }
    .button {
      border: 1px solid var(--line-strong); background: var(--surface-strong);
      min-height: 34px; padding: 6px 12px; border-radius: var(--radius-sm);
      font-weight: 600; white-space: nowrap;
    }
    .button:hover { border-color: #aeb4ba; background: #f7f8f8; }
    .button.primary { color: white; background: var(--blue); border-color: var(--blue); }
    .button.quiet { border-color: transparent; background: transparent; color: var(--muted); }
    .button.danger { color: var(--danger); border-color: #dabcbc; background: #fffafa; }
    .button.small { min-height: 29px; padding: 4px 9px; font-size: 12px; }
    .context-strip {
      display: grid; grid-template-columns: repeat(4, minmax(150px, 1fr)); gap: 10px;
      padding: 10px 18px; border-bottom: 1px solid var(--line); background: #f8f8f6;
    }
    .metric {
      min-width: 0; padding: 8px 10px; border-left: 3px solid var(--slate);
      background: var(--surface-strong); border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
    }
    .metric b { display: block; font-size: 18px; line-height: 1.15; }
    .metric span { color: var(--muted); font-size: 12px; }
    .metric.is-warning { border-left-color: var(--gold); }
    .metric.is-danger { border-left-color: var(--danger); }
    .metric.is-good { border-left-color: var(--green); }
    .workspace {
      min-height: 0; display: grid; grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
    }
    .sidebar {
      min-height: 0; overflow: auto; border-right: 1px solid var(--line);
      background: #eef0f1; padding: 12px 10px 24px;
    }
    .sidebar-head {
      position: sticky; top: 0; z-index: 2; background: #eef0f1;
      padding: 2px 4px 10px;
    }
    .sidebar-head h2 { margin: 0; font-size: 14px; }
    .sidebar-head p { margin: 3px 0 0; color: var(--muted); font-size: 12px; }
    .tree details { margin: 2px 0; }
    .tree summary {
      list-style: none; display: flex; gap: 6px; align-items: flex-start;
      padding: 6px 7px; border-radius: var(--radius-sm); cursor: pointer;
    }
    .tree summary::-webkit-details-marker { display: none; }
    .tree summary:hover { background: rgba(255,255,255,.72); }
    .tree summary::before { content: "›"; color: var(--faint); transform: rotate(0); transition: transform .15s ease; }
    .tree details[open] > summary::before { transform: rotate(90deg); }
    .tree-node { min-width: 0; flex: 1; }
    .tree-node code { display: block; color: var(--slate); font-size: 11px; font-family: ui-monospace, monospace; }
    .tree-node span { display: block; font-size: 12px; line-height: 1.4; }
    .tree-children { margin-left: 12px; border-left: 1px solid #d2d6d9; padding-left: 5px; }
    .tree-filter {
      width: 100%; border: 0; background: transparent; text-align: left;
      border-radius: var(--radius-sm); padding: 6px 7px;
    }
    .tree-filter:hover, .tree-filter.active { background: var(--blue-soft); color: #155fa5; }
    .tree-filter code { display: block; font-size: 11px; color: inherit; font-family: ui-monospace, monospace; }
    .tree-filter span { display: block; font-size: 12px; line-height: 1.4; }
    .main { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
    .toolbar {
      display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      padding: 10px 12px; border-bottom: 1px solid var(--line); background: var(--surface);
    }
    .search {
      flex: 1 1 320px; min-width: 220px; min-height: 34px; border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm); background: white; padding: 6px 10px;
    }
    .filter-select {
      min-height: 34px; border: 1px solid var(--line-strong); background: white;
      border-radius: var(--radius-sm); padding: 5px 30px 5px 9px;
    }
    .result-count { margin-left: auto; color: var(--muted); font-size: 12px; white-space: nowrap; }
    .matrix-wrap {
      min-height: 0; overflow: auto; background: var(--surface-strong);
      scrollbar-gutter: stable both-edges;
    }
    .matrix {
      width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0;
      table-layout: fixed;
    }
    .matrix col.object { width: var(--object-w); }
    .matrix col.dimension { width: var(--dimension-col-w); }
    .matrix col.decision { width: 188px; }
    .matrix th, .matrix td { border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); vertical-align: top; }
    .matrix thead th {
      position: sticky; top: 0; z-index: 8; background: #e9ecee;
      padding: 9px 10px; text-align: left; font-size: 12px; color: #46515b;
    }
    .matrix thead th:first-child { left: 0; z-index: 10; }
    .object-cell {
      position: sticky; left: 0; z-index: 4; background: #fbfbfa;
      box-shadow: 1px 0 0 var(--line);
    }
    .matrix tbody tr:hover td { background-color: #fafcfd; }
    .matrix tbody tr:hover .object-cell { background: #f3f7fa; }
    .matrix tbody tr.is-confirmed .object-cell { box-shadow: inset 4px 0 0 var(--green), 1px 0 0 var(--line); }
    .group-row th {
      position: sticky; left: 0; z-index: 5; padding: 7px 10px; text-align: left;
      background: #ecebf0; color: #4f4a67; border-bottom: 1px solid #d4d1df;
    }
    .group-title { font-weight: 700; }
    .group-guidance {
      display: block; margin-top: 3px; color: #676276; font-size: 11px; font-weight: 500;
    }
    .object-cell { padding: 10px; }
    .path { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; color: var(--muted); font-size: 11px; }
    .path span::after { content: "›"; margin-left: 4px; color: #a0a6ac; }
    .path span:last-child::after { display: none; }
    .focus-line { color: var(--lavender); font-size: 12px; font-weight: 650; margin-bottom: 5px; }
    .assessment-code { display: block; color: var(--slate); font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .assessment-name { display: block; margin-top: 2px; font-weight: 650; line-height: 1.45; }
    .assessment-context { display: block; margin-top: 4px; color: var(--muted); font-size: 11px; }
    .badges { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 7px; }
    .badge {
      display: inline-flex; align-items: center; min-height: 21px; padding: 2px 7px;
      border-radius: 999px; background: var(--slate-soft); color: var(--slate); font-size: 11px; font-weight: 650;
    }
    .badge.good { background: var(--green-soft); color: var(--green); }
    .badge.warning { background: var(--gold-soft); color: var(--gold); }
    .badge.danger { background: var(--danger-soft); color: var(--danger); }
    .badge.lavender { background: var(--lavender-soft); color: var(--lavender); }
    .dimension-review-cell { padding: 6px; background: white; }
    .level-stack { display: grid; gap: 4px; }
    .criterion-button {
      width: 100%; min-height: 64px; display: grid; grid-template-columns: 34px minmax(0, 1fr);
      gap: 8px; align-items: start; border: 1px solid var(--line); background: #fcfcfb;
      border-radius: var(--radius-sm); padding: 7px 8px; text-align: left;
    }
    .criterion-button:hover { border-color: #b9c9d7; background: var(--blue-soft); }
    .criterion-button.is-missing { color: var(--clay); background: #fffafa; }
    .criterion-button.is-not-required {
      color: var(--muted); background: #f3f4f4; border-style: dashed;
    }
    .level-key {
      display: inline-grid; place-items: center; min-height: 25px; border-radius: 4px;
      background: var(--slate-soft); color: var(--slate); font-size: 11px; font-weight: 750;
    }
    .criterion-body { min-width: 0; }
    .criterion-copy { display: block; white-space: normal; line-height: 1.55; font-size: 12.5px; }
    .criterion-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-top: 5px; }
    .decision-cell { padding: 9px; }
    .decision-cell .button { width: 100%; margin-top: 7px; }
    .decision-copy { color: var(--muted); font-size: 11px; min-height: 34px; }
    .empty-state { padding: 46px 20px; text-align: center; color: var(--muted); }
    .drawer-backdrop {
      position: fixed; inset: 0; z-index: 70; background: rgba(36, 42, 48, .25);
      display: none;
    }
    .drawer-backdrop.open { display: block; }
    .drawer {
      position: absolute; right: 0; top: 0; bottom: 0; width: min(720px, 78vw);
      background: var(--surface-strong); box-shadow: var(--shadow);
      display: grid; grid-template-rows: auto minmax(0,1fr) auto;
    }
    .drawer-head { padding: 14px 18px; border-bottom: 1px solid var(--line); }
    .drawer-head-row { display: flex; justify-content: space-between; gap: 14px; }
    .drawer-head h2 { margin: 3px 0 0; font-size: 18px; line-height: 1.35; }
    .drawer-head p { margin: 6px 0 0; color: var(--muted); font-size: 12px; }
    .icon-button {
      width: 34px; height: 34px; border: 1px solid var(--line); border-radius: var(--radius-sm);
      background: white; font-size: 18px;
    }
    .drawer-body { overflow: auto; padding: 16px 18px 30px; }
    .drawer-foot {
      display: flex; gap: 8px; justify-content: flex-end; padding: 11px 18px;
      border-top: 1px solid var(--line); background: #fafafa;
    }
    .review-section { margin: 0 0 16px; border-top: 1px solid var(--line); padding-top: 14px; }
    .review-section:first-child { border-top: 0; padding-top: 0; }
    .review-section h3 { margin: 0 0 8px; font-size: 14px; }
    .review-section > p { margin: 4px 0 10px; color: var(--muted); font-size: 12px; }
    .notice {
      padding: 9px 10px; border-left: 3px solid var(--gold); background: var(--gold-soft);
      border-radius: 0 var(--radius-sm) var(--radius-sm) 0; color: #6b512a; font-size: 12px; margin: 8px 0;
    }
    .notice.danger { border-left-color: var(--danger); background: var(--danger-soft); color: #743737; }
    .notice.info { border-left-color: var(--blue); background: var(--blue-soft); color: #24577e; }
    .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .field { display: grid; gap: 5px; }
    .field.full { grid-column: 1 / -1; }
    .field label { color: #46515b; font-size: 12px; font-weight: 650; }
    .field select, .field textarea, .field input {
      width: 100%; border: 1px solid var(--line-strong); border-radius: var(--radius-sm);
      background: white; padding: 7px 9px;
    }
    .field textarea { min-height: 78px; resize: vertical; line-height: 1.5; }
    .decision-options { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .decision-option {
      display: inline-flex; align-items: center; gap: 6px; min-height: 34px;
      padding: 6px 10px; border: 1px solid var(--line-strong);
      border-radius: var(--radius-sm); background: white; cursor: pointer; font-weight: 650;
    }
    .decision-option:has(input:checked) {
      border-color: var(--blue); background: var(--blue-soft); color: #155fa5;
    }
    .decision-option.needs-change:has(input:checked) {
      border-color: #c99588; background: var(--clay-soft); color: var(--clay);
    }
    .decision-option.not-required:has(input:checked) {
      border-color: #818b94; background: #eef0f1; color: #4f5962;
    }
    .decision-option:has(input:disabled) { cursor: not-allowed; opacity: .48; }
    .decision-option input { margin: 0; }
    .revision-field { margin-top: 10px; }
    .revision-field[hidden] { display: none; }
    .level-review {
      margin: 8px 0; border: 1px solid var(--line); border-radius: var(--radius-md); overflow: hidden;
    }
    .level-review summary {
      cursor: pointer; display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; background: #f5f6f6; list-style: none;
    }
    .level-review summary::-webkit-details-marker { display: none; }
    .level-review summary strong { min-width: 26px; }
    .level-review summary .badge { margin-left: auto; }
    .level-review-body { padding: 12px; }
    .dimension-card {
      display: grid; grid-template-columns: 102px minmax(0,1fr); gap: 10px;
      padding: 9px 0; border-bottom: 1px solid #eceeef;
    }
    .dimension-card:last-child { border-bottom: 0; }
    .dimension-card h4 { margin: 0; font-size: 12px; color: #4e5861; }
    .dimension-card p { margin: 0; white-space: pre-wrap; line-height: 1.55; }
    .dimension-card .missing-copy { color: var(--clay); font-style: normal; }
    .raw-text { white-space: pre-wrap; padding: 10px; background: var(--lavender-soft); border-radius: var(--radius-sm); }
    .source-evidence {
      margin-top: 10px; padding: 8px 10px; border-radius: var(--radius-sm);
      background: var(--surface-muted); color: var(--muted); font-size: 11px;
    }
    .source-evidence code { font-family: ui-monospace, monospace; }
    .dimension-note-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
    .dimension-note-grid textarea { min-height: 58px; }
    .issues-panel {
      position: fixed; inset: 68px 22px 22px auto; z-index: 65; width: min(560px, calc(100vw - 44px));
      max-height: calc(100vh - 90px); overflow: auto; display: none;
      background: white; border: 1px solid var(--line); border-radius: var(--radius-lg); box-shadow: var(--shadow);
      padding: 16px;
    }
    .issues-panel.open { display: block; }
    .issues-panel h2 { margin: 0 0 4px; font-size: 18px; }
    .issues-panel > p { margin: 0 0 14px; color: var(--muted); }
    .issue-card { padding: 11px 0; border-top: 1px solid var(--line); }
    .issue-card h3 { margin: 0 0 4px; font-size: 14px; }
    .issue-card p { margin: 0; color: var(--muted); font-size: 12px; }
    .toast-host { position: fixed; right: 18px; bottom: 18px; z-index: 100; display: grid; gap: 8px; }
    .toast {
      min-width: 260px; max-width: 420px; padding: 10px 12px; border-radius: var(--radius-sm);
      color: white; background: #34424e; box-shadow: var(--shadow); font-size: 12px;
    }
    .toast.error { background: var(--danger); }
    .visually-hidden {
      position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }
    @media (max-width: 1180px) {
      :root { --sidebar-w: 244px; --object-w: 326px; --dimension-col-w: 286px; }
      .context-strip { grid-template-columns: repeat(2, minmax(150px, 1fr)); }
      .brand { min-width: 230px; }
      .actions .optional-label { display: none; }
    }
    @media (max-width: 920px) {
      body { min-width: 680px; }
      .workspace { grid-template-columns: 1fr; }
      .sidebar { display: none; }
      .topbar { flex-wrap: wrap; }
      .top-progress { order: 3; flex-basis: 100%; }
      .drawer { width: min(680px, 94vw); }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { transition: none !important; scroll-behavior: auto !important; }
    }
    @media print {
      .topbar, .context-strip, .sidebar, .toolbar, .drawer-backdrop, .issues-panel, .toast-host { display: none !important; }
      .workspace, .main { display: block; }
      .matrix-wrap { overflow: visible; }
      .matrix { width: 100%; font-size: 8px; }
      .matrix th, .matrix td { position: static !important; }
    }
  </style>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div class="brand">
        <strong>OI-197 成熟度评分标准审阅表</strong>
        <span>评分标准说明 L1–L5 应达到的程度；能力、关注点和安全技术服务以当前字典为准</span>
      </div>
      <div class="top-progress" aria-label="审阅进度">
        <div class="progress-track"><div class="progress-fill" id="progressFill"></div></div>
        <div class="progress-copy"><span id="progressText">0 / 185 行已确认</span><span id="saveStatus">尚未修改</span></div>
      </div>
      <div class="actions">
        <button class="button quiet" type="button" id="issuesButton">怎么判断 <span id="issueCountBadge"></span></button>
        <button class="button" type="button" id="importButton">导入进度</button>
        <button class="button" type="button" id="exportJsonButton">备份 JSON</button>
        <button class="button primary" type="button" id="exportHtmlButton">导出确认 HTML</button>
        <input class="visually-hidden" id="importFile" type="file" accept=".json,application/json">
      </div>
    </header>
    <section class="context-strip" aria-label="工作台摘要">
      <div class="metric"><b id="objectMetric">3 / 10 / 32 / 91</b><span>L0 / L1 / L2 / 关注点</span></div>
      <div class="metric is-warning"><b id="mappingMetric">5 / 180</b><span>历史缺失待补充 / 等级范围待确认</span></div>
      <div class="metric is-danger"><b id="levelIssueMetric">—</b><span>L1–L5 当前存在空白或不完整的评估点</span></div>
      <div class="metric is-good"><b id="decisionMetric">0</b><span>已要求修改、补充或删除等级的行</span></div>
    </section>
    <div class="workspace">
      <aside class="sidebar">
        <div class="sidebar-head">
          <h2>能力目录</h2>
          <p>点击 L0 / L1 / L2 / 关注点筛选矩阵</p>
          <button class="button small quiet" id="clearTreeFilter" type="button">显示全部</button>
        </div>
        <nav class="tree" id="treeNav" aria-label="能力目录"></nav>
      </aside>
      <main class="main">
        <div class="toolbar">
          <label class="visually-hidden" for="searchInput">搜索能力、关注点或评估点</label>
          <input class="search" id="searchInput" type="search" placeholder="搜索编码、能力、关注点、评估点或作用域">
          <label class="visually-hidden" for="issueFilter">问题筛选</label>
          <select class="filter-select" id="issueFilter">
            <option value="all">全部评估点类型</option>
            <option value="known-gap">仅历史缺失待补充</option>
            <option value="range-review">仅等级范围待确认</option>
          </select>
          <label class="visually-hidden" for="reviewFilter">确认状态筛选</label>
          <select class="filter-select" id="reviewFilter">
            <option value="all">全部确认状态</option>
            <option value="pending">仅未确认</option>
            <option value="confirmed">仅已确认</option>
            <option value="changed">仅要求修改 / 补充 / 删除等级</option>
          </select>
          <button class="button small" type="button" id="mappingQueueButton">只看历史缺失待补充</button>
          <span class="result-count" id="resultCount">185 行</span>
        </div>
        <div class="matrix-wrap" id="matrixWrap" tabindex="0" aria-label="成熟度评估依据矩阵，可横向滚动">
          <table class="matrix">
            <colgroup>
              <col class="object">
              <col class="dimension"><col class="dimension"><col class="dimension"><col class="dimension">
              <col class="decision">
            </colgroup>
            <thead>
              <tr>
                <th scope="col">能力 / 关注点 / 评估点</th>
                <th scope="col">组织与角色<br><span class="visually-hidden">内含 L1 至 L5 描述</span></th>
                <th scope="col">制度与流程<br><span class="visually-hidden">内含 L1 至 L5 描述</span></th>
                <th scope="col">平台与工具<br><span class="visually-hidden">内含 L1 至 L5 描述</span></th>
                <th scope="col">数据与信息<br><span class="visually-hidden">内含 L1 至 L5 描述</span></th>
                <th scope="col">确认进度</th>
              </tr>
            </thead>
            <tbody id="matrixBody"></tbody>
          </table>
        </div>
      </main>
    </div>
  </div>
  <div class="drawer-backdrop" id="drawerBackdrop" aria-hidden="true">
    <section class="drawer" id="reviewDrawer" role="dialog" aria-modal="true" aria-labelledby="drawerTitle"></section>
  </div>
  <aside class="issues-panel" id="issuesPanel" aria-label="评分标准审阅说明"></aside>
  <div class="toast-host" id="toastHost" aria-live="polite"></div>
  <script id="workbench-data" type="application/json">__WORKBENCH_DATA__</script>
  <script id="review-state" type="application/octet-stream"></script>
  <script>
  (() => {
    "use strict";
    const DATA = JSON.parse(document.getElementById("workbench-data").textContent);
    const LEVELS = ["L1", "L2", "L3", "L4", "L5"];
    const DIMENSIONS = [
      ["organization", "组织与角色", "组织"],
      ["process", "制度与流程", "流程"],
      ["tool", "平台与工具", "工具"],
      ["data", "数据与信息", "信息"],
    ];
    const SOURCE_LABELS = {
      AVAILABLE_OBJECT_SPECIFIC: ["有评分依据", "good"],
      PARTIAL: ["部分维度为空", "warning"],
      UNAVAILABLE_BY_DESIGN: ["原表留空", "warning"],
      MISSING_PENDING: ["当前为空", "warning"],
      UNSTRUCTURED_PENDING: ["有评分依据（原文）", "lavender"],
      PENDING_CLASSIFICATION: ["当前为空", "warning"],
      NO_RUBRIC: ["当前为空", "warning"],
    };
    const LEVEL_DECISIONS = [
      ["", "请选择"],
      ["APPROVE_AS_IS", "合理"],
      ["NEEDS_REVISION", "需要修改"],
      ["NOT_REQUIRED", "该级别不需要"],
    ];
    const rowById = new Map(DATA.rows.map(row => [row.id, row]));
    const el = id => document.getElementById(id);
    const storageKey = `sapd-oi197-review:${DATA.schemaVersion}:${DATA.template.snapshotId}`;
    let activeRowId = null;
    let activeLevel = null;
    let treeFilter = null;
    let saveTimer = null;

    const escapeHtml = value => String(value ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const nowIso = () => new Date().toISOString();
    const fileTimestamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
    const utf8ToBase64 = value => {
      const bytes = new TextEncoder().encode(value);
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(binary);
    };
    const base64ToUtf8 = value => {
      const binary = atob(value);
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    };

    function blankState() {
      return {
        schemaVersion: DATA.schemaVersion,
        templateSnapshotId: DATA.template.snapshotId,
        reviewContract: DATA.reviewContract,
        sourceFiles: Object.fromEntries(Object.entries(DATA.sourceFiles).map(([key, value]) => [key, value.sha256])),
        createdAt: nowIso(),
        updatedAt: nowIso(),
        reviewer: { name: "", reviewRound: "OI-197" },
        rowReviews: {},
        levelReviews: {},
      };
    }

    function safeParseState(raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.schemaVersion !== DATA.schemaVersion || parsed.templateSnapshotId !== DATA.template.snapshotId) return null;
        parsed.reviewContract = DATA.reviewContract;
        return parsed;
      } catch (_) {
        return null;
      }
    }

    function loadState() {
      const embeddedRaw = el("review-state").textContent.trim();
      const embedded = embeddedRaw ? safeParseState(base64ToUtf8(embeddedRaw)) : null;
      let local = null;
      try { local = safeParseState(localStorage.getItem(storageKey) || ""); } catch (_) {}
      if (embedded && local) {
        return String(embedded.updatedAt) >= String(local.updatedAt) ? embedded : local;
      }
      return embedded || local || blankState();
    }
    let state = loadState();

    function ensureRowReview(rowId) {
      state.rowReviews[rowId] ||= { confirmed: false, confirmedAt: null };
      state.levelReviews[rowId] ||= {};
      LEVELS.forEach(level => {
        state.levelReviews[rowId][level] ||= { decision: "", note: "" };
      });
      return state.rowReviews[rowId];
    }

    function markChanged() {
      state.updatedAt = nowIso();
      el("saveStatus").textContent = "正在保存…";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, JSON.stringify(state));
          el("saveStatus").textContent = `已自动保存 ${new Date().toLocaleTimeString("zh-CN", {hour:"2-digit", minute:"2-digit"})}`;
        } catch (_) {
          el("saveStatus").textContent = "浏览器存储不可用，请导出 HTML";
        }
      }, 180);
      updateSummary();
    }

    function toast(message, isError = false) {
      const node = document.createElement("div");
      node.className = `toast${isError ? " error" : ""}`;
      node.textContent = message;
      el("toastHost").appendChild(node);
      setTimeout(() => node.remove(), 3200);
    }

    function reviewBadge(row) {
      const review = state.rowReviews[row.id];
      if (review?.confirmed) return `<span class="badge good">已确认</span>`;
      if (LEVELS.some(level => state.levelReviews[row.id]?.[level]?.decision)) return `<span class="badge warning">处理中</span>`;
      return `<span class="badge">未确认</span>`;
    }

    function sourceBadge(stateCode) {
      const [label, tone] = SOURCE_LABELS[stateCode] || [stateCode, ""];
      return `<span class="badge ${tone}">${escapeHtml(label)}</span>`;
    }

    function rowContentState(row) {
      return row.reviewClassification === "KNOWN_SUPPLEMENT_GAP" ? "known-gap" : "range-review";
    }

    function contentStateBadge(row) {
      const contentState = rowContentState(row);
      if (contentState === "known-gap") return `<span class="badge danger">历史缺失 · 需要补充</span>`;
      return `<span class="badge warning">逐级确认有效范围</span>`;
    }

    function levelCriteriaState(row, level) {
      const rubric = DATA.rubrics[row.reviewRubricSetId];
      const source = rubric?.levels?.[level];
      if (!source) return "missing";
      if (String(source.rawText || "").trim()) return "raw";
      const filled = DIMENSIONS.filter(([code]) => String(source.criteria?.[code] || "").trim()).length;
      if (filled === DIMENSIONS.length) return "complete";
      if (filled === 0) return "missing";
      return "incomplete";
    }

    function isKnownSupplementLevel(row, level) {
      return row.reviewClassification === "KNOWN_SUPPLEMENT_GAP"
        && levelCriteriaState(row, level) === "missing";
    }

    function dictionaryCorrectionBadge(row) {
      if (row.mappingBucket === "review" || row.flags.includes("SOURCE_SERVICE_DRIFT")) {
        return `<span class="badge">对象已按当前字典展示</span>`;
      }
      return "";
    }

    function sourceSummary(row, level, source) {
      if (isKnownSupplementLevel(row, level)) {
        return "该等级属于已确认的历史缺失，需要补充评分依据。";
      }
      if (String(source.rawText || "").trim()) return "该等级有原始评分文字；请按完整原文判断是否合理。";
      const filled = DIMENSIONS.filter(([code]) => String(source.criteria?.[code] || "").trim()).length;
      if (filled === DIMENSIONS.length) return "该等级有完整评分依据，请判断内容是否合理。";
      if (filled > 0) return "该等级的评分依据不完整，请选择“需要修改”并写明缺少或需改写的内容。";
      return "该等级当前为空，请判断该级别不需要，还是需要补充评分依据。";
    }

    function focusReviewDirection(row) {
      if (row.flags.includes("SOURCE_SERVICE_DRIFT")) {
        return `评分依据表中的服务清单与当前字典不一致。本页面已按当前字典展示“${row.assessmentName}”；你只需判断 L1–L5 内容是否合理，不需要修正服务名称或归属。`;
      }
      if (row.reviewClassification === "KNOWN_SUPPLEMENT_GAP") {
        return `“${row.l2Name}”属于已确认的历史缺失；空白等级需要补充评分依据，不按“该级别不需要”处理。`;
      }
      if (row.mappingBucket === "noSource") {
        return `“${row.focusName}”当前没有评分文字。请先确定该评估点连续的有效等级范围；范围内的空白需要补充，范围外的最低或最高等级可以判为“不需要”。`;
      }
      if (row.flags.includes("RUBRIC_UNSTRUCTURED")) {
        return `“${row.focusName}”已有 L1–L5 原始评分文字。它属于“有评分依据”，请按完整原文判断是否合理；后续结构整理不作为你的分类任务。`;
      }
      if (row.flags.some(flag => ["RUBRIC_PARTIAL", "RUBRIC_EMPTY", "MISSING_DIMENSION", "MISSING_OR_UNCLASSIFIED_LEVEL"].includes(flag))) {
        return `“${row.focusName}”的现有标准存在空白或缺项。请先判断空白等级是否位于有效范围之外；有效范围内的空白需要补充。`;
      }
      return `请先确认“${row.focusName}”需要覆盖的连续等级范围，再判断范围内的评分文字是否合理。`;
    }

    function levelCriterionButton(row, level, dimensionCode, dimensionLabel, showDecision) {
      const rubric = DATA.rubrics[row.reviewRubricSetId];
      const source = rubric?.levels?.[level] || {
        sourceState: "NO_RUBRIC", dimensionStates: Object.fromEntries(DIMENSIONS.map(([code]) => [code, "NO_RUBRIC"])),
        criteria: {}, rawText: "",
      };
      const user = state.levelReviews[row.id]?.[level];
      const criteria = source.criteria?.[dimensionCode] || "";
      const criteriaState = levelCriteriaState(row, level);
      const displayText = criteria || (source.rawText
        ? `该等级只有未拆分原文：${source.rawText}`
        : isKnownSupplementLevel(row, level)
          ? "历史缺失：该等级需要补充"
          : criteriaState === "missing"
            ? "当前为空：请判断该等级不需要，还是需要补充"
            : "该维度当前为空");
      return `
        <button class="criterion-button${criteria ? "" : " is-missing"}${user?.decision === "NOT_REQUIRED" ? " is-not-required" : ""}" type="button"
          data-open-row="${escapeHtml(row.id)}" data-open-level="${level}"
          aria-label="${escapeHtml(row.assessmentName)} ${escapeHtml(dimensionLabel)} ${level} 评分依据">
          <span class="level-key">${level}</span>
          <span class="criterion-body">
            <span class="criterion-copy">${escapeHtml(displayText)}</span>
            <span class="criterion-meta">
              ${criteria ? "" : sourceBadge(source.dimensionStates?.[dimensionCode] || source.sourceState)}
              ${showDecision && user?.decision ? `<span class="badge lavender">${escapeHtml(levelDecisionDisplay(row, level, user.decision))}</span>` : ""}
            </span>
          </span>
        </button>`;
    }

    function dimensionReviewCell(row, dimensionCode, dimensionLabel, showDecision) {
      return `
        <td class="dimension-review-cell" data-dimension="${escapeHtml(dimensionCode)}">
          <div class="level-stack">
            ${LEVELS.map(level => levelCriterionButton(row, level, dimensionCode, dimensionLabel, showDecision)).join("")}
          </div>
        </td>`;
    }

    function levelDecisionLabel(value) {
      return (LEVEL_DECISIONS.find(([key]) => key === value) || ["", value])[1];
    }

    function levelDecisionDisplay(row, level, value) {
      if (value === "NEEDS_REVISION" && levelCriteriaState(row, level) === "missing") {
        return "需要补充";
      }
      return levelDecisionLabel(value);
    }

    function selectedRangeSummary(row) {
      const decisions = LEVELS.map(level => state.levelReviews[row.id]?.[level]?.decision || "");
      if (decisions.some(value => !value)) return "";
      const applicable = decisions
        .map((value, index) => value === "NOT_REQUIRED" ? -1 : index)
        .filter(index => index >= 0);
      if (!applicable.length) return "尚未保留任何有效等级";
      const first = Math.min(...applicable);
      const last = Math.max(...applicable);
      if (decisions.slice(first, last + 1).some(value => value === "NOT_REQUIRED")) {
        return "等级范围不连续";
      }
      return `有效范围 ${LEVELS[first]}–${LEVELS[last]}`;
    }

    function rowHtml(row) {
      const review = state.rowReviews[row.id] || {};
      const rubric = DATA.rubrics[row.reviewRubricSetId];
      const revisionCount = LEVELS.filter(level => state.levelReviews[row.id]?.[level]?.decision === "NEEDS_REVISION").length;
      const notRequiredCount = LEVELS.filter(level => state.levelReviews[row.id]?.[level]?.decision === "NOT_REQUIRED").length;
      const rangeSummary = selectedRangeSummary(row);
      const decisionParts = [
        rangeSummary,
        revisionCount ? `${revisionCount} 级需修改或补充` : "",
        notRequiredCount ? `${notRequiredCount} 级不需要` : "",
      ].filter(Boolean);
      return `
        <tr data-row-id="${escapeHtml(row.id)}" class="assessment-row${review.confirmed ? " is-confirmed" : ""}">
          <td class="object-cell">
            <span class="path"><span>${escapeHtml(row.l0Code)}</span><span>${escapeHtml(row.l1Code)}</span><span>${escapeHtml(row.l2Code)}</span></span>
            <div class="focus-line">${escapeHtml(row.focusCode)} · ${escapeHtml(row.focusName)}</div>
            <code class="assessment-code">${escapeHtml(row.assessmentCode)}</code>
            <span class="assessment-name">${escapeHtml(row.assessmentName)}</span>
            <span class="assessment-context">${escapeHtml(row.assessmentContext)}</span>
            <div class="badges">
              ${contentStateBadge(row)}
              ${dictionaryCorrectionBadge(row)}
              ${row.reviewRubricSetId ? `<span class="badge lavender">评分标准编号 ${escapeHtml(row.reviewRubricSetId)}</span>` : ""}
              ${rubric?.boundFocusCount > 1 ? `<span class="badge">同一标准用于 ${rubric.boundFocusCount} 个关注点</span>` : ""}
            </div>
          </td>
          ${DIMENSIONS.map(([dimensionCode, dimensionLabel], index) =>
            dimensionReviewCell(row, dimensionCode, dimensionLabel, index === 0)
          ).join("")}
          <td class="decision-cell">
            ${reviewBadge(row)}
            <div class="decision-copy">${decisionParts.length ? escapeHtml(decisionParts.join(" · ")) : "逐级确定连续有效范围并判断内容"}</div>
            <button class="button small" type="button" data-open-row="${escapeHtml(row.id)}">开始审阅</button>
          </td>
        </tr>`;
    }

    function currentRows() {
      const query = el("searchInput").value.trim().toLocaleLowerCase("zh-CN");
      const issue = el("issueFilter").value;
      const reviewFilter = el("reviewFilter").value;
      return DATA.rows.filter(row => {
        if (treeFilter) {
          if (treeFilter.type === "l0" && row.l0Code !== treeFilter.code) return false;
          if (treeFilter.type === "l1" && row.l1Code !== treeFilter.code) return false;
          if (treeFilter.type === "l2" && row.l2Code !== treeFilter.code) return false;
          if (treeFilter.type === "focus" && row.focusCode !== treeFilter.code) return false;
        }
        if (query) {
          const haystack = [
            row.l0Code, row.l0Name, row.l1Code, row.l1Name, row.l2Code, row.l2Name,
            row.focusCode, row.focusName, row.assessmentCode, row.assessmentName, row.assessmentContext,
          ].join(" ").toLocaleLowerCase("zh-CN");
          if (!haystack.includes(query)) return false;
        }
        const contentState = rowContentState(row);
        if (issue === "known-gap" && contentState !== "known-gap") return false;
        if (issue === "range-review" && contentState !== "range-review") return false;
        const review = state.rowReviews[row.id];
        if (reviewFilter === "pending" && review?.confirmed) return false;
        if (reviewFilter === "confirmed" && !review?.confirmed) return false;
        if (reviewFilter === "changed" && !LEVELS.some(level =>
          ["NEEDS_REVISION", "NOT_REQUIRED"].includes(state.levelReviews[row.id]?.[level]?.decision)
        )) return false;
        return true;
      });
    }

    function renderMatrix() {
      const rows = currentRows();
      let lastGroup = "";
      const chunks = [];
      rows.forEach(row => {
        const group = `${row.l2Code}|${row.focusCode}`;
        if (group !== lastGroup) {
          chunks.push(`<tr class="group-row"><th colspan="6">
            <span class="group-title">${escapeHtml(row.l2Code)} ${escapeHtml(row.l2Name)}　/　${escapeHtml(row.focusCode)} ${escapeHtml(row.focusName)}</span>
            <span class="group-guidance">审阅重点：${escapeHtml(focusReviewDirection(row))}</span>
          </th></tr>`);
          lastGroup = group;
        }
        chunks.push(rowHtml(row));
      });
      el("matrixBody").innerHTML = chunks.join("") || `<tr><td colspan="6"><div class="empty-state">没有符合当前筛选条件的评估点。</div></td></tr>`;
      el("resultCount").textContent = `${rows.length} / ${DATA.rows.length} 行`;
    }

    function renderTree() {
      el("treeNav").innerHTML = DATA.hierarchy.map(top => `
        <details open>
          <summary><span class="tree-node"><code>L0 · ${escapeHtml(top.code)}</code><span>${escapeHtml(top.name)}</span></span></summary>
          <div class="tree-children">
            <button class="tree-filter" data-tree-type="l0" data-tree-code="${escapeHtml(top.code)}"><code>${escapeHtml(top.code)}</code><span>查看该 L0 全部对象</span></button>
            ${top.domains.map(domain => `
              <details>
                <summary><span class="tree-node"><code>L1 · ${escapeHtml(domain.code)}</code><span>${escapeHtml(domain.name)}</span></span></summary>
                <div class="tree-children">
                  <button class="tree-filter" data-tree-type="l1" data-tree-code="${escapeHtml(domain.code)}"><code>${escapeHtml(domain.code)}</code><span>查看该 L1 全部对象</span></button>
                  ${domain.capabilities.map(capability => `
                    <details>
                      <summary><span class="tree-node"><code>L2 · ${escapeHtml(capability.code)}</code><span>${escapeHtml(capability.name)}</span></span></summary>
                      <div class="tree-children">
                        <button class="tree-filter" data-tree-type="l2" data-tree-code="${escapeHtml(capability.code)}"><code>${escapeHtml(capability.code)}</code><span>查看该 L2 全部评估点</span></button>
                        ${capability.focuses.map(focus => `
                          <button class="tree-filter" data-tree-type="focus" data-tree-code="${escapeHtml(focus.code)}">
                            <code>${escapeHtml(focus.code)} · ${focus.scoreItemCount} 项</code><span>${escapeHtml(focus.name)}</span>
                          </button>`).join("")}
                      </div>
                    </details>`).join("")}
                </div>
              </details>`).join("")}
          </div>
        </details>`).join("");
      updateTreeActive();
    }

    function updateTreeActive() {
      document.querySelectorAll(".tree-filter").forEach(button => {
        button.classList.toggle("active", !!treeFilter &&
          button.dataset.treeType === treeFilter.type && button.dataset.treeCode === treeFilter.code);
      });
    }

    function rowValidation(row) {
      ensureRowReview(row.id);
      const errors = [];
      LEVELS.forEach(level => {
        const levelReview = state.levelReviews[row.id][level];
        const criteriaState = levelCriteriaState(row, level);
        if (!levelReview.decision) errors.push(`${level} 尚未选择处理方式`);
        if (levelReview.decision === "NEEDS_REVISION" && !String(levelReview.note || "").trim()) {
          errors.push(`${level} 选择了“需要修改或补充”，请填写意见`);
        }
        if (criteriaState === "missing" && levelReview.decision === "APPROVE_AS_IS") {
          errors.push(`${level} 当前为空，不能直接判为“合理”`);
        }
        if (isKnownSupplementLevel(row, level) && levelReview.decision === "NOT_REQUIRED") {
          errors.push(`${level} 属于已确认的历史缺失，需要补充，不能判为“不需要”`);
        }
      });
      const decisions = LEVELS.map(level => state.levelReviews[row.id][level].decision);
      if (decisions.every(Boolean)) {
        const applicable = decisions
          .map((value, index) => value === "NOT_REQUIRED" ? -1 : index)
          .filter(index => index >= 0);
        if (!applicable.length) {
          errors.push("至少需要保留一个有效等级");
        } else {
          const first = Math.min(...applicable);
          const last = Math.max(...applicable);
          if (decisions.slice(first, last + 1).some(value => value === "NOT_REQUIRED")) {
            errors.push("“该级别不需要”只能从最低或最高等级连续删除，不能删除中间等级");
          }
        }
      }
      return errors;
    }

    function renderFocusGuidance(row) {
      return `
        <section class="review-section">
          <h3>这个关注点主要看什么</h3>
          <div class="notice">对象基准：本行的能力层级、关注点和安全技术服务均来自当前字典。评分依据表中的对象名称或归属如有冲突，后续一律按当前字典修正。</div>
          <div class="notice info">${escapeHtml(focusReviewDirection(row))}</div>
          <p>需要修改或补充时，可以直接写：应由谁负责、应形成什么流程、需要什么工具能力、应记录或衡量什么数据。若某一级不需要，直接选择“该级别不需要”。</p>
        </section>`;
    }

    function renderLevelReview(row, level, open = false) {
      ensureRowReview(row.id);
      const rubric = DATA.rubrics[row.reviewRubricSetId];
      const source = rubric?.levels?.[level] || {
        sourceState: "NO_RUBRIC", sourceStatus: "当前关注点没有评分标准",
        sourceRange: "", rawText: "", criteria: {}, dimensionStates: {},
      };
      const review = state.levelReviews[row.id][level];
      const criteriaState = levelCriteriaState(row, level);
      const knownSupplement = isKnownSupplementLevel(row, level);
      const needsChangeLabel = criteriaState === "missing" ? "需要补充" : "需要修改";
      return `
        <details class="level-review" data-level-review="${level}"${open ? " open" : ""}>
          <summary>
            <strong>${level}</strong>
            <span>${escapeHtml(sourceSummary(row, level, source))}</span>
            ${sourceBadge(source.sourceState)}
            ${review.decision ? `<span class="badge lavender">${escapeHtml(levelDecisionDisplay(row, level, review.decision))}</span>` : ""}
          </summary>
          <div class="level-review-body">
            ${source.rawText ? `<div class="raw-text"><strong>现有未整理原文</strong><br>${escapeHtml(source.rawText)}</div>` : ""}
            ${DIMENSIONS.map(([code, label]) => `
              <div class="dimension-card">
                <h4>${escapeHtml(label)}<br>${sourceBadge(source.dimensionStates?.[code] || "NO_RUBRIC")}</h4>
                <p>${source.criteria?.[code] ? escapeHtml(source.criteria[code]) : `<em class="missing-copy">${knownSupplement ? "历史缺失，需要补充" : criteriaState === "missing" ? "当前为空，待判断该等级是否需要" : "该维度当前为空"}</em>`}</p>
              </div>`).join("")}
            <div class="source-evidence">${escapeHtml(sourceSummary(row, level, source))}${rubric ? ` 评分标准编号：${escapeHtml(rubric.id)}。` : ""}</div>
            <div class="decision-options" role="radiogroup" aria-label="${level} 如何处理">
              <label class="decision-option">
                <input type="radio" name="levelDecision-${level}" data-level-decision="${level}" value="APPROVE_AS_IS"${review.decision === "APPROVE_AS_IS" ? " checked" : ""}${criteriaState === "missing" ? " disabled" : ""}>
                合理
              </label>
              <label class="decision-option needs-change">
                <input type="radio" name="levelDecision-${level}" data-level-decision="${level}" value="NEEDS_REVISION"${review.decision === "NEEDS_REVISION" ? " checked" : ""}>
                ${needsChangeLabel}
              </label>
              <label class="decision-option not-required">
                <input type="radio" name="levelDecision-${level}" data-level-decision="${level}" value="NOT_REQUIRED"${review.decision === "NOT_REQUIRED" ? " checked" : ""}${knownSupplement ? " disabled" : ""}>
                该级别不需要
              </label>
            </div>
            <div class="field revision-field" data-revision-field="${level}"${review.decision === "NEEDS_REVISION" ? "" : " hidden"}>
              <label for="levelNote-${level}">${level} ${criteriaState === "missing" ? "补充方向" : "修改意见"}</label>
              <textarea id="levelNote-${level}" data-level-note="${level}" placeholder="请直接说明应该改成什么，或需要补充哪些职责、流程、工具、数据要求。">${escapeHtml(review.note || "")}</textarea>
            </div>
          </div>
        </details>`;
    }

    function renderDrawer(row, initialLevel = null) {
      activeRowId = row.id;
      activeLevel = initialLevel;
      const review = ensureRowReview(row.id);
      const rubric = DATA.rubrics[row.reviewRubricSetId];
      el("reviewDrawer").innerHTML = `
        <header class="drawer-head">
          <div class="drawer-head-row">
            <div>
              <span class="assessment-code">${escapeHtml(row.assessmentCode)}</span>
              <h2 id="drawerTitle">${escapeHtml(row.assessmentName)}</h2>
            </div>
            <button class="icon-button" type="button" id="drawerClose" aria-label="关闭">×</button>
          </div>
          <p>${escapeHtml(row.l2Code)} ${escapeHtml(row.l2Name)} / ${escapeHtml(row.focusCode)} ${escapeHtml(row.focusName)}</p>
          <div class="badges">${contentStateBadge(row)} ${dictionaryCorrectionBadge(row)} ${rubric ? `<span class="badge lavender">评分标准编号 ${escapeHtml(rubric.id)}</span>` : ""} ${reviewBadge(row)}</div>
        </header>
        <div class="drawer-body">
          ${renderFocusGuidance(row)}
          <section class="review-section">
            <h3>先确定连续等级范围，再判断内容</h3>
            <p>每一级选择“合理”“需要修改 / 补充”或“该级别不需要”。不需要的等级只能从最低或最高端连续删除，不能删除中间等级。</p>
            <div class="actions" style="margin-top:9px">
              <button class="button small" type="button" id="approveAllLevels">有评分文字的等级全部标为合理</button>
            </div>
          </section>
          <section class="review-section">
            ${LEVELS.map(level => renderLevelReview(row, level, level === (initialLevel || "L1"))).join("")}
          </section>
        </div>
        <footer class="drawer-foot">
          <button class="button" type="button" id="savePending">保存为待处理</button>
          <button class="button primary" type="button" id="confirmAndNext">确认本行并进入下一行</button>
        </footer>`;
      bindDrawerEvents(row);
      el("drawerBackdrop").classList.add("open");
      el("drawerBackdrop").setAttribute("aria-hidden", "false");
      setTimeout(() => el("drawerClose")?.focus(), 0);
    }

    function syncDrawerInputs(row) {
      const review = ensureRowReview(row.id);
      document.querySelectorAll("[data-level-decision]:checked").forEach(input => {
        state.levelReviews[row.id][input.dataset.levelDecision].decision = input.value;
      });
      document.querySelectorAll("[data-level-note]").forEach(textarea => {
        state.levelReviews[row.id][textarea.dataset.levelNote].note = textarea.value;
      });
      review.confirmed = false;
      review.confirmedAt = null;
      markChanged();
    }

    function bindDrawerEvents(row) {
      el("drawerClose").addEventListener("click", closeDrawer);
      el("savePending").addEventListener("click", () => {
        syncDrawerInputs(row);
        renderMatrix();
        closeDrawer();
        toast("已保存为待处理；可继续导出 HTML 或稍后返回。");
      });
      el("approveAllLevels").addEventListener("click", () => {
        LEVELS.forEach(level => {
          if (levelCriteriaState(row, level) !== "missing") {
            state.levelReviews[row.id][level].decision = "APPROVE_AS_IS";
            state.levelReviews[row.id][level].note = "";
          }
        });
        renderDrawer(row, activeLevel);
        markChanged();
      });
      el("confirmAndNext").addEventListener("click", () => {
        syncDrawerInputs(row);
        const errors = rowValidation(row);
        if (errors.length) {
          toast(errors.slice(0, 3).join("；") + (errors.length > 3 ? `；另有 ${errors.length - 3} 项` : ""), true);
          return;
        }
        const visible = currentRows();
        const index = visible.findIndex(item => item.id === row.id);
        const next = visible[index + 1] || DATA.rows[DATA.rows.findIndex(item => item.id === row.id) + 1];
        const review = state.rowReviews[row.id];
        review.confirmed = true;
        review.confirmedAt = nowIso();
        markChanged();
        renderMatrix();
        if (next) {
          renderDrawer(next);
          toast("本行已确认，已进入下一行。");
        } else {
          closeDrawer();
          toast("本行已确认，已到达当前清单末尾。");
        }
      });
      document.querySelectorAll("[data-level-decision]").forEach(node => node.addEventListener("change", () => {
        const level = node.dataset.levelDecision;
        const revisionField = document.querySelector(`[data-revision-field="${level}"]`);
        const note = document.querySelector(`[data-level-note="${level}"]`);
        if (["APPROVE_AS_IS", "NOT_REQUIRED"].includes(node.value) && note) note.value = "";
        if (revisionField) revisionField.hidden = node.value !== "NEEDS_REVISION";
        syncDrawerInputs(row);
        if (node.value === "NEEDS_REVISION") note?.focus();
      }));
      document.querySelectorAll("[data-level-note]").forEach(node => node.addEventListener("input", () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => syncDrawerInputs(row), 260);
      }));
    }

    function closeDrawer() {
      el("drawerBackdrop").classList.remove("open");
      el("drawerBackdrop").setAttribute("aria-hidden", "true");
      el("reviewDrawer").innerHTML = "";
      activeRowId = null;
      activeLevel = null;
    }

    function updateSummary() {
      const confirmed = Object.values(state.rowReviews).filter(review => review.confirmed).length;
      const contentStates = DATA.rows.map(rowContentState);
      const knownGaps = contentStates.filter(value => value === "known-gap").length;
      const rangeReviews = contentStates.filter(value => value === "range-review").length;
      const rowsWithLevelIssues = DATA.rows.filter(row =>
        LEVELS.some(level => ["incomplete", "missing"].includes(levelCriteriaState(row, level)))
      ).length;
      const rowsNeedingChange = DATA.rows.filter(row =>
        LEVELS.some(level => ["NEEDS_REVISION", "NOT_REQUIRED"].includes(
          state.levelReviews[row.id]?.[level]?.decision
        ))
      ).length;
      el("progressFill").style.width = `${100 * confirmed / DATA.rows.length}%`;
      el("progressText").textContent = `${confirmed} / ${DATA.rows.length} 行已确认`;
      el("decisionMetric").textContent = `${rowsNeedingChange} 行`;
      el("mappingMetric").textContent = `${knownGaps} / ${rangeReviews}`;
      el("levelIssueMetric").textContent = `${rowsWithLevelIssues} 行`;
      const unresolved = DATA.rows.length - confirmed;
      el("issueCountBadge").textContent = unresolved ? `(${unresolved})` : "(0)";
    }

    function renderIssuesPanel() {
      const confirmed = Object.values(state.rowReviews).filter(review => review.confirmed).length;
      el("issuesPanel").innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:12px">
          <div><h2>怎么判断评分标准</h2><p>你只需要判断内容是否合理，不需要理解内部数据关系。</p></div>
          <button class="icon-button" id="issuesClose" type="button" aria-label="关闭">×</button>
        </div>
        <div class="issue-card">
          <h3>什么是评分标准</h3>
          <p>评分标准就是：针对一个关注点，L1、L2、L3、L4、L5 分别做到什么程度。原资料中的英文名称是 Rubric，本页面不再使用这个术语。</p>
        </div>
        <div class="issue-card">
          <h3>矩阵怎么读</h3>
          <p>每个评估点占一行，横向四列依次是组织与角色、制度与流程、平台与工具、数据与信息。每个维度格内从上到下排列 L1–L5，可以在同一维度内直接比较五级成熟度递进。</p>
        </div>
        <div class="issue-card">
          <h3>能力和服务以谁为准</h3>
          <p>L0、L1、L2、关注点和安全技术服务的对象身份、名称与归属全部以当前字典为准。评分依据表只提供 L1–L5 的标准文字；其中的对象信息如有问题，后续直接按当前字典修正，不需要你判断。</p>
        </div>
        <div class="issue-card">
          <h3>评估点分成两类</h3>
          <p>“历史缺失待补充”只包括进攻反制能力和安全运行管理能力，它们的空白需要补充；其他评估点进入“等级范围待确认”，不能仅凭原表空白直接判为缺失或不需要。</p>
        </div>
        <div class="issue-card">
          <h3>先确定有效等级范围</h3>
          <p>每个评估点不一定需要五个等级，但保留的等级必须形成一个连续区间，例如 L2–L5、L1–L4 或 L2–L4。“该级别不需要”只能从最低或最高端连续删除，不能单独删除中间等级。</p>
        </div>
        <div class="issue-card">
          <h3>每一级怎么判断</h3>
          <p>有评分文字时可选“合理”“需要修改”或“该级别不需要”；当前为空时只能选“需要补充”或“该级别不需要”。有效范围内的空白必须补充，范围外的最低或最高等级可以不需要。</p>
        </div>
        <div class="issue-card">
          <h3>空白不等于已经判定不需要</h3>
          <p>除已确认的两项历史缺失外，原表空白只表示原设计没有设置该等级。是否确实不需要仍由你判断；若决定保留该等级，就必须补充评分依据。</p>
        </div>
        <div class="issue-card">
          <h3>修改意见怎么写</h3>
          <p>直接写希望改成什么。可以从四个角度说明：谁负责、形成什么制度流程、需要什么工具能力、记录或衡量什么数据。</p>
        </div>
        <div class="issue-card"><h3>当前完成度</h3><p>${confirmed} / ${DATA.rows.length} 行已确认。</p></div>
        <div class="issue-card">
          <h3>审阅记录</h3>
          <div class="field-grid">
            <div class="field">
              <label for="reviewerName">审阅人</label>
              <input id="reviewerName" value="${escapeHtml(state.reviewer?.name || "")}" placeholder="可填写姓名或角色">
            </div>
            <div class="field">
              <label for="reviewRound">评审轮次</label>
              <input id="reviewRound" value="${escapeHtml(state.reviewer?.reviewRound || "OI-197")}">
            </div>
          </div>
        </div>
        <div class="issue-card">
          <h3>完成后怎么处理</h3>
          <p>点击“导出确认 HTML”并把文件交给我。我会读取每一级的“合理 / 需要修改”和修改意见，再处理 OI-197；不会让你继续判断内部映射方式。</p>
        </div>
        <div class="issue-card">
          <button class="button danger small" id="resetStateButton" type="button">清空本浏览器中的全部审阅结果</button>
        </div>`;
      el("issuesClose").addEventListener("click", () => el("issuesPanel").classList.remove("open"));
      el("reviewerName").addEventListener("input", event => {
        state.reviewer ||= {};
        state.reviewer.name = event.target.value;
        markChanged();
      });
      el("reviewRound").addEventListener("input", event => {
        state.reviewer ||= {};
        state.reviewer.reviewRound = event.target.value;
        markChanged();
      });
      el("resetStateButton").addEventListener("click", () => {
        if (!confirm("这会清空当前浏览器内 OI-197 的全部审阅结果。请先导出 HTML 或 JSON 备份。确定继续吗？")) return;
        state = blankState();
        try { localStorage.removeItem(storageKey); } catch (_) {}
        renderMatrix();
        updateSummary();
        renderIssuesPanel();
        toast("本浏览器中的审阅结果已清空。");
      });
    }

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 500);
    }

    function exportJson() {
      state.updatedAt = nowIso();
      const payload = JSON.stringify(state, null, 2);
      downloadBlob(new Blob([payload], { type: "application/json;charset=utf-8" }),
        `SAPD_OI197_成熟度审阅_${fileTimestamp()}.json`);
      toast("审阅进度 JSON 已导出。");
    }

    function exportHtml() {
      state.updatedAt = nowIso();
      const clone = document.documentElement.cloneNode(true);
      const encodedState = utf8ToBase64(JSON.stringify(state));
      clone.querySelector("#review-state").textContent = encodedState;
      clone.querySelector("#matrixBody").innerHTML = "";
      clone.querySelector("#treeNav").innerHTML = "";
      clone.querySelector("#reviewDrawer").innerHTML = "";
      clone.querySelector("#toastHost").innerHTML = "";
      clone.querySelector("#drawerBackdrop").classList.remove("open");
      clone.querySelector("#drawerBackdrop").setAttribute("aria-hidden", "true");
      clone.querySelector("#issuesPanel").classList.remove("open");
      const output = "<!doctype html>\n" + clone.outerHTML;
      downloadBlob(new Blob([output], { type: "text/html;charset=utf-8" }),
        `SAPD_OI197_成熟度评分标准审阅_${fileTimestamp()}.html`);
      const confirmed = Object.values(state.rowReviews).filter(review => review.confirmed).length;
      toast(`已导出自包含 HTML；当前 ${confirmed} / ${DATA.rows.length} 行确认，可重新打开继续或直接回传。`);
    }

    function importJson(file) {
      const reader = new FileReader();
      reader.onload = () => {
        const imported = safeParseState(String(reader.result || ""));
        if (!imported) {
          toast("文件版本或模板快照不匹配，未导入。", true);
          return;
        }
        state = imported;
        markChanged();
        renderMatrix();
        updateSummary();
        toast("审阅进度已导入。");
      };
      reader.readAsText(file, "utf-8");
    }

    function bindGlobalEvents() {
      el("searchInput").addEventListener("input", renderMatrix);
      el("issueFilter").addEventListener("change", renderMatrix);
      el("reviewFilter").addEventListener("change", renderMatrix);
      el("mappingQueueButton").addEventListener("click", () => {
        el("issueFilter").value = "known-gap";
        el("reviewFilter").value = "pending";
        treeFilter = null;
        updateTreeActive();
        renderMatrix();
        el("matrixWrap").scrollTo({ top: 0, left: 0, behavior: "smooth" });
      });
      el("matrixBody").addEventListener("click", event => {
        const target = event.target.closest("[data-open-row]");
        if (!target) return;
        const row = rowById.get(target.dataset.openRow);
        if (row) renderDrawer(row, target.dataset.openLevel || null);
      });
      el("treeNav").addEventListener("click", event => {
        const target = event.target.closest("[data-tree-type]");
        if (!target) return;
        treeFilter = { type: target.dataset.treeType, code: target.dataset.treeCode };
        updateTreeActive();
        renderMatrix();
        el("matrixWrap").scrollTo({ top: 0, left: 0, behavior: "smooth" });
      });
      el("clearTreeFilter").addEventListener("click", () => {
        treeFilter = null; updateTreeActive(); renderMatrix();
      });
      el("drawerBackdrop").addEventListener("mousedown", event => {
        if (event.target === el("drawerBackdrop")) closeDrawer();
      });
      document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
          if (el("issuesPanel").classList.contains("open")) el("issuesPanel").classList.remove("open");
          else if (el("drawerBackdrop").classList.contains("open")) closeDrawer();
        }
      });
      el("issuesButton").addEventListener("click", () => {
        renderIssuesPanel();
        el("issuesPanel").classList.toggle("open");
      });
      el("exportJsonButton").addEventListener("click", exportJson);
      el("exportHtmlButton").addEventListener("click", exportHtml);
      el("importButton").addEventListener("click", () => el("importFile").click());
      el("importFile").addEventListener("change", event => {
        const file = event.target.files?.[0];
        if (file) importJson(file);
        event.target.value = "";
      });
    }

    function initialize() {
      const counts = DATA.counts;
      el("objectMetric").textContent = `${counts.l0} / ${counts.l1} / ${counts.l2} / ${counts.focuses}`;
      renderTree();
      renderMatrix();
      updateSummary();
      renderIssuesPanel();
      bindGlobalEvents();
    }

    initialize();
  })();
  </script>
</body>
</html>
"""


def write_html(data: dict[str, Any], output_path: Path) -> None:
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    output = HTML_TEMPLATE.replace("__WORKBENCH_DATA__", payload)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(output, encoding="utf-8")


def extract_review_state(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    match = re.search(
        r'<script id="review-state" type="application/octet-stream">\s*([^<]*)\s*</script>',
        text,
    )
    if not match or not match.group(1).strip():
        raise ValueError("the HTML does not contain an exported review state")
    raw = base64.b64decode(match.group(1).strip())
    return json.loads(raw.decode("utf-8"))


def review_summary(state: dict[str, Any]) -> dict[str, Any]:
    row_reviews = state.get("rowReviews", {})
    level_reviews = state.get("levelReviews", {})
    return {
        "schemaVersion": state.get("schemaVersion"),
        "templateSnapshotId": state.get("templateSnapshotId"),
        "reviewContract": state.get("reviewContract"),
        "updatedAt": state.get("updatedAt"),
        "confirmedRows": sum(1 for item in row_reviews.values() if item.get("confirmed")),
        "levelDecisions": sum(
            1
            for row in level_reviews.values()
            for item in row.values()
            if item.get("decision")
        ),
        "levelsNeedingRevision": sum(
            1
            for row in level_reviews.values()
            for item in row.values()
            if item.get("decision") == "NEEDS_REVISION"
        ),
        "levelsNotRequired": sum(
            1
            for row in level_reviews.values()
            for item in row.values()
            if item.get("decision") == "NOT_REQUIRED"
        ),
        "revisionNotes": sum(
            1
            for row in level_reviews.values()
            for item in row.values()
            if str(item.get("note", "")).strip()
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT_PATH)
    parser.add_argument("--extract-review", type=Path)
    parser.add_argument("--summary-json", action="store_true")
    args = parser.parse_args()

    if args.extract_review:
        state = extract_review_state(args.extract_review)
        summary = review_summary(state)
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return 0

    data = build_workbench_data()
    write_html(data, args.output)
    result = {
        "output": str(args.output),
        "bytes": args.output.stat().st_size,
        "counts": data["counts"],
        "templateSnapshotId": data["template"]["snapshotId"],
    }
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.summary_json else None))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
