#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from sapd_wiki.maturity import (  # noqa: E402
    build_maturity_workspace,
    calculate_maturity_assessment,
    create_maturity_report_snapshot,
    export_maturity_score_exchange,
    export_maturity_template_exchange,
    import_maturity_score_exchange,
    import_maturity_template_exchange,
    validate_maturity_template,
)


DIMENSIONS = ("organization", "process", "tool", "data")


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def scored_entry(item_id: str, levels: tuple[str, str, str, str] = ("L1", "L2", "L3", "L4"), *, target: str = "L4", evidence: str = "E0") -> dict:
    return {
        "scoreItemId": item_id,
        "isApplicable": True,
        "elements": dict(zip(DIMENSIONS, levels, strict=True)),
        "reviewElements": {},
        "targetLevel": target,
        "targetReason": "基于风险、业务重要性与实施可行性的人工建议。",
        "targetConfirmed": True,
        "evidenceLevel": evidence,
        "evidenceSummary": "契约审计证据" if evidence != "E0" else "",
        "note": "",
        "naReason": "",
        "status": "scored",
    }


def not_applicable_entry(item_id: str, reason: str = "该对象不适用于本次企业组织评估。") -> dict:
    return {
        "scoreItemId": item_id,
        "isApplicable": False,
        "elements": {},
        "reviewElements": {},
        "targetLevel": None,
        "targetReason": "",
        "targetConfirmed": False,
        "evidenceLevel": "E0",
        "evidenceSummary": "",
        "note": "",
        "naReason": reason,
        "status": "not_applicable",
    }


def minimal_template() -> dict:
    return {
        "id": "maturity-v2.1-minimal",
        "snapshotId": "maturity-v2.1-minimal-snapshot",
        "knowledgeSnapshotId": "knowledge-v2.1-test",
        "name": "V2.1 四维评分审计模板",
        "version": "V2.1",
        "type": "custom",
        "status": "validated",
        "readOnly": False,
        "structureMutable": True,
        "weightMutable": True,
        "categories": [{"id": "l1-1", "code": "L1-A", "name": "顶级能力 L1", "level": 2, "capabilityLevel": "L1", "parentId": None, "weight": 1, "includedInOverall": True, "sourceType": "CUSTOM", "changeAction": "ADDED"}],
        "capabilities": [{"id": "capability-1", "code": "C1.1", "name": "能力 L2", "capabilityLevel": "L2", "categoryId": "l1-1", "topCategoryId": None, "weight": 1, "included": True, "isCustom": True, "sourceType": "CUSTOM", "changeAction": "ADDED", "businessImportance": 3, "riskUrgency": 3, "focusIds": ["focus-1"]}],
        "focuses": [{"id": "focus-1", "code": "C1.1-01", "name": "关注点", "capabilityId": "capability-1", "weight": 1, "included": True, "isCustom": True, "sourceType": "CUSTOM", "changeAction": "ADDED", "itemType": "FOCUS", "serviceMappingIds": [], "platformEvidenceServiceIds": [], "scoreItemIds": ["score-1"]}],
        "services": [],
        "scopes": [{"id": "scope:ALL", "code": "ALL", "name": "全部作用域", "sourceType": "DICTIONARY"}],
        "focusServiceMappings": [],
        "scoreItems": [{"id": "score-1", "itemType": "FOCUS", "capabilityId": "capability-1", "focusId": "focus-1", "serviceId": None, "scopeCode": None, "scopeName": None, "weight": 1, "required": True, "sourceType": "CUSTOM", "elementWeights": {key: 0.25 for key in DIMENSIONS}}],
        "criticalRules": [],
        "elementWeights": {key: 0.25 for key in DIMENSIONS},
    }


def main() -> int:
    workbench = read_json(ROOT / "frontend" / "capability-browser" / "public" / "data" / "capability-workbench.json")
    workspace = build_maturity_workspace(workbench)
    base = workspace["template"]
    expected_stats = {"topCategories": 3, "domains": 10, "capabilities": 32, "focuses": 91, "services": 160, "serviceMappings": 160, "platformEvidenceReferences": 6, "serviceItems": 154, "focusItems": 31, "scoreItems": 185}
    require(workspace["mode"] == "controlled_demo" and workspace["persistence"] == "browser_local_only", "V2.1 must stay a browser-local controlled demo")
    require(base["version"] == "V2.1" and base["readOnly"] is True and base["structureMutable"] is False and base["weightMutable"] is False, "fixed template must identify V2.1 and lock structure and weights")
    require(base["name"] == "SAPD标准能力成熟度模板", "the default template must expose its canonical SAPD maturity name")
    require(base["stats"] == expected_stats, f"unexpected V2.1 stats: {base['stats']}")
    require(validate_maturity_template(base)["valid"], "V2.1 fixed template must validate")
    require(all(len(item.get("rubricEntries", [])) == 20 for item in base["scoreItems"]), "every score item must expose four dimensions by five maturity levels")
    require(all("scopeCodes" not in detail["project"] for detail in workspace["projectDetails"].values()), "projects must not carry project scope selections")
    require(all(detail["project"].get("assessmentObjectType") == "ENTERPRISE_ORGANIZATION" for detail in workspace["projectDetails"].values()), "assessment object must be the enterprise organization")
    group_demo = workspace["projectDetails"]["demo-project-001"]
    require(
        group_demo["project"].get("controlledDemoRevision") == "target-conflicts-3-20260716"
        and group_demo["result"]["summary"].get("targetBelowCurrentCount") == 3,
        "the controlled group demo must migrate to exactly three backend-calculated target conflicts",
    )

    capability_by_id = {item["id"]: item for item in base["capabilities"]}
    focus_by_id = {item["id"]: item for item in base["focuses"]}
    mapping_by_focus: dict[str, list[dict]] = {}
    for mapping in base["focusServiceMappings"]:
        mapping_by_focus.setdefault(mapping["focusId"], []).append(mapping)
    for focus in base["focuses"]:
        capability = capability_by_id[focus["capabilityId"]]
        rows = [item for item in base["scoreItems"] if item["focusId"] == focus["id"]]
        mappings = mapping_by_focus.get(focus["id"], [])
        if capability["code"].startswith("T-") and mappings:
            require(all(item["itemType"] == "SERVICE" and item.get("scopeCode") for item in rows), "technical mappings must generate service points from actual scopes")
            require(len(rows) == sum(1 for item in mappings if item["serviceRole"] == "ASSESSMENT_POINT"), "technical service point count must equal actual assessment mappings")
        if capability["code"].startswith(("G-", "M-")):
            require(len(rows) == 1 and rows[0]["itemType"] == "FOCUS", "governance and management focuses must remain one FOCUS point")
            require(all(item["serviceRole"] == "PLATFORM_EVIDENCE_REFERENCE" for item in mappings), "governance and management services must be platform evidence references")
            require(not any(item.get("serviceId") in {mapping["serviceId"] for mapping in mappings} for item in rows), "platform evidence references must not become score items")

    template = minimal_template()
    template["rubricVersion"] = base["rubricVersion"]
    template["scoreItems"][0]["rubricEntries"] = [
        {**entry, "scoreItemId": "score-1"}
        for entry in base["scoreItems"][0]["rubricEntries"]
    ]
    project = {"id": "v2.1-score", "name": "V2.1 评分审计", "organization": "测试企业", "status": "scoring", "assessmentObjectType": "ENTERPRISE_ORGANIZATION", "knowledgeSnapshotId": "knowledge-v2.1-test"}
    direct_level = calculate_maturity_assessment({"project": project, "template": template, "scoreEntries": [{"scoreItemId": "score-1", "isApplicable": True, "selfLevel": "L5", "targetLevel": "L5", "targetReason": "人工建议"}]})
    require(direct_level["summary"]["currentIndex"] is None, "direct current overall level input must be ignored")

    entry = scored_entry("score-1")
    result = calculate_maturity_assessment({"project": project, "template": template, "scoreEntries": [entry]})
    require(result["summary"]["currentIndex"] == 2.5 and result["summary"]["currentLevel"] == "L3", "four dimensions must calculate current maturity")
    require(result["summary"]["targetIndex"] == 4.0 and result["summary"]["targetAchievementRate"] == 62.5, "target must aggregate and calculate achievement rate")
    require(result["summary"]["completionRate"] == 100 and result["summary"]["evidenceCoverage"] == 0, "evidence must be optional and separate from completion")
    require(
        result["summary"]["applicableCapabilityCount"] == 1
        and result["summary"]["completedCapabilityCount"] == 1
        and result["summary"]["applicableFocusCount"] == 1
        and result["summary"]["completedFocusCount"] == 1,
        "project progress summary must expose completed and applicable capability/focus counts",
    )
    require(result["calculationRun"]["algorithmVersion"] == "sapd-maturity-v2.1.0", "calculation run must freeze V2.1 algorithm version")
    with_evidence = calculate_maturity_assessment({"project": project, "template": template, "scoreEntries": [scored_entry("score-1", evidence="E5")]})
    require(with_evidence["summary"]["currentIndex"] == result["summary"]["currentIndex"], "evidence must not change the default maturity score")
    no_reason = copy.deepcopy(entry)
    no_reason["targetReason"] = ""
    no_reason_result = calculate_maturity_assessment({"project": project, "template": template, "scoreEntries": [no_reason]})
    require(
        no_reason_result["summary"]["completionRate"] == 100
        and no_reason_result["scoreItemResults"][0]["isComplete"]
        and no_reason_result["scoreItemResults"][0]["targetConfirmed"],
        "an optional assessment note must not block completion after four dimensions and target level are set",
    )
    conflicting_target = scored_entry("score-1", target="L2")
    conflicting_result = calculate_maturity_assessment({"project": project, "template": template, "scoreEntries": [conflicting_target]})
    locked_formal_result = calculate_maturity_assessment({"project": {**project, "status": "completed"}, "template": template, "scoreEntries": [conflicting_target]})
    require(
        conflicting_result["scoreItemResults"][0]["currentLevel"] == "L3"
        and conflicting_result["scoreItemResults"][0]["minimumTargetLevel"] == "L3"
        and conflicting_result["scoreItemResults"][0]["targetBelowCurrent"] is True
        and conflicting_result["scoreItemResults"][0]["isComplete"] is False,
        "target level below the backend-calculated current level must invalidate the score item",
    )
    require(
        conflicting_result["summary"]["statisticsReady"] is False
        and conflicting_result["summary"]["targetBelowCurrentCount"] == 1
        and conflicting_result["summary"]["notScoredCount"] == 1,
        "a target conflict must block project statistics and completion for active scoring",
    )
    require(
        locked_formal_result["summary"]["statisticsReady"] is True
        and locked_formal_result["summary"]["notScoredCount"] == 0
        and locked_formal_result["scoreItemResults"][0]["targetBelowCurrent"] is False,
        "a locked historical formal snapshot must retain its persisted conclusion after the target-floor rule is introduced",
    )

    exclusion_template = copy.deepcopy(template)
    exclusion_template["capabilities"][0]["focusIds"].append("focus-2")
    second_focus = copy.deepcopy(exclusion_template["focuses"][0])
    second_focus.update({"id": "focus-2", "code": "C1.1-02", "name": "不适用关注点", "scoreItemIds": ["score-2"]})
    exclusion_template["focuses"].append(second_focus)
    second_item = copy.deepcopy(exclusion_template["scoreItems"][0])
    second_item.update({"id": "score-2", "focusId": "focus-2"})
    second_item["rubricEntries"] = [{**rubric, "scoreItemId": "score-2"} for rubric in second_item["rubricEntries"]]
    exclusion_template["scoreItems"].append(second_item)
    exclusion_result = calculate_maturity_assessment({"project": project, "template": exclusion_template, "scoreEntries": [entry, not_applicable_entry("score-2")]})
    optional_na_result = calculate_maturity_assessment({"project": project, "template": exclusion_template, "scoreEntries": [entry, not_applicable_entry("score-2", reason="")]})
    exclusion_capability = exclusion_result["capabilityResults"][0]
    exclusion_category = exclusion_result["categoryResults"][0]
    exclusion_focus = next(item for item in exclusion_result["focusResults"] if item["id"] == "focus-2")
    require(
        exclusion_result["summary"]["applicableItemCount"] == 1
        and exclusion_result["summary"]["notApplicableCount"] == 1
        and exclusion_result["summary"]["completionRate"] == 100
        and exclusion_result["summary"]["currentIndex"] == 2.5,
        "not-applicable focuses must be excluded from the overall score and completion denominator",
    )
    require(
        exclusion_focus["status"] == "not_applicable"
        and exclusion_capability["applicableItemCount"] == 1
        and exclusion_capability["notApplicableItemCount"] == 1
        and exclusion_capability["completionRate"] == 100
        and exclusion_category["completionRate"] == 100,
        "not-applicable focuses must be excluded consistently from capability and category percentages",
    )
    require(
        optional_na_result["summary"]["statisticsReady"] is True
        and optional_na_result["summary"]["invalidNaReasonCount"] == 1
        and optional_na_result["scoreItemResults"][1]["isComplete"] is True,
        "an optional not-applicable reason must remain visible as information without blocking statistics or project completion",
    )

    score_export = export_maturity_score_exchange({"project": project, "template": template, "scoreEntries": [entry]})
    require(score_export["ok"] and score_export["package"]["schemaVersion"] == "maturity-score-exchange-v2.1", "score exchange export must identify V2.1")
    score_import = import_maturity_score_exchange({"project": project, "template": template, "scoreEntries": [], "exchange": score_export["package"]})
    require(score_import["ok"] and score_import["batch"]["status"] == "success" and len(score_import["scoreEntries"]) == 1, "valid score exchange must import")
    optional_note_exchange = copy.deepcopy(score_export["package"])
    optional_note_exchange["scoreInput"][0]["targetReason"] = ""
    optional_note_import = import_maturity_score_exchange({"project": project, "template": template, "scoreEntries": [], "exchange": optional_note_exchange})
    require(optional_note_import["ok"] and optional_note_import["batch"]["status"] == "success", "score exchange import must accept an empty optional assessment note")
    optional_na_exchange = copy.deepcopy(score_export["package"])
    optional_na_exchange["scoreInput"][0].update({"isApplicable": False, "organizationLevel": None, "processLevel": None, "toolLevel": None, "dataLevel": None, "targetLevel": None, "naReason": ""})
    optional_na_import = import_maturity_score_exchange({"project": project, "template": template, "scoreEntries": [], "exchange": optional_na_exchange})
    require(optional_na_import["ok"] and optional_na_import["batch"]["status"] == "success" and optional_na_import["scoreEntries"][0]["status"] == "not_applicable", "score exchange import must accept an empty optional not-applicable reason")
    conflicting_exchange = copy.deepcopy(score_export["package"])
    conflicting_exchange["scoreInput"][0]["targetLevel"] = "L2"
    conflicting_import = import_maturity_score_exchange({"project": project, "template": template, "scoreEntries": [], "exchange": conflicting_exchange})
    require(
        conflicting_import["batch"]["status"] == "failed"
        and any(error.get("code") == "target_below_current" for error in conflicting_import["rowErrors"]),
        "score exchange import must reject a target below the backend-calculated current level",
    )
    changed_structure = copy.deepcopy(score_export["package"])
    changed_structure["assessmentItems"][0]["focusName"] = "非法修改结构"
    rejected = import_maturity_score_exchange({"project": project, "template": template, "scoreEntries": [], "exchange": changed_structure})
    require(not rejected["ok"] and rejected["dataState"] == "invalid_structure", "score import must reject structural changes")

    template_export = export_maturity_template_exchange({"template": template})
    require(template_export["ok"] and template_export["package"]["schemaVersion"] == "maturity-template-exchange-v2.1", "custom template structure must export with V2.1 schema")
    template_import = import_maturity_template_exchange({"exchange": template_export["package"]})
    require(template_import["ok"] and template_import["template"]["id"] != template["id"] and template_import["template"]["type"] == "custom" and template_import["sourceTemplateType"] == "custom", "valid custom template structure must import as a protected custom copy")
    base_template_export = export_maturity_template_exchange({"template": base})
    base_template_import = import_maturity_template_exchange({"exchange": base_template_export["package"]})
    require(base_template_export["ok"] and base_template_import["ok"] and base_template_import["sourceTemplateType"] == "base" and base_template_import["template"]["type"] == "custom" and base_template_import["template"]["sourceTemplateId"] == base["id"], "the default template must export and re-import only as a mutable custom copy")

    multi_focus = next(item for item in base["focuses"] if len(item.get("scoreItemIds", [])) > 1)
    multi_items = [item for item in base["scoreItems"] if item["focusId"] == multi_focus["id"]]
    inherited_entries = [scored_entry(item["id"], levels=("L2", "L2", "L2", "L2"), target="L4") for item in multi_items]
    inherited_result = calculate_maturity_assessment({"project": project, "template": base, "scoreEntries": inherited_entries})
    inherited_focus = next(item for item in inherited_result["focusResults"] if item["id"] == multi_focus["id"])
    overridden_entries = copy.deepcopy(inherited_entries)
    overridden_entries[0]["elements"] = dict.fromkeys(DIMENSIONS, "L4")
    overridden_result = calculate_maturity_assessment({"project": project, "template": base, "scoreEntries": overridden_entries})
    overridden_focus = next(item for item in overridden_result["focusResults"] if item["id"] == multi_focus["id"])
    require(inherited_focus["currentIndex"] == 2.0 and 2.0 < overridden_focus["currentIndex"] < 4.0, "service overrides must aggregate back to the parent focus instead of preserving the inherited batch value")
    service_exclusion_entries = [scored_entry(multi_items[0]["id"])] + [not_applicable_entry(item["id"]) for item in multi_items[1:]]
    service_exclusion_result = calculate_maturity_assessment({"project": project, "template": base, "scoreEntries": service_exclusion_entries})
    service_exclusion_focus = next(item for item in service_exclusion_result["focusResults"] if item["id"] == multi_focus["id"])
    require(
        service_exclusion_focus["applicableItemCount"] == 1
        and service_exclusion_focus["notApplicableItemCount"] == len(multi_items) - 1
        and service_exclusion_focus["completedItemCount"] == 1
        and service_exclusion_focus["completionRate"] == 100
        and service_exclusion_focus["currentIndex"] == 2.5,
        "not-applicable technical services must not affect their focus score or completion denominator",
    )

    completed = copy.deepcopy(workspace["projectDetails"]["demo-project-002"])
    for completed_entry in completed["scoreEntries"]:
        if completed_entry.get("isApplicable") is not False:
            completed_entry["targetLevel"] = "L5"
    report = create_maturity_report_snapshot({"project": completed["project"], "template": completed["template"], "scoreEntries": completed["scoreEntries"], "narrative": {"executiveSummary": "管理层摘要审计", "keyFindings": "关键发现审计", "managementRecommendations": "管理建议审计", "nextSteps": "下一步审计"}})
    require(report["formal"] and set(report["fileNames"]) == {"markdown", "html"} and "json" not in report, "complete V2.1 project must generate only Markdown and HTML formal report outputs")
    require(all(token in report["markdown"] for token in ("目标达成率", "## 四维成熟度", "## 能力类别评分", "## L2 安全能力结果", "管理层摘要审计")) and all(token in report["html"] for token in ("contenteditable=\"true\"", "四维成熟度", "能力类别评分", "管理建议审计")), "customer report must combine backend scoring with editable reporting narratives")

    component = (ROOT / "frontend" / "capability-browser" / "components" / "MaturityAssessmentWorkbench.js").read_text(encoding="utf-8")
    styles = (ROOT / "frontend" / "capability-browser" / "maturity-assessment-workbench.css").read_text(encoding="utf-8")
    app_shell = (ROOT / "frontend" / "capability-browser" / "components" / "AppShell.js").read_text(encoding="utf-8")
    app_js = (ROOT / "frontend" / "capability-browser" / "app.js").read_text(encoding="utf-8")
    maturity_py = (ROOT / "src" / "sapd_wiki" / "maturity.py").read_text(encoding="utf-8")
    data_client = (ROOT / "frontend" / "capability-browser" / "dataClient.js").read_text(encoding="utf-8")
    frontend_spec = (ROOT / "frontend" / "design-handoff" / "implementation-specs" / "maturity-assessment-v2-1-complete-frontend-design-2026-07-12.md").read_text(encoding="utf-8")
    global_plan = (ROOT / "frontend" / "design-handoff" / "implementation-specs" / "frontend-global-optimization-plan-2026-07-11.md").read_text(encoding="utf-8")
    business_spec = (ROOT.parent.parent / "04_workspace" / "research" / "知识库工程" / "SAPD maturity assesment" / "SAPD_成熟度评估业务设计_V2.1_20260712.md").read_text(encoding="utf-8")
    report_config = (ROOT / "config" / "maturity" / "report-template-v1.yaml").read_text(encoding="utf-8")
    project_list_block = component.split("function renderProjectList()", 1)[1].split("function renderCompactCategoryBars", 1)[0]
    template_manager_block = component.split("function renderTemplateManager()", 1)[1].split("function normalizedRoute", 1)[0]
    overview_block = component.split("function renderOverviewTab(detail)", 1)[1].split("function renderTemplateTab", 1)[0]
    scoring_block = component.split("function renderScoringTab(detail)", 1)[1].split("function renderScoreRow", 1)[0]
    batch_block = component.split("function renderFocusBatchControls", 1)[1].split("function renderScoreInspector", 1)[0]
    inspector_block = component.split("function renderScoreInspector", 1)[1].split("function rubricRows", 1)[0]
    assessment_details_block = inspector_block.split('class="maturity-v15-assessment-details"', 1)[1].split("</section>", 1)[0]
    score_overview_block = component.split("function renderScoreOverview", 1)[1].split("function hierarchyResult", 1)[0]
    l2_summary_block = component.split("function renderL2Summary", 1)[1].split("function renderScoreDirectoryRow", 1)[0]
    element_controls_block = component.split("function renderElementControls", 1)[1].split("function renderReviewTab", 1)[0]
    review_block = component.split("function renderReviewInspector", 1)[1].split("function renderReviewTab", 1)[0]
    review_tab_block = component.split("function renderReviewTab", 1)[1].split("function capabilityRadarGroups", 1)[0]
    result_summary_block = component.split("function renderResultSummary", 1)[1].split("function renderResultDimensionRadar", 1)[0]
    capability_radar_block = component.split("function renderCapabilityRadar", 1)[1].split("function renderAssessmentDistributions", 1)[0]
    project_search_block = component.split("function projectObjectSearchResults", 1)[1].split("function templateStats", 1)[0]
    results_tab_block = component.split("function renderResultsTab", 1)[1].split("function renderCategoryComparison", 1)[0]
    report_tab_block = component.split("function renderReportTab", 1)[1].split("function activeControlLocator", 1)[0]
    complete_assessment_block = component.split("async function completeAssessment", 1)[1].split("function scheduleScoringLanding", 1)[0]
    score_update_block = component.split("function updateScoreEntry", 1)[1].split("function updateFocusEntries", 1)[0]
    require("data-create-scope" not in component and "filterTemplateByScopes" not in component and "项目作用域" not in component, "frontend project flow must remove project scope selection and filtering")
    require("评估对象类型" not in component and "ENTERPRISE_ORGANIZATION" in component and "客户所属行业" in component and "企业规模" in component, "project creation must use the V2.1 enterprise customer fields")
    require("结构与权重只读" in component and "PLATFORM_EVIDENCE_REFERENCE" in component, "fixed-template lock and platform evidence role must be visible")
    require("maturity-v1-scoring-layout" not in component and "maturity-v3-scoring-workspace" in component and "data-maturity-capability-jump" in component, "scoring must use the selected L2/focus/point workspace")
    require('model.activeTab === "scoring" ? ""' not in component and "maturity-v5-project-context" in component and "maturityShellHeaderActions" in app_shell and "syncMaturityShellHeader" in component, "all maturity project tabs must retain one compact project context under the real App Shell header")
    require('<header class="maturity-v1-page-header">' not in component and '<header class="maturity-v1-project-header">' not in component and '["workbenchWorkspace", "main-only"]' in app_shell, "maturity list and project pages must share the main-only Apple Shell layout")
    require('details class="maturity-v3-scoring-tools"' in scoring_block and all(token in scoring_block for token in ("data-maturity-score-search", "data-maturity-score-filter", "export-score-exchange", "trigger-score-import")), "secondary scoring tools must stay available under the App Shell More popover")
    require("scorePanelCollapsed" not in component and 'data-maturity-action="toggle-score-panel"' not in inspector_block and '<header class="maturity-v3-score-form-header">' not in inspector_block, "the active score form must remove the redundant header and collapse control")
    require("maturity-v4-scoring-shell" in component and ".maturity-v4-scoring-shell" in styles and "grid-template-columns: 304px minmax(0, 1fr)" in styles, "scoring must use a stable left directory and right workbench layout")
    require("maturity-v2-create-page" not in component and "maturity-v1-modal-backdrop maturity-v2-create-layer" in component and "role=\"dialog\"" in component and 'data-shell-workflow-overlay="maturity-project-create"' in component and 'data-shell-overlay-surface="maturity-project-create"' in component, "project creation must use the centered Apple Shell workflow overlay without replacing the project list")
    require("maturityDrawerIn" not in styles and "translateX" not in styles and "maturityModalIn" in styles, "project creation must not use right-side drawer motion")
    require("width: min(780px, calc(100vw - 48px))" in styles and "place-items: center" in styles and "grid-template-columns: repeat(2, minmax(0, 1fr))" in styles and "border-radius: var(--sapd-shell-radius-overlay, 14px)" in styles, "project creation must preserve the centered 780px desktop modal, Apple Shell overlay radius and compact two-column form")
    require("maturity-v1-summary-strip" not in component and "maturity-v2-list-views" in component and "toggle-project-preview" in component, "project list must be an operational queue without KPI strip and with inline preview")
    require("下一步：选择模板" in component and "下一步：确认信息" in component and "创建并进入项目" in component, "create modal must expose one primary action per step")
    close_create_block = component.split("function closeCreateWizard()", 1)[1].split("function saveCreateDraft", 1)[0]
    require(
        "function closeCreateWizard()" in component
        and "createDraftIsDirty()" not in close_create_block
        and component.count('data-maturity-action="close-create"') >= 2
        and 'model.createStep === 1 ? "close-create" : "create-back"' in component
        and 'if (action === "close-create") closeCreateWizard();' in component
        and 'if (event.key === "Escape")' in component
        and "closeCreateWizard();" in component.split('if (event.key === "Escape")', 1)[1].split("return;", 1)[0]
        and "maturity-v2-close-confirm" not in component
        and "maturity-v2-close-confirm" not in styles,
        "cancel, close, Escape and scrim must dismiss the uncreated project directly",
    )
    require('data-maturity-literal-input="project-owner"' in component and 'translate="no"' in component and 'class="maturity-v2-literal notranslate"' in component, "project identity inputs must opt out of translation and text rewriting")
    require(component.count('data-maturity-literal="project-owner"') >= 4, "project owner must remain a literal value in confirmation, list, preview and project detail views")
    require(".maturity-v2-literal" in styles and "text-transform: none !important" in styles, "literal project identity values must preserve user-entered letter case")
    require("data-maturity-score-search" in component and "data-maturity-score-filter" in component and "maturity-v4-score-directory" in component, "scoring must retain search and filters while using the capability directory")
    require(all(token in component for token in ("select-score-l0", "select-score-l1", "select-capability", "select-focus")), "scoring must navigate from L0 through L1 and L2 to a focus")
    require("data-score-item-switch" not in scoring_block and "previous-score-item-in-focus" not in component and "next-score-item-in-focus" not in component and "maturity-v5-service-tab-item" in scoring_block and "maintenance-section-tab maturity-v4-service-tab" in scoring_block and "select-score-item" in scoring_block, "service navigation must use full-text shared tabs instead of previous/next actions, cards or a child assessment dropdown")
    require('type="checkbox" data-score-applicability' in scoring_block and "maturity-v5-service-tab-applicability" in scoring_block and 'aria-label="${escapeHtml(`${itemLabel}是否适用`)}"' in scoring_block, "each service tab must place its square applicability checkbox directly after the full service label")
    require(all(token in element_controls_block for token in ("maturity-v15-score-matrix", "data-maturity-score-level", 'role="radiogroup"', 'role="radio"', 'aria-checked="${active}"')) and "data-maturity-score-slider" not in element_controls_block, "all four dimensions must use independent object-rubric-backed L1-L5 score matrices instead of per-row sliders")
    require("is-not-applicable" in component and "不适用说明（可选）" in component, "not-applicable points must disable scoring and target inputs while keeping an optional explanation field")
    require("apply-focus-batch-level" in component and "data-maturity-focus-batch-slider" in batch_block and 'type="range" min="1" max="5" step="1"' in batch_block and "下级评估设置" in batch_block and "统一设置应用到下级" in batch_block and "DIMENSIONS.reduce" in component and "作为下级评估点的四维初始等级" in component, "focus initialization must use the shared discrete slider and explicitly apply one level to all four dimensions of child services")
    require("hasAnyScore" in batch_block and "canApply" in batch_block and "canClear" in batch_block and "清空后才能再次统一设置" in batch_block, "child assessment settings must lock uniform initialization after any child score and reopen it only after clearing")
    require('data-maturity-action="toggle-focus-batch"' in scoring_block and ">下级评估设置</button>" in scoring_block and "focusBatch.allowed ?" not in scoring_block and 'model.focusBatchOpen && sourceMode === "CHILD_ROLLUP"' in scoring_block, "child assessment settings must remain openable regardless of whether child scores already exist")
    require(all(token in component for token in ("request-clear-focus-scores", "confirm-clear-focus-scores", "cancel-clear-focus-scores", 'entry.elements = {};', 'entry.reviewElements = {};', 'scope: "FOCUS_CLEAR"')) and 'item.itemType === "SERVICE"' in component, "clearing child scores must be a confirmed service-item action that removes only self and review dimension scores")
    require('entry.lastUpdateScope = scope' in component and 'entry.lastUpdateScope = "ITEM"' in component and 'delete entry.focusBatchSourceId' in component, "focus initialization, clearing and later item overrides must remain distinguishable")
    require("focus?.description" in scoring_block and "maturity-v5-focus-stats" in scoring_block and "focusApplicableCount" in scoring_block and "focusNotApplicableCount" in scoring_block and "currentIndex" not in scoring_block and "targetLevel" not in scoring_block, "focus execution header must show definition, applicability counts and completion without feeding child aggregate scores back into the scoring header")
    require("capabilityResults" in component and "renderL2Summary" in component, "L2 result summary must continue to use backend aggregate results")
    require("projectTop" in component and 'querySelector(".maturity-v1-project-page")' in component and "preventScroll: true" in component and "requestAnimationFrame" in component, "score updates must re-query the live project scroll owner and restore position across rerenders")
    require(all(token in component for token in ("maturity-v4-score-state", 'label: "已完成"', 'label: "进行中"', 'label: "未开始"')) and all(token in styles for token in (".maturity-v4-score-state.is-complete", ".maturity-v4-score-state.is-in-progress", ".maturity-v4-score-state.is-not-started")), "every directory node must expose distinct complete, in-progress and not-started statuses")
    require("iconOnly" in component and "is-icon-only" in component and "title=\"${escapeHtml(accessibleLabel)}\"" in component and ".maturity-v4-score-state.is-icon-only" in styles and "display: none" in styles, "directory status tags must be visual-only while retaining accessible labels")
    require(".maturity-v4-service-tabs.maintenance-section-tabs" in styles and "--maturity-service-tab-columns" not in scoring_block and "display: flex" in styles and "flex-wrap: nowrap" in styles and "title=\"${escapeHtml(`${state.label} · ${itemLabel}`)}\"" in scoring_block, "service navigation must return to the one-line global Apple Shell tab grammar")
    require("maturity-v5-service-tab-item" in scoring_block and "maturity-v5-service-tab-applicability" in scoring_block and "translateY(-2px)" in styles and ".maturity-v5-service-tab-item.is-active .maturity-v4-service-tab strong" in styles and "max-width: none" in styles, "the selected service tab must rise and reveal its full label while retaining the compact applicability checkbox")
    require("通用等级定义" not in component and "selectedRubric?.criteria" in element_controls_block and "maturity-v15-score-feedback" in element_controls_block and 'aria-live="polite"' in element_controls_block and "maturity-v3-selected-rubric" not in component, "the selected object-specific rubric must live in its own persistent row feedback lane without duplicate generic copy")
    require("差距" not in l2_summary_block and "评估维度均值" in l2_summary_block and "适用评估点" in l2_summary_block and "grid-template-columns: repeat(3" in styles and "grid-template-rows: 18px minmax(50px, 1fr)" in styles, "L2 execution summary must remove the gap metric, align all remaining rows and name the four-dimension aggregate as assessment-dimension mean")
    require('const visibleLevel = level === "FOCUS" ? "关注点" : level' in component and '<span class="maturity-v1-row-status is-muted">关注点</span>' in component and '<span class="maturity-v1-row-status is-muted">FOCUS</span>' not in component, "FOCUS may remain an internal object type but all execution-page type labels must read 关注点")
    require("maturity-v1-demo-notice" not in component and "受控 demo" not in component and "演示项目" not in app_shell and "演示项目" not in app_js, "customer-facing maturity UI must not expose demo banners or demo project labels")
    require("lastSavedAt" in component and "localSaveState" in component and "result: detail.result" in component, "browser-local score persistence must include save state and the matching aggregate result")
    require("保存并转到下一项" in component and "保存并刷新试算" not in component, "inline scoring must use autosave semantics instead of implying a single-row authoritative calculation")
    require("maturity-v4-score-header-actions" not in inspector_block and 'footer class="maturity-v3-score-footer"' in inspector_block and 'data-maturity-action="next-score-item"' in inspector_block and "不适用项不会进入评分、聚合或完成率分母。" in inspector_block, "the primary save-and-next action and exclusion rule must live together in the score footer")
    require(
        '.maturity-v1-project-page:has([data-maturity-v3-scoring]) > .maturity-v1-project-body' in styles
        and '.maturity-v4-score-directory {\n  position: sticky;\n  z-index: 2;\n  top: 100px;\n  align-self: start;' in styles
        and 'twenty-seventh acceptance: outer scoring scroll' in styles
        and '.maturity-v4-score-workbench > .maturity-v3-score-form {\n    height: auto;\n    min-height: 0;\n    overflow: visible;\n    overscroll-behavior: auto;\n    scrollbar-gutter: auto;' in styles
        and '.maturity-v12-score-dimensions {\n    height: auto;\n    min-height: 0;\n    max-height: none;\n    overflow: visible;' in styles
        and '.maturity-v12-score-side {\n    height: max-content;\n    max-height: calc(100dvh - var(--topbar-height, 72px) - var(--page-header-height, 100px) - 118px);\n    position: sticky;' in styles
        and 'const formScrollOwner = target?.closest(".maturity-v3-score-form")' in component
        and 'maturity-assessment-v2.1-project-unlock-progress-20260717-33' in (ROOT / "frontend" / "capability-browser" / "index.html").read_text(encoding="utf-8"),
        "the scoring project page must be the only vertical scroll owner while the expanded form stays in normal flow and the overview remains sticky",
    )
    require("data-focus-applicability-toggle" in scoring_block and "data-focus-na-reason" in scoring_block and "不适用项退出评分与聚合" in component, "focus and service applicability controls must expose the exclusion contract")
    require(all(token in component for token in ("capabilityRadarGroups", "topCategoryId", "全能力分组雷达", 'data-maturity-radar-contract="l2-capability-by-top-category"', "不按 0 分计算", "RADAR_SHORT_LABELS", "renderRadarAnalysis", "subCategoryResults", "低于目标等级")) and all(token in styles for token in ("maturity-v4-radar-layout", "maturity-v4-radar-analysis", "maturity-v21-radar-stack", "maturity-v21-capability-radar-layout")) and "data-maturity-result-capability" not in component, "results must show every backend L2 capability on a Chinese-short-label fixed-scale radar with adjacent L0/L1/L2 backend statistics")
    require("maturity-v6-project-sticky-header" in component and '.maturity-v6-project-sticky-header' in styles and "position: sticky" in styles and "height: 52px" in styles, "project identity and all six project tabs must share one locked Apple Shell header region")
    require(component.index('class="maturity-v5-project-context"') < component.index('class="maturity-v1-tabs"') and 'aria-label="当前项目与项目步骤"' in component, "the locked project region must contain the project context before the six-step navigation")
    require("renderAssessmentCoverage" not in component and all(token in component for token in ("renderResultSummary", "renderAssessmentDistributions", "适用评估点 / 全部评估点", "已完成 / 适用评估点", "maturity-v20-result-distributions")), "result statistics must consolidate applicability and progress denominators while moving maturity and evidence distributions under result evaluation")
    require(".maturity-v9-score-slider-track" in styles and 'input[type="range"]::-webkit-slider-thumb' in styles and "data-maturity-focus-batch-slider" in batch_block and "width: min(100%, 290px)" in styles and "width: 34px" in styles and "height: 30px" in styles and "border: 0 !important" in styles and "--maturity-score-progress" in styles and "--maturity-score-ratio" in styles and "prefers-reduced-motion: reduce" in styles, "the retained focus-batch initializer must continue using the shared discrete macOS slider without leaking that control into per-dimension scoring")
    require("data-maturity-score-group" in element_controls_block and "LEVELS.map" in element_controls_block and "maturity-v15-score-matrix" in element_controls_block and "maturity-v3-level-buttons" not in element_controls_block and "set-element-level" not in element_controls_block, "every dimension must render one stable five-cell score matrix")
    require("commitScoreLevel" in score_update_block and "rubricRows(item, dimension)" in score_update_block and "updateScoreEntry" in score_update_block and "reviewElements" in score_update_block and "elements" in score_update_block, "matrix selections must validate the object rubric and reuse the existing score-entry update contract")
    require(all(token in component for token in ('"ArrowRight"', '"ArrowLeft"', '"Home"', '"End"', "data-maturity-score-level")) and "is-tip-animating" not in component, "the five-cell matrix must provide radio-style keyboard navigation without transient cross-row tip animation")
    require('const serviceTabDensity = currentFocusItems.length <= 3 ? "is-sparse" : "is-dense"' in scoring_block and 'data-service-tab-count="${currentFocusItems.length}"' in scoring_block, "service tabs must choose sparse or dense Apple Shell width behavior from the current focus item count")
    require(".maturity-v4-service-tabs.maintenance-section-tabs.is-sparse" in styles and "min-width: max-content" in styles and "margin-inline: 0 auto" in styles and "justify-content: flex-start" in styles, "one to three service tabs must form a left-aligned content-width Apple Shell control")
    require("assessmentProgress" in component and all(token in component for token in ("completedCapabilityCount", "completedFocusCount", "completedItemCount", "remainingCapabilityCount", "remainingFocusCount", "remainingItemCount", "notApplicableCapabilityCount", "notApplicableFocusCount", "notApplicableCount")), "project overview progress must expose completed, remaining and not-applicable counts at capability, focus and score-item grain")
    require(all(token in component for token in ("maturity-v10-project-overview", "项目基本信息", "maturity-v10-overview-progress", "评估进度", "完成率分母")) and "当前结果" not in overview_block and "renderCompactCategoryBars" not in overview_block, "project overview must separate project facts on the left from assessment progress on the right without mixing result aggregates")
    require("maturity-v1-gap-preview" not in component and "差距摘要" not in component and "maturity-v9-overview-continue" in component and "margin-top: auto" in styles, "project overview must remove the gap summary and anchor continue-scoring at the bottom of the progress column")
    require(all(token in maturity_py for token in ("applicableCapabilityCount", "completedCapabilityCount", "applicableFocusCount", "completedFocusCount")), "backend maturity summary must project progress counts instead of deriving completion semantics only in the browser")
    require("refreshScoringCalculatedState" in component and 'if (silent) refreshScoringCalculatedState(detail);' in component and 'querySelector(".maturity-v3-l2-summary")' in component and 'querySelector("[data-maturity-current-summary]")' in component and "renderScoreOverview" in component and "drawPointRadar(detail)" in component, "silent backend recalculation must refresh the fixed-open score overview and its radar while leaving score controls mounted")
    require(all(token in inspector_block for token in ("maturity-v12-score-layout", "maturity-v12-score-dimensions", "maturity-v12-score-side", "maturity-v15-assessment-details", "maturity-v16-target-settings", "评估说明（可选）", "renderScoreOverview")) and "maturity-v12-evidence-summary" not in assessment_details_block and assessment_details_block.count('data-score-text="targetReason"') == 1, "score execution must keep one optional assessment-note field beside the required target level")
    require("sapd-stat-vibrancy" in score_overview_block and component.count("sapd-stat-vibrancy") >= 6 and "stat-vibrancy.css" in (ROOT / "frontend" / "capability-browser" / "index.html").read_text(encoding="utf-8"), "maturity statistic surfaces must reuse the shared Apple Shell vibrancy class instead of local decorative glass")
    require(all(token in score_overview_block for token in ("maturity-v15-score-overview", "maturity-v17-score-overview-heading", "data-maturity-point-radar", "总体目标（等轴）", "非逐维目标", "maturity-v16-score-target")) and all(token not in score_overview_block for token in ("<details", "<summary", "项目适用评估点", "目标达成率", "强项", "待加强", "maturity-v15-score-observation", "维度得分明细")), "the fixed-open score overview must retain only score, current/target level and the four-dimension radar")
    require("if (model.calculating)" in component and "scheduleCalculation(detail);" in component.split("function scheduleCalculation", 1)[1].split("function readCreateStepOne", 1)[0], "rapid score changes must queue a final backend recalculation instead of dropping the newest dimension value")
    require("人工目标" not in component and component.count("目标等级") >= 6, "all maturity user-facing target labels must use the unified target-level wording")
    require("grid-template-columns: minmax(78px, 90px) minmax(500px, 1fr)" in styles and "overflow-x: auto" in styles and "workbenchOverflow" not in component, "the stable four-dimension picker must fit desktop and keep narrow-width overflow local")
    require("目标达成率" in component and "证据等级（可选）" in component, "target achievement and optional evidence semantics must be visible")
    require("rubricEntries" in component and "rubric_missing" in maturity_py, "rubric data must come from the API contract and block incomplete score definitions")
    require("exportMaturityScoreExchange" in component and "importMaturityScoreExchange" in component and "文件交换记录" in component, "score file exchange and batch feedback must exist")
    require("maturityScoreExport" in data_client and "maturityTemplateImport" in data_client, "dataClient must own V2.1 exchange API contracts")
    require(".maturity-v2-platform-references" in styles and ".maturity-v2-exchange-log" in styles and "@media (max-width: 720px)" in styles, "V2.1 UI must style reference services, exchange batches and responsive constraints")
    require(all(token in frontend_spec for token in ("四维评分判定契约", "当前已经稳定实现的最高完整等级", "对象专用标准", "rubric_missing", "数据与信息")), "frontend maturity specification must define independent four-dimension scoring and rubric fallback boundaries")
    require("FE-R53" in global_plan and "数据维度不等于证据数量" in global_plan and "工具维度不由服务映射或部署事实自动生成" in global_plan, "global frontend plan must preserve the maturity rubric visibility and non-inference contract")
    require(all(token in frontend_spec for token in ("DIRECT", "CHILD_ROLLUP", "统一设置下级", "一个有效来源")), "frontend maturity specification must make direct scoring and child rollup mutually exclusive")
    require("minmax(380px, 1fr)" in frontend_spec and "方案 2" in frontend_spec and "加长评分依据" in frontend_spec, "selected design must preserve the wide scoring-basis column and inline rubric row")
    require("G-SP.SM-01" in frontend_spec and "FOCUS 完整样例" in frontend_spec and "不生成空服务" in frontend_spec, "frontend specification must include a no-service FOCUS golden sample")
    require(all(token in frontend_spec for token in ("关注点单等级初始化", "下级已有任一维度评分后锁定", "评分执行页不回写关注点评级", "结果页后端聚合", "适用性方框勾选", "当前下级评估点不使用下拉菜单", "评分后保持原位")), "frontend specification must freeze the second-round scoring interaction and aggregation boundaries")
    require(all(token in global_plan for token in ("FE-R54", "FE-R55", "DIRECT / CHILD_ROLLUP", "评分依据最小 `380px`")), "global frontend plan must cover score-source collision and narrow scoring-basis risks")
    require(all(token in global_plan for token in ("FE-R56", "FE-R57", "G-SP.SM-01", "用户可见 demo 信息清零")), "global frontend plan must cover applicability, FOCUS and removal of user-facing demo information")
    require(all(token in frontend_spec for token in ("第三轮授权变化与保留边界", "左侧评分目录", "未在此清单内的功能删除或对象粒度变化一律视为回归")), "third-round maturity redesign must preserve explicit functional and object-granularity boundaries")
    require(all(token in frontend_spec for token in ("两张独立设计图", "不得上下拼接", "G-SP.SM-02", "G-SP.SM-03")), "SERVICE and no-service FOCUS review images must be separate and use the real focus sibling list")
    require("FE-R58" in global_plan and "第二轮八项修正白名单" in global_plan and "本轮结构变化可逐条映射" in global_plan, "global frontend plan must keep authorized maturity redesign changes traceable to user feedback")
    require(all(token in frontend_spec for token in ("评分目录状态契约", "共享服务 Tab", "L2 全能力分组雷达", "技术、治理、管理", "完成率分母", "1.14")), "frontend maturity specification must freeze the directory, shared tabs, all-L2 grouped radar, exclusion and animation contracts")
    require(all(token in global_plan for token in ("FE-R62", "FE-R63", "FE-R64", "FE-R65", "FE-R66", "FE-R67", "FE-R68", "FE-R69", "FE-R70", "保存并转到下一项", "固定 1—5 量尺")), "global frontend plan must track directory density, project context, shared tabs, all-L2 result grain and score animation risks")
    require(all(token in business_spec for token in ("0.1.12", "左侧安全能力评分目录", "完成率只使用适用评估点作为分母", "22.3.1 L2 全能力分组雷达", "技术、治理、管理", "减少动态效果偏好")), "business design must synchronize the project context, shared tabs, all-L2 grouped radar and motion rules")
    require(all(token in frontend_spec for token in ("第六轮评分交互重新裁定", "同一 Tab 项", "选中评分格", "项目身份区与六个步骤页签组成的完整")), "frontend maturity specification must freeze the sixth-round integrated-tab, in-cell rubric and whole-header lock corrections")
    require(all(token in global_plan for token in ("FE-R76", "FE-R77", "FE-R78", "格内同时显示", "整体 sticky")), "global frontend plan must track sixth-round integrated service tabs, expanding score cells and full project header lock")
    require(all(token in business_spec for token in ("0.1.16", "选中评分格本身平滑扩展", "项目标题和六个项目步骤页签作为一个整体锁定", "不改变评分、聚合或 `targetLevel`")), "business design must synchronize the sixth-round interaction without changing target or aggregation semantics")
    require(all(token in frontend_spec for token in ("第七轮 Apple Shell 与局部评分动效裁定", "评估维度均值", "用户文案固定为“关注点”", "稳定五格轨道")), "frontend maturity specification must freeze the seventh-round labels, Apple Shell tabs and isolated square score motion")
    require(all(token in global_plan for token in ("FE-R79", "FE-R80", "FE-R81", "FE-R82", "单行 Apple Shell Tab", "不得触发其他维度重建")), "global frontend plan must track the seventh-round metric, naming, tab and score-render isolation risks")
    require(all(token in business_spec for token in ("0.1.17", "评估维度均值", "安全技术服务切换使用单行 Apple Shell Tab", "只更新当前维度控件")), "business design must synchronize the seventh-round UI workflow without changing scoring semantics")
    require(all(token in frontend_spec for token in ("第九轮五档滑杆、稀疏 Tab 与进度概览裁定", "五档离散滑杆", "1—3 项左对齐", "评估进度", "删除差距摘要", "继续评分按钮固定在右侧区域底部")), "frontend maturity specification must freeze the discrete slider, sparse-tab alignment and progress-first overview")
    require(all(token in global_plan for token in ("FE-R85", "FE-R86", "FE-R87", "五档离散滑杆", "少量 Tab 左对齐", "项目概览只解释评估进度")), "global frontend plan must track slider overlap, sparse-tab alignment and overview information-scope risks")
    require(all(token in business_spec for token in ("0.1.19", "五档离散滑杆", "1—3 个评估点时左对齐", "已完成能力", "已完成关注点", "差距摘要从项目概览删除")), "business design must synchronize the discrete slider and progress metrics without changing scoring semantics")
    require(all(token in frontend_spec for token in ("第十轮项目概览分区与 macOS 滑块裁定", "左侧只展示项目名称", "右侧只突出评估进度", "应用到下级")) and all(token in global_plan for token in ("FE-R88", "FE-R89", "左侧项目基本信息", "拖动不直接覆盖下级")) and all(token in business_spec for token in ("0.1.20", "不同对象粒度的不适用数量不得相加", "不显示表单式外框和 1—5 数字标签", "用户点击“应用到下级”")), "all three maturity documents must synchronize the project/progress split and shared macOS slider contract")
    require(all(token in frontend_spec for token in ("第十一轮滑块比例与下级评估设置裁定", "290px", "清空全部下级 `elements / reviewElements`")) and all(token in global_plan for token in ("FE-R90", "FE-R91", "下级评估设置", "确认清空")) and all(token in business_spec for token in ("0.1.21", "清空下级当前所有评分", "统一设置应用到下级", "elements / reviewElements")), "all three maturity documents must synchronize the short thick slider and clear-before-reapply child assessment settings contract")
    require(all(token in frontend_spec for token in ("第十二轮真实工程双栏评分与 Vibrancy 裁定", "五个定位点始终可见", "等级解释 Tip", "右侧统计区")) and all(token in global_plan for token in ("FE-R93", "FE-R94", "统计类 Vibrancy", "普通表单", "禁用")) and all(token in business_spec for token in ("0.1.23", "等级解释 Tip", "当前汇总与目标等级", "本轮无评分规则变化")), "all three maturity documents must synchronize the selected split scoring, endpoint markers, animated tip and restrained statistic vibrancy contract")
    require(all(token in component for token in ("selectedScoreViewLevel", "setScoringHierarchy", "renderHierarchyStatistics", "categoryResults", "subCategoryResults", "capabilityResults", "focusResults")), "L0, L1 and L2 directory selections must render backend aggregates at the selected object grain before focus scoring")
    require("目标达成率" in component and "result.targetAchievementRate" in component and "距目标尚差" in component and "评分完成度" in component and "maturity-v13-achievement" in styles, "target achievement must use the backend rate while gap copy and scoring completion remain separate explanatory measures")
    require("maturity-v15-score-feedback" in styles and "grid-column: 2" in styles and "maturity-v12-score-tip" not in element_controls_block and "maturity-v9-score-slider-copy" not in element_controls_block, "dimension rows must keep rubric feedback inside the selected row without slider-tip overlays or duplicate level copy")
    require('<strong>${escapeHtml(level)}</strong></button>' in element_controls_block and '<span>${escapeHtml(rubric?.levelName' not in element_controls_block and "selectedRubric?.levelName || LEVEL_NAMES[selectedLevel]" in element_controls_block and "当前对象定义" in element_controls_block and all(token in styles for token in ("font-size: 17px", ".maturity-v15-score-feedback > span", "font-size: 13px")), "score cells must show only enlarged L1-L5 labels while the readable row-owned lane carries the object rubric level name and definition")
    require(all(token in frontend_spec for token in ("第十三轮统计口径、层级聚合与评分密度裁定", "目标达成率", "完成 / 适用", "L0 / L1 / L2")) and all(token in global_plan for token in ("FE-R95", "FE-R96", "FE-R97", "同粒度后端聚合")) and all(token in business_spec for token in ("0.1.24", "目录层级统计", "距目标尚差", "重复静态等级说明")), "all three maturity documents must synchronize the backend aggregate grain, target-achievement explanation and compact score-row contract")
    require(all(token in component for token in ("drawHierarchyRadar", "data-maturity-hierarchy-radar", "dimensionResults", "targetIndex", "总体目标（等轴）", "非逐维目标")), "L0, L1 and L2 statistics must render a same-grain four-dimension radar with an explicitly non-dimensional overall target reference")
    require(all(token in component for token in ("maturity-v16-hierarchy-strip", "maturity-v14-hierarchy-insight", "maturity-v14-hierarchy-visual", "maturity-v15-child-radar-panel", 'viewLevel === "L0" ? "下属能力域"', 'viewLevel === "L1" ? "归属能力"', 'const childRadarTitle = `${childLabel}雷达图`')) and all(token in styles for token in (".maturity-v16-hierarchy-strip", "grid-template-columns: minmax(250px, 0.84fr) minmax(260px, 1fr) minmax(300px, 1.16fr)", ".maturity-v14-hierarchy-insight > .maturity-v12-score-dimension-stats")) and "当前轮廓与目标参考" not in component and "直接下级能力雷达" not in component, "hierarchy statistics must place current summary and both renamed radars in one horizontal desktop region")
    require(all(token in component for token in ("drawChildRadar", "data-maturity-child-radar", "hierarchyChildren", "currentIndex", "targetIndex", "未评分留空")) and all(token in styles for token in (".maturity-v15-child-radar-panel", ".maturity-v15-radar-legend")), "L0, L1 and L2 statistics must render child current/target radars without inventing missing values")
    require("current_index is not None and target_index is not None" in maturity_py and "current_index is not None and target_index is not None and bool(target_reason)" not in maturity_py and 'message": "适用项必须填写目标等级；评估说明为可选。"' in maturity_py, "backend completion and score-import validation must treat the merged assessment note as optional")
    require(all(token in component for token in ("renderResultDimensionRadar", "drawResultDimensionRadar", "data-maturity-result-radar", "summary.dimensionResults", "总体目标指数", "不代表逐维目标")) and all(token in styles for token in (".maturity-v15-result-profile-grid", ".maturity-v15-result-dimension-radar", ".maturity-v15-result-dimension-layout")), "assessment results must add a backend-summary four-dimension radar next to coverage while preserving the all-L2 capability radar")
    require("maturity-v12-score-tip" not in element_controls_block and "maturity-v14-score-tip-feedback" not in styles and "maturity-v15-score-feedback" in element_controls_block and "maturity-v15-score-feedback" in styles, "score rubric feedback must remain permanently row-owned and must not return as hover, focus or transient cross-row overlays")
    require('@media (max-width: 860px)' in styles and '.app-shell.app-shell-integrated:has(#maturityShellHeaderActions)' in styles and 'grid-template-columns: var(--app-sidebar-width) minmax(0, 1fr);' in styles, "the maturity route must preserve the integrated two-column App Shell below the legacy 860px block-layout breakpoint")
    require(all(token in frontend_spec for token in ("第十四轮层级统计雷达与评分 Tip 行内化裁定", "总体目标参考", "不代表逐维目标", "四维极差", "1280ms")) and all(token in global_plan for token in ("FE-R98", "FE-R99", "FE-R100", "总体目标参考")) and all(token in business_spec for token in ("0.1.25", "总体目标参考", "行内反馈槽", "本轮无评分规则变化")), "all three maturity documents must synchronize the hierarchy radar, overall-target reference and row-contained score-tip contract")
    require(all(token in frontend_spec for token in ("第十五轮五档刻度矩阵、评估概览与双雷达裁定", "评估执行采用方案 1", "评估概览采用方案 2", "删除原“维度得分明细”", "直接下级对象雷达")) and all(token in global_plan for token in ("FE-R101", "FE-R102", "FE-R103", "FE-R104", "不得恢复为 `data-maturity-score-slider`")) and all(token in business_spec for token in ("0.1.26", "五档刻度矩阵", "删除“维度得分明细”", "直接下级雷达", "本轮无评分规则变化")), "all three maturity documents must synchronize the selected score matrix, collapsed overview scope and dual-radar contract")
    require(all(token in frontend_spec for token in ("第十六轮字体、可选说明、概览减法与层级横排裁定", "评估说明（可选）", "下属能力域雷达图", "归属能力雷达图", "归属关注点雷达图")) and all(token in global_plan for token in ("FE-R105", "FE-R106", "FE-R107", "FE-R108", "四维评分 + 目标等级")) and all(token in business_spec for token in ("0.1.27", "评估说明（可选）", "四维评分 + 目标等级", "本轮完成条件变化", "评分公式不变")), "all three maturity documents must synchronize the optional-note completion rule, typography cleanup, overview reduction and horizontal hierarchy strip")
    require(all(token in component for token in ('action === "next-score-item"', '[data-maturity-dimension-row="organization"]', '.maturity-v1-project-page', '.maturity-v6-project-sticky-header', "getBoundingClientRect", "scrollOwner.scrollTop", 'scrollIntoView({ block: "start" })', '[data-maturity-score-group="organization"] [role="radio"][tabindex="0"]', "requestAnimationFrame", "preventScroll: true")), "save-and-next must align the next item first organization row below the locked header and then move keyboard focus into that row")
    require("<span>当前关注点</span>" not in scoring_block and "focus?.description" in scoring_block and all(token in styles for token in (".maturity-v4-focus-context p", "overflow: visible", "-webkit-line-clamp: initial")), "the focus summary must remove its redundant eyebrow and expose the full backend definition")
    require(all(token in scoring_block for token in ("maturity-v18-focus-heading", "maturity-v4-focus-applicability", "focusTotalCount", "focusApplicableCount", "focusNotApplicableCount", "focusCompletedApplicableCount", "focusResolvedCount", "focusCompletedApplicableCount + focusNotApplicableCount", "<dt>完成</dt>", "<dt>适用性</dt>", '${focusResolvedCount}/${focusTotalCount}', '${focusApplicableCount}/${focusTotalCount}')) and "关注点适用" not in scoring_block, "the focus title must own the enlarged applicability control while completion and applicability retain separate total-item denominators")
    require("<details" not in score_overview_block and "maturity-v17-score-overview-heading" in score_overview_block and all(token in styles for token in (".maturity-v16-score-target > div", "align-items: baseline", "font-size: 18px", ".maturity-v16-target-settings select", "font-size: 16px")), "the score overview must stay open while target summary and target settings use prominent horizontal typography")
    require("评分标准`" not in element_controls_block and "selectedRubric?.levelName || LEVEL_NAMES[selectedLevel]" in element_controls_block and all(token in styles for token in (".maturity-v15-score-feedback > strong", "font-size: 14px", "line-height: 1.62")), "the score feedback lane must title itself with the selected level name instead of the generic scoring-standard label")
    require(all(token in l2_summary_block for token in ("completedItemCount", "applicableItemCount", "notApplicableItemCount", "maturity-v20-applicability-summary", "maturity-v20-completion-summary", "适用评估点 / 全部评估点", "已完成 / 适用评估点", '${applicable} / ${total || "—"}', '${completed} / ${applicable || "—"}')) and "当前 L2 · 下级汇总" not in l2_summary_block, "L2 summary must expose applicability as applicable/total and progress as completed/applicable from backend counts")
    require(all(token in review_block for token in ("检查对象", "data-maturity-review-dimension", "沿用自评结果", "返回评分", "renderReviewInspector(detail, item, focus)")) and "renderReviewQueueGroup" in review_tab_block and "renderScoreInspector" not in review_tab_block and "data-score-field" not in review_block and "data-score-text" not in review_block and all(token in styles for token in (".maturity-v17-review-inspector", ".maturity-v17-review-dimensions")), "score checking must use an independent read-only summary instead of nesting the editable scoring workbench")
    require('class="maturity-v4-radar-panel maturity-v20-radar-suite maturity-v21-radar-suite sapd-stat-vibrancy"' in component and "maturity-v4-radar-analysis sapd-stat-vibrancy" in component and all(token in styles for token in (".maturity-v4-radar-analysis", "border-radius: 14px", ".maturity-v4-radar-l1-stats > div", "max-height: none", "overflow: visible")), "layer statistics must expose complete shared vibrancy surfaces without internal vertical clipping")
    require(all(token in frontend_spec for token in ("第十七轮连续评分、完成语义、复核摘要与统计材质裁定", "评估完成 `completed / applicable`", "复核页不完整复制评估执行表单")) and all(token in global_plan for token in ("FE-R109", "FE-R110", "FE-R111", "FE-R112")) and all(token in business_spec for token in ("0.1.28", "评估完成 `5 / 6`", "复核页不复制一套可编辑评估执行表单", "本轮无评分规则变化")), "all three maturity documents must synchronize continuous focus, completion semantics, read-only review and unclipped vibrancy")
    require(all(token in styles for token in (".maturity-v18-focus-heading .maturity-v4-focus-applicability input", "width: 20px", "font-size: 13px", ".maturity-v3-l2-summary dl > .is-completion dd > span", "white-space: nowrap", ".maturity-v15-score-feedback", "width: min(100%, 760px)")), "focus applicability, L2 completion and rubric feedback must keep stable readable geometry")
    require(all(token in frontend_spec for token in ("第十八轮连续评分落点、双统计与文字几何裁定", "完成 `resolved / total`", "适用性 `applicable / total`")) and all(token in global_plan for token in ("FE-R113", "FE-R114", "FE-R115", "FE-R116")) and all(token in business_spec for token in ("0.1.29", "完成 `6 / 6`", "适用性 `5 / 6`", "本轮无评分规则变化")), "all three maturity documents must synchronize the deterministic next-row landing, dual focus denominators and stable text geometry")
    require(all(token in component for token in ("adjust-first-blocker", "adjust-review-item", "返回评分", "完成评估", "不阻塞完成评估", "complete-assessment")) and all(token not in review_tab_block for token in ("confirm-review-item", "确认全部待复核项", "评分完整，尚未确认", "已执行显式确认")) and "confirmReviewItem" not in component, "review must diagnose blockers, return every issue to scoring and keep only the meaningful project completion action")
    require(all(token in component for token in ("scheduleScoringLanding", "firstMissing", "missingDimension", ".maturity-v12-score-dimensions", ".maturity-v1-project-page", "dimensionOverflow", ".maturity-v16-target-level", "preventScroll: true")), "blocker adjustment must land on the exact score item in either a local or shared scoring scroll owner")
    require(all(token in l2_summary_block for token in ("const notApplicable = Number(result?.notApplicableItemCount || 0)", "const total = applicable + notApplicable", "maturity-v22-maturity-summary", "maturity-v19-dimension-summary", "maturity-v22-point-summary", "maturity-v20-applicability-summary", "maturity-v20-completion-summary", "评估点情况", "适用评估点 / 全部评估点", "已完成 / 适用评估点", "is-current", "is-target")) and l2_summary_block.index("is-current") < l2_summary_block.index("is-target") < l2_summary_block.index("maturity-v19-dimension-summary") < l2_summary_block.index("maturity-v22-point-summary"), "L2 summary must order current maturity, target maturity, dimension means and one grouped assessment-point summary")
    require(all(token in component for token in ("backendPriorityCounts", "detail?.result?.gapItems", "item.priority", "高", "中", "低")) and "priorityThreshold" not in component and "gapThreshold" not in component, "result priority statistics must count existing backend gap-item priority fields without frontend thresholds")
    require(results_tab_block.index("${renderResultSummary(detail)}") < results_tab_block.index("${renderCapabilityRadar(detail)}") and "maturity-v19-result-warning" not in results_tab_block and all(token in component for token in ("评估结果与统计口径", "maturity-v20-result-metrics", "适用评估点 / 全部评估点", "已完成 / 适用评估点")), "results must open with one source-backed result and scope strip and must remove the redundant trial warning")
    require(all(token in capability_radar_block for token in ("maturity-v21-radar-stack", "maturity-v25-radar-visual-column", "maturity-v21-dimension-radar-row", "maturity-v25-compact-dimension-radar", "maturity-v21-capability-radar-layout", "renderResultDimensionRadar(detail)", "renderRadarAnalysis(detail, groups)")) and capability_radar_block.index("maturity-v20-capability-radar") < capability_radar_block.index("maturity-v21-dimension-radar-row") < capability_radar_block.index("renderRadarAnalysis(detail, groups)") and all(token in styles for token in (".maturity-v21-radar-stack", ".maturity-v21-capability-radar-layout", ".maturity-v25-radar-visual-column", ".maturity-v25-compact-dimension-radar", ".maturity-v20-result-distributions")), "the left result column must stack the capability radar and compact four-dimension radar before the right-side layered analysis")
    require("groupBoundaries" not in component and "context.lineWidth = 3.4" not in component and 'context.fillStyle = `${groupColors[groupIndex % groupColors.length]}30`' in component and all(token in styles for token in ('.maturity-v21-capability-radar-layout .maturity-v4-radar-tgm-stats > section[data-radar-group="T"]', "rgba(47, 120, 196, 0.16)", "rgba(116, 103, 184, 0.16)", "rgba(79, 138, 114, 0.16)")), "T/G/M result sections must use clearly distinguishable low-saturation tonal regions without abrupt separator lines")
    require(all(token in styles for token in ("twenty-fifth acceptance: scoring-only scroll", "overflow-y: auto", ".maturity-v15-dimension-grid > header { position: sticky; top: 0; }", ".maturity-v23-score-context", "position: static", ".maturity-v15-score-overview-body { min-height: 0; overflow: hidden; }")), "desktop scoring must keep summary, focus, service tabs and overview stationary while only the dimension column scrolls")
    require(all(token in component for token in ("renderDimensionPriorityTop10", "priorityByCapability", "dimensionResults?.[key]", "priorityScore", "四维优先改进 Top 10", "后端维度聚合与总体优先级", "<th>优先级</th>")) and "priorityThreshold" not in component and "dimensionPriorityThreshold" not in component, "results must expose four dimension-sorted Top 10 views and the L2 backend priority column without inventing frontend thresholds")
    require(all(token in styles for token in (".maturity-v19-dimension-summary > div strong", "font-size: 24px", ".maturity-v3-l2-summary dl > .is-current dd > span", "color: #0878d9", ".maturity-v3-l2-summary dl > .is-target dd > span", "color: #a3681f", ".maturity-v5-focus-batch-state", "font-size: 12px", ".maturity-v15-score-feedback", "min-height: 52px")), "L2 metrics, downstream status text and compact rubric definitions must preserve the requested hierarchy and readable emphasis")
    require(all(token in frontend_spec for token in ("第十九轮复核闭环、结果首屏与评分锁定裁定", "全能力分组雷达优先")) and all(token in global_plan for token in ("FE-R117", "FE-R118", "FE-R119", "FE-R120", "FE-R121")) and all(token in business_spec for token in ("0.1.30", "适用评估点 / 全部评估点", "后端差距候选", "本轮无评分规则变化")), "the nineteenth-round baseline must remain documented after the twentieth-round correction")
    require(all(token in frontend_spec for token in ("第二十轮结果信息架构、共享滚动与检查语义裁定", "applicable / total", "completed / applicable", "四维优先改进 Top 10", "无需逐项确认")) and all(token in global_plan for token in ("FE-R122", "FE-R123", "FE-R124", "FE-R125", "FE-R126")) and all(token in business_spec for token in ("0.1.31", "完成评估", "共享项目滚动", "本轮无评分规则变化")), "all three maturity documents must synchronize result IA, review semantics, denominator ownership, backend-only priority and shared scoring scroll")
    require("成熟度差距" not in result_summary_block and "目标达成率" not in result_summary_block and "当前成熟度" not in result_summary_block and "目标指数" not in result_summary_block and "同粒度后端聚合" not in result_summary_block and "分层评价" not in result_summary_block and all(token in result_summary_block for token in ("目标成熟度", "maturity-v25-target-maturity", "targetLevel", "targetIndex", "适用性", "评估进度", "能力类别评分", "maturity-v27-category-score")), "the result lead strip must avoid duplicating current maturity and keep T/G/M code, score and target in one compact category-score group")
    require(all(token in maturity_py for token in ("target_below_current", "targetBelowCurrent", "minimumTargetLevel", "statisticsReady", "resultAvailability")) and all(token in component for token in ("scoreTargetConflict", "scoringNavigationBlocked", "targetConflict: true", "目标等级不能低于当前评分计算等级")), "backend target validation and frontend navigation must share one authoritative conflict contract")
    require(all(token in results_tab_block for token in ('!statisticsReadyForDisplay(detail)', "评分完整前不输出成熟度统计、雷达或优先级", "open-review-tab")) and all(token in component for token in ("function statisticsReadyForDisplay", 'summary.statisticsReady === true', '["completed", "reported", "archived"]', "summary.notScoredCount", "detail?.resultStale", "const blockingCount", "const canComplete")) and "summary.statisticsReady !== true" in component.split("async function completeAssessment", 1)[1].split("function scheduleScoringLanding", 1)[0], "only incomplete applicable scores or backend target conflicts may block project completion and result statistics")
    require(all(token in review_tab_block for token in ("targetConflicts", "incomplete", "notApplicable", "noEvidenceInformation", "reviewGroups", "按问题类型核对", "已完成项已隐藏")) and all(token in component for token in ("maturity-v23-review-group", 'data-maturity-review-group=', "renderReviewQueueGroup", "返回评分")), "score checking must group target conflicts, incomplete items, not-applicable checks and no-evidence information into collapsible sections")
    require(all(token in project_search_block for token in ("projectObjectSearchResults", "categoryCapabilityLevel(item)", 'type: "L2"', 'type: "FOCUS"', 'type: "SERVICE"', "focusServiceMappings", "scoreItems")) and "querySelector" not in project_search_block and all(token in component for token in ("data-maturity-project-search", "open-project-object-result", "搜索 L0 / L1 / L2 / 关注点 / 安全技术服务")), "project-local search must use template business objects instead of DOM text or cross-project inference")
    require("data-maturity-l2-applicability" in l2_summary_block and "适用评估点 / 全部评估点" in l2_summary_block and "maturity-v20-applicability-summary[data-maturity-l2-applicability]" in styles, "L2 scoring summary must visibly retain applicable/total beside completed/applicable")
    require(all(token in component for token in ("controlledDemoRevision", "storedProject.controlledDemoRevision", "locallyStored: false")) and all(token in maturity_py for token in ("target_conflict_count=3", "remaining_target_conflicts", "controlledDemoRevision")), "the named controlled demo must migrate stale browser-local seed data before enforcing the exact three-conflict contract")
    require(all(token in component for token in ("function renderFeedback", "maturity-v24-feedback", "toastRoute", "normalizedRoute", "dismiss-feedback")) and 'insertAdjacentHTML("beforeend"' not in component and all(token in styles for token in (".maturity-v24-feedback", "grid-template-columns: auto minmax(0, 1fr) auto")), "maturity feedback must stay inside the owning route and must not float over the global top-right shell")
    require("maturity-v22-hierarchy-target" in component and all(token in styles for token in (".maturity-v22-hierarchy-target", "rgba(164, 118, 48, 0.11)", "font-size: 18px")), "L0, L1 and L2 hierarchy statistics must visibly emphasize the backend target level")
    require(all(token in styles for token in (".maturity-v22-point-summary", ".maturity-v22-point-summary > div", "grid-template-columns: repeat(2, minmax(0, 1fr))", ".maturity-v19-dimension-summary")), "assessment-point status and dimension means must share the same grouped summary grammar")
    require(all(token in frontend_spec for token in ("第二十一轮正式统计门禁、纵向雷达与局部对象搜索裁定", "statisticsReady", "目标等级不得低于当前评分计算等级")) and all(token in global_plan for token in ("FE-R127", "FE-R128", "FE-R129", "FE-R130", "FE-R131")) and all(token in business_spec for token in ("0.1.32", "结果统计不可用", "L0 / L1 / L2 / 关注点 / 安全技术服务")), "all three maturity documents must synchronize the twenty-first-round business gate, vertical radar composition and scoped search contract")
    require(all(token in frontend_spec for token in ("第二十二轮反馈槽、受控 demo 冲突数与 L2 摘要顺序裁定", "controlledDemoRevision", "当前成熟度、目标成熟度、评估维度均值、评估点情况")) and all(token in global_plan for token in ("FE-R132", "FE-R133", "FE-R134", "FE-R135")) and all(token in business_spec for token in ("0.1.33", "固定生成 3 个目标等级冲突", "短时全局反馈进入顶部反馈槽")), "all three maturity documents must synchronize feedback ownership, exact demo conflict count, hierarchy target emphasis and L2 metric order")
    require(results_tab_block.index("${renderResultSummary(detail)}") < results_tab_block.index("${renderCapabilityRadar(detail)}") < results_tab_block.index('className: "maturity-v23-capability-heat"') < results_tab_block.index('className: "maturity-v23-overall-priority"') < results_tab_block.index("${renderDimensionPriorityTop10(detail)}") and all(token in component for token in ("renderCollapsibleResultSection", "maturity-v23-result-section", "按 T / G / M 展开", "data-radar-group")), "result analysis must order the grouped collapsible heat table, backend overall priority and four-dimension priority after the radar suite")
    require("maturity-v4-radar-axis-details" not in capability_radar_block and all(token in component for token in ("function renderCapabilityHeatTable(detail)", "capabilityRadarGroups(detail)", "maturity-v23-heat-group")), "L2 exact values must have one T/G/M-grouped heat-table owner instead of a duplicate radar details list")
    require(all(token in component for token in ("const directoryTree = model.root?.querySelector(\".maturity-v4-directory-tree\")", "directoryTop", "directoryLeft", "directoryTree.scrollTop = state.directoryTop")), "directory selection rerenders must preserve the explicit maturity directory scroll position")
    require(all(token in component for token in ("maturity-v23-score-context", "data-maturity-fixed-score-context", "syncFixedScoreContextPosition", "--maturity-v23-score-context-height")) and all(token in styles for token in (".maturity-v23-score-context > .maturity-v3-l2-summary {\n  height: auto;\n  min-height: 94px;", ".maturity-v4-score-workbench > .maturity-v23-score-context {\n    min-height: 0;\n    flex: 0 0 auto;", ".maturity-v23-score-context {\n    position: static;", "scrollbar-gutter: stable", ".maturity-v12-score-dimensions {\n    height: auto;", "overflow: visible;\n    overscroll-behavior: auto;", ".maturity-v12-score-side {\n    height: max-content;")), "the natural-height L2 context must precede the single scrolling score form whose overview remains sticky")
    require(all(token in scoring_block for token in ("directFocusAssessment", 'sourceMode === "DIRECT"', '${directFocusAssessment ? ""', "maturity-v4-focus-applicability")) and 'filter((item) => item.focusId === focusId);' in component and "关注点自身" in scoring_block, "a direct FOCUS assessment must use the title-owned applicability control and must not render a one-item pseudo service tab")
    require(all(token in maturity_py for token in ("invalid_na_reason_count", 'is_complete = True if not is_applicable', "scored_item_count == applicable_item_count", "target_below_current_count == 0")) and "and invalid_na_reason_count == 0" not in maturity_py and all(token in review_tab_block for token in ("不适用说明、评估说明和证据材料均为可选", "不阻塞完成评估")), "not-applicable reasons and evidence must remain informational while applicable completion and target-floor conflicts own the completion gate")
    require(all(token in frontend_spec for token in ("第二十三轮结果分组、评分上下文与检查门禁裁定", "成熟度热力表 → 总体优先级 → 维度优先级", "不适用与无证据不阻塞")) and all(token in global_plan for token in ("FE-R136", "FE-R137", "FE-R138", "FE-R139")) and all(token in business_spec for token in ("0.1.35", "按问题类型分组折叠", "不适用说明为可选")), "all three maturity documents must synchronize result section ownership, stable scoring context, directory position and the revised completion gate")
    require(all(token in project_list_block for token in ("项目进展", "renderTemplateManager()")) and all(token in template_manager_block for token in ("模板管理", "全部模板", "自定义模板", "导入任务", "trigger-global-template-import", "export-global-template", "use-library-template")) and "模板管理将在正式持久化阶段开放" not in component, "the maturity homepage must visibly own project progress and a standalone template import/export manager")
    require(all(token in component for token in ("templateLibraryRecords", "templateImportHistory", "importTemplateToLibrary", "sourceTemplateType", "templateLibraryId")) and all(token in maturity_py for token in ('template.get("type") not in {"base", "custom"}', '"type": "custom"', '"sourceTemplateId": source_template_id', '"sourceTemplateSnapshotId": source_snapshot_id')), "default and custom template exchange must preserve sources while importing only a custom copy")
    require(all(token in complete_assessment_block for token in ('calculateDetail(detail, { silent: true })', 'model.activeTab = "results"', "不适用与无证据项未作为阻断项")) and all(token in component for token in ("toastRoute", "normalizedRoute", "model.toastRoute !== nextRoute")), "completion must use project semantics and clear route-owned feedback when returning to the homepage")
    require(all(token in component for token in ("function renderLevelScore", 'label = "成熟度指数"', '${escapeHtml(label)} / 5.00')) and "目标指数" not in result_summary_block and all(token in styles for token in (".maturity-v22-maturity-summary .maturity-v24-level-score", ".maturity-v25-target-maturity > div")) and capability_radar_block.index("maturity-v20-capability-radar") < capability_radar_block.index("maturity-v21-dimension-radar-row"), "execution and result level/index readouts must keep distinct visual roles without redundant result suffix text")
    require(all(token in component for token in (">客户评估结果</button>", ">评分明细清单</button>")) and "客户结果</button>" not in component and "内部明细</button>" not in component and all(token in styles for token in (".maturity-v2-result-views button.is-active", "border-bottom: 2px solid transparent", "border-radius: 0", "background: transparent")), "result views must use the agreed customer/detail names and the shared underline-tab grammar")
    require(all(token in report_tab_block for token in ("管理层摘要", "关键发现", "管理建议", "下一步计划", 'data-format="markdown"', 'data-format="html"', "data-maturity-report-field", "srcdoc", "maturity-v27-report-formats", "两种格式均包含项目事实", "能力类别评分")) and report_tab_block.count('data-maturity-action="download-report"') == 2 and all(token in component for token in ('if (format === "markdown") downloadBlob', 'if (format === "html") downloadBlob')) and 'data-format="json"' not in report_tab_block and 'data-format="package"' not in report_tab_block and all(token in report_config for token in ("markdown:", "html:", "executive_summary", "key_findings", "next_steps", "能力类别评分")) and "json:" not in report_config, "report snapshot UI and configuration must expose the full assessment with editable narratives and two independent Markdown/HTML downloads")
    require("na_reason_missing" not in maturity_py and "summary.get(\"invalidNaReasonCount\") == 0" not in maturity_py and "summary.get(\"confirmedCount\") == summary.get(\"applicableItemCount\")" not in maturity_py, "optional not-applicable reasons and evidence must not re-enter completion through import or report gates")
    require(all(token in frontend_spec for token in ("第二十四轮首页、模板资产、结果层级与报告快照裁定", "项目进展", "Markdown 与自包含 HTML")) and all(token in global_plan for token in ("FE-R140", "FE-R141", "FE-R142", "FE-R143", "FE-R144", "FE-R145")) and all(token in business_spec for token in ("0.1.36", "始终创建新的 `CUSTOM` 副本", "汇报型报告快照")), "all three maturity documents must synchronize round 24 feedback, template, result and report contracts")
    require(all(token in frontend_spec for token in ("第二十五轮评分滚动、结果雷达与目标摘要裁定", "客户评估结果", "评分明细清单")) and all(token in global_plan for token in ("FE-R146", "FE-R147", "FE-R148", "FE-R149")) and all(token in business_spec for token in ("0.1.38", "只有组织与角色、制度与流程、平台与工具、数据与信息四维打分区域上下滚动", "目标成熟度")), "all three maturity documents must synchronize round 25 score-scroll ownership, nested radar layout, compact target summary and result tab names")
    require("function displayTemplateName(detail)" in component and 'detail?.project?.templateType === "base"' in component and component.count("SAPD标准能力成熟度模板") >= 1, "base projects must use the canonical current default-template display name without mutating project records")
    require("maturity-v26-home-grid" in project_list_block and "知识快照" not in overview_block and all(token in styles for token in ("grid-template-columns: minmax(0, 1.85fr) minmax(470px, 1fr)", "grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr)", "@media (max-width: 1680px)")), "the maturity homepage must use a safe wide two-column workspace and project overview must allocate project/progress at two-to-one without exposing the knowledge snapshot")
    require(all(token in styles for token in ("grid-template-rows: 18px minmax(0, 1fr)", ".maturity-v22-maturity-summary .maturity-v24-level-score > span > b", "font-size: 26px !important", "@container maturity-score-workbench (max-width: 760px)", ".maturity-v22-maturity-summary > div + div")), "all four L2 summary headings must share one title rail, level/index values must use the same main number size, and narrow workbenches must stack groups without overlap")
    require('const currentLevelName = LEVEL_NAMES[currentLevel] || ""' in result_summary_block and 'height: 390, maxRadius: 150' in component and 'cssWidth * 0.36, cssHeight * 0.39' in component and all(token in styles for token in ("grid-template-rows: auto minmax(440px, 1fr)", ".maturity-v25-compact-dimension-radar aside dl", "grid-template-columns: repeat(2, minmax(0, 1fr))")), "result title and the stretched radar visual column must use the named level, a genuinely enlarged four-dimension radar and compact value cards")
    require(all(token in frontend_spec for token in ("第二十六轮评分滚动、摘要基线与双栏首页裁定", "评分表单是唯一纵向滚动所有者", "SAPD标准能力成熟度模板")) and all(token in global_plan for token in ("FE-R150", "FE-R151", "FE-R152", "FE-R153", "FE-R154", "FE-R155")) and all(token in business_spec for token in ("0.1.39", "完整评分表单是唯一纵向滚动区域", "项目情况 `2/3`")), "all three maturity documents must synchronize round 26 scroll ownership, summary alignment, radar scale, named result and workspace proportions")
    require(all(token in frontend_spec for token in ("第二十七轮外层滚动、摘要排版、能力类别评分与双格式报告裁定", "项目页外层容器是唯一纵向滚动所有者", "能力类别评分")) and all(token in global_plan for token in ("FE-R156", "FE-R157", "FE-R158", "FE-R159", "FE-R160")) and all(token in business_spec for token in ("0.1.40", "项目页外层容器是唯一纵向滚动所有者", "Markdown 与 HTML 两个独立导出按钮")), "all three maturity documents must synchronize round 27 outer scrolling, aligned metrics, dense overview, category scores and dual report exports")
    require(all(token in styles for token in ("twenty-eighth acceptance: independent current/target maturity cells", "grid-template-columns: minmax(220px, 1.02fr) minmax(280px, 1fr)", "grid-template-rows: minmax(76px, 1fr)", ".maturity-v22-maturity-summary dd > .maturity-v24-level-score", "@container maturity-score-workbench (max-width: 1130px)")), "current and target maturity must own full-height cells with enough width and an explicit responsive fallback")
    require(all(token in frontend_spec for token in ("第二十八轮当前与目标成熟度独立单元裁定", "不得跨过中间分隔线")) and all(token in global_plan for token in ("FE-R161", "独立内容边界")) and all(token in business_spec for token in ("0.1.41", "本轮无评分规则变化")), "all three maturity documents must synchronize the round 28 current/target cell geometry without changing scoring rules")
    require(all(token in styles for token in ("twenty-ninth acceptance: complete L2 dimension labels and aligned values", ".maturity-v19-dimension-summary > div > span {\n  overflow: visible;", "text-overflow: clip", "grid-template-rows: 18px 28px", "font-variant-numeric: tabular-nums", "@container maturity-score-workbench (max-width: 480px)")), "L2 dimension means must keep all four full business labels and align their tabular values on one value rail without text ellipsis")
    require(all(token in frontend_spec for token in ("第二十九轮 L2 四维均值完整标签与数值基线裁定", "组织与角色", "不得把标签压成")) and all(token in global_plan for token in ("FE-R162", "完整业务标签")) and all(token in business_spec for token in ("0.1.42", "四维均值", "本轮无评分规则变化")), "all three maturity documents must synchronize the round 29 L2 dimension-label and value-baseline contract")
    require(all(token in styles for token in ("thirtieth acceptance: keep L2 dimension values on one row", "grid-template-columns: minmax(260px, 0.85fr) minmax(300px, 1.4fr) minmax(220px, 0.85fr)", "@container maturity-score-workbench (max-width: 480px)", "grid-template-columns: repeat(4, minmax(0, 1fr))")), "wide and medium L2 workbenches must reserve a four-column dimension rail and defer the two-row fallback to true narrow widths")
    require(all(token in frontend_spec for token in ("第三十轮 L2 四维均值单行与摘要宽度裁定", "480px")) and all(token in global_plan for token in ("FE-R163", "同一数值行")) and all(token in business_spec for token in ("0.1.43", "同一数值行", "本轮无评分规则变化")), "all three maturity documents must synchronize the round 30 single-row L2 dimension layout contract")
    require(all(token in styles for token in ("thirty-first acceptance: narrow point status and align each L2 readout group", "--maturity-l2-readout-size: 28px", "minmax(210px, 0.65fr)", ".maturity-v22-maturity-summary > div {\n  justify-items: stretch;\n  text-align: left;", ".maturity-v22-maturity-summary dt {\n  width: 100%;\n  justify-content: flex-start;\n  text-align: left;", ".maturity-v22-maturity-summary dd {\n  width: 100%;\n  justify-content: center;\n  text-align: center;", ".maturity-v22-point-summary > div {\n  width: 100%;\n  display: grid;", "align-self: center")) and "maturity-assessment-v2.1-project-unlock-progress-20260717-40" in (ROOT / "frontend" / "capability-browser" / "index.html").read_text(encoding="utf-8"), "current and target maturity titles must align left while their readouts stay centered, share the 28px maturity/dimension token and allocate less width to point status")
    require("scoring overview: pin below the project header without the static L2 summary offset" in styles and ".maturity-v12-score-side {\n    top: 108px;\n  }" in styles and "maturity-assessment-v2.1-project-unlock-progress-20260717-40" in (ROOT / "frontend" / "capability-browser" / "index.html").read_text(encoding="utf-8"), "the scoring overview must stay pinned below the project header without adding the static L2 summary height")
    require(all(token in overview_block for token in ("总体完成", "总计 ${progress.capabilityTotalCount} · 适用 ${progress.capabilityCount}", "总计 ${progress.focusTotalCount} · 适用 ${progress.focusCount}", "总计 ${progress.itemTotalCount} · 适用 ${progress.applicableItemCount}", "修改评估分数", "visibleProjectHistory", "每页 3 条", "renderUnlockConfirmation")) and "maturity-v10-project-identity" not in overview_block and all(token in component for token in ("LOCKED_ASSESSMENT_STATUSES", "unlockAssessmentForEditing", 'detail.project.status = "score_review"', 'detail.project.readOnly = true', "ASSESSMENT_UNLOCKED", "ASSESSMENT_COMPLETED", 'detail.project.changeHistory = list(detail.project.changeHistory);', 'action === "step-project-history"')) and all(token in project_search_block for token in ("page-search-control", "page-search-input-shell", "page-search-match-status", "step-project-search")) and all(token in styles for token in ("compact equal-height cards, paged history and capability-mapping search grammar", ".maturity-v32-project-history > footer", "width: var(--page-local-search-width", ".maturity-v32-unlock-modal", ".maturity-v21-project-search.page-search-control")) and '"readOnly": status in {"completed", "reported", "archived"}' in maturity_py and "maturity-assessment-v2.1-project-unlock-progress-20260717-33" in (ROOT / "frontend" / "capability-browser" / "index.html").read_text(encoding="utf-8"), "completed assessments must expose compact equal-height cards, unbounded paged history, confirmed score unlocking and the capability-mapping local-search grammar")
    require(all(token in frontend_spec for token in ("第三十二轮项目概览、完成后解锁与局部搜索裁定", "修改评估分数", "最近修改记录")) and all(token in global_plan for token in ("FE-R165", "FE-R166", "FE-R167", "FE-R168")), "the frontend contracts must synchronize equal-height overview cards, layered progress, confirmed unlocking, history and shared local search")
    require(all(token in frontend_spec for token in ("第三十一轮 L2 摘要组内居中与评估点收窄裁定", "每个子格水平居中")) and all(token in global_plan for token in ("FE-R164", "评估点情况")) and all(token in business_spec for token in ("0.1.44", "共享 `28px` 主读数 token", "本轮无评分规则变化")), "all three maturity documents must synchronize the round 31 centered-readout and point-width contract")

    print(json.dumps({
        "result": "pass",
        "checks": 225,
        "baseStats": base["stats"],
        "fourDimensionIndex": result["summary"]["currentIndex"],
        "targetAchievementRate": result["summary"]["targetAchievementRate"],
        "algorithmVersion": result["calculationRun"]["algorithmVersion"],
        "scoreExchangeStatus": score_import["batch"]["status"],
        "reportStatus": report["status"],
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
