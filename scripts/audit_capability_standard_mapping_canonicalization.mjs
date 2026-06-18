#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import vm from "node:vm";

const PROJECT_ROOT = process.cwd();
const FRONTEND_ROOT = join(PROJECT_ROOT, "frontend/capability-browser");
const DATA_ROOT = join(FRONTEND_ROOT, "public/data");
const REPORT_ROOT = join(PROJECT_ROOT, "data/exports/worker-verify");
const REPORT_JSON = join(REPORT_ROOT, "capability-standard-mapping-canonicalization-audit.json");
const REPORT_MD = join(REPORT_ROOT, "capability-standard-mapping-canonicalization-audit.md");

const CHECK_OBJECTS = ["T-PD.PP-01", "T-AS.AD-01", "G-SP"];
const PLACEHOLDER_VALUES = new Set(["", "/", "n/a", "na", "none", "null", "待补充", "暂无", "未编号", "待确认"]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function text(value) {
  return value == null ? "" : String(value);
}

function normalize(value) {
  return text(value).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function canonicalKey(value) {
  return normalize(value).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
}

function isPlaceholder(value) {
  return PLACEHOLDER_VALUES.has(normalize(value).toLowerCase());
}

function canonicalStandardKey(item = {}) {
  const code = normalize(item.frameworkCode || item.code);
  if (code) return `code:${canonicalKey(code)}`;
  const title = normalize(item.frameworkTitle || item.title || item.name);
  if (title) return `title:${canonicalKey(title)}`;
  return `id:${canonicalKey(item.id)}`;
}

function controlCode(row = {}) {
  const mlpsRequirement = normalize(row["等保三级控制要求"]);
  const mlpsMatch = mlpsRequirement.match(/^(\d+(?:\.\d+)+)/);
  if (mlpsMatch) return mlpsMatch[1];

  const nistCsfDescription = normalize(row["分类标识符说明"]);
  const nistCsfMatch = nistCsfDescription.match(/^([A-Z]{2}\.[A-Z]{2}-\d+)/);
  if (nistCsfMatch) return nistCsfMatch[1];

  return normalize(
    row["控制编号"] ||
      row["保护措施编号"] ||
      row["SCF编号"] ||
      row["Safeguard ID"] ||
      row["安全策略编号"] ||
      row["等级编号"] ||
      row["等保控制项"] ||
      row.originalControlId ||
      row.original_control_id ||
      row.controlId ||
      row.code ||
      "",
  );
}

function controlTitle(row = {}) {
  return normalize(row["控制名称"] || row["名称"] || row["SCF控制项"] || row["安全控制项名称"] || row["保障措施描述"] || row.title || row.name || "");
}

function canonicalControlKey(control = {}) {
  return `${canonicalKey(control.frameworkCode || control.frameworkTitle)}:${normalize(control.originalControlId || control.code || control.title).toLowerCase().replace(/\s+/g, "")}`;
}

function displayableControl(control = {}) {
  return !isPlaceholder(control.originalControlId || control.code) && !isPlaceholder(control.title || control.name);
}

function resolveDataPath(value) {
  const raw = normalize(value);
  if (!raw) return null;
  if (raw.startsWith("./public/data/")) return join(DATA_ROOT, raw.slice("./public/data/".length));
  if (raw.startsWith("public/data/")) return join(DATA_ROOT, raw.slice("public/data/".length));
  if (raw.startsWith("/")) return raw;
  return join(DATA_ROOT, raw);
}

function hydrateStandards(index) {
  const loadedFrameworks = {};
  const frameworkRows = [];
  const placeholderRows = [];
  const controlKeys = new Set();
  const pathIssues = [];

  for (const framework of list(index.frameworks)) {
    const hydrated = { ...framework };
    const frameworkCode = normalize(framework.frameworkCode || framework.code || framework.id);
    const loadRows = (target, tabId = "rows") => {
      const dataPath = resolveDataPath(target?.dataPath);
      if (!dataPath) {
        pathIssues.push({ framework: framework.id, tab: tabId, issue: "missing_data_path" });
        return [];
      }
      let rows = [];
      try {
        const payload = readJson(dataPath);
        rows = list(payload.rows);
      } catch (error) {
        pathIssues.push({ framework: framework.id, tab: tabId, issue: "read_failed", path: dataPath, error: String(error.message || error) });
      }
      for (const row of rows) {
        const code = controlCode(row);
        if (isPlaceholder(code)) {
          placeholderRows.push({ frameworkId: framework.id, frameworkCode, frameworkTitle: framework.title, tabId, rawControlCode: code || "待补充" });
          continue;
        }
        controlKeys.add(`${frameworkCode}:${code}`);
      }
      frameworkRows.push({ frameworkId: framework.id, frameworkCode, frameworkTitle: framework.title, tabId, rowCount: rows.length });
      return rows;
    };

    if (list(framework.tabs).length) {
      hydrated.tabs = list(framework.tabs).map((tab) => ({ ...tab, rows: loadRows(tab, tab.id || "tab") }));
    } else {
      hydrated.rows = loadRows(framework);
    }
    loadedFrameworks[framework.id] = hydrated;
  }

  return { ...index, loadedFrameworks, audit: { frameworkRows, placeholderRows, controlKeys, pathIssues } };
}

function loadViewModels() {
  const context = { window: {}, console };
  vm.createContext(context);
  vm.runInContext(readFileSync(join(FRONTEND_ROOT, "viewModels.js"), "utf8"), context, { filename: "viewModels.js" });
  return context.window.sapdViewModels;
}

function workbenchObjectsById(workbench) {
  const byId = {};
  const byCode = {};
  for (const group of Object.values(workbench.objects || {})) {
    if (!group || typeof group !== "object") continue;
    for (const item of Object.values(group)) {
      byId[item.id] = item;
      if (item.code) byCode[item.code] = item;
    }
  }
  return { byId, byCode };
}

function duplicateGroups(items, keyFn) {
  const groups = new Map();
  for (const item of list(items)) {
    const key = keyFn(item);
    if (!key) continue;
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

function standardRowIssues(row) {
  const standards = list(row.standards);
  const controls = list(row.controls);
  const duplicateStandards = duplicateGroups(standards, canonicalStandardKey);
  const duplicateControls = duplicateGroups(controls.filter(displayableControl), canonicalControlKey);
  const placeholders = controls.filter((control) => !displayableControl(control));
  return { duplicateStandards, duplicateControls, placeholders };
}

function buildWorkbenchDictionaryChecks(workbench, standards) {
  const standardCodes = new Set(list(standards.frameworks).map((framework) => normalize(framework.frameworkCode || framework.code)));
  const controlKeys = standards.audit.controlKeys;
  const frameworks = Object.values(workbench.objects?.standard_framework || {});
  const controls = Object.values(workbench.objects?.standard_control || {});
  const standardAliasCandidates = frameworks
    .map((framework) => {
      const canonical = list(standards.frameworks).find((item) => normalize(item.frameworkCode || item.code) === normalize(framework.code));
      if (!canonical || normalize(canonical.title) === normalize(framework.title)) return null;
      return {
        rawStandardName: framework.title,
        rawStandardCode: framework.code,
        canonicalCandidate: canonical.title,
        canonicalStandardId: canonical.id,
        evidence: "capability-workbench standard_framework title differs from standards-data canonical title",
        status: "display_uses_current_standards_dictionary; canonical_name_requires_review",
      };
    })
    .filter(Boolean);
  const unmatchedFrameworks = frameworks
    .filter((framework) => !standardCodes.has(normalize(framework.code)))
    .map((framework) => ({ rawStandardName: framework.title, rawStandardCode: framework.code, reason: "standard framework code not found in standards dictionary" }));
  const unmatchedControls = controls
    .filter((control) => !controlKeys.has(`${normalize(control.frameworkCode)}:${normalize(control.originalControlId)}`))
    .map((control) => ({
      rawStandardName: control.frameworkTitle,
      rawControlCode: control.originalControlId,
      reason: "standard control code not found in standards dictionary",
    }));
  return { standardAliasCandidates, unmatchedFrameworks, unmatchedControls };
}

function main() {
  const capabilityTree = readJson(join(DATA_ROOT, "capability-tree.json"));
  const capabilityWorkbench = readJson(join(DATA_ROOT, "capability-workbench.json"));
  const standardsIndex = readJson(join(DATA_ROOT, "standards-data.json"));
  const standards = hydrateStandards(standardsIndex);
  const viewModels = loadViewModels();
  const { byCode } = workbenchObjectsById(capabilityWorkbench);
  const dictionaryChecks = buildWorkbenchDictionaryChecks(capabilityWorkbench, standards);

  const objectChecks = [];
  const duplicateStandardDisplayGroups = [];
  const duplicateCanonicalControls = [];
  const placeholderControlItems = [];

  for (const objectCode of CHECK_OBJECTS) {
    const selected = byCode[objectCode];
    if (!selected) {
      objectChecks.push({ objectCode, status: "not_found" });
      continue;
    }
    const model = viewModels.buildCapabilityWorkspaceViewModel({
      capabilityWorkbench,
      capabilityTree,
      capabilityProjection: null,
      management: {},
      standards,
      selectedCapabilityId: selected.id,
      search: "",
      relationshipFilters: {},
    });
    const rows = list(model.standardMappingRows);
    for (const row of rows) {
      const issues = standardRowIssues(row);
      for (const [canonicalKey, group] of issues.duplicateStandards) {
        duplicateStandardDisplayGroups.push({
          selectedObjectId: objectCode,
          focusCode: row.focus?.code || "",
          displayNames: group.map((standard) => standard.title || standard.name || standard.code),
          possibleCanonicalStandardId: canonicalKey,
          possibleCanonicalStandardName: group[0]?.title || group[0]?.name || "",
          reason: "same canonical framework appears more than once in one mapping row",
        });
      }
      for (const [canonicalKey, group] of issues.duplicateControls) {
        duplicateCanonicalControls.push({
          selectedObjectId: objectCode,
          focusCode: row.focus?.code || "",
          canonicalControlCode: canonicalKey,
          occurrences: group.length,
          rawRows: group.map((control) => ({ frameworkCode: control.frameworkCode, originalControlId: control.originalControlId || control.code, title: control.title })),
          displayAction: "dedupe",
        });
      }
      for (const control of issues.placeholders) {
        placeholderControlItems.push({
          selectedObjectId: objectCode,
          focusCode: row.focus?.code || "",
          rawStandardName: control.frameworkTitle || control.frameworkCode || "",
          rawControlCode: control.originalControlId || control.code || "待补充",
          action: "exclude_from_official_display",
        });
      }
    }
    const localStandards = list(model.localRelationMap?.standards?.frameworks);
    const localControls = list(model.localRelationMap?.standards?.controls);
    objectChecks.push({
      objectCode,
      objectId: selected.id,
      selectedType: selected.type,
      standardMappingRows: rows.length,
      localStandardCount: localStandards.length,
      localControlCount: localControls.length,
      localStandardNames: localStandards.map((standard) => standard.title || standard.name || standard.code),
      localDuplicateStandardCount: duplicateGroups(localStandards, canonicalStandardKey).length,
      localDuplicateControlCount: duplicateGroups(localControls.filter(displayableControl), canonicalControlKey).length,
      localPlaceholderControlCount: localControls.filter((control) => !displayableControl(control)).length,
    });
  }

  const report = {
    auditStatus:
      duplicateStandardDisplayGroups.length ||
      duplicateCanonicalControls.length ||
      placeholderControlItems.length ||
      dictionaryChecks.unmatchedFrameworks.length ||
      dictionaryChecks.unmatchedControls.length ||
      standards.audit.pathIssues.length
        ? "fail"
        : "pass",
    generatedAt: new Date().toISOString(),
    scope: "P0 Capability Standard Mapping Canonicalization 1.0",
    sourcePolicy: {
      standardsDictionaryReadonly: true,
      modifiedStandardsDictionary: false,
      modifiedCapabilityWorkbench: false,
      officialDisplayRequiresDictionaryMatch: true,
      lifecycleMeasuresReclassified: true,
      lifecycleMeasures: ["应用程序威胁建模", "制品安全加固", "IaC代码安全测试", "数据销毁"],
      lifecycleMeasuresOfficiallyIncludedInMaintenancePackage: true,
    },
    mappingSource: {
      capabilityWorkbench: "frontend/capability-browser/public/data/capability-workbench.json",
      standardsDictionary: "frontend/capability-browser/public/data/standards-data.json + standards split packages",
      usesRawStandardNameBeforeCanonicalization: dictionaryChecks.standardAliasCandidates.length > 0,
      canonicalStandardKey: "frameworkCode/code from standards-data; title/id are display fallback only",
      canonicalControlKey: "frameworkCode + originalControlId/control code",
    },
    summary: {
      checkedObjects: objectChecks.length,
      duplicateStandardDisplayGroupCount: duplicateStandardDisplayGroups.length,
      duplicateCanonicalControlCount: duplicateCanonicalControls.length,
      placeholderControlItemCount: placeholderControlItems.length,
      standardAliasCandidateCount: dictionaryChecks.standardAliasCandidates.length,
      unmatchedStandardMappingCount: dictionaryChecks.unmatchedFrameworks.length + dictionaryChecks.unmatchedControls.length,
      standardsPathIssueCount: standards.audit.pathIssues.length,
    },
    objectChecks,
    duplicateStandardDisplayGroups,
    standardAliasCandidates: dictionaryChecks.standardAliasCandidates,
    unmatchedStandardMappings: [...dictionaryChecks.unmatchedFrameworks, ...dictionaryChecks.unmatchedControls],
    placeholderControlItems,
    duplicateCanonicalControls,
    standardsPathIssues: standards.audit.pathIssues,
  };

  mkdirSync(REPORT_ROOT, { recursive: true });
  writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(
    REPORT_MD,
    [
      "# Capability Standard Mapping Canonicalization Audit",
      "",
      `- 审计状态：\`${report.auditStatus}\``,
      `- 生成时间：\`${report.generatedAt}\``,
      `- 标准字典是否修改：\`${report.sourcePolicy.modifiedStandardsDictionary}\``,
      `- capability-workbench 是否修改：\`${report.sourcePolicy.modifiedCapabilityWorkbench}\``,
      "",
      "## 核心计数",
      "",
      `- 检查对象：\`${report.summary.checkedObjects}\``,
      `- 重复标准展示组：\`${report.summary.duplicateStandardDisplayGroupCount}\``,
      `- 重复 canonical 控制项：\`${report.summary.duplicateCanonicalControlCount}\``,
      `- 已排除占位控制项：\`${report.summary.placeholderControlItemCount}\``,
      `- 标准别名候选：\`${report.summary.standardAliasCandidateCount}\``,
      `- 未匹配标准映射：\`${report.summary.unmatchedStandardMappingCount}\``,
      "",
      "## 抽查对象",
      "",
      ...report.objectChecks.map(
        (item) =>
          `- \`${item.objectCode}\`: standardRows=\`${item.standardMappingRows ?? "n/a"}\`, standards=\`${item.localStandardCount ?? "n/a"}\`, controls=\`${item.localControlCount ?? "n/a"}\`, duplicateStandards=\`${item.localDuplicateStandardCount ?? "n/a"}\`, duplicateControls=\`${item.localDuplicateControlCount ?? "n/a"}\`, placeholders=\`${item.localPlaceholderControlCount ?? "n/a"}\``,
      ),
      "",
      "## 安全技术措施口径",
      "",
      "- `应用程序威胁建模`、`制品安全加固`、`IaC代码安全测试` 来自 LC-AP，应纳入安全技术措施。",
      "- `数据销毁` 来自 LC-DT，应纳入安全技术措施；它与同名服务 / 安全工作属于不同对象类型。",
      "- 因此正式维护包中 `security_technical_measures=30` 不再按旧 B 类误恢复风险处理。",
      "",
    ].join("\n"),
    "utf8",
  );
  console.log(`audit_status=${report.auditStatus}`);
  console.log(`duplicate_standard_display_groups=${report.summary.duplicateStandardDisplayGroupCount}`);
  console.log(`duplicate_canonical_controls=${report.summary.duplicateCanonicalControlCount}`);
  console.log(`placeholder_control_items=${report.summary.placeholderControlItemCount}`);
  console.log(`standard_alias_candidates=${report.summary.standardAliasCandidateCount}`);
  console.log(`unmatched_standard_mappings=${report.summary.unmatchedStandardMappingCount}`);
  console.log(`json=${REPORT_JSON}`);
  console.log(`markdown=${REPORT_MD}`);
  if (report.auditStatus !== "pass") process.exitCode = 1;
}

main();
