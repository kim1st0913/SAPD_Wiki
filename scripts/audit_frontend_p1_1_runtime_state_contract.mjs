#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const configPath = path.join(projectRoot, "config/frontend-p1-1-runtime-state.json");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function read(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function assert(condition, message, issues) {
  if (!condition) issues.push(message);
}

function includesAll(source, values) {
  return values.every((value) => source.includes(value));
}

async function fetchText(baseUrl, relativePath) {
  const response = await fetch(new URL(relativePath, `${baseUrl.replace(/\/$/, "")}/`), { cache: "no-store" });
  if (!response.ok) throw new Error(`${relativePath} HTTP ${response.status}`);
  return response.text();
}

async function evaluateCapabilityPackage(dataClientSource, fetchImpl) {
  const context = {
    window: { location: { protocol: "file:" } },
    fetch: fetchImpl,
    URLSearchParams,
    AbortController,
    Headers,
    Blob,
    setTimeout,
    clearTimeout,
  };
  vm.runInNewContext(dataClientSource, context, { filename: "dataClient.js" });
  return context.window.sapdDataClient;
}

async function main() {
  const issues = [];
  assert(existsSync(configPath), "缺少 P1-1 运行状态配置", issues);
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  const componentSource = read("frontend/capability-browser/components/RuntimeState.js");
  const cssSource = read("frontend/capability-browser/runtime-state.css");
  const appSource = read("frontend/capability-browser/app.js");
  const dataClientSource = read("frontend/capability-browser/dataClient.js");
  const environmentSource = read("frontend/capability-browser/components/EnvironmentLocalRelationMap.js");
  const indexSource = read("frontend/capability-browser/index.html");

  const context = {
    window: {
      sapdComponents: {
        utils: {
          escapeHtml: (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
        },
      },
    },
  };
  vm.runInNewContext(componentSource, context, { filename: "RuntimeState.js" });
  const runtimeState = context.window.sapdComponents.RuntimeState;
  const expectedStates = config.states.map((item) => item.id);
  assert(runtimeState, "RuntimeState 组件未注册", issues);
  assert(expectedStates.every((item) => runtimeState?.states?.includes(item)), "RuntimeState 未覆盖五类显式状态", issues);

  const rendered = Object.fromEntries(
    config.states.map((item) => [
      item.id,
      runtimeState?.render({
        state: item.id,
        action: item.retry ? { scope: "package", key: "standards", label: "重新加载" } : null,
      }) || "",
    ]),
  );
  for (const item of config.states) {
    assert(rendered[item.id].includes(`data-runtime-state="${item.domState}"`), `${item.id} DOM 状态标识错误`, issues);
    assert(rendered[item.id].includes(item.nextAction.split("并")[0].slice(0, 2)) || rendered[item.id].includes(runtimeState.defaults[item.id].message), `${item.id} 未说明下一步`, issues);
  }
  assert(rendered.loading.includes("runtime-state__skeleton") && rendered.loading.includes('aria-busy="true"'), "loading 未使用骨架或 aria-busy", issues);
  assert(rendered.error.includes('role="alert"') && rendered.error.includes("data-runtime-state-retry"), "error 未提供可访问局部重试", issues);
  assert(rendered.missing_file.includes("data-runtime-state-retry"), "missing_file 未提供重新检查入口", issues);
  assert(!rendered.no_selection.includes("data-runtime-state-retry"), "no_selection 不应伪装成加载失败", issues);

  const resolutionCases = [
    [{ loading: true }, "loading"],
    [{ error: "failed" }, "error"],
    [{ dataState: "missing_file" }, "missing_file"],
    [{ dataState: "empty" }, "empty"],
    [{ dataState: "ready", selected: false }, "no_selection"],
    [{ dataState: "ready", hasData: true }, "ready"],
  ];
  for (const [input, expected] of resolutionCases) {
    assert(runtimeState.resolveState(input) === expected, `状态解析失败：${JSON.stringify(input)} -> ${expected}`, issues);
  }

  assert(includesAll(dataClientSource, ['response.status === 404 ? "missing_file" : "error"', '__data_state: "error"', "invalidatePackage(name)"]), "dataClient 未区分 404、请求错误与可重试缓存", issues);
  assert(dataClientSource.includes('{ ...createLegacyEnvironmentWorkbenchFallback(), __data_state: "missing_file" }'), "环境 fallback 丢失 missing_file 语义", issues);
  const missingClient = await evaluateCapabilityPackage(dataClientSource, async () => ({ ok: false, status: 404 }));
  const missingEnvelope = await missingClient.getCapabilityTree();
  assert(missingEnvelope?.data?.__data_state === "missing_file", "404 未解析为 missing_file", issues);
  let retryRequestCount = 0;
  const retryClient = await evaluateCapabilityPackage(dataClientSource, async () => {
    retryRequestCount += 1;
    if (retryRequestCount === 1) return { ok: false, status: 503 };
    return { ok: true, status: 200, json: async () => ({ data_state: "ready", categories: [{ id: "T" }] }) };
  });
  const errorEnvelope = await retryClient.getCapabilityTree();
  assert(errorEnvelope?.data?.__data_state === "error", "非 404 HTTP 失败未解析为 error", issues);
  assert(retryClient.invalidatePackage("capability") === true, "数据包缓存失效接口不可用", issues);
  const recoveredEnvelope = await retryClient.getCapabilityTree();
  assert(recoveredEnvelope?.data?.data_state === "ready" && retryRequestCount === 2, "局部重试未重新请求并恢复 ready", issues);
  assert(includesAll(appSource, ["packageLoadErrors: new Map()", "captureRuntimeContext", "restoreRuntimeContext", "retryDataPackage", "runtimeStateForPackage"]), "app 未建立共享状态与上下文保留重试", issues);
  for (const key of config.retryContextKeys) assert(appSource.includes(`"${key}"`), `重试上下文未覆盖 ${key}`, issues);
  assert(appSource.includes("state.activeRoute !== snapshot.activeRoute"), "异步重试可能覆盖用户已切换的路由", issues);
  assert(appSource.includes("selectionWasSuperseded") && appSource.includes("state[key] !== snapshot.values[key]"), "异步重试可能覆盖用户新选择的对象", issues);
  assert(includesAll(appSource, ['runtimeStateForPackage("capabilityInitial"', 'runtimeStateForPackage("environmentWorkbench"', 'renderMaintenancePackageState("standards"']), "代表页面未全部接入共享状态", issues);
  assert(includesAll(environmentSource, ['state: "empty"', 'state: "no_selection"', "components.RuntimeState?.render"]), "环境映射未区分空数据与未选择", issues);
  assert(includesAll(cssSource, [".runtime-state", '[data-runtime-state="missing-file"]', '[data-runtime-state="error"]', "prefers-reduced-motion"]), "共享状态样式或减少动态效果降级不完整", issues);
  assert(includesAll(indexSource, ["runtime-state.css?v=p1-1-runtime-state-20260714-1", "RuntimeState.js?v=p1-1-runtime-state-20260714-1", "p1-1-runtime-state-20260714-1"]), "P1-1 入口或缓存版本未更新", issues);
  assert(!includesAll(appSource, ["CapabilityGraphCollisionController", "relationGraphViewPolicy"]), "P1-1 重新引入了已回退的 P0-3", issues);

  const forbiddenFields = ["raw_value", "source_file", "import_id", "source_ref", "debug", "metadata", "generated_at"];
  for (const field of forbiddenFields) assert(!componentSource.includes(field), `共享状态组件泄露非业务字段：${field}`, issues);

  const baseUrl = argValue("--url");
  if (baseUrl) {
    try {
      const [liveIndex, liveComponent, liveCss, liveApp, liveDataClient] = await Promise.all([
        fetchText(baseUrl, "index.html"),
        fetchText(baseUrl, "components/RuntimeState.js?v=p1-1-runtime-state-20260714-1"),
        fetchText(baseUrl, "runtime-state.css?v=p1-1-runtime-state-20260714-1"),
        fetchText(baseUrl, "app.js?v=p1-1-runtime-state-20260714-1"),
        fetchText(baseUrl, "dataClient.js?v=p1-1-runtime-state-20260714-1"),
      ]);
      assert(liveIndex.includes("RuntimeState.js?v=p1-1-runtime-state-20260714-1"), "5173 index 未提供 P1-1 组件入口", issues);
      assert(liveComponent.includes("components.RuntimeState"), "5173 RuntimeState 不是最新版本", issues);
      assert(liveCss.includes("runtime-state__skeleton"), "5173 状态样式不是最新版本", issues);
      assert(liveApp.includes("retryDataPackage"), "5173 app 未提供保留上下文重试", issues);
      assert(liveDataClient.includes("invalidatePackage(name)"), "5173 dataClient 未提供缓存失效", issues);
    } catch (error) {
      issues.push(`5173 运行态核对失败：${error.message}`);
    }
  }

  console.log(`contract=${config.version}`);
  console.log(`states=${expectedStates.join(",")}`);
  console.log(`representative_routes=${config.representativeRoutes.map((item) => item.route).join(",")}`);
  if (issues.length) {
    console.error("result=fail");
    issues.forEach((issue) => console.error(`issue=${issue}`));
    process.exit(1);
  }
  console.log("result=pass");
}

main();
