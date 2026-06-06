#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "frontend/capability-browser/public/data");

const SOURCE_PACKAGES = [
  "capability-workbench",
  "environment-workbench",
  "lifecycle-workbench",
  "standards-index",
  "content-views",
];

const DEFAULT_OUTPUT = path.join(DATA_DIR, "analytics-summary.json");

function parseArgs(argv) {
  const options = {
    output: DEFAULT_OUTPUT,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") {
      options.output = path.resolve(argv[index + 1] || "");
      index += 1;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--help") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function readJsonPackage(name) {
  const packagePath = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(packagePath)) {
    throw new Error(`Missing source package: ${path.relative(ROOT, packagePath)}`);
  }
  return {
    name,
    path: packagePath,
    data: JSON.parse(fs.readFileSync(packagePath, "utf8")),
  };
}

function statsOf(pkg) {
  return pkg?.data?.meta?.stats || pkg?.data?.stats || {};
}

function relationRows(pkg) {
  const relations = pkg?.data?.relations;
  if (Array.isArray(relations)) return relations;
  if (relations && typeof relations === "object") return Object.values(relations);
  return [];
}

function relationTypeCounts(pkg) {
  const counts = {};
  for (const relation of relationRows(pkg)) {
    if (!relation?.type) continue;
    counts[relation.type] = (counts[relation.type] || 0) + 1;
  }
  return counts;
}

function countObjects(pkg, type) {
  const rows = pkg?.data?.objects?.[type];
  if (Array.isArray(rows)) return rows.length;
  if (rows && typeof rows === "object") return Object.keys(rows).length;
  return Number(statsOf(pkg)[type] || 0);
}

function coveredFocuses(pkg, relationTypes) {
  const allowed = new Set(relationTypes);
  const focusIds = new Set();
  for (const relation of relationRows(pkg)) {
    if (!allowed.has(relation?.type)) continue;
    if (relation.sourceType === "capability_focus" && relation.sourceId) {
      focusIds.add(relation.sourceId);
    }
    if (relation.targetType === "capability_focus" && relation.targetId) {
      focusIds.add(relation.targetId);
    }
  }
  return focusIds.size;
}

function percent(covered, total) {
  if (!total) return 0;
  return Number(((covered / total) * 100).toFixed(1));
}

function dimension({ id, label, pkg, covered, total, relationTypes, route, displayRole = "primary" }) {
  return {
    id,
    label,
    covered,
    total,
    numerator: covered,
    denominator: total,
    percent: percent(covered, total),
    sourcePackage: pkg.name,
    relationTypes,
    route,
    displayRole,
  };
}

function packageHealth(pkg) {
  const stats = statsOf(pkg);
  return {
    id: pkg.name,
    label: pkg.name,
    dataState: pkg.data?.data_state || pkg.data?.meta?.dataState || "ready",
    objectCount: Number(stats.objects || 0),
    relationCount: Number(stats.relations || 0),
    evidenceRefCount: Number(stats.evidenceRefs || 0),
  };
}

function sourceSummary(pkg) {
  const stats = statsOf(pkg);
  return {
    id: pkg.name,
    label: pkg.name,
    evidenceRefs: Number(stats.evidenceRefs || 0),
  };
}

function buildSummary(packages) {
  const capability = packages["capability-workbench"];
  const environment = packages["environment-workbench"];
  const lifecycle = packages["lifecycle-workbench"];
  const standards = packages["standards-index"];
  const content = packages["content-views"];

  const capabilityStats = statsOf(capability);
  const environmentStats = statsOf(environment);
  const lifecycleStats = statsOf(lifecycle);
  const standardsStats = statsOf(standards);
  const contentStats = statsOf(content);

  const totalFocuses = Number(capabilityStats.capability_focus || countObjects(capability, "capability_focus"));
  const capabilityCount = Number(capabilityStats.capability || countObjects(capability, "capability"));
  const capabilityMappedControls = Number(capabilityStats.standard_control || 0);
  const standardsIndexControls = Number(standardsStats.controls || 0);

  const coverageDimensions = [
    dimension({
      id: "technical_service",
      label: "技术服务",
      pkg: capability,
      covered: coveredFocuses(capability, ["supports_focus"]),
      total: totalFocuses,
      relationTypes: ["supports_focus"],
      route: "/capability-mapping",
    }),
    dimension({
      id: "technical_scope",
      label: "适用范围",
      pkg: capability,
      covered: coveredFocuses(capability, ["applies_to_scope"]),
      total: totalFocuses,
      relationTypes: ["applies_to_scope"],
      route: "/capability-mapping",
    }),
    dimension({
      id: "management_work",
      label: "管理工作",
      pkg: capability,
      covered: coveredFocuses(capability, ["maps_to_work"]),
      total: totalFocuses,
      relationTypes: ["maps_to_work"],
      route: "/capability-mapping",
    }),
    dimension({
      id: "process_reference",
      label: "流程参考",
      pkg: capability,
      covered: coveredFocuses(capability, ["maps_to_process"]),
      total: totalFocuses,
      relationTypes: ["maps_to_process"],
      route: "/capability-mapping",
      displayRole: "secondary",
    }),
    dimension({
      id: "standard_control",
      label: "标准控制项",
      pkg: capability,
      covered: coveredFocuses(capability, ["maps_to_standard"]),
      total: totalFocuses,
      relationTypes: ["maps_to_standard"],
      route: "/standards",
    }),
    dimension({
      id: "environment_reach",
      label: "信息化环境可达",
      pkg: environment,
      covered: coveredFocuses(environment, ["supports_focus"]) || Number(environmentStats.capability_focus || 0),
      total: totalFocuses,
      relationTypes: ["supports_focus"],
      route: "/environment-scope",
      displayRole: "secondary",
    }),
    dimension({
      id: "lifecycle_reach",
      label: "生命周期可达",
      pkg: lifecycle,
      covered: coveredFocuses(lifecycle, ["maps_to_focus"]) || Number(lifecycleStats.capability_focus || 0),
      total: totalFocuses,
      relationTypes: ["maps_to_focus"],
      route: "/lifecycle",
      displayRole: "secondary",
    }),
  ];

  const totalEvidenceRefs = [capability, environment, lifecycle]
    .reduce((sum, pkg) => sum + Number(statsOf(pkg).evidenceRefs || 0), 0);

  return {
    meta: {
      version: "v1",
      viewModelVersion: "analytics-summary-1.0",
      generated_at: new Date().toISOString(),
      dataState: "ready",
      apiEquivalent: "/api/v1/data-packages/analytics-summary",
      sourcePackages: SOURCE_PACKAGES,
      stats: {
        primaryGrain: "capability_focus",
        focusCount: totalFocuses,
        capabilityCount,
        sourcePackageCount: SOURCE_PACKAGES.length,
      },
    },
    page: {
      title: "安全能力知识地图",
      subtitle: "以能力关注点为核心查看技术、环境、生命周期、标准和工作方法的支撑关系",
      primaryRoute: "/capability-mapping",
      defaultView: "capability_overview",
      audience: "knowledge_user",
      adminPanelDefault: "collapsed",
    },
    businessSummary: {
      headline: {
        label: "能力知识地图",
        titleMetric: {
          id: "capability_focus_count",
          label: "能力关注点",
          value: totalFocuses,
          unit: "个",
          grain: "capability_focus",
          sourcePackage: capability.name,
        },
        supportingText: `当前知识库围绕 ${capabilityStats.capability_category} 个能力大类、${capabilityStats.capability_domain} 个能力域、${capabilityCount} 项能力和 ${totalFocuses} 个关注点组织知识。`,
      },
      heroMetrics: [
        {
          id: "capability_map_depth",
          label: "能力地图层级",
          value: `${capabilityStats.capability_category} / ${capabilityStats.capability_domain} / ${capabilityCount} / ${totalFocuses}`,
          unit: "类 / 域 / 能力 / 关注点",
          displayRole: "primary",
          route: "/capability-mapping",
        },
        {
          id: "technical_service_coverage",
          label: "技术服务支撑",
          value: coverageDimensions[0].percent,
          unit: "%",
          displayRole: "primary",
          route: "/capability-mapping",
          denominator: totalFocuses,
          numerator: coverageDimensions[0].covered,
          relationTypes: ["supports_focus"],
        },
        {
          id: "standard_mapping_coverage",
          label: "标准映射覆盖",
          value: coverageDimensions[4].percent,
          unit: "%",
          displayRole: "primary",
          route: "/standards",
          denominator: totalFocuses,
          numerator: coverageDimensions[4].covered,
          relationTypes: ["maps_to_standard"],
        },
        {
          id: "module_entry_count",
          label: "分析入口",
          value: 6,
          unit: "个",
          displayRole: "secondary",
          route: "/",
        },
      ],
      capabilityMap: {
        categories: Number(capabilityStats.capability_category || 0),
        domains: Number(capabilityStats.capability_domain || 0),
        capabilities: capabilityCount,
        focuses: totalFocuses,
      },
    },
    coverageSummary: {
      grain: "capability_focus",
      totalFocuses,
      dimensions: coverageDimensions,
    },
    moduleSummary: {
      uniquePackageTotals: {
        packages: 3,
        objectCount: Number(capabilityStats.objects || 0) + Number(environmentStats.objects || 0) + Number(lifecycleStats.objects || 0),
        relationCount: Number(capabilityStats.relations || 0) + Number(environmentStats.relations || 0) + Number(lifecycleStats.relations || 0),
        evidenceRefCount: totalEvidenceRefs,
        displayRole: "admin_only",
      },
      entryViews: [
        { id: "capability_mapping", label: "安全能力映射", route: "/capability-mapping", sourcePackage: capability.name, primaryGrain: "capability_focus", objectCount: Number(capabilityStats.objects || 0) },
        { id: "environment_scope", label: "信息化环境维度", route: "/environment-scope", sourcePackage: environment.name, primaryGrain: "information_object", objectCount: Number(environmentStats.objects || 0) },
        { id: "lifecycle_ap", label: "LC-AP 安全开发生命周期", route: "/lifecycle/ap", sourcePackage: lifecycle.name, primaryGrain: "lifecycle_stage", objectCount: Number(lifecycleStats.objects || 0) },
        { id: "lifecycle_dt", label: "LC-DT 数据生命周期安全", route: "/lifecycle/dt", sourcePackage: lifecycle.name, primaryGrain: "lifecycle_stage", objectCount: Number(lifecycleStats.objects || 0) },
        { id: "standards", label: "安全标准 / 框架", route: "/standards", sourcePackage: standards.name, primaryGrain: "standard_control", objectCount: standardsIndexControls },
        { id: "guides", label: "指南 / 幻灯片", route: "/guides/security-architecture-design", sourcePackage: content.name, primaryGrain: "content_page", objectCount: Number(contentStats.html_documents || 0) + Number(contentStats.diagram_views || 0) + Number(contentStats.guide_pages || 0) },
      ],
    },
    navigationSummary: {
      primaryEntries: [
        { id: "capability_mapping", label: "安全能力映射", route: "/capability-mapping" },
        { id: "environment_scope", label: "信息化环境维度", route: "/environment-scope" },
        { id: "lifecycle_ap", label: "LC-AP 安全开发生命周期", route: "/lifecycle/ap" },
        { id: "lifecycle_dt", label: "LC-DT 数据生命周期安全", route: "/lifecycle/dt" },
      ],
      secondaryEntries: [
        { id: "standards", label: "安全标准 / 框架", route: "/standards" },
        { id: "guides", label: "指南 / 幻灯片", route: "/guides/security-architecture-design" },
      ],
    },
    relationshipSummary: {
      graphGrain: "business_relation",
      groups: [
        { id: "capability", label: "能力关系", sourcePackage: capability.name, relationTypeCounts: relationTypeCounts(capability) },
        { id: "environment", label: "环境关系", sourcePackage: environment.name, relationTypeCounts: relationTypeCounts(environment) },
        { id: "lifecycle", label: "生命周期关系", sourcePackage: lifecycle.name, relationTypeCounts: relationTypeCounts(lifecycle) },
      ],
    },
    evidenceSummary: {
      displayRole: "secondary",
      sourcePackages: [sourceSummary(capability), sourceSummary(environment), sourceSummary(lifecycle)],
      totalEvidenceRefs,
    },
    adminSummary: {
      displayRole: "admin_only",
      packageHealth: SOURCE_PACKAGES.map((name) => packageHealth(packages[name])),
      generatedAt: new Date().toISOString(),
    },
    reconciliationSummary: {
      displayRole: "admin_only",
      standardControls: {
        capabilityMapped: capabilityMappedControls,
        standardsIndex: standardsIndexControls,
        sqliteFullDatabase: null,
        grainNotes: [
          "capabilityMapped 来自 capability-workbench 的能力映射可达控制项。",
          "standardsIndex 来自 standards-index 的标准索引控制项。",
          "sqliteFullDatabase 只允许进入管理员 reconciliation，不作为 dashboard 主指标。",
        ],
      },
    },
    compatibility: {
      warnings: [],
      sourcePackages: SOURCE_PACKAGES.map((name) => ({
        id: name,
        dataState: packages[name].data?.data_state || packages[name].data?.meta?.dataState || "ready",
      })),
    },
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: node scripts/export_analytics_summary.mjs [--output <path>] [--json]");
    return 0;
  }
  const packages = Object.fromEntries(SOURCE_PACKAGES.map((name) => {
    const pkg = readJsonPackage(name);
    return [name, pkg];
  }));
  const summary = buildSummary(packages);
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  const result = {
    result: "pass",
    output: path.relative(ROOT, options.output),
    primaryGrain: summary.meta.stats.primaryGrain,
    focusCount: summary.meta.stats.focusCount,
    coverageDimensions: summary.coverageSummary.dimensions.length,
    standardControls: summary.reconciliationSummary.standardControls,
  };
  console.log(options.json ? JSON.stringify(result, null, 2) : `result=pass output=${result.output} primaryGrain=${result.primaryGrain} focusCount=${result.focusCount} coverageDimensions=${result.coverageDimensions}`);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`result=fail reason=${error.message}`);
  process.exitCode = 1;
}
