"use strict";

const IPC_CHANNEL = "sapd:mcp:invoke";
const ALLOWED_ACTIONS = new Set(["get_status", "start", "stop", "retry"]);

function localOriginFromURL(value) {
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol)
      || url.hostname !== "127.0.0.1"
      || !url.port
      || url.username
      || url.password
    ) {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

function normalizeBridgeRequest(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const keys = Object.keys(payload).sort();
  if (keys.join(",") !== "action,parameters,requestId") return null;
  if (
    typeof payload.requestId !== "string"
    || !/^[A-Za-z0-9_-]{1,80}$/.test(payload.requestId)
    || !ALLOWED_ACTIONS.has(payload.action)
    || !payload.parameters
    || typeof payload.parameters !== "object"
    || Array.isArray(payload.parameters)
    || Object.keys(payload.parameters).length !== 0
  ) {
    return null;
  }
  return {
    requestId: payload.requestId,
    action: payload.action,
    parameters: {},
  };
}

function eventHasTrustedMainFrame(event, mainWindow, trustedOrigin) {
  if (!event || !mainWindow || mainWindow.isDestroyed?.()) return false;
  if (event.sender !== mainWindow.webContents) return false;
  if (event.senderFrame !== mainWindow.webContents.mainFrame) return false;
  return localOriginFromURL(event.senderFrame.url) === trustedOrigin;
}

function registerMCPIPC({
  ipcMain,
  getMainWindow,
  getTrustedOrigin,
  supervisor,
}) {
  ipcMain.removeHandler(IPC_CHANNEL);
  ipcMain.handle(IPC_CHANNEL, (event, payload) => {
    const mainWindow = getMainWindow();
    const trustedOrigin = getTrustedOrigin();
    if (!trustedOrigin || !eventHasTrustedMainFrame(event, mainWindow, trustedOrigin)) {
      return { ok: false, errorCode: "UNTRUSTED_BRIDGE_CALL" };
    }
    const request = normalizeBridgeRequest(payload);
    if (!request) {
      return { ok: false, errorCode: "INVALID_BRIDGE_REQUEST" };
    }
    return {
      requestId: request.requestId,
      ...supervisor.handleBridgeAction(request.action, request.parameters),
    };
  });
}

module.exports = {
  ALLOWED_ACTIONS,
  IPC_CHANNEL,
  eventHasTrustedMainFrame,
  localOriginFromURL,
  normalizeBridgeRequest,
  registerMCPIPC,
};
