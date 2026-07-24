const { contextBridge, ipcRenderer } = require("electron");

const SETTINGS_IPC_CHANNELS = Object.freeze({
  get: "sapd:settings:get",
  chooseDataRoot: "sapd:settings:choose-data-root",
  chooseImportDirectory: "sapd:settings:choose-import-directory",
  chooseDownloadDirectory: "sapd:settings:choose-download-directory",
});

contextBridge.exposeInMainWorld("sapdDesktop", {
  platform: process.platform,
  isDesktop: true,
  getSettings: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.get),
  chooseDataRoot: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.chooseDataRoot),
  chooseImportDirectory: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.chooseImportDirectory),
  chooseDownloadDirectory: () => ipcRenderer.invoke(SETTINGS_IPC_CHANNELS.chooseDownloadDirectory),
});
