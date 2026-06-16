#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const DATA_ROOT = join(ROOT, "frontend/capability-browser/public/data");
const CANDIDATE_ROOT = join(ROOT, "data/exports/worker-verify/p0-source-of-truth-reconciliation/exports-candidate-sqlite");
const REPORT_ROOT = join(ROOT, "data/exports/worker-verify");
const REPORT_JSON = join(REPORT_ROOT, "p0-baseline-canonical-data-correction-report.json");
const REPORT_MD = join(REPORT_ROOT, "p0-baseline-canonical-data-correction-report.md");

const CONFIRMED_MEASURES = [
  {
    name: "应用程序威胁建模",
    evidenceSummary: "LC-AP 应用安全开发生命周期，AP-02 架构设计",
  },
  {
    name: "制品安全加固",
    evidenceSummary: "LC-AP 应用安全开发生命周期，AP-04 集成构建",
  },
  {
    name: "IaC代码安全测试",
    evidenceSummary: "LC-AP 应用安全开发生命周期，AP-05 测试验证",
  },
  {
    name: "数据销毁",
    evidenceSummary: "LC-DT 数据生命周期及 LC-DT 安全技术服务、模块、策略映射表",
  },
];

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, payload) {
  writeFileSync(path, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function measureName(item) {
  return String(item?.name || item?.title || "").trim();
}

function byName(items) {
  return new Map(list(items).map((item) => [measureName(item), item]).filter(([name]) => name));
}

function ensureCount(payload, value) {
  payload.stats = payload.stats && typeof payload.stats === "object" ? payload.stats : {};
  payload.stats.security_technical_measures = value;
}

function main() {
  const maintenancePath = join(DATA_ROOT, "maintenance-knowledge.json");
  const measuresPath = join(DATA_ROOT, "maintenance/measures.json");
  const indexPath = join(DATA_ROOT, "maintenance-index.json");
  const evidencePath = join(DATA_ROOT, "source-evidence/maintenance/measures.sources.json");

  const candidateMaintenance = readJson(join(CANDIDATE_ROOT, "maintenance-knowledge.json"));
  const candidateMeasures = readJson(join(CANDIDATE_ROOT, "maintenance/measures.json"));
  const candidateEvidence = readJson(join(CANDIDATE_ROOT, "source-evidence/maintenance/measures.sources.json"));

  const maintenance = readJson(maintenancePath);
  const measures = readJson(measuresPath);
  const index = readJson(indexPath);
  const evidence = readJson(evidencePath);

  const before = {
    maintenanceMeasureCount: list(maintenance.security_technical_measures).length,
    splitMeasureCount: list(measures.security_technical_measures).length,
    indexMeasureCount: Number(index.section_counts?.measures || 0),
    evidenceCount: Object.keys(evidence.evidenceById || {}).length,
  };

  const currentByName = byName(maintenance.security_technical_measures);
  const candidateMaintenanceByName = byName(candidateMaintenance.security_technical_measures);
  const candidateSplitByName = byName(candidateMeasures.security_technical_measures);
  const additions = [];
  const updatedExisting = [];
  const skippedExisting = [];
  const missingCandidates = [];

  for (const item of CONFIRMED_MEASURES) {
    const maintenanceCandidate = candidateMaintenanceByName.get(item.name);
    const splitCandidate = candidateSplitByName.get(item.name);
    if (!maintenanceCandidate || !splitCandidate) {
      missingCandidates.push(item.name);
      continue;
    }
    maintenanceCandidate.type = "security_technical_measure";
    splitCandidate.type = "security_technical_measure";
    if (currentByName.has(item.name)) {
      updatedExisting.push({
        ...item,
        maintenanceRecord: currentByName.get(item.name),
        splitRecord: byName(measures.security_technical_measures).get(item.name),
        candidateRecord: maintenanceCandidate,
        evidence: list(candidateEvidence.evidenceById?.[maintenanceCandidate.id]),
      });
      skippedExisting.push(item.name);
      continue;
    }
    additions.push({
      ...item,
      maintenanceRecord: maintenanceCandidate,
      splitRecord: splitCandidate,
      evidence: list(candidateEvidence.evidenceById?.[maintenanceCandidate.id]),
    });
  }

  if (missingCandidates.length) {
    throw new Error(`候选导出中缺少已确认安全技术措施：${missingCandidates.join("、")}`);
  }

  maintenance.security_technical_measures = [
    ...list(maintenance.security_technical_measures),
    ...additions.map((item) => item.maintenanceRecord),
  ];
  measures.security_technical_measures = [
    ...list(measures.security_technical_measures),
    ...additions.map((item) => item.splitRecord),
  ];
  for (const item of updatedExisting) {
    Object.assign(item.maintenanceRecord, { type: "security_technical_measure" });
    if (item.splitRecord) Object.assign(item.splitRecord, { type: "security_technical_measure" });
  }

  const afterMeasureCount = list(maintenance.security_technical_measures).length;
  ensureCount(maintenance, afterMeasureCount);
  ensureCount(measures, list(measures.security_technical_measures).length);
  index.stats = index.stats && typeof index.stats === "object" ? index.stats : {};
  index.stats.security_technical_measures = afterMeasureCount;
  index.section_counts = index.section_counts && typeof index.section_counts === "object" ? index.section_counts : {};
  index.section_counts.measures = afterMeasureCount;
  for (const section of list(index.sections)) {
    if (section.id === "measures") section.count = afterMeasureCount;
  }

  evidence.evidenceById = evidence.evidenceById && typeof evidence.evidenceById === "object" ? evidence.evidenceById : {};
  for (const item of [...additions, ...updatedExisting]) {
    evidence.evidenceById[item.maintenanceRecord.id] = item.evidence;
  }

  const duplicateNames = [...byName(maintenance.security_technical_measures).keys()].filter(
    (name) => list(maintenance.security_technical_measures).filter((item) => measureName(item) === name).length > 1,
  );
  if (duplicateNames.length) {
    throw new Error(`补入后出现重复安全技术措施名称：${duplicateNames.join("、")}`);
  }
  if (afterMeasureCount !== before.maintenanceMeasureCount + additions.length) {
    throw new Error(`补入后数量异常：before=${before.maintenanceMeasureCount}, additions=${additions.length}, after=${afterMeasureCount}`);
  }

  writeJson(maintenancePath, maintenance);
  writeJson(measuresPath, measures);
  writeJson(indexPath, index);
  writeJson(evidencePath, evidence);

  const after = {
    maintenanceMeasureCount: list(maintenance.security_technical_measures).length,
    splitMeasureCount: list(measures.security_technical_measures).length,
    indexMeasureCount: Number(index.section_counts?.measures || 0),
    evidenceCount: Object.keys(evidence.evidenceById || {}).length,
  };

  const report = {
    status: "ready",
    generatedAt: new Date().toISOString(),
    scope: "P0 Baseline Canonical Data Correction 1.1",
    modifiedFiles: [
      "frontend/capability-browser/public/data/maintenance-knowledge.json",
      "frontend/capability-browser/public/data/maintenance/measures.json",
      "frontend/capability-browser/public/data/maintenance-index.json",
      "frontend/capability-browser/public/data/source-evidence/maintenance/measures.sources.json",
    ],
    forbiddenScopeTouched: {
      sqlite: false,
      lifecycleWorkbench: false,
      environmentWorkbench: false,
      nodeDetails: false,
      standardsDictionary: false,
      originalExcel: false,
      schema: false,
    },
    before,
    after,
    addedMeasures: additions.map((item) => ({
      id: item.maintenanceRecord.id,
      name: item.name,
      type: item.maintenanceRecord.type || "security_technical_measure",
      category: item.maintenanceRecord.category || null,
      sourceKind: item.maintenanceRecord.source_kind || null,
      evidenceSummary: item.evidenceSummary,
      sourceEvidence: item.evidence,
    })),
    updatedExistingMeasures: updatedExisting.map((item) => ({
      id: item.maintenanceRecord.id,
      name: item.name,
      type: item.maintenanceRecord.type,
      evidenceSummary: item.evidenceSummary,
      sourceEvidence: item.evidence,
    })),
    skippedExisting,
    duplicateMeasureNameCount: duplicateNames.length,
  };

  mkdirSync(REPORT_ROOT, { recursive: true });
  writeJson(REPORT_JSON, report);
  writeFileSync(
    REPORT_MD,
    [
      "# P0 Baseline Canonical Data Correction Report",
      "",
      `- 状态：\`${report.status}\``,
      `- 生成时间：\`${report.generatedAt}\``,
      `- 修复前 security_technical_measures：\`${before.maintenanceMeasureCount}\``,
      `- 修复后 security_technical_measures：\`${after.maintenanceMeasureCount}\``,
      `- 新增数量：\`${report.addedMeasures.length}\``,
      `- 已存在确认项更新数量：\`${report.updatedExistingMeasures.length}\``,
      `- 重复名称数量：\`${report.duplicateMeasureNameCount}\``,
      "",
      "## 新增安全技术措施",
      "",
      ...report.addedMeasures.map((item) => `- \`${item.name}\`：id=\`${item.id}\`，type=\`${item.type}\`，来源：${item.evidenceSummary}`),
      ...report.updatedExistingMeasures.map((item) => `- \`${item.name}\`：id=\`${item.id}\`，type=\`${item.type}\`，来源：${item.evidenceSummary}`),
      "",
      "## 禁止范围",
      "",
      ...Object.entries(report.forbiddenScopeTouched).map(([key, value]) => `- ${key}: \`${value}\``),
      "",
    ].join("\n"),
    "utf8",
  );

  console.log(`status=${report.status}`);
  console.log(`before_security_technical_measures=${before.maintenanceMeasureCount}`);
  console.log(`after_security_technical_measures=${after.maintenanceMeasureCount}`);
  console.log(`added=${report.addedMeasures.map((item) => item.name).join("、")}`);
  console.log(`json=${REPORT_JSON}`);
  console.log(`markdown=${REPORT_MD}`);
}

main();
