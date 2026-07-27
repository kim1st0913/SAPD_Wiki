const { contextBridge, ipcRenderer } = require("electron");

const SETTINGS_IPC_CHANNELS = Object.freeze({
  get: "sapd:settings:get",
  chooseDataRoot: "sapd:settings:choose-data-root",
  chooseImportDirectory: "sapd:settings:choose-import-directory",
  chooseDownloadDirectory: "sapd:settings:choose-download-directory",
});

const MCP_NATIVE_IPC_CHANNELS = Object.freeze({
  getRuntimeStatus: "sapd:mcp-native:get-runtime-status",
  confirmCertificate: "sapd:mcp-native:confirm-certificate",
  runtimeStatusChanged: "sapd:mcp-native:runtime-status-changed",
});

contextBridge.exposeInMainWorld("sapdDesktop", {
  platform: process.platform,
  isDesktop: true,
  getSettings: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.get),
  chooseDataRoot: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.chooseDataRoot),
  chooseImportDirectory: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.chooseImportDirectory),
  chooseDownloadDirectory: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.chooseDownloadDirectory),
  confirmMcpCertificate: (payload) =>
    ipcRenderer.invoke(MCP_NATIVE_IPC_CHANNELS.confirmCertificate, payload),
  mcp: Object.freeze({
    getRuntimeStatus: () => ipcRenderer.invoke(MCP_NATIVE_IPC_CHANNELS.getRuntimeStatus),
    onRuntimeStatus: (callback) => {
      if (typeof callback !== "function") {
        throw new TypeError("MCP runtime status callback must be a function");
      }
      const listener = (_event, status) => callback(status);
      ipcRenderer.on(MCP_NATIVE_IPC_CHANNELS.runtimeStatusChanged, listener);
      return () => {
        ipcRenderer.removeListener(MCP_NATIVE_IPC_CHANNELS.runtimeStatusChanged, listener);
      };
    },
  }),
});
