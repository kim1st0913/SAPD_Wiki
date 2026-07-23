const path = require("node:path");

const DATA_ROOT_FOLDER_NAME = "SAPDWiki";

function dataRootForSelectedDirectory(selectedDirectory, pathApi = path) {
  const selected = pathApi.normalize(String(selectedDirectory || "").trim());
  if (!selected || selected === ".") return "";
  return pathApi.basename(selected).toLowerCase() === DATA_ROOT_FOLDER_NAME.toLowerCase()
    ? selected
    : pathApi.join(selected, DATA_ROOT_FOLDER_NAME);
}

function defaultSettingsForParent(parentDirectory, pathApi = path) {
  const dataRoot = dataRootForSelectedDirectory(parentDirectory, pathApi);
  if (!dataRoot) return null;
  return {
    dataRoot,
    importDirectory: pathApi.join(dataRoot, "import"),
    downloadDirectory: pathApi.join(dataRoot, "export"),
  };
}

function isDefaultImportDirectory(settings, pathApi = path) {
  return pathApi.normalize(settings.importDirectory) === pathApi.join(pathApi.normalize(settings.dataRoot), "import");
}

function isDefaultDownloadDirectory(settings, pathApi = path) {
  return pathApi.normalize(settings.downloadDirectory) === pathApi.join(pathApi.normalize(settings.dataRoot), "export");
}

function settingsForNewDataParent(parentDirectory, currentSettings, pathApi = path) {
  const defaults = defaultSettingsForParent(parentDirectory, pathApi);
  if (!defaults) return null;
  return {
    dataRoot: defaults.dataRoot,
    importDirectory: isDefaultImportDirectory(currentSettings, pathApi)
      ? defaults.importDirectory
      : currentSettings.importDirectory,
    downloadDirectory: isDefaultDownloadDirectory(currentSettings, pathApi)
      ? defaults.downloadDirectory
      : currentSettings.downloadDirectory,
  };
}

function isValidSettings(settings) {
  return Boolean(
    settings
    && typeof settings.dataRoot === "string"
    && settings.dataRoot.trim()
    && typeof settings.importDirectory === "string"
    && settings.importDirectory.trim()
    && typeof settings.downloadDirectory === "string"
    && settings.downloadDirectory.trim(),
  );
}

module.exports = {
  DATA_ROOT_FOLDER_NAME,
  dataRootForSelectedDirectory,
  defaultSettingsForParent,
  isDefaultDownloadDirectory,
  isDefaultImportDirectory,
  isValidSettings,
  settingsForNewDataParent,
};
