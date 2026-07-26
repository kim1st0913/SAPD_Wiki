#!/usr/bin/env node
import { spawn } from "node:child_process";

const DEFAULT_URL = "http://127.0.0.1:5173";

function hasFlag(name) {
  return process.argv.includes(name);
}

function argValues(name) {
  const values = [];
  for (let index = 2; index < process.argv.length; index += 1) {
    if (process.argv[index] === name && process.argv[index + 1]) {
      values.push(...process.argv[index + 1].split(",").map((item) => item.trim()).filter(Boolean));
      index += 1;
    }
  }
  return values;
}

function argValue(name, fallback = "") {
  const values = argValues(name);
  return values.length ? values[values.length - 1] : fallback;
}

function command(id, description, bin, args = [], options = {}) {
  return { id, description, bin, args, ...options };
}

function withUrl(args, ctx) {
  return [...args, "--url", ctx.url];
}

function withOptionalChrome(args, ctx) {
  return ctx.allowSystemChrome ? [...args, "--allow-system-chrome"] : args;
}

const suites = {
  static: {
    description: "语法与测试编排脚本静态检查",
    commands: [
      command("static:runtime-py", "后端 / Runtime helper Python 语法检查", "python3", [
        "-m",
        "py_compile",
        "scripts/run_local_server.py",
        "scripts/check_bundle_runtime.py",
        "scripts/create_user_db.py",
        "scripts/export_diagnostics.py",
        "scripts/package_backend_pyinstaller.py",
      ]),
      command("static:test-runner", "项目测试套件编排脚本语法检查", "node", ["--check", "scripts/run_project_test_suite.mjs"]),
      command("static:reserved-preview-port", "5173 stable 保留端口与 synthetic 负向门禁", ".venv-local-mcp-web/bin/python", [
        "-m",
        "unittest",
        "tests.mcp_integration.test_reserved_preview_port",
      ], {
        env: { PYTHONPATH: "src" },
      }),
      command("static:frontend-smoke", "前端 smoke 脚本语法检查", "node", ["--check", "scripts/frontend_smoke_check.mjs"]),
      command("static:content-smoke", "内容 smoke 脚本语法检查", "node", ["--check", "scripts/frontend_content_smoke_check.mjs"]),
      command("static:dmg-parity-audit", "DMG / 5173 一致性审计脚本语法检查", "node", ["--check", "scripts/audit_mac_dmg_browser_parity_contract.mjs"]),
      command("static:local-directory-audit", "本地 import / export / Runtime 目录契约脚本语法检查", "python3", ["-m", "py_compile", "scripts/audit_local_file_directory_contract.py"]),
      command("static:service-scope-chip-audit", "服务胶囊作用域颜色审计脚本语法检查", "node", ["--check", "scripts/audit_service_scope_chip_color_contract.mjs"]),
      command("static:p0-1-boundary-audit", "P0-1 正确性与安全边界门禁脚本语法检查", "node", ["--check", "scripts/audit_frontend_p0_1_correctness_boundary_contract.mjs"]),
      command("static:p0-2-shell-audit", "P0-2 Apple Shell 与共享布局基座门禁脚本语法检查", "node", ["--check", "scripts/audit_frontend_p0_2_apple_shell_layout_contract.mjs"]),
      command("static:p0-4-standard-issue-audit", "P0-4 标准与 Issue 壳层派生门禁脚本语法检查", "node", ["--check", "scripts/audit_frontend_p0_4_standard_issue_shell_contract.mjs"]),
      command("static:p1-1-runtime-state-audit", "P1-1 共享运行状态模板门禁脚本语法检查", "node", ["--check", "scripts/audit_frontend_p1_1_runtime_state_contract.mjs"]),
      command("static:p1-2-canvas-workbench-audit", "P1-2 画布工作台门禁脚本语法检查", "node", ["--check", "scripts/audit_frontend_p1_2_canvas_workbench_contract.mjs"]),
      command("static:p1-3-lifecycle-audit", "P1-3 生命周期宽表与上下文门禁脚本语法检查", "node", ["--check", "scripts/audit_frontend_p1_3_lifecycle_workbench_contract.mjs"]),
      command("static:p1-4-reference-audit", "P1-4 字典与标准层级语义门禁脚本语法检查", "node", ["--check", "scripts/audit_frontend_p1_4_reference_tables_contract.mjs"]),
      command("static:p1-5-review-search-audit", "P1-5 Issue 与全局搜索门禁脚本语法检查", "node", ["--check", "scripts/audit_frontend_p1_5_review_search_contract.mjs"]),
      command("static:p1-6-guide-reading-audit", "P1-6 指南阅读门禁脚本语法检查", "node", ["--check", "scripts/audit_frontend_p1_6_guide_reading_contract.mjs"]),
      command("static:p2-product-workspace-audit", "P2 工作台、目录和指南门禁脚本语法检查", "node", ["--check", "scripts/audit_frontend_p2_product_workspace_contract.mjs"]),
    ],
  },
  boundaries: {
    description: "GitHub / JSON / 受保护基线边界检查",
    commands: [
      command("boundary:github-data", "GitHub 不同步数据边界检查", "python3", ["scripts/check_github_data_boundary.py"]),
      command("boundary:json-package", "正式 JSON 包边界检查", "python3", ["scripts/audit_json_package_boundary.py"]),
      command("boundary:dictionary-standard", "字典 / 标准保护基线完整性检查", "python3", ["scripts/audit_dictionary_standard_baseline_integrity.py"]),
      command("boundary:protected-no-regression", "受保护基线无回归检查", "python3", ["scripts/audit_protected_baseline_no_regression.py"]),
    ],
  },
  data: {
    description: "核心业务数据契约检查",
    commands: [
      command("data:dictionary-reference", "字典权威引用一致性审计", "node", ["scripts/audit_dictionary_reference_consistency.mjs"]),
      command("data:search-quality", "搜索索引语义质量探针", ".venv-local-mcp-web/bin/python", ["scripts/audit_search_index_quality_probes.py"]),
      command("data:capability-integrity", "安全能力映射完整性审计", "python3", ["scripts/audit_capability_mapping_integrity.py"]),
      command("data:lcdt-policy", "LC-DT 策略矩阵行级投影审计", "python3", ["scripts/audit_lcdt_policy_projection_contract.py"]),
      command("data:module-services", "安全技术模块-服务关系审计", "python3", ["scripts/audit_maintenance_module_services_integrity.py"]),
      command("data:measure-catalog", "安全技术措施目录契约审计", "python3", ["scripts/audit_maintenance_measure_catalog_contract.py"]),
    ],
  },
  frontend: {
    description: "前端契约与搜索 / 滚动 / 加载规则检查",
    commands: [
      command("frontend:p0-1-boundary", "P0-1 正确性与安全边界统一门禁", "node", (ctx) =>
        withUrl(["scripts/audit_frontend_p0_1_correctness_boundary_contract.mjs"], ctx),
      ),
      command("frontend:p0-2-shell", "P0-2 Apple Shell 与共享布局基座门禁", "node", (ctx) =>
        withUrl(["scripts/audit_frontend_p0_2_apple_shell_layout_contract.mjs"], ctx),
      ),
      command("frontend:p0-4-standard-issue", "P0-4 标准与 Issue 壳层派生门禁", "node", (ctx) =>
        withUrl(["scripts/audit_frontend_p0_4_standard_issue_shell_contract.mjs"], ctx),
      ),
      command("frontend:p1-1-runtime-state", "P1-1 共享运行状态模板门禁", "node", (ctx) =>
        withUrl(["scripts/audit_frontend_p1_1_runtime_state_contract.mjs"], ctx),
      ),
      command("frontend:p1-2-canvas-workbench", "P1-2 画布工作台门禁", "node", (ctx) =>
        withUrl(["scripts/audit_frontend_p1_2_canvas_workbench_contract.mjs"], ctx),
      ),
      command("frontend:p1-3-lifecycle", "P1-3 生命周期宽表与上下文门禁", "node", (ctx) =>
        withUrl(["scripts/audit_frontend_p1_3_lifecycle_workbench_contract.mjs"], ctx),
      ),
      command("frontend:p1-4-reference", "P1-4 字典与标准层级语义门禁", "node", (ctx) =>
        withUrl(["scripts/audit_frontend_p1_4_reference_tables_contract.mjs"], ctx),
      ),
      command("frontend:p1-5-review-search", "P1-5 Issue 与全局搜索门禁", "node", (ctx) =>
        withUrl(["scripts/audit_frontend_p1_5_review_search_contract.mjs"], ctx),
      ),
      command("frontend:p1-6-guide-reading", "P1-6 指南阅读门禁", "node", (ctx) =>
        withUrl(["scripts/audit_frontend_p1_6_guide_reading_contract.mjs"], ctx),
      ),
      command("frontend:p2-product-workspace", "P2 工作台、目录和指南门禁", "node", (ctx) =>
        withUrl(["scripts/audit_frontend_p2_product_workspace_contract.mjs"], ctx),
      ),
      command("frontend:governance", "前端高风险文件治理审计", "node", ["scripts/audit_frontend_governance.mjs"]),
      command("frontend:lazy-load", "前端按需加载契约审计", "node", ["scripts/audit_frontend_lazy_load_contract.mjs"]),
      command("frontend:route-refresh", "前端深层路由刷新契约审计", "node", ["scripts/audit_frontend_route_refresh_contract.mjs"]),
      command("frontend:scroll", "前端滚动 owner 契约审计", "node", ["scripts/audit_frontend_scroll_contract.mjs"]),
      command("frontend:global-search", "全局搜索索引和定位契约审计", "node", ["scripts/audit_global_search_index_contract.mjs"]),
      command("frontend:search-state", "搜索历史和状态隔离审计", "node", ["scripts/audit_search_state_isolation.mjs"]),
      command("frontend:environment-search", "信息化环境搜索契约审计", "node", ["scripts/audit_environment_search_contract.mjs"]),
      command("frontend:maturity-v2.1", "成熟度评估 V2.1 企业项目、固定模板、目标聚合与文件交换审计", "python3", ["scripts/audit_maturity_assessment_v2_1_contract.py"]),
    ],
  },
  runtime: {
    description: "5173 本地运行态 smoke",
    commands: [
      command("runtime:server", "固定 5173 项目服务状态检查", "python3", ["scripts/dev_server_guard.py", "--status"]),
      command("runtime:content", "5173 内容和 API smoke", "node", (ctx) => withUrl(["scripts/frontend_content_smoke_check.mjs"], ctx)),
      command("runtime:search", "全局搜索页 HTTP/API smoke", "node", (ctx) =>
        withOptionalChrome(withUrl(["scripts/frontend_smoke_check.mjs", "--page", "search", "--route", "/search?q=M-PM.PR-00"], ctx), ctx),
      ),
      command("runtime:capability", "安全能力映射页 HTTP/API smoke", "node", (ctx) =>
        withOptionalChrome(withUrl(["scripts/frontend_smoke_check.mjs", "--page", "capability", "--route", "/capability-mapping"], ctx), ctx),
      ),
      command("runtime:environment", "信息化环境页 HTTP/API smoke", "node", (ctx) =>
        withOptionalChrome(withUrl(["scripts/frontend_smoke_check.mjs", "--page", "environment", "--route", "/environment-mapping"], ctx), ctx),
      ),
      command("runtime:lifecycle", "LC-AP 页面 HTTP/API smoke", "node", (ctx) =>
        withOptionalChrome(withUrl(["scripts/frontend_smoke_check.mjs", "--page", "lifecycle", "--route", "/dev-lifecycle"], ctx), ctx),
      ),
      command("runtime:standards", "标准页 HTTP/API smoke", "node", (ctx) =>
        withOptionalChrome(withUrl(["scripts/frontend_smoke_check.mjs", "--page", "standards", "--route", "/standards/dsp-level-2"], ctx), ctx),
      ),
      command("runtime:maturity", "成熟度评估工作台 HTTP/API smoke", "node", (ctx) =>
        withOptionalChrome(withUrl(["scripts/frontend_smoke_check.mjs", "--page", "maturity", "--route", "/workbench/maturity"], ctx), ctx),
      ),
    ],
  },
  mcp: {
    description: "本地 MCP 合同、控制面、Sidecar 与优雅退出验证",
    commands: [
      command("mcp:core", "MCP Core 与只读数据边界", ".venv-local-mcp-web/bin/python", [
        "-m", "unittest", "discover", "-s", "tests/mcp", "-p", "test_*.py",
      ], { env: { PYTHONPATH: "src" } }),
      command("mcp:policy", "MCP 策略签名", ".venv-local-mcp-web/bin/python", [
        "-m", "unittest", "discover", "-s", "tests/mcp_policy_signature", "-p", "test_*.py",
      ], { env: { PYTHONPATH: "src" } }),
      command("mcp:certificate", "MCP 稳定证书与模拟 CurrentUser 信任", ".venv-local-mcp-web/bin/python", [
        "-m", "unittest", "discover", "-s", "tests/mcp_certificate", "-p", "test_*.py",
      ], { env: { PYTHONPATH: "src" } }),
      command("mcp:control", "MCP Web 控制 API", ".venv-local-mcp-web/bin/python", [
        "-m", "unittest", "discover", "-s", "tests/mcp_control", "-p", "test_*.py",
      ], { env: { PYTHONPATH: "src" } }),
      command("mcp:integration", "MCP Web 隔离与 5173 门禁", ".venv-local-mcp-web/bin/python", [
        "-m", "unittest", "discover", "-s", "tests/mcp_integration", "-p", "test_*.py",
      ], { env: { PYTHONPATH: "src" } }),
      command("mcp:sidecar", "MCP HTTPS / OAuth / TLS Sidecar", ".venv-local-mcp-web/bin/python", [
        "-m", "unittest", "discover", "-s", "tests/mcp_sidecar", "-p", "test_*.py",
      ], { env: { PYTHONPATH: "src" } }),
      command("mcp:e2e", "MCP 真实 loopback HTTPS/OAuth/五项 Tool 闭环", ".venv-local-mcp-web/bin/python", [
        "-m", "unittest", "discover", "-s", "tests/mcp_e2e", "-p", "test_*.py",
      ], { env: { PYTHONPATH: "src" } }),
      command("mcp:frontend-system-settings", "系统设置与 AI 集成前端契约", "node", [
        "scripts/audit_frontend_system_settings_contract.mjs",
      ]),
    ],
  },
  user: {
    description: "用户库、批注、数据篮和导出最小闭环",
    commands: [
      command("user:db-governance", "用户库治理契约审计", "node", ["scripts/audit_user_db_governance_contract.mjs"]),
      command("user:annotation", "用户批注全局锚点契约审计", "node", ["scripts/audit_user_annotation_contract.mjs"]),
      command("user:notes-integrity", "用户批注完整性审计", "node", ["scripts/audit_user_notes_integrity.mjs"]),
      command("user:db-migration-smoke", "用户库 / stable key 迁移临时库 smoke", "node", ["scripts/smoke_db_migration_contracts.mjs"]),
      command("user:data-basket-smoke", "用户数据篮和导出 API 临时 Runtime smoke", "node", ["scripts/smoke_user_data_basket_api.mjs"]),
      command("user:local-directory-contract", "用户本地目录与分类导出契约审计", ".venv-local-mcp-web/bin/python", ["-m", "scripts.audit_local_file_directory_contract"], {
        env: { PYTHONPATH: "src" },
      }),
    ],
  },
  delivery: {
    description: "打包前交付契约检查，不构建 DMG",
    commands: [
      command("delivery:dmg-browser-parity", "DMG 与 5173 一致性契约审计", "node", ["scripts/audit_mac_dmg_browser_parity_contract.mjs"]),
      command("delivery:local-directory-contract", "App 本地 import / export / Runtime 目录契约审计", ".venv-local-mcp-web/bin/python", ["-m", "scripts.audit_local_file_directory_contract"], {
        env: { PYTHONPATH: "src" },
      }),
      command("delivery:runtime-py", "打包 Runtime helper Python 语法检查", "python3", [
        "-m",
        "py_compile",
        "scripts/run_local_server.py",
        "scripts/check_bundle_runtime.py",
        "scripts/create_user_db.py",
        "scripts/export_diagnostics.py",
        "scripts/package_backend_pyinstaller.py",
      ]),
    ],
  },
  "dmg-build": {
    description: "真实 macOS DMG 构建；必须显式传 --include-dmg-build",
    commands: [
      command("dmg-build:package", "强制重建 backend 并生成 license / no-license 双 DMG", "apps/macos/SAPDWiki/script/package_dmg.sh", [], {
        env: { SAPD_WIKI_REBUILD_BACKEND: "1" },
        requires: "--include-dmg-build",
      }),
    ],
  },
};

const groups = {
  quick: ["static", "boundaries", "delivery"],
  "pre-commit": ["static", "boundaries", "data", "frontend", "delivery"],
  "pre-dmg": ["static", "boundaries", "data", "frontend", "runtime", "user", "delivery"],
  full: ["static", "boundaries", "data", "frontend", "runtime", "user", "delivery"],
  "release-full": ["static", "boundaries", "data", "frontend", "runtime", "user", "delivery", "dmg-build"],
};

function usage() {
  console.log(`SAPD Wiki project test suite

Usage:
  node scripts/run_project_test_suite.mjs --list
  node scripts/run_project_test_suite.mjs --suite quick
  node scripts/run_project_test_suite.mjs --suite frontend --suite runtime --url http://127.0.0.1:5173
  node scripts/run_project_test_suite.mjs --full
  node scripts/run_project_test_suite.mjs --suite release-full --include-dmg-build

Flags:
  --suite <name[,name]>       Suite or group to run. Default: quick.
  --full                      Alias for --suite full.
  --url <url>                 Runtime smoke base URL. Default: ${DEFAULT_URL}
  --allow-system-chrome       Pass through to frontend_smoke_check. Default is disabled.
  --include-dmg-build         Allow real DMG build commands.
  --dry-run                   Print commands without running.
  --list                      List suites and groups.
`);
}

function listSuites() {
  console.log("groups:");
  for (const [name, members] of Object.entries(groups)) {
    console.log(`  ${name}: ${members.join(", ")}`);
  }
  console.log("suites:");
  for (const [name, suite] of Object.entries(suites)) {
    console.log(`  ${name}: ${suite.description}`);
  }
}

function expandSelection(names) {
  const expanded = [];
  const seen = new Set();
  function addName(name) {
    if (groups[name]) {
      for (const member of groups[name]) addName(member);
      return;
    }
    if (!suites[name]) {
      throw new Error(`Unknown suite or group: ${name}`);
    }
    if (!seen.has(name)) {
      seen.add(name);
      expanded.push(name);
    }
  }
  for (const name of names) addName(name);
  return expanded;
}

function argsFor(entry, ctx) {
  return typeof entry.args === "function" ? entry.args(ctx) : entry.args;
}

function printable(entry, ctx) {
  const args = argsFor(entry, ctx);
  const prefix = entry.env ? Object.entries(entry.env).map(([key, value]) => `${key}=${value}`).join(" ") + " " : "";
  return `${prefix}${entry.bin}${args.length ? ` ${args.map((arg) => (String(arg).includes(" ") ? JSON.stringify(arg) : arg)).join(" ")}` : ""}`;
}

function run(entry, ctx) {
  return new Promise((resolve, reject) => {
    if (entry.requires && !ctx.includeDmgBuild) {
      reject(new Error(`${entry.id} requires ${entry.requires}`));
      return;
    }
    const args = argsFor(entry, ctx);
    const child = spawn(entry.bin, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...(entry.env || {}) },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${entry.id} failed with ${signal || code}`));
    });
  });
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }
  if (hasFlag("--list")) {
    listSuites();
    return;
  }

  const ctx = {
    url: argValue("--url", DEFAULT_URL),
    allowSystemChrome: hasFlag("--allow-system-chrome"),
    includeDmgBuild: hasFlag("--include-dmg-build"),
    dryRun: hasFlag("--dry-run"),
  };
  const requested = hasFlag("--full") ? ["full"] : argValues("--suite");
  const selectedSuites = expandSelection(requested.length ? requested : ["quick"]);

  console.log(`selected_suites=${selectedSuites.join(",")}`);
  for (const suiteName of selectedSuites) {
    const suite = suites[suiteName];
    console.log(`\n## suite=${suiteName} ${suite.description}`);
    for (const entry of suite.commands) {
      console.log(`command=${entry.id}`);
      console.log(`description=${entry.description}`);
      console.log(`run=${printable(entry, ctx)}`);
      if (!ctx.dryRun) {
        await run(entry, ctx);
      }
    }
  }
  console.log("\nresult=pass");
}

main().catch((error) => {
  console.error(`result=fail`);
  console.error(error.message);
  process.exit(1);
});
