const crypto = require("node:crypto");
const http = require("node:http");

const MCP_NATIVE_IPC_CHANNELS = Object.freeze({
  getRuntimeStatus: "sapd:mcp-native:get-runtime-status",
  confirmCertificate: "sapd:mcp-native:confirm-certificate",
  runtimeStatusChanged: "sapd:mcp-native:runtime-status-changed",
});

const CONTROL_CONTRACT_VERSION = "sapd-mcp-control-v1";
const RUNTIME_STATES = new Set(["idle", "starting", "ready", "stopping", "stopped", "error"]);
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const RESPONSE_BODY_LIMIT = 128 * 1024;

const SAFE_ERROR_MESSAGES = Object.freeze({
  ACTION_REJECTED: "当前状态不允许执行该证书操作，请刷新后重试。",
  API_UNAVAILABLE: "本地 MCP 控制服务不可用，请检查桌面客户端运行状态。",
  INVALID_CONFIRMATION_ID: "证书确认标识无效或已经过期。",
  INVALID_STATE_VERSION: "MCP 状态版本无效，请刷新后重试。",
  MCP_NATIVE_UNAVAILABLE: "Windows 桌面 MCP 控制桥尚未就绪。",
  REQUEST_TIMEOUT: "等待本机 MCP 控制服务响应超时。",
  RESPONSE_POLICY_VIOLATION: "本机 MCP 控制服务返回了不安全的响应。",
  STATE_VERSION_CONFLICT: "MCP 状态已经更新，请刷新后重试。",
  USER_CANCELLED: "已取消 Windows 本机证书操作。",
});

class McpNativeError extends Error {
  constructor(code) {
    super(SAFE_ERROR_MESSAGES[code] || "本机 MCP 控制操作未完成。");
    this.name = "McpNativeError";
    this.code = code;
  }
}

function closedObject(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new McpNativeError(code);
  }
  const supplied = Object.keys(value).sort();
  const allowed = [...keys].sort();
  if (supplied.length !== allowed.length || supplied.some((key, index) => key !== allowed[index])) {
    throw new McpNativeError(code);
  }
  return value;
}

function stateVersion(value) {
  if (!Number.isInteger(value) || value < 0) {
    throw new McpNativeError("INVALID_STATE_VERSION");
  }
  return value;
}

function normalizedBaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    throw new McpNativeError("MCP_NATIVE_UNAVAILABLE");
  }
  if (
    parsed.protocol !== "http:"
    || parsed.hostname !== "127.0.0.1"
    || !parsed.port
    || parsed.username
    || parsed.password
    || (parsed.pathname !== "/" && parsed.pathname !== "")
    || parsed.search
    || parsed.hash
  ) {
    throw new McpNativeError("MCP_NATIVE_UNAVAILABLE");
  }
  return `http://127.0.0.1:${parsed.port}`;
}

function assertTrustedRenderer(senderUrl, isMainFrame, baseUrl) {
  if (!isMainFrame) throw new McpNativeError("MCP_NATIVE_UNAVAILABLE");
  let sender;
  try {
    sender = new URL(String(senderUrl || ""));
  } catch {
    throw new McpNativeError("MCP_NATIVE_UNAVAILABLE");
  }
  const expected = normalizedBaseUrl(baseUrl);
  if (sender.origin !== expected || sender.username || sender.password) {
    throw new McpNativeError("MCP_NATIVE_UNAVAILABLE");
  }
}

function requestLocalJson({
  baseUrl,
  method,
  pathname,
  headers = {},
  body = null,
  timeoutMs = 5_000,
}) {
  const origin = normalizedBaseUrl(baseUrl);
  if (!["GET", "POST"].includes(method) || !pathname.startsWith("/api/v1/")) {
    return Promise.reject(new McpNativeError("API_UNAVAILABLE"));
  }
  const encoded = body === null ? null : Buffer.from(JSON.stringify(body), "utf8");
  if (encoded && encoded.length > 8_192) {
    return Promise.reject(new McpNativeError("API_UNAVAILABLE"));
  }
  return new Promise((resolve, reject) => {
    const request = http.request(`${origin}${pathname}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(encoded ? {
          "Content-Type": "application/json",
          "Content-Length": String(encoded.length),
        } : {}),
        ...headers,
      },
    }, (response) => {
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > RESPONSE_BODY_LIMIT) {
          response.destroy(new McpNativeError("RESPONSE_POLICY_VIOLATION"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        let payload;
        try {
          payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          reject(new McpNativeError("RESPONSE_POLICY_VIOLATION"));
          return;
        }
        if ((response.statusCode || 500) >= 400) {
          const code = String(payload?.error?.code || "API_UNAVAILABLE");
          reject(new McpNativeError(Object.hasOwn(SAFE_ERROR_MESSAGES, code) ? code : "API_UNAVAILABLE"));
          return;
        }
        resolve(payload);
      });
    });
    request.setTimeout(timeoutMs, () => request.destroy(new McpNativeError("REQUEST_TIMEOUT")));
    request.on("error", (error) => {
      reject(error instanceof McpNativeError ? error : new McpNativeError("API_UNAVAILABLE"));
    });
    if (encoded) request.write(encoded);
    request.end();
  });
}

function stringField(value, maximum = 128) {
  const result = String(value || "");
  if (!result || result.length > maximum) throw new McpNativeError("RESPONSE_POLICY_VIOLATION");
  return result;
}

function commonProjection(payload) {
  if (!payload || payload.contract_version !== CONTROL_CONTRACT_VERSION) {
    throw new McpNativeError("RESPONSE_POLICY_VIOLATION");
  }
  return {
    contract_version: CONTROL_CONTRACT_VERSION,
    action: stringField(payload.action),
    request_id: stringField(payload.request_id),
    state_version: stateVersion(payload.state_version),
    result: stringField(payload.result, 32),
    changed: Boolean(payload.changed),
  };
}

function projectConfirmResponse(payload) {
  const projected = commonProjection(payload);
  if (payload.operation_id !== undefined) {
    if (!OPAQUE_ID.test(String(payload.operation_id || ""))) {
      throw new McpNativeError("RESPONSE_POLICY_VIOLATION");
    }
    projected.operation_id = payload.operation_id;
  }
  return projected;
}

function sanitizeRuntimeStatus(value = {}) {
  const state = RUNTIME_STATES.has(value.state) ? value.state : "error";
  const code = /^[A-Z][A-Z0-9_]{2,63}$/.test(String(value.code || ""))
    ? String(value.code)
    : "";
  const messages = {
    idle: "Windows 本机 MCP 运行环境尚未启动。",
    starting: "正在启动 Windows 本机 MCP 运行环境…",
    ready: "Windows 本机 MCP 运行环境已就绪。",
    stopping: "正在停止 Windows 本机 MCP 运行环境…",
    stopped: "Windows 本机 MCP 运行环境已停止。",
    error: "Windows 本机 MCP 运行环境发生错误，请查看桌面客户端日志。",
  };
  return Object.freeze({
    available: state === "ready",
    platform: "win32",
    state,
    code,
    message: messages[state],
  });
}

function createMcpNativeController({
  getBaseUrl,
  getRuntimeStatus,
  getNativeCapability,
  confirmNativeAction,
  request = requestLocalJson,
  randomUUID = crypto.randomUUID,
}) {
  if (
    typeof getBaseUrl !== "function"
    || typeof getRuntimeStatus !== "function"
    || typeof getNativeCapability !== "function"
    || typeof confirmNativeAction !== "function"
  ) {
    throw new TypeError("MCP native controller requires runtime accessors");
  }
  async function sessionContext() {
    const baseUrl = normalizedBaseUrl(getBaseUrl());
    const health = await request({
      baseUrl,
      method: "GET",
      pathname: "/api/v1/health",
      timeoutMs: 3_000,
    });
    const sessionToken = String(health?.data?.auth?.session_token || "").trim();
    if (!sessionToken || sessionToken.length > 256) {
      throw new McpNativeError("MCP_NATIVE_UNAVAILABLE");
    }
    return { baseUrl, sessionToken };
  }

  async function mutate(pathname, body, projector, timeoutMs, nativeConfirmation = false) {
    const { baseUrl, sessionToken } = await sessionContext();
    const headers = {
      Origin: baseUrl,
      "X-SAPD-Session-Token": sessionToken,
    };
    if (nativeConfirmation) {
      const capability = String(getNativeCapability() || "");
      if (!/^[A-Za-z0-9_-]{32,128}$/.test(capability)) {
        throw new McpNativeError("MCP_NATIVE_UNAVAILABLE");
      }
      headers["X-SAPD-Native-Confirmation"] = capability;
    }
    const payload = await request({
      baseUrl,
      method: "POST",
      pathname,
      headers,
      body: {
        request_id: `mcp:electron:${randomUUID()}`,
        ...body,
      },
      timeoutMs,
    });
    return projector(payload);
  }

  return Object.freeze({
    getRuntimeStatus: () => sanitizeRuntimeStatus(getRuntimeStatus()),
    assertTrustedRenderer: (senderUrl, isMainFrame) =>
      assertTrustedRenderer(senderUrl, isMainFrame, getBaseUrl()),
    async confirmCertificate(payload) {
      const source = closedObject(
        payload,
        ["confirmationId", "expectedStateVersion"],
        "INVALID_CONFIRMATION_ID",
      );
      if (!OPAQUE_ID.test(String(source.confirmationId || ""))) {
        throw new McpNativeError("INVALID_CONFIRMATION_ID");
      }
      const confirmationContext = Object.freeze({
        confirmation_id: source.confirmationId,
      });
      if (!await confirmNativeAction(confirmationContext)) {
        throw new McpNativeError("USER_CANCELLED");
      }
      return mutate(
        "/api/v1/mcp/certificate/actions/confirm",
        {
          confirmation_id: source.confirmationId,
          expected_state_version: stateVersion(source.expectedStateVersion),
        },
        projectConfirmResponse,
        150_000,
        true,
      );
    },
  });
}

module.exports = {
  MCP_NATIVE_IPC_CHANNELS,
  McpNativeError,
  createMcpNativeController,
  normalizedBaseUrl,
  projectConfirmResponse,
  sanitizeRuntimeStatus,
};
