#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_PACKAGE = path.join(ROOT, "frontend/capability-browser/public/data/analytics-summary.json");
const DATA_CLIENT_PATH = path.join(ROOT, "frontend/capability-browser/dataClient.js");
const APP_PATH = path.join(ROOT, "frontend/capability-browser/app.js");

const REQUIRED_TOP_LEVEL_KEYS = [
  "meta",
  "page",
  "businessSummary",
  "coverageSummary",
  "moduleSummary",
  "navigationSummary",
  "relationshipSummary",
  "evidenceSummary",
  "adminSummary",
  "reconciliationSummary",
  "compatibility",
];

const FORBIDDEN_KEYS = new Set([
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
]);

function parseArgs(argv) {
  const options = {
    packagePath: DEFAULT_PACKAGE,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--package") {
      options.packagePath = path.resolve(argv[index + 1] || "");
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

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing analytics summary package: ${path.relative(ROOT, filePath)}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function addIssue(issues, code, message, detail = {}) {
  issues.push({ code, message, ...detail });
}

function findForbiddenKeyHits(value) {
  const hits = [];
  function walk(item, trail) {
    if (!item || typeof item !== "object") return;
    if (Array.isArray(item)) {
      item.forEach((child, index) => walk(child, `${trail}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(item)) {
      const next = trail ? `${trail}.${key}` : key;
      if (FORBIDDEN_KEYS.has(key) && next !== "meta.generated_at") {
        hits.push(next);
      }
      walk(child, next);
    }
  }
  walk(value, "");
  return hits.slice(0, 30);
}

function validateCoverage(summary, issues) {
  const coverage = summary.coverageSummary || {};
  const total = Number(coverage.totalFocuses);
  if (coverage.grain !== "capability_focus") {
    addIssue(issues, "coverage_grain", "coverageSummary.grain must be capability_focus", { actual: coverage.grain });
  }
  if (total !== 91) {
    addIssue(issues, "coverage_total", "coverageSummary.totalFocuses must remain 91 for P0 data", { actual: total });
  }
  if (!Array.isArray(coverage.dimensions) || coverage.dimensions.length < 5) {
    addIssue(issues, "coverage_dimensions", "coverageSummary.dimensions must include core coverage dimensions");
    return;
  }
  for (const item of coverage.dimensions) {
    if (item.total !== total || item.denominator !== total) {
      addIssue(issues, "coverage_denominator", "coverage dimensions must use capability_focus denominator", {
        id: item.id,
        total: item.total,
        denominator: item.denominator,
        expected: total,
      });
    }
    if (item.covered !== item.numerator) {
      addIssue(issues, "coverage_numerator", "coverage covered and numerator must match", {
        id: item.id,
        covered: item.covered,
        numerator: item.numerator,
      });
    }
    if (!Array.isArray(item.relationTypes) || item.relationTypes.length === 0) {
      addIssue(issues, "coverage_relation_types", "coverage dimensions must declare source relation types", { id: item.id });
    }
    if (typeof item.percent !== "number" || item.percent < 0 || item.percent > 100) {
      addIssue(issues, "coverage_percent", "coverage percent must be a number between 0 and 100", {
        id: item.id,
        percent: item.percent,
      });
    }
  }
}

function validateStandardGrain(summary, issues) {
  const standardControls = summary.reconciliationSummary?.standardControls || {};
  if (standardControls.capabilityMapped !== 1745) {
    addIssue(issues, "standard_capability_mapped", "capability mapped standard controls must stay separate at 1745", {
      actual: standardControls.capabilityMapped,
    });
  }
  if (standardControls.standardsIndex !== 4893) {
    addIssue(issues, "standard_index", "standards index controls must stay separate at 4893", {
      actual: standardControls.standardsIndex,
    });
  }
  if (standardControls.capabilityMapped === standardControls.standardsIndex) {
    addIssue(issues, "standard_grain_mixed", "standard control grains appear mixed");
  }
  if (!Array.isArray(standardControls.grainNotes) || standardControls.grainNotes.length < 3) {
    addIssue(issues, "standard_grain_notes", "standard controls must explain all three grains");
  }
}

function validateSummary(summary) {
  const issues = [];
  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(summary, key)) {
      addIssue(issues, "missing_top_level_key", `Missing top-level key: ${key}`, { key });
    }
  }
  if (summary.meta?.stats?.primaryGrain !== "capability_focus") {
    addIssue(issues, "primary_grain", "meta.stats.primaryGrain must be capability_focus", {
      actual: summary.meta?.stats?.primaryGrain,
    });
  }
  if (summary.businessSummary?.headline?.titleMetric?.grain !== "capability_focus") {
    addIssue(issues, "headline_grain", "headline title metric must use capability_focus grain", {
      actual: summary.businessSummary?.headline?.titleMetric?.grain,
    });
  }
  validateCoverage(summary, issues);
  validateStandardGrain(summary, issues);
  const forbiddenHits = findForbiddenKeyHits(summary);
  if (forbiddenHits.length) {
    addIssue(issues, "forbidden_field_leak", "Forbidden field keys leaked into analytics summary", { hits: forbiddenHits });
  }
  return issues;
}

function validateDataClient(issues) {
  const source = fs.existsSync(DATA_CLIENT_PATH) ? fs.readFileSync(DATA_CLIENT_PATH, "utf8") : "";
  const checks = [
    ["client_data_path", /analyticsSummary:\s*"\.\/public\/data\/analytics-summary\.json"/],
    ["client_api_path", /analyticsSummary:\s*"\/api\/v1\/data-packages\/analytics-summary"/],
    ["client_method", /async\s+getAnalyticsSummary\s*\(/],
    ["client_fetch_package", /fetchPackage\("analyticsSummary"\)/],
  ];
  for (const [code, pattern] of checks) {
    if (!pattern.test(source)) {
      addIssue(issues, code, "dataClient analytics summary contract is missing or changed");
    }
  }
}

function validateDashboardConsumer(issues) {
  const source = fs.existsSync(APP_PATH) ? fs.readFileSync(APP_PATH, "utf8") : "";
  const checks = [
    ["dashboard_state", /analyticsSummary:\s*null/],
    ["dashboard_getter", /analyticsSummary:\s*"getAnalyticsSummary"/],
    ["dashboard_assign", /name === "analyticsSummary"\)\s*state\.analyticsSummary = data/],
    ["dashboard_route_package", /state\.activeView === "overview"\)\s*return \["analyticsSummary", "maintenanceIndex", "dashboardKnowledgeSummary"\]/],
    ["dashboard_render_source", /const summary = state\.analyticsSummary \|\| \{\}/],
  ];
  for (const [code, pattern] of checks) {
    if (!pattern.test(source)) {
      addIssue(issues, code, "dashboard analytics summary consumer contract is missing or changed");
    }
  }
  const routeMatch = source.match(/if \(state\.activeView === "overview"\) return \[([^\]]*)\]/);
  if (routeMatch && /capabilityWorkbench|environmentWorkbench|lifecycleWorkbench|standards|content/.test(routeMatch[1])) {
    addIssue(issues, "dashboard_raw_package_load", "overview must not load raw workbench packages for dashboard metrics", { routePackages: routeMatch[1] });
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log("Usage: node scripts/audit_analytics_summary_contract.mjs [--package <path>] [--json]");
    return 0;
  }
  const summary = readJson(options.packagePath);
  const issues = validateSummary(summary);
  validateDataClient(issues);
  validateDashboardConsumer(issues);
  const result = {
    result: issues.length ? "fail" : "pass",
    package: path.relative(ROOT, options.packagePath),
    issues,
    focusCount: summary.meta?.stats?.focusCount,
    coverageDimensions: summary.coverageSummary?.dimensions?.length || 0,
    standardControls: summary.reconciliationSummary?.standardControls,
  };
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (issues.length) {
    console.log(`result=fail issues=${issues.length}`);
    for (const issue of issues) {
      console.log(`${issue.code}: ${issue.message}`);
    }
  } else {
    console.log(`result=pass package=${result.package} focusCount=${result.focusCount} coverageDimensions=${result.coverageDimensions} capabilityMapped=${result.standardControls.capabilityMapped} standardsIndex=${result.standardControls.standardsIndex}`);
  }
  return issues.length ? 1 : 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`result=fail reason=${error.message}`);
  process.exitCode = 1;
}
