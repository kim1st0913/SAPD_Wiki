const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  McpNativeError,
  createMcpNativeController,
  normalizedBaseUrl,
  projectConfirmResponse,
  sanitizeRuntimeStatus,
} = require("../mcp-native.cjs");

const BASE_URL = "http://127.0.0.1:51888";
const SESSION = "native-main-only-session-token";

test("accepts only an exact HTTP 127.0.0.1 backend origin", () => {
  assert.equal(normalizedBaseUrl(`${BASE_URL}/`), BASE_URL);
  for (const value of [
    "https://127.0.0.1:51888",
    "http://localhost:51888",
    "http://127.0.0.1:51888/path",
    "http://user@127.0.0.1:51888",
  ]) {
    assert.throws(() => normalizedBaseUrl(value), McpNativeError);
  }
});

test("native controller keeps session and capability in main for confirm only", async () => {
  const calls = [];
  const confirmations = [];
  const request = async (options) => {
    calls.push(options);
    if (options.pathname === "/api/v1/health") {
      return {
        data: {
          status: "ok",
          auth: { session_token: SESSION },
        },
      };
    }
    return {
      contract_version: "sapd-mcp-control-v1",
      action: "certificate_provision",
      request_id: "mcp:electron:12345678",
      state_version: 9,
      result: "accepted",
      changed: true,
      operation_id: "operation:12345678",
    };
  };
  const controller = createMcpNativeController({
    getBaseUrl: () => BASE_URL,
    getRuntimeStatus: () => ({ state: "ready" }),
    getNativeCapability: () => "native-confirmation-capability-123456",
    confirmNativeAction: async (preview) => {
      confirmations.push(preview);
      return true;
    },
    request,
    randomUUID: () => "00000000-0000-4000-8000-000000000001",
  });

  controller.assertTrustedRenderer(`${BASE_URL}/settings/ai-integration`, true);
  await controller.confirmCertificate({
    confirmationId: "certificate:confirmation-123456",
    expectedStateVersion: 8,
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers["X-SAPD-Session-Token"], SESSION);
  assert.equal(calls[1].headers.Origin, BASE_URL);
  assert.equal(
    calls[1].headers["X-SAPD-Native-Confirmation"],
    "native-confirmation-capability-123456",
  );
  assert.equal(confirmations.length, 1);
  assert.equal(confirmations[0].confirmation_id, "certificate:confirmation-123456");
  assert.deepEqual(calls[1].body, {
    request_id: "mcp:electron:00000000-0000-4000-8000-000000000001",
    confirmation_id: "certificate:confirmation-123456",
    expected_state_version: 8,
  });
  assert.doesNotMatch(JSON.stringify(calls[1].body), /capability|token|secret/i);
});

test("renderer cannot choose a URL, header, request id, or malformed confirmation", async () => {
  const controller = createMcpNativeController({
    getBaseUrl: () => BASE_URL,
    getRuntimeStatus: () => ({ state: "ready" }),
    getNativeCapability: () => "",
    confirmNativeAction: async () => false,
    request: async () => {
      throw new Error("request must not run");
    },
  });
  await assert.rejects(
    controller.confirmCertificate({
      confirmationId: "certificate:confirmation-123456",
      expectedStateVersion: 7,
      url: "http://example.invalid",
    }),
    (error) => error.code === "INVALID_CONFIRMATION_ID",
  );
  await assert.rejects(
    controller.confirmCertificate({
      confirmationId: "../certificate.pem",
      expectedStateVersion: 7,
    }),
    (error) => error.code === "INVALID_CONFIRMATION_ID",
  );
});

test("native sender must be the exact backend main frame", () => {
  const controller = createMcpNativeController({
    getBaseUrl: () => BASE_URL,
    getRuntimeStatus: () => ({ state: "ready" }),
    getNativeCapability: () => "",
    confirmNativeAction: async () => false,
  });
  assert.throws(
    () => controller.assertTrustedRenderer(`${BASE_URL}/`, false),
    McpNativeError,
  );
  assert.throws(
    () => controller.assertTrustedRenderer("http://127.0.0.1:51889/", true),
    McpNativeError,
  );
});

test("confirm response projection drops secret-bearing open fields", () => {
  const result = projectConfirmResponse({
    contract_version: "sapd-mcp-control-v1",
    action: "certificate_provision",
    request_id: "mcp:electron:12345678",
    state_version: 9,
    result: "accepted",
    changed: true,
    operation_id: "operation:12345678",
    session_token: "must-never-cross",
    private_key: "must-never-cross",
  });
  assert.equal(result.session_token, undefined);
  assert.equal(result.private_key, undefined);
  assert.doesNotMatch(JSON.stringify(result), /must-never-cross/);
});

test("runtime status has a fixed safe schema and no raw error or path", () => {
  assert.deepEqual(sanitizeRuntimeStatus({
    state: "error",
    code: "BACKEND_EXITED",
    error: "C:\\Users\\Kim\\secret\\private-key.pem",
    logPath: "C:\\Users\\Kim\\Runtime\\logs",
  }), {
    available: false,
    platform: "win32",
    state: "error",
    code: "BACKEND_EXITED",
    message: "Windows 本机 MCP 运行环境发生错误，请查看桌面客户端日志。",
  });
});

test("preload exposes an allowlisted MCP bridge without generic send or invoke", () => {
  const preload = fs.readFileSync(path.join(__dirname, "..", "preload.cjs"), "utf8");
  assert.match(preload, /mcp:\s*Object\.freeze\(\{/);
  assert.match(preload, /getRuntimeStatus:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(MCP_NATIVE_IPC_CHANNELS\.getRuntimeStatus\)/);
  assert.match(preload, /confirmMcpCertificate:\s*\(payload\)\s*=>/);
  assert.doesNotMatch(preload, /prepareCertificateAction:\s*\(payload\)\s*=>/);
  assert.doesNotMatch(preload, /ipcRenderer\.(?:send|sendSync)\(/);
  assert.doesNotMatch(preload, /invoke:\s*ipcRenderer\.invoke|send:\s*ipcRenderer\.send/);
});

test("main sends the native capability through inherited stdin and keeps NSIS CurrentUser-only", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
  );
  assert.match(main, /stdio:\s*\["pipe", output, output\]/);
  assert.match(main, /contract:\s*"sapd-electron-bootstrap-v1"/);
  assert.match(main, /backendProcess\.stdin\.end/);
  assert.doesNotMatch(main, /SAPD_WIKI_MCP_NATIVE_CONFIRMATION_CAPABILITY/);
  assert.match(main, /dialog\.showMessageBoxSync\(mainWindow/);
  assert.match(main, /mcpNativeController\.assertTrustedRenderer/);
  assert.match(main, /Number\(state\.pid\) === processHandle\.pid/);
  assert.match(main, /health\?\.data\?\.status !== "ok"/);
  assert.match(main, /publishBackendRuntimeStatus\("ready"\)/);
  assert.equal(packageJson.build.nsis.perMachine, false);
  assert.equal(packageJson.build.nsis.allowElevation, false);
  assert.equal(packageJson.build.nsis.deleteAppDataOnUninstall, false);
});
