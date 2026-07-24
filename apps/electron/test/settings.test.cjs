const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  dataRootForSelectedDirectory,
  defaultSettingsForParent,
  settingsForNewDataParent,
} = require("../settings.cjs");

const winPath = path.win32;

test("adds the SAPDWiki folder to the selected parent", () => {
  assert.equal(dataRootForSelectedDirectory("D:\\Workspace", winPath), "D:\\Workspace\\SAPDWiki");
});

test("does not append SAPDWiki twice", () => {
  assert.equal(dataRootForSelectedDirectory("D:\\Workspace\\SAPDWiki", winPath), "D:\\Workspace\\SAPDWiki");
});

test("creates macOS-compatible default import and export paths", () => {
  assert.deepEqual(defaultSettingsForParent("D:\\Workspace", winPath), {
    dataRoot: "D:\\Workspace\\SAPDWiki",
    importDirectory: "D:\\Workspace\\SAPDWiki\\import",
    downloadDirectory: "D:\\Workspace\\SAPDWiki\\export",
  });
});

test("moves default folders with the data root and preserves custom folders", () => {
  const defaults = defaultSettingsForParent("D:\\Old", winPath);
  assert.deepEqual(settingsForNewDataParent("E:\\New", defaults, winPath), {
    dataRoot: "E:\\New\\SAPDWiki",
    importDirectory: "E:\\New\\SAPDWiki\\import",
    downloadDirectory: "E:\\New\\SAPDWiki\\export",
  });

  const custom = {
    ...defaults,
    importDirectory: "F:\\Shared\\imports",
    downloadDirectory: "F:\\Shared\\exports",
  };
  assert.deepEqual(settingsForNewDataParent("E:\\New", custom, winPath), {
    dataRoot: "E:\\New\\SAPDWiki",
    importDirectory: "F:\\Shared\\imports",
    downloadDirectory: "F:\\Shared\\exports",
  });
});

test("desktop settings bridge exposes only parameterless directory picker requests", () => {
  const preload = fs.readFileSync(path.join(__dirname, "..", "preload.cjs"), "utf8");
  assert.match(preload, /getSettings:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(SETTINGS_IPC_CHANNELS\.get\)/);
  assert.match(preload, /chooseDataRoot:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(SETTINGS_IPC_CHANNELS\.chooseDataRoot\)/);
  assert.match(preload, /chooseImportDirectory:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(SETTINGS_IPC_CHANNELS\.chooseImportDirectory\)/);
  assert.match(preload, /chooseDownloadDirectory:\s*\(\)\s*=>\s*ipcRenderer\.invoke\(SETTINGS_IPC_CHANNELS\.chooseDownloadDirectory\)/);
  assert.doesNotMatch(preload, /choose(?:DataRoot|ImportDirectory|DownloadDirectory):\s*\([^)]*[A-Za-z_$][^)]*\)/);
});

test("desktop settings IPC is origin-checked and preserves BrowserWindow isolation", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "main.cjs"), "utf8");
  assert.match(main, /127\\\.0\\\.0\\\.1/);
  assert.match(main, /event\.senderFrame !== event\.sender\.mainFrame/);
  for (const field of [
    "currentVersion",
    "dataRoot",
    "importDirectory",
    "downloadDirectory",
    "runtimeRoot",
    "licenseDisplay",
  ]) {
    assert.match(main, new RegExp(`${field}:`));
  }
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /sandbox:\s*true/);
});
