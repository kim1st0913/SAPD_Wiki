const test = require("node:test");
const assert = require("node:assert/strict");
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
