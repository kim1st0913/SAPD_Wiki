const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { spawn, execFileSync } = require("node:child_process");
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
} = require("electron");
const {
  defaultSettingsForParent,
  isValidSettings,
  sanitizeSettings,
  settingsForNewDataParent,
} = require("./settings.cjs");
const { registerMCPIPC, localOriginFromURL } = require("./mcp/ipc-bridge.cjs");
const { MCPSupervisor } = require("./mcp/supervisor.cjs");
const { WindowsMCPProcessRuntime } = require("./mcp/windows-platform.cjs");

const APP_NAME = "SAPD Wiki";
const RUNTIME_FINGERPRINT = ".sapd-runtime-fingerprint";
const STARTUP_TIMEOUT_MS = 35_000;

let mainWindow = null;
let backendProcess = null;
let runtimeRoot = null;
let currentSettings = null;
let isQuitting = false;
let trustedRuntimeOrigin = null;
const mcpSupervisor = new MCPSupervisor({
  profile: "stable",
  processRuntime: new WindowsMCPProcessRuntime(),
});
mcpSupervisor.on("authorization-request", ({ clientDisplayName }) => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "MCP 授权请求",
    message: `${clientDisplayName} 正在请求授权`,
    detail: "请返回 SAPD Wiki 的 AI 集成页面继续确认。",
    buttons: ["返回 SAPD Wiki"],
  });
});

function appDataRoot() {
  const localAppData = process.env.LOCALAPPDATA || app.getPath("appData");
  return path.join(localAppData, APP_NAME);
}

app.setPath("userData", appDataRoot());

function settingsFilePath() {
  return path.join(app.getPath("userData"), "settings.json");
}

function loadSettings() {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsFilePath(), "utf8"));
    return isValidSettings(settings) ? sanitizeSettings(settings) : null;
  } catch {
    return null;
  }
}

function saveSettings(settings) {
  const safeSettings = sanitizeSettings(settings);
  if (!safeSettings) {
    throw new Error("Invalid application settings");
  }
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(settingsFilePath(), `${JSON.stringify(safeSettings, null, 2)}\n`, "utf8");
}

function ensureSettingsDirectories(settings) {
  const directories = [
    settings.dataRoot,
    settings.importDirectory,
    settings.downloadDirectory,
    path.join(settings.dataRoot, "Runtime"),
    path.join(settings.importDirectory, "maturity-templates"),
    path.join(settings.importDirectory, "maturity-scores"),
    path.join(settings.downloadDirectory, "maturity-reports"),
    path.join(settings.downloadDirectory, "maturity-scores"),
    path.join(settings.downloadDirectory, "maturity-templates"),
    path.join(settings.downloadDirectory, "issues"),
    path.join(settings.downloadDirectory, "diagnostics"),
  ];
  directories.forEach((directory) => fs.mkdirSync(directory, { recursive: true }));
}

function chooseDirectory(title, defaultPath, message) {
  const selection = dialog.showOpenDialogSync(mainWindow, {
    title,
    message,
    defaultPath,
    buttonLabel: "选择此文件夹",
    properties: ["openDirectory", "createDirectory", "promptToCreate"],
  });
  return selection?.[0] || "";
}

function ensureConfiguredSettings() {
  const saved = loadSettings();
  if (saved) {
    ensureSettingsDirectories(saved);
    return saved;
  }

  dialog.showMessageBoxSync(mainWindow, {
    type: "info",
    title: `${APP_NAME} 首次启动`,
    message: "请选择 SAPD Wiki 数据的保存位置",
    detail: "应用会在所选位置创建 SAPDWiki 文件夹，并分别管理 import、export 和 Runtime。程序安装位置与这里的数据位置相互独立。",
    buttons: ["选择保存位置"],
  });
  const selected = chooseDirectory(
    "选择 SAPD Wiki 保存位置",
    app.getPath("documents"),
    "请选择一个父级保存位置，应用会在其中创建 SAPDWiki 文件夹。",
  );
  if (!selected) {
    const error = new Error("已取消首次启动的数据路径设置。");
    error.code = "SETTINGS_CANCELLED";
    throw error;
  }
  const settings = defaultSettingsForParent(selected);
  ensureSettingsDirectories(settings);
  saveSettings(settings);
  return settings;
}

function resourceRuntimeRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "runtime-template");
  }
  return path.join(__dirname, ".build", "runtime-template");
}

function logFilePath() {
  return path.join(runtimeRoot || path.join(app.getPath("userData"), "Runtime"), "logs", "electron-wrapper.log");
}

function writeLog(message, details = "") {
  if (!runtimeRoot) return;
  const logsRoot = path.dirname(logFilePath());
  fs.mkdirSync(logsRoot, { recursive: true });
  const suffix = details ? ` ${details}` : "";
  fs.appendFileSync(logFilePath(), `${new Date().toISOString()} ${message}${suffix}\n`, "utf8");
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
}

function copyReplacing(sourceRoot, targetRoot, relativePath) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(targetRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`Bundled runtime resource is missing: ${relativePath}`);
  }
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function runtimeIsCurrent(sourceRoot, targetRoot) {
  const sourceFingerprint = readText(path.join(sourceRoot, RUNTIME_FINGERPRINT));
  const targetFingerprint = readText(path.join(targetRoot, RUNTIME_FINGERPRINT));
  if (!sourceFingerprint || sourceFingerprint !== targetFingerprint) return false;
  return [
    "SAPD-Wiki-Backend.exe",
    "_internal",
    "app/frontend-dist/index.html",
    "config/app-config.json",
    "data/base/base-manifest.json",
  ].every((relativePath) => fs.existsSync(path.join(targetRoot, relativePath)));
}

function seedUserDatabase(sourceRoot, targetRoot) {
  const source = path.join(sourceRoot, "data", "user", "sapd_wiki_user.sqlite3");
  const target = path.join(targetRoot, "data", "user", "sapd_wiki_user.sqlite3");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(source) || fs.existsSync(target)) return;
  fs.copyFileSync(source, target);
}

function writeRuntimeConfig(targetRoot, settings) {
  const configPath = path.join(targetRoot, "config", "app-config.json");
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.app_data_root = settings.dataRoot;
  config.import_dir = settings.importDirectory;
  config.download_dir = settings.downloadDirectory;
  config.runtime_root = targetRoot;
  config.user_database_path = path.join(targetRoot, "data", "user", "sapd_wiki_user.sqlite3");
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  fs.mkdirSync(config.import_dir, { recursive: true });
  fs.mkdirSync(config.download_dir, { recursive: true });
}

function prepareRuntime(settings) {
  const sourceRoot = resourceRuntimeRoot();
  runtimeRoot = path.join(settings.dataRoot, "Runtime");
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Bundled runtime is missing: ${sourceRoot}`);
  }

  fs.mkdirSync(runtimeRoot, { recursive: true });
  writeLog("prepare-runtime start", `source=${sourceRoot}`);
  if (!runtimeIsCurrent(sourceRoot, runtimeRoot)) {
    for (const relativePath of [
      "SAPD-Wiki-Backend.exe",
      "_internal",
      "app",
      "config",
      "data/base",
      "diagnostics",
      "README-FIRST.md",
      "start-windows.bat",
      "stop-windows.bat",
    ]) {
      copyReplacing(sourceRoot, runtimeRoot, relativePath);
    }
    copyReplacing(sourceRoot, runtimeRoot, RUNTIME_FINGERPRINT);
  }
  seedUserDatabase(sourceRoot, runtimeRoot);
  writeRuntimeConfig(runtimeRoot, settings);
  fs.mkdirSync(path.join(runtimeRoot, "logs"), { recursive: true });
  fs.rmSync(path.join(runtimeRoot, "logs", "runtime-state.json"), { force: true });
  writeLog("prepare-runtime done", `runtime=${runtimeRoot}`);
  return runtimeRoot;
}

function showLoadingPage(message = "正在准备本地运行环境…") {
  if (!mainWindow) return;
  const safeMessage = String(message).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${APP_NAME}</title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#f4f5f2;color:#27312f;font:15px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.loading{width:min(420px,calc(100vw - 48px));padding:28px 30px;border:1px solid #d6dbd6;background:#fff;box-shadow:0 16px 42px #26312f12}.mark{width:10px;height:10px;border-radius:50%;background:#5f7c76;display:inline-block;margin-right:10px}.message{margin:14px 0 0;color:#65716d;line-height:1.6}</style><main class="loading"><strong><i class="mark"></i>${APP_NAME}</strong><p class="message">${safeMessage}</p></main></html>`;
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { headers: { Accept: "application/json" } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.setTimeout(1500, () => request.destroy(new Error("request timeout")));
    request.on("error", reject);
  });
}

async function waitForBackend(processHandle) {
  const statePath = path.join(runtimeRoot, "logs", "runtime-state.json");
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) {
      throw new Error(`本地服务已退出，退出码：${processHandle.exitCode}`);
    }
    try {
      const state = JSON.parse(readText(statePath));
      if (state.url) {
        await requestJson(`${state.url.replace(/\/$/, "")}/api/v1/health`);
        return state.url;
      }
    } catch {
      // The backend writes its state file before the HTTP listener is ready.
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error("本地服务启动超时");
}

function startBackend() {
  const executable = path.join(runtimeRoot, "SAPD-Wiki-Backend.exe");
  if (!fs.existsSync(executable)) {
    throw new Error(`后端程序不存在：${executable}`);
  }
  const logPath = path.join(runtimeRoot, "logs", "backend-wrapper-console.log");
  const output = fs.openSync(logPath, "a");
  fs.writeSync(output, `\n--- wrapper start ${new Date().toISOString()} ---\n`);
  backendProcess = spawn(executable, ["--bundle-root", runtimeRoot, "--no-browser"], {
    cwd: runtimeRoot,
    windowsHide: true,
    stdio: ["ignore", output, output],
  });
  backendProcess.on("exit", (code, signal) => {
    writeLog("backend-process exited", `code=${code} signal=${signal || "none"}`);
  });
  backendProcess.on("error", (error) => {
    writeLog("backend-process error", `error=${error.message}`);
  });
  return backendProcess;
}

function stopBackend() {
  if (!backendProcess || backendProcess.exitCode !== null) return;
  const pid = backendProcess.pid;
  try {
    if (process.platform === "win32" && pid) {
      execFileSync("taskkill.exe", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      backendProcess.kill("SIGTERM");
    }
  } catch (error) {
    writeLog("backend-process stop warning", `error=${error.message}`);
  }
  backendProcess = null;
}

function showRuntimeError(error) {
  const logPath = logFilePath();
  writeLog("startup failed", `error=${error.message}`);
  const response = dialog.showMessageBoxSync({
    type: "error",
    title: `${APP_NAME} 启动失败`,
    message: error.message,
    detail: `请查看日志：${logPath}`,
    buttons: ["打开日志目录", "退出"],
    defaultId: 0,
  });
  if (response === 0) shell.openPath(path.dirname(logPath));
  app.quit();
}

function restartPrompt() {
  const response = dialog.showMessageBoxSync(mainWindow, {
    type: "info",
    title: "设置已保存",
    message: "新的路径将在重启 SAPD Wiki 后完全生效。",
    detail: "应用不会自动移动或覆盖旧目录中的用户数据。",
    buttons: ["立即重启", "稍后"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response === 0) {
    isQuitting = true;
    stopBackend();
    app.relaunch();
    app.quit();
  }
}

function changeSettingsDirectory(kind) {
  if (!currentSettings) return;
  const options = {
    dataRoot: {
      title: "更改 SAPD Wiki 保存位置",
      defaultPath: path.dirname(currentSettings.dataRoot),
      message: "选择新的父级位置，应用会在其中创建 SAPDWiki 文件夹。",
    },
    importDirectory: {
      title: "更改导入文件夹",
      defaultPath: currentSettings.importDirectory,
      message: "选择成熟度模板、评分等文件的导入文件夹。",
    },
    downloadDirectory: {
      title: "更改导出文件夹",
      defaultPath: currentSettings.downloadDirectory,
      message: "选择报告、评分、问题和诊断文件的导出文件夹。",
    },
  };
  const option = options[kind];
  if (!option) return;
  const selected = chooseDirectory(option.title, option.defaultPath, option.message);
  if (!selected) return;
  currentSettings = kind === "dataRoot"
    ? settingsForNewDataParent(selected, currentSettings)
    : { ...currentSettings, [kind]: path.normalize(selected) };
  ensureSettingsDirectories(currentSettings);
  saveSettings(currentSettings);
  createApplicationMenu();
  restartPrompt();
}

function showApplicationSettings() {
  if (!currentSettings) return;
  const response = dialog.showMessageBoxSync(mainWindow, {
    type: "info",
    title: "SAPD Wiki 设置",
    message: "本地文件夹",
    detail: `工作目录：${currentSettings.dataRoot}\n\n导入目录：${currentSettings.importDirectory}\n\n导出目录：${currentSettings.downloadDirectory}`,
    buttons: ["更改工作目录", "更改导入目录", "更改导出目录", "关闭"],
    cancelId: 3,
  });
  if (response === 0) changeSettingsDirectory("dataRoot");
  if (response === 1) changeSettingsDirectory("importDirectory");
  if (response === 2) changeSettingsDirectory("downloadDirectory");
}

function createApplicationMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [
        { label: "系统设置…", enabled: Boolean(currentSettings), click: showApplicationSettings },
        { type: "separator" },
        { label: "打开工作目录", enabled: Boolean(currentSettings), click: () => shell.openPath(currentSettings.dataRoot) },
        { label: "打开导入目录", enabled: Boolean(currentSettings), click: () => shell.openPath(currentSettings.importDirectory) },
        { label: "打开导出目录", enabled: Boolean(currentSettings), click: () => shell.openPath(currentSettings.downloadDirectory) },
        { label: "打开 Runtime", enabled: Boolean(currentSettings), click: () => shell.openPath(path.join(currentSettings.dataRoot, "Runtime")) },
        { label: "打开日志目录", enabled: Boolean(currentSettings), click: () => shell.openPath(path.join(currentSettings.dataRoot, "Runtime", "logs")) },
        { type: "separator" },
        { role: "quit", label: "退出 SAPD Wiki" },
      ],
    },
    { role: "viewMenu" },
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: true,
    title: APP_NAME,
    backgroundColor: "#f4f5f2",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  registerMCPIPC({
    ipcMain,
    getMainWindow: () => mainWindow,
    getTrustedOrigin: () => trustedRuntimeOrigin,
    supervisor: mcpSupervisor,
  });
  const webSession = mainWindow.webContents.session;
  webSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  webSession.setPermissionCheckHandler(() => false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const isSyntheticLoadingPage = !trustedRuntimeOrigin && url.startsWith("data:text/html");
    if (!isSyntheticLoadingPage && localOriginFromURL(url) !== trustedRuntimeOrigin) {
      event.preventDefault();
    }
  });
  mainWindow.webContents.on("will-redirect", (event, url) => {
    if (localOriginFromURL(url) !== trustedRuntimeOrigin) {
      event.preventDefault();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (!isQuitting) app.quit();
  });
  showLoadingPage();
}

async function launch() {
  createWindow();
  createApplicationMenu();
  try {
    currentSettings = ensureConfiguredSettings();
    createApplicationMenu();
    showLoadingPage("正在复制本地运行环境，首次启动可能需要一点时间…");
    prepareRuntime(currentSettings);
    const processHandle = startBackend();
    const url = await waitForBackend(processHandle);
    const origin = localOriginFromURL(url);
    if (!origin) {
      throw new Error("本地服务返回了不受信任的地址");
    }
    trustedRuntimeOrigin = origin;
    writeLog("backend ready", `url=${url}`);
    await mainWindow.loadURL(url);
  } catch (error) {
    if (error.code === "SETTINGS_CANCELLED") {
      dialog.showMessageBoxSync(mainWindow, {
        type: "info",
        title: APP_NAME,
        message: "首次启动已取消",
        detail: "下次启动时可以重新选择数据保存位置。",
        buttons: ["退出"],
      });
      app.quit();
      return;
    }
    showRuntimeError(error);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  app.whenReady().then(launch);
  app.on("before-quit", () => {
    isQuitting = true;
    mcpSupervisor.stop();
    stopBackend();
  });
  process.on("exit", () => {
    mcpSupervisor.stop();
    stopBackend();
  });
}
