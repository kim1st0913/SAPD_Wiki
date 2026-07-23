"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  IPC_CHANNEL,
  eventHasTrustedMainFrame,
  localOriginFromURL,
  normalizeBridgeRequest,
  registerMCPIPC,
} = require("../mcp/ipc-bridge.cjs");
const { sanitizeSettings } = require("../settings.cjs");

test("bridge accepts only an exact local origin with an explicit port", () => {
  assert.equal(localOriginFromURL("http://127.0.0.1:5173/settings"), "http://127.0.0.1:5173");
  assert.equal(localOriginFromURL("http://localhost:5173/settings"), null);
  assert.equal(localOriginFromURL("http://127.0.0.1/settings"), null);
  assert.equal(localOriginFromURL("https://example.com:5173/settings"), null);
  assert.equal(localOriginFromURL("http://user@127.0.0.1:5173/settings"), null);
});

test("bridge request uses an allowlist and closed parameter schema", () => {
  assert.deepEqual(normalizeBridgeRequest({
    requestId: "fixture",
    action: "get_status",
    parameters: {},
  }), {
    requestId: "fixture",
    action: "get_status",
    parameters: {},
  });
  assert.equal(normalizeBridgeRequest({
    requestId: "fixture",
    action: "start",
    parameters: { path: "C:\\sidecar.exe" },
  }), null);
  assert.equal(normalizeBridgeRequest({
    requestId: "fixture",
    action: "start",
    parameters: {},
    command: "arbitrary",
  }), null);
});

test("bridge requires the exact main frame and webContents identity", () => {
  const mainFrame = { url: "http://127.0.0.1:5173/settings" };
  const webContents = { mainFrame };
  const mainWindow = { webContents, isDestroyed: () => false };

  assert.equal(eventHasTrustedMainFrame({
    sender: webContents,
    senderFrame: mainFrame,
  }, mainWindow, "http://127.0.0.1:5173"), true);
  assert.equal(eventHasTrustedMainFrame({
    sender: webContents,
    senderFrame: { url: mainFrame.url },
  }, mainWindow, "http://127.0.0.1:5173"), false);
});

test("registered IPC rejects untrusted callers and exposes no process identity", async () => {
  let handler;
  const ipcMain = {
    removeHandler: () => {},
    handle: (channel, nextHandler) => {
      assert.equal(channel, IPC_CHANNEL);
      handler = nextHandler;
    },
  };
  const mainFrame = { url: "http://127.0.0.1:5173/settings" };
  const webContents = { mainFrame };
  const mainWindow = { webContents, isDestroyed: () => false };
  const supervisor = {
    handleBridgeAction: () => ({
      ok: true,
      errorCode: null,
      status: {
        serviceState: "ready",
        configuredPort: 18_775,
      },
    }),
  };
  registerMCPIPC({
    ipcMain,
    getMainWindow: () => mainWindow,
    getTrustedOrigin: () => "http://127.0.0.1:5173",
    supervisor,
  });

  const untrusted = await handler({
    sender: webContents,
    senderFrame: { url: "http://127.0.0.1:5173/settings" },
  }, {
    requestId: "fixture",
    action: "get_status",
    parameters: {},
  });
  assert.deepEqual(untrusted, { ok: false, errorCode: "UNTRUSTED_BRIDGE_CALL" });

  const trusted = await handler({
    sender: webContents,
    senderFrame: mainFrame,
  }, {
    requestId: "fixture",
    action: "get_status",
    parameters: {},
  });
  assert.equal(trusted.ok, true);
  assert.equal(JSON.stringify(trusted).includes("pid"), false);
  assert.equal(JSON.stringify(trusted).includes("path"), false);
  assert.equal(JSON.stringify(trusted).includes("token"), false);
});

test("settings serialization whitelist removes secrets and unknown fields", () => {
  assert.deepEqual(sanitizeSettings({
    dataRoot: "D:\\SAPDWiki",
    importDirectory: "D:\\SAPDWiki\\import",
    downloadDirectory: "D:\\SAPDWiki\\export",
    token: "must-not-persist",
    passphrase: "must-not-persist",
    privateKey: "must-not-persist",
  }), {
    dataRoot: "D:\\SAPDWiki",
    importDirectory: "D:\\SAPDWiki\\import",
    downloadDirectory: "D:\\SAPDWiki\\export",
  });
});

test("Electron window integration denies navigation, popups, and permissions by default", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
  assert.match(source, /setPermissionRequestHandler/);
  assert.match(source, /setPermissionCheckHandler/);
  assert.match(source, /setWindowOpenHandler\(\(\) => \(\{ action: "deny" \}\)\)/);
  assert.match(source, /webContents\.on\("will-navigate"/);
  assert.match(source, /webContents\.on\("will-redirect"/);
});

test("preload exposes a single allowlisted invoke function without process primitives", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "preload.cjs"), "utf8");
  assert.doesNotMatch(source, /spawn|execFile|taskkill|child_process/);
  assert.doesNotMatch(source, /privateKey|passphrase|token/);
  assert.match(source, /ALLOWED_MCP_ACTIONS/);
  assert.match(source, /mcp: Object\.freeze/);
});
