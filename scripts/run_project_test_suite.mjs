#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_URL = "http://127.0.0.1:5173";
let activeChild = null;
let shutdownSignal = "";
let shutdownEscalationTimer = null;
let shutdownProcessGroupId = 0;

function signalPosixProcessGroup(processGroupId, signal) {
  if (process.platform === "win32" || !processGroupId) return false;
  try {
    process.kill(-processGroupId, signal);
    return true;
  } catch (error) {
    if (error?.code === "ESRCH") return true;
    return false;
  }
}

function posixProcessGroupExists(processGroupId) {
  if (process.platform === "win32" || !processGroupId) return false;
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    return error?.code !== "ESRCH";
  }
}

function waitForPosixProcessGroupExit(processGroupId, timeoutMs) {
  if (!posixProcessGroupExists(processGroupId)) return Promise.resolve(true);
  return new Promise((resolve) => {
    const started = Date.now();
    const poll = () => {
      if (!posixProcessGroupExists(processGroupId)) {
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }
      setTimeout(poll, 25);
    };
    poll();
  });
}

async function cleanupExitedChildTree(processGroupId) {
  if (process.platform === "win32" || !posixProcessGroupExists(processGroupId)) return;
  signalPosixProcessGroup(processGroupId, "SIGTERM");
  if (await waitForPosixProcessGroupExit(processGroupId, 750)) return;
  signalPosixProcessGroup(processGroupId, "SIGKILL");
  if (!(await waitForPosixProcessGroupExit(processGroupId, 750))) {
    throw new Error(`process group ${processGroupId} survived child exit cleanup`);
  }
}

function signalChildTree(child, signal) {
  if (signalPosixProcessGroup(child?.pid || shutdownProcessGroupId, signal)) return;
  if (!child || child.exitCode != null || child.signalCode != null) return;
  child.kill(signal);
}

function clearShutdownEscalation() {
  if (!shutdownEscalationTimer) return;
  clearTimeout(shutdownEscalationTimer);
  shutdownEscalationTimer = null;
}

function forwardShutdownSignal(signal) {
  if (shutdownSignal) {
    signalChildTree(activeChild, "SIGKILL");
    clearShutdownEscalation();
    return;
  }
  shutdownSignal = signal;
  shutdownProcessGroupId = activeChild?.pid || 0;
  signalChildTree(activeChild, signal);
  shutdownEscalationTimer = setTimeout(() => {
    signalChildTree(activeChild, "SIGKILL");
    shutdownEscalationTimer = null;
  }, 3000);
}

process.on("SIGINT", () => forwardShutdownSignal("SIGINT"));
process.on("SIGTERM", () => forwardShutdownSignal("SIGTERM"));

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
        "scripts/run_python_resource_warning_gate.py",
      ]),
      command("static:test-runner", "项目测试套件编排脚本语法检查", "node", ["--check", "scripts/run_project_test_suite.mjs"]),
      command("static:document-governance", "当前权威文档入口与 Open Issue 计数一致性检查", "node", ["scripts/audit_document_governance.mjs"]),
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
      command("static:maturity-p2-regressions", "成熟度 P2 回归门禁脚本语法检查", "node", ["--check", "scripts/audit_maturity_p2_regressions.mjs"]),
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
      command("data:multi-source-reference", "来源证据归属与完整证据键去重回归", ".venv-local-mcp-web/bin/python", [
        "-m", "unittest", "tests.test_multi_source_reference_ownership",
      ], { env: { PYTHONPATH: "src" } }),
      command("data:database-resource-safety", "数据库迁移原子性与连接初始化资源回归", ".venv-local-mcp-web/bin/python", [
        "scripts/run_python_resource_warning_gate.py",
        "tests.test_db_migrations",
        "tests.test_connection_setup_safety",
      ], { env: { PYTHONPATH: "src" } }),
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
      command("frontend:maturity-v2.1", "成熟度评估 V2.1 企业项目、固定模板、目标聚合与文件交换审计", ".venv-local-mcp-web/bin/python", ["scripts/audit_maturity_assessment_v2_1_contract.py"]),
      command("frontend:maturity-p2-regressions", "成熟度持久化、首页滚动与删除弹窗焦点回归", "node", ["scripts/audit_maturity_p2_regressions.mjs"]),
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
        "scripts/build_zip_bundle.py",
        "scripts/prepare_windows_electron_runtime.py",
        "scripts/verify_windows_runtime.py",
        "scripts/windows_delivery_data.py",
        "scripts/verify_mac_dmg_artifacts.py",
      ]),
      command("delivery:mac-shell-syntax", "macOS 构建与 DMG 脚本语法检查", "bash", [
        "-n",
        "apps/macos/SAPDWiki/script/build_and_run.sh",
        "apps/macos/SAPDWiki/script/package_dmg.sh",
      ]),
      command("delivery:windows-contracts", "Windows Runtime、交付数据与安装器合同测试", "python3", [
        "-m", "unittest",
        "tests.test_prepare_windows_electron_runtime",
        "tests.test_verify_windows_runtime",
        "tests.test_windows_delivery_data",
        "tests.test_verify_windows_installer_contract",
      ]),
      command("delivery:user-state-regressions", "报告 manifest、隔离用户态与 Issue 导出鉴权回归", ".venv-local-mcp-web/bin/python", [
        "-m", "unittest",
        "tests.mcp_integration.test_ephemeral_web_user_state",
        "tests.mcp_integration.test_user_notes_export_security",
      ], { env: { PYTHONPATH: "src" } }),
      command("delivery:bundle-artifact-regressions", "离线前端包边界与 macOS 产物验收行为回归", "python3", [
        "-m", "unittest",
        "tests.test_content_offline_bundle_t5",
        "tests.test_delivery_release_control",
        "tests.test_verify_mac_dmg_artifacts",
      ], { env: { PYTHONPATH: "scripts" } }),
    ],
  },
  "core-regressions": {
    description: "内容候选、内容发布、导入审批与 Electron 壳层回归",
    commands: [
      command("core-regressions:content-import", "内容候选、内容发布与导入审批生命周期回归", ".venv-local-mcp-web/bin/python", [
        "scripts/run_python_resource_warning_gate.py",
        "tests.test_content_candidate_t1",
        "tests.test_content_release_pipeline",
        "tests.test_import_approval_lifecycle",
      ], { env: { PYTHONPATH: "src" } }),
      command("core-regressions:electron", "Electron 桌面壳层 Node 回归", "npm", ["--prefix", "apps/electron", "test"]),
    ],
  },
  "dmg-build": {
    description: "真实 macOS DMG 构建；必须显式传 --include-dmg-build",
    commands: [
      command("dmg-build:package", "强制重建 backend 并生成 license / no-license 双 DMG", "apps/macos/SAPDWiki/script/package_dmg.sh", [], {
        env: (ctx) => ({
          SAPD_WIKI_REBUILD_BACKEND: "1",
          SAPD_WIKI_ALLOW_EXTERNAL_BACKEND: "0",
          SAPD_WIKI_DMG_VARIANT: "all",
          SAPD_WIKI_BUILD_STAMP: ctx.releaseBuildStamp,
        }),
        requires: "--include-dmg-build",
      }),
    ],
  },
  "artifact-validation": {
    description: "真实 DMG 构建后的产物完整性与当前源码一致性验收",
    commands: [
      command("artifact-validation:dmg", "双变体 DMG 文件、版本、Runtime 与镜像校验", "python3", ["scripts/verify_mac_dmg_artifacts.py"], {
        env: (ctx) => ({ SAPD_WIKI_BUILD_STAMP: ctx.releaseBuildStamp }),
        requires: "--include-dmg-build",
      }),
      command("artifact-validation:current-source", "双变体 staging 必须存在且前端等于当前源码", "node", ["scripts/audit_mac_dmg_browser_parity_contract.mjs", "--strict-current-source"], {
        requires: "--include-dmg-build",
      }),
    ],
  },
};

const groups = {
  quick: ["static", "boundaries", "delivery"],
  "pre-commit": ["static", "boundaries", "data", "frontend", "delivery"],
  "pre-dmg": ["static", "boundaries", "data", "frontend", "runtime", "user", "delivery"],
  full: ["static", "boundaries", "data", "frontend", "runtime", "mcp", "user", "delivery", "core-regressions"],
  "release-full": ["static", "boundaries", "data", "frontend", "runtime", "mcp", "user", "delivery", "core-regressions", "dmg-build", "artifact-validation"],
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
  --build-stamp <stamp>       Reuse an existing YYYYMMDD-HHMMSSZ release build stamp.
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

function envFor(entry, ctx) {
  return typeof entry.env === "function" ? entry.env(ctx) : (entry.env || {});
}

function printable(entry, ctx) {
  const args = argsFor(entry, ctx);
  const environment = envFor(entry, ctx);
  const prefix = Object.keys(environment).length ? Object.entries(environment).map(([key, value]) => `${key}=${value}`).join(" ") + " " : "";
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
      env: { ...process.env, ...envFor(entry, ctx) },
      stdio: "inherit",
      detached: process.platform !== "win32",
    });
    const processGroupId = process.platform === "win32" ? 0 : child.pid || 0;
    let settled = false;
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      callback();
    };
    activeChild = child;
    if (shutdownSignal) {
      shutdownProcessGroupId = child.pid || 0;
      signalChildTree(child, shutdownSignal);
    }
    child.on("error", (error) => {
      if (activeChild === child) {
        activeChild = null;
        if (!shutdownSignal || !posixProcessGroupExists(shutdownProcessGroupId)) clearShutdownEscalation();
      }
      settle(() => reject(error));
    });
    child.on("exit", async (code, signal) => {
      if (activeChild === child) {
        activeChild = null;
        if (!shutdownSignal || !posixProcessGroupExists(shutdownProcessGroupId)) clearShutdownEscalation();
      }
      try {
        await cleanupExitedChildTree(processGroupId);
      } catch (error) {
        settle(() => reject(error));
        return;
      }
      if (shutdownSignal && !posixProcessGroupExists(shutdownProcessGroupId)) clearShutdownEscalation();
      if (code === 0) settle(resolve);
      else settle(() => reject(new Error(`${entry.id} failed with ${signal || code}`)));
    });
  });
}

export { run as runCommand };

function releaseBuildStampFor(selectedSuites) {
  const supplied = argValue("--build-stamp", String(process.env.SAPD_WIKI_BUILD_STAMP || "").trim());
  if (supplied && !/^\d{8}-\d{6}Z$/.test(supplied)) {
    throw new Error("--build-stamp / SAPD_WIKI_BUILD_STAMP must use YYYYMMDD-HHMMSSZ");
  }
  if (supplied) return supplied;
  const includesBuild = selectedSuites.includes("dmg-build");
  if (selectedSuites.includes("artifact-validation") && !includesBuild) {
    throw new Error("standalone artifact-validation requires --build-stamp or SAPD_WIKI_BUILD_STAMP from the completed build");
  }
  return new Date().toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z").replace("T", "-");
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

  const requested = hasFlag("--full") ? ["full"] : argValues("--suite");
  const selectedSuites = expandSelection(requested.length ? requested : ["quick"]);
  const ctx = {
    url: argValue("--url", DEFAULT_URL),
    allowSystemChrome: hasFlag("--allow-system-chrome"),
    includeDmgBuild: hasFlag("--include-dmg-build"),
    dryRun: hasFlag("--dry-run"),
    releaseBuildStamp: releaseBuildStampFor(selectedSuites),
  };

  console.log(`selected_suites=${selectedSuites.join(",")}`);
  let plannedCount = 0;
  for (const suiteName of selectedSuites) {
    const suite = suites[suiteName];
    console.log(`\n## suite=${suiteName} ${suite.description}`);
    for (const entry of suite.commands) {
      plannedCount += 1;
      console.log(`command=${entry.id}`);
      console.log(`description=${entry.description}`);
      console.log(`run=${printable(entry, ctx)}`);
      if (!ctx.dryRun) {
        await run(entry, ctx);
        if (shutdownSignal) throw new Error(`interrupted by ${shutdownSignal}`);
      }
    }
  }
  console.log(ctx.dryRun ? `\nresult=dry-run planned=${plannedCount} executed=0` : `\nresult=pass executed=${plannedCount}`);
}

function handleMainError(error) {
  if (shutdownSignal) {
    console.error(`result=interrupted signal=${shutdownSignal}`);
    process.exitCode = shutdownSignal === "SIGINT" ? 130 : 143;
    return;
  }
  console.error(`result=fail`);
  console.error(error.message);
  process.exitCode = 1;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  main().catch(handleMainError);
}
