const { contextBridge, ipcRenderer } = require("electron");

const MCP_CHANNEL = "sapd:mcp:invoke";
const ALLOWED_MCP_ACTIONS = new Set(["get_status", "start", "stop", "retry"]);

function invokeMCP(action, parameters = {}) {
  if (!ALLOWED_MCP_ACTIONS.has(action) || Object.keys(parameters).length !== 0) {
    return Promise.reject(new Error("INVALID_PARAMETERS"));
  }
  return ipcRenderer.invoke(MCP_CHANNEL, {
    requestId: globalThis.crypto.randomUUID().replaceAll("-", ""),
    action,
    parameters: {},
  });
}

contextBridge.exposeInMainWorld("sapdDesktop", Object.freeze({
  platform: process.platform,
  isDesktop: true,
  mcp: Object.freeze({
    invoke: invokeMCP,
  }),
}));
