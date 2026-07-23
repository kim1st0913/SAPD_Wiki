const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("sapdDesktop", {
  platform: process.platform,
  isDesktop: true,
});
