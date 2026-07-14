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
    require(base["stats"] == expected_stats, f"unexpected V2.1 stats: {base['stats']}")
    require(validate_maturity_template(base)["valid"], "V2.1 fixed template must validate")
    require(all(len(item.get("rubricEntries", [])) == 20 for item in base["scoreItems"]), "every score item must expose four dimensions by five maturity levels")
    require(all("scopeCodes" not in detail["project"] for detail in workspace["projectDetails"].values()), "projects must not carry project scope selections")
    require(all(detail["project"].get("assessmentObjectType") == "ENTERPRISE_ORGANIZATION" for detail in workspace["projectDetails"].values()), "assessment object must be the enterprise organization")

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
    require(result["calculationRun"]["algorithmVersion"] == "sapd-maturity-v2.1.0", "calculation run must freeze V2.1 algorithm version")
    with_evidence = calculate_maturity_assessment({"project": project, "template": template, "scoreEntries": [scored_entry("score-1", evidence="E5")]})
    require(with_evidence["summary"]["currentIndex"] == result["summary"]["currentIndex"], "evidence must not change the default maturity score")
    no_reason = copy.deepcopy(entry)
    no_reason["targetReason"] = ""
    require(calculate_maturity_assessment({"project": project, "template": template, "scoreEntries": [no_reason]})["summary"]["completionRate"] == 0, "target reason must remain required")

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

    score_export = export_maturity_score_exchange({"project": project, "template": template, "scoreEntries": [entry]})
    require(score_export["ok"] and score_export["package"]["schemaVersion"] == "maturity-score-exchange-v2.1", "score exchange export must identify V2.1")
    score_import = import_maturity_score_exchange({"project": project, "template": template, "scoreEntries": [], "exchange": score_export["package"]})
    require(score_import["ok"] and score_import["batch"]["status"] == "success" and len(score_import["scoreEntries"]) == 1, "valid score exchange must import")
    changed_structure = copy.deepcopy(score_export["package"])
    changed_structure["assessmentItems"][0]["focusName"] = "非法修改结构"
    rejected = import_maturity_score_exchange({"project": project, "template": template, "scoreEntries": [], "exchange": changed_structure})
    require(not rejected["ok"] and rejected["dataState"] == "invalid_structure", "score import must reject structural changes")

    template_export = export_maturity_template_exchange({"template": template})
    require(template_export["ok"] and template_export["package"]["schemaVersion"] == "maturity-template-exchange-v2.1", "custom template structure must export with V2.1 schema")
    template_import = import_maturity_template_exchange({"exchange": template_export["package"]})
    require(template_import["ok"] and template_import["template"]["id"] == template["id"], "valid custom template structure must re-import")

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
    report = create_maturity_report_snapshot({"project": completed["project"], "template": completed["template"], "scoreEntries": completed["scoreEntries"]})
    require(report["formal"] and report["json"]["schemaVersion"] == "maturity-demo-package-v2.1", "complete reviewed V2.1 project must generate a formal V2.1 report snapshot")
    require("目标达成率" in report["markdown"] and "## L2 安全能力结果" in report["markdown"], "customer report must include target achievement and L2 results")

    component = (ROOT / "frontend" / "capability-browser" / "components" / "MaturityAssessmentWorkbench.js").read_text(encoding="utf-8")
    styles = (ROOT / "frontend" / "capability-browser" / "maturity-assessment-workbench.css").read_text(encoding="utf-8")
    app_shell = (ROOT / "frontend" / "capability-browser" / "components" / "AppShell.js").read_text(encoding="utf-8")
    app_js = (ROOT / "frontend" / "capability-browser" / "app.js").read_text(encoding="utf-8")
    maturity_py = (ROOT / "src" / "sapd_wiki" / "maturity.py").read_text(encoding="utf-8")
    data_client = (ROOT / "frontend" / "capability-browser" / "dataClient.js").read_text(encoding="utf-8")
    frontend_spec = (ROOT / "frontend" / "design-handoff" / "implementation-specs" / "maturity-assessment-v2-1-complete-frontend-design-2026-07-12.md").read_text(encoding="utf-8")
    global_plan = (ROOT / "frontend" / "design-handoff" / "implementation-specs" / "frontend-global-optimization-plan-2026-07-11.md").read_text(encoding="utf-8")
    business_spec = (ROOT.parent.parent / "04_workspace" / "research" / "知识库工程" / "SAPD maturity assesment" / "SAPD_成熟度评估业务设计_V2.1_20260712.md").read_text(encoding="utf-8")
    scoring_block = component.split("function renderScoringTab(detail)", 1)[1].split("function renderScoreRow", 1)[0]
    batch_block = component.split("function renderFocusBatchControls", 1)[1].split("function renderScoreInspector", 1)[0]
    inspector_block = component.split("function renderScoreInspector", 1)[1].split("function rubricRows", 1)[0]
    rubric_block = component.split("function renderRubric", 1)[1].split("function renderElementControls", 1)[0]
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
    require("maturity-v3-level-buttons" in component and "set-element-level" in component and "data-level" in component, "all four dimension scores must use independent 1-5 buttons")
    require("is-not-applicable" in component and "不适用原因" in component, "not-applicable points must disable scoring and target inputs while keeping a reason field")
    require("set-focus-batch-level" in batch_block and "统一设置关注点初始等级" in batch_block and "DIMENSIONS.reduce" in component and "作为下级评估点的四维初始等级" in component, "focus initialization must select one level and propagate it to the four dimensions of all child services")
    require("hasAnyScore" in batch_block and "下级已有评分" in batch_block and "allowed: false" in batch_block, "focus initialization must lock after any child dimension has a score")
    require('entry.lastUpdateScope = "FOCUS_BATCH"' in component and 'entry.lastUpdateScope = "ITEM"' in component, "focus initialization and later item overrides must remain distinguishable")
    require("focus?.description" in scoring_block and "maturity-v5-focus-stats" in scoring_block and "focusApplicableCount" in scoring_block and "focusNotApplicableCount" in scoring_block and "currentIndex" not in scoring_block and "targetLevel" not in scoring_block, "focus execution header must show definition, applicability counts and completion without feeding child aggregate scores back into the scoring header")
    require("capabilityResults" in component and "renderL2Summary" in component, "L2 result summary must continue to use backend aggregate results")
    require("projectTop" in component and 'querySelector(".maturity-v1-project-page")' in component and "preventScroll: true" in component and "requestAnimationFrame" in component, "score updates must re-query the live project scroll owner and restore position across rerenders")
    require(all(token in component for token in ("maturity-v4-score-state", 'label: "已完成"', 'label: "进行中"', 'label: "未开始"')) and all(token in styles for token in (".maturity-v4-score-state.is-complete", ".maturity-v4-score-state.is-in-progress", ".maturity-v4-score-state.is-not-started")), "every directory node must expose distinct complete, in-progress and not-started statuses")
    require("iconOnly" in component and "is-icon-only" in component and "title=\"${escapeHtml(accessibleLabel)}\"" in component and ".maturity-v4-score-state.is-icon-only" in styles and "display: none" in styles, "directory status tags must be visual-only while retaining accessible labels")
    require(".maturity-v4-service-tabs.maintenance-section-tabs" in styles and "--maturity-service-tab-columns" in scoring_block and "grid-template-columns: repeat(var(--maturity-service-tab-columns" in styles and "white-space: normal" in styles and "@container maturity-score-workbench" in styles and "title=\"${escapeHtml(`${state.label} · ${itemLabel}`)}\"" in scoring_block, "service tabs must show full labels in a responsive integrated tab grid")
    require("maturity-v5-service-tab-item" in scoring_block and "maturity-v5-service-tab-applicability" in scoring_block and "padding: 0" in styles and "min-width: 17px" in styles, "service status, full label and compact applicability checkbox must remain one coherent tab item")
    require("通用等级定义" not in rubric_block and "maturity-v6-score-definition" in rubric_block and "data-rubric-level" in rubric_block and 'if (!selected) return ""' in rubric_block and "maturity-v3-selected-rubric" not in component, "selected level definition must render inside the selected score cell with no separate definition region")
    require("maturity-v1-demo-notice" not in component and "受控 demo" not in component and "演示项目" not in app_shell and "演示项目" not in app_js, "customer-facing maturity UI must not expose demo banners or demo project labels")
    require("lastSavedAt" in component and "localSaveState" in component and "result: detail.result" in component, "browser-local score persistence must include save state and the matching aggregate result")
    require("保存并转到下一项" in component and "保存并刷新试算" not in component, "inline scoring must use autosave semantics instead of implying a single-row authoritative calculation")
    require("maturity-v4-score-header-actions" not in inspector_block and 'footer class="maturity-v3-score-footer"' in inspector_block and 'data-maturity-action="next-score-item"' in inspector_block and "不适用项不会进入评分、聚合或完成率分母。" in inspector_block, "the primary save-and-next action and exclusion rule must live together in the score footer")
    require("data-focus-applicability-toggle" in scoring_block and "data-focus-na-reason" in scoring_block and "从评分、聚合和完成率分母中剔除" in component, "focus and service applicability controls must expose the exclusion denominator contract")
    require(all(token in component for token in ("capabilityRadarGroups", "topCategoryId", "全能力分组雷达", 'data-maturity-radar-contract="l2-capability-by-top-category"', "不按 0 分计算", "固定 1—5 量尺", "RADAR_SHORT_LABELS", "renderRadarAnalysis", "subCategoryResults", "低于目标等级")) and all(token in styles for token in ("maturity-v4-radar-layout", "maturity-v4-radar-analysis", "grid-template-columns: minmax(560px, 1.45fr) minmax(330px, 0.75fr)")) and "data-maturity-result-capability" not in component, "results must show every backend L2 capability on a Chinese-short-label fixed-scale radar with adjacent L0/L1/L2 backend statistics")
    require("maturity-v6-project-sticky-header" in component and '.maturity-v6-project-sticky-header' in styles and "position: sticky" in styles and "height: 52px" in styles, "project identity and all six project tabs must share one locked Apple Shell header region")
    require(component.index('class="maturity-v5-project-context"') < component.index('class="maturity-v1-tabs"') and 'aria-label="当前项目与项目步骤"' in component, "the locked project region must contain the project context before the six-step navigation")
    require("renderAssessmentCoverage" in component and "maturity-v4-coverage-panel" in component and "完成率只使用适用评估点作为分母" in component, "result statistics must separate coverage, exclusions and the applicable denominator")
    require("minmax(300px, 1fr)" in styles and "maturity-v6-score-cell-expand" in styles and "maturity-v6-score-definition-in" in styles and "prefers-reduced-motion: reduce" in styles, "selected score cell must expand by an order of magnitude and reveal its own definition with reduced-motion support")
    require("has-active is-level-" in component and "maturity-v6-score-number" in component and "definitionInside" not in component, "every dimension must encode the active score track and keep number plus definition inside the selected button")
    require("人工目标" not in component and component.count("目标等级") >= 6, "all maturity user-facing target labels must use the unified target-level wording")
    require("grid-template-columns: minmax(78px, 90px) minmax(500px, 1fr)" in styles and "overflow-x: auto" in styles and "workbenchOverflow" not in component, "the expanding four-dimension picker must fit desktop and use only local overflow at narrow widths")
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

    print(json.dumps({
        "result": "pass",
        "checks": 109,
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
