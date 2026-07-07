import Cocoa
import Darwin
import Foundation
import WebKit

private let bundleIdentifier = "com.sapd.wiki.macos"
private let appDisplayName = "SAPD Wiki"
private let fallbackDisplayVersion = "0.1.5"
private let wrapperLogName = "app-wrapper.log"
private let runtimeFingerprintName = ".sapd-runtime-fingerprint"

private func currentDisplayVersion() -> String {
    let value = (Bundle.main.object(forInfoDictionaryKey: "SAPDWikiDisplayVersion") as? String ?? fallbackDisplayVersion)
        .trimmingCharacters(in: .whitespacesAndNewlines)
    return value.isEmpty ? fallbackDisplayVersion : value
}

private func windowDisplayTitle() -> String {
    "\(appDisplayName) \(currentDisplayVersion())"
}

private func currentLicenseMode() -> String {
    let value = (Bundle.main.object(forInfoDictionaryKey: "SAPDWikiLicenseMode") as? String ?? "license")
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()
    switch value {
    case "no-license", "none", "disabled", "open":
        return "no-license"
    default:
        return "license"
    }
}

fileprivate struct LicenseState: Sendable {
    let state: String
    let displayText: String
    let expiresAt: Date?
    let remainingDays: Int?

    var isActivated: Bool {
        state == "activated"
    }

    var isExpired: Bool {
        state == "expired"
    }

    var canSkip: Bool {
        state == "not_started" || state == "trial"
    }
}

fileprivate enum LicenseStore {
    private static let validPasscode = "Passc0de"
    private static let activatedKey = "SAPDWiki.LicenseActivated"
    private static let trialStartedAtKey = "SAPDWiki.TrialStartedAt"
    private static let trialExpiresAtKey = "SAPDWiki.TrialExpiresAt"
    private static let activatedAtKey = "SAPDWiki.LicenseActivatedAt"
    private static let trialDays = 30

    private static var isEnabled: Bool {
        currentLicenseMode() == "license"
    }

    static func currentState(now: Date = Date()) -> LicenseState {
        guard isEnabled else {
            return LicenseState(state: "open", displayText: "无限制版", expiresAt: nil, remainingDays: nil)
        }

        let defaults = UserDefaults.standard
        if defaults.bool(forKey: activatedKey) {
            return LicenseState(state: "activated", displayText: "已激活", expiresAt: nil, remainingDays: nil)
        }

        guard let expiresAt = defaults.object(forKey: trialExpiresAtKey) as? Date else {
            return LicenseState(state: "not_started", displayText: "未授权", expiresAt: nil, remainingDays: nil)
        }

        let remainingSeconds = expiresAt.timeIntervalSince(now)
        guard remainingSeconds > 0 else {
            return LicenseState(state: "expired", displayText: "授权已到期", expiresAt: expiresAt, remainingDays: 0)
        }

        let remainingDays = max(1, Int(ceil(remainingSeconds / 86_400)))
        return LicenseState(
            state: "trial",
            displayText: "使用有效期至 \(dateOnlyString(expiresAt))（剩余\(remainingDays)d）",
            expiresAt: expiresAt,
            remainingDays: remainingDays
        )
    }

    @MainActor
    static func ensureUsableLicense() throws -> LicenseState {
        guard isEnabled else {
            return currentState()
        }

        while true {
            let state = currentState()
            if state.isActivated {
                return state
            }

            switch promptForLicense(state: state) {
            case .activated:
                activate()
                return currentState()
            case .skipped:
                guard state.canSkip else {
                    continue
                }
                if state.state == "not_started" {
                    startTrial()
                }
                return currentState()
            case .cancelled:
                throw RuntimeError("授权未完成。")
            }
        }
    }

    static func currentStatusPayload(now: Date = Date()) -> [String: Any] {
        let state = currentState(now: now)
        var payload: [String: Any] = [
            "state": state.state,
            "display_text": state.displayText,
            "activated": state.isActivated,
            "can_skip": state.canSkip,
            "trial_days": trialDays,
            "license_mode": currentLicenseMode(),
            "enabled": isEnabled,
        ]
        if let expiresAt = state.expiresAt {
            payload["expires_at"] = ISO8601DateFormatter().string(from: expiresAt)
            payload["expires_on"] = dateOnlyString(expiresAt)
        }
        if let remainingDays = state.remainingDays {
            payload["remaining_days"] = remainingDays
        }
        return payload
    }

    private static func startTrial(now: Date = Date()) {
        let expiresAt = now.addingTimeInterval(TimeInterval(trialDays * 86_400))
        let defaults = UserDefaults.standard
        defaults.set(now, forKey: trialStartedAtKey)
        defaults.set(expiresAt, forKey: trialExpiresAtKey)
        AppWrapperLogger.write("license trial started expiresAt=\(ISO8601DateFormatter().string(from: expiresAt))")
    }

    private static func activate(now: Date = Date()) {
        let defaults = UserDefaults.standard
        defaults.set(true, forKey: activatedKey)
        defaults.set(now, forKey: activatedAtKey)
        AppWrapperLogger.write("license activated")
    }

    private static func dateOnlyString(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "zh_CN")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private enum PromptResult {
        case activated
        case skipped
        case cancelled
    }

    @MainActor
    private static func promptForLicense(state: LicenseState) -> PromptResult {
        let panel = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 480, height: 224),
            styleMask: [.titled],
            backing: .buffered,
            defer: false
        )
        panel.title = "SAPD Wiki 授权"
        panel.isReleasedWhenClosed = false
        panel.center()

        let titleLabel = NSTextField(labelWithString: state.isExpired ? "授权已到期，请输入授权码" : "请输入 SAPD Wiki 授权码")
        titleLabel.font = .systemFont(ofSize: 18, weight: .semibold)

        let message = state.isExpired
            ? "试用期已结束，输入正确授权码后可继续使用。"
            : "不知道授权码时可以跳过输入，App 将开启或继续 30 天试用。"
        let messageLabel = NSTextField(labelWithString: message)
        messageLabel.font = .systemFont(ofSize: 12)
        messageLabel.textColor = .secondaryLabelColor
        messageLabel.lineBreakMode = .byWordWrapping
        messageLabel.maximumNumberOfLines = 2

        let codeField = NSSecureTextField()
        codeField.placeholderString = "授权码"
        codeField.font = .systemFont(ofSize: 14)
        codeField.translatesAutoresizingMaskIntoConstraints = false

        let statusLabel = NSTextField(labelWithString: state.displayText)
        statusLabel.font = .systemFont(ofSize: 12)
        statusLabel.textColor = state.isExpired ? .systemRed : .secondaryLabelColor

        let errorLabel = NSTextField(labelWithString: "")
        errorLabel.font = .systemFont(ofSize: 12)
        errorLabel.textColor = .systemRed
        errorLabel.maximumNumberOfLines = 1

        var result = PromptResult.cancelled
        let skipButton = NSButton(title: "跳过输入", target: nil, action: nil)
        skipButton.bezelStyle = .rounded
        skipButton.isEnabled = state.canSkip
        skipButton.toolTip = state.canSkip ? "进入 30 天试用" : "试用已到期，必须输入授权码"

        let confirmButton = NSButton(title: "确认", target: nil, action: nil)
        confirmButton.bezelStyle = .rounded
        confirmButton.keyEquivalent = "\r"

        let skipAction = ActionSleeve {
            result = .skipped
            NSApp.stopModal()
        }
        let confirmAction = ActionSleeve {
            let code = codeField.stringValue.trimmingCharacters(in: .whitespacesAndNewlines)
            guard code == validPasscode else {
                errorLabel.stringValue = "授权码不正确。"
                return
            }
            result = .activated
            NSApp.stopModal()
        }
        skipButton.target = skipAction
        skipButton.action = #selector(ActionSleeve.invoke(_:))
        confirmButton.target = confirmAction
        confirmButton.action = #selector(ActionSleeve.invoke(_:))

        let buttonRow = NSStackView(views: [skipButton, NSView(), confirmButton])
        buttonRow.orientation = .horizontal
        buttonRow.alignment = .centerY
        buttonRow.distribution = .fill
        buttonRow.spacing = 12

        let stack = NSStackView(views: [titleLabel, messageLabel, codeField, statusLabel, errorLabel, buttonRow])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 12
        stack.translatesAutoresizingMaskIntoConstraints = false

        let contentView = NSView()
        contentView.addSubview(stack)
        panel.contentView = contentView
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 22),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: contentView.bottomAnchor, constant: -18),
            codeField.widthAnchor.constraint(equalTo: stack.widthAnchor),
            buttonRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
        ])

        panel.makeKeyAndOrderFront(nil)
        codeField.becomeFirstResponder()
        let actionSleeves = [skipAction, confirmAction]
        _ = withExtendedLifetime(actionSleeves) {
            NSApp.runModal(for: panel)
        }
        panel.orderOut(nil)
        return result
    }
}

private final class ActionSleeve: NSObject {
    private let action: () -> Void

    init(action: @escaping () -> Void) {
        self.action = action
    }

    @objc func invoke(_ sender: Any?) {
        action()
    }
}

fileprivate struct AppSettings: Sendable {
    let dataRoot: URL
    let downloadDirectory: URL
}

@MainActor
fileprivate enum AppSettingsStore {
    private static let dataRootFolderName = "SAPDWiki"
    private static let dataRootKey = "SAPDWiki.DataRootPath"
    private static let downloadDirectoryKey = "SAPDWiki.DownloadDirectoryPath"

    static func load() -> AppSettings? {
        let defaults = UserDefaults.standard
        let dataRootPath = (defaults.string(forKey: dataRootKey) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let downloadPath = (defaults.string(forKey: downloadDirectoryKey) ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !dataRootPath.isEmpty, !downloadPath.isEmpty else {
            return nil
        }
        let dataRoot = URL(fileURLWithPath: dataRootPath, isDirectory: true).standardizedFileURL
        var downloadDirectory = URL(fileURLWithPath: downloadPath, isDirectory: true).standardizedFileURL
        if downloadDirectory.path == legacyDefaultDownloadDirectory().path {
            downloadDirectory = defaultDownloadDirectory(for: dataRoot)
            defaults.set(downloadDirectory.path, forKey: downloadDirectoryKey)
        }
        return AppSettings(
            dataRoot: dataRoot,
            downloadDirectory: downloadDirectory
        )
    }

    static func ensureConfigured() throws -> AppSettings {
        if let settings = load() {
            try ensureDirectories(for: settings)
            return settings
        }

        let alert = NSAlert()
        alert.messageText = "首次启动需要设置本地保存位置"
        alert.informativeText = "请选择一个父级保存位置。SAPD Wiki 会在该位置下创建 SAPDWiki 文件夹，并把 Runtime、用户数据库和默认 export 下载目录都放在这个文件夹下。"
        alert.addButton(withTitle: "开始设置")
        alert.addButton(withTitle: "取消")
        guard alert.runModal() == .alertFirstButtonReturn else {
            throw RuntimeError("已取消首次启动路径设置。")
        }

        return try promptForSettings(existing: nil)
    }

    static func promptForSettings(existing: AppSettings?) throws -> AppSettings {
        let selectedParent = try chooseDirectory(
            title: "选择 SAPD Wiki 保存位置",
            message: "系统会在所选位置下创建 SAPDWiki 文件夹，Runtime 和 export 都会放在 SAPDWiki 下面。",
            defaultURL: existing.map { parentDirectoryForDataRoot($0.dataRoot) } ?? defaultDataRootParent()
        )
        let dataRoot = dataRoot(forSelectedDirectory: selectedParent)
        let shouldMoveDownload = existing.map { isDefaultDownloadDirectory($0.downloadDirectory, for: $0.dataRoot) } ?? true
        let downloadDirectory = shouldMoveDownload ? defaultDownloadDirectory(for: dataRoot) : existing?.downloadDirectory ?? defaultDownloadDirectory(for: dataRoot)
        let settings = AppSettings(dataRoot: dataRoot, downloadDirectory: downloadDirectory)
        save(settings)
        try ensureDirectories(for: settings)
        return settings
    }

    static func save(_ settings: AppSettings) {
        let defaults = UserDefaults.standard
        defaults.set(settings.dataRoot.path, forKey: dataRootKey)
        defaults.set(settings.downloadDirectory.path, forKey: downloadDirectoryKey)
    }

    static func ensureDirectories(for settings: AppSettings) throws {
        try FileManager.default.createDirectory(at: settings.dataRoot, withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: settings.downloadDirectory, withIntermediateDirectories: true)
    }

    static func chooseDirectory(title: String, message: String, defaultURL: URL) throws -> URL {
        try? FileManager.default.createDirectory(at: defaultURL, withIntermediateDirectories: true)
        let panel = NSOpenPanel()
        panel.title = title
        panel.message = message
        panel.prompt = "选择"
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.canCreateDirectories = true
        panel.directoryURL = defaultURL
        guard panel.runModal() == .OK, let url = panel.url else {
            throw RuntimeError("已取消路径选择。")
        }
        return url.standardizedFileURL
    }

    static func defaultSettings() -> AppSettings {
        let dataRoot = defaultDataRoot()
        return AppSettings(dataRoot: dataRoot, downloadDirectory: defaultDownloadDirectory(for: dataRoot))
    }

    static func defaultDownloadDirectory(for dataRoot: URL) -> URL {
        dataRoot.appendingPathComponent("export", isDirectory: true).standardizedFileURL
    }

    static func dataRoot(forSelectedDirectory selectedDirectory: URL) -> URL {
        let standardized = selectedDirectory.standardizedFileURL
        if standardized.lastPathComponent == dataRootFolderName {
            return standardized
        }
        return standardized.appendingPathComponent(dataRootFolderName, isDirectory: true).standardizedFileURL
    }

    static func parentDirectoryForDataRoot(_ dataRoot: URL) -> URL {
        let standardized = dataRoot.standardizedFileURL
        if standardized.lastPathComponent == dataRootFolderName {
            return standardized.deletingLastPathComponent()
        }
        return standardized
    }

    static func isDefaultDownloadDirectory(_ downloadDirectory: URL, for dataRoot: URL) -> Bool {
        downloadDirectory.standardizedFileURL.path == defaultDownloadDirectory(for: dataRoot).path
            || downloadDirectory.standardizedFileURL.path == legacyDefaultDownloadDirectory().path
    }

    private static func defaultDataRoot() -> URL {
        dataRoot(forSelectedDirectory: defaultDataRootParent())
    }

    private static func defaultDataRootParent() -> URL {
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? FileManager.default.homeDirectoryForCurrentUser
        return documents.standardizedFileURL
    }

    private static func legacyDefaultDownloadDirectory() -> URL {
        let downloads = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
            ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Downloads", isDirectory: true)
        return downloads.appendingPathComponent(appDisplayName, isDirectory: true)
    }
}

final class RuntimeInstaller {
    private let fileManager = FileManager.default
    private let settings: AppSettings

    fileprivate init(settings: AppSettings) {
        self.settings = settings
    }

    func prepareRuntime() throws -> URL {
        guard let sourceRuntime = Bundle.main.resourceURL?.appendingPathComponent("Runtime") else {
            throw RuntimeError("Cannot locate bundled runtime resources.")
        }
        guard fileManager.fileExists(atPath: sourceRuntime.path) else {
            throw RuntimeError("Bundled runtime is missing at \(sourceRuntime.path).")
        }

        AppWrapperLogger.write("prepare-runtime start source=\(sourceRuntime.path)")
        try fileManager.createDirectory(at: settings.dataRoot, withIntermediateDirectories: true)
        try fileManager.createDirectory(at: settings.downloadDirectory, withIntermediateDirectories: true)
        let runtimeRoot = settings.dataRoot.appendingPathComponent("Runtime", isDirectory: true)
        try fileManager.createDirectory(at: runtimeRoot, withIntermediateDirectories: true)

        if runtimeIsCurrent(sourceRoot: sourceRuntime, targetRoot: runtimeRoot) {
            AppWrapperLogger.write("prepare-runtime reuse-current-runtime")
        } else {
            try copyReplacing("SAPD-Wiki-Backend", from: sourceRuntime, to: runtimeRoot)
            try copyReplacingIfPresent("_internal", from: sourceRuntime, to: runtimeRoot)
            try copyReplacing("app", from: sourceRuntime, to: runtimeRoot)
            try copyReplacing("config", from: sourceRuntime, to: runtimeRoot)
            try copyReplacing("diagnostics", from: sourceRuntime, to: runtimeRoot)
            try copyReplacing("README-FIRST.md", from: sourceRuntime, to: runtimeRoot)
            try copyReplacing("start-macos.command", from: sourceRuntime, to: runtimeRoot)
            try copyReplacing("stop-macos.command", from: sourceRuntime, to: runtimeRoot)
            try syncBaseData(from: sourceRuntime, to: runtimeRoot)
            try copyReplacing(runtimeFingerprintName, from: sourceRuntime, to: runtimeRoot)
        }

        try seedUserDataIfNeeded(from: sourceRuntime, to: runtimeRoot)
        try writeRuntimePreferences(to: runtimeRoot)
        try fileManager.createDirectory(at: runtimeRoot.appendingPathComponent("logs", isDirectory: true), withIntermediateDirectories: true)
        clearQuarantineRecursively(at: runtimeRoot)

        let backend = runtimeRoot.appendingPathComponent("SAPD-Wiki-Backend")
        chmod(backend.path, S_IRUSR | S_IWUSR | S_IXUSR | S_IRGRP | S_IXGRP | S_IROTH | S_IXOTH)
        AppWrapperLogger.write("prepare-runtime done runtime=\(runtimeRoot.path)")
        return runtimeRoot
    }

    private func runtimeIsCurrent(sourceRoot: URL, targetRoot: URL) -> Bool {
        let sourceFingerprint = readTrimmed(sourceRoot.appendingPathComponent(runtimeFingerprintName))
        let targetFingerprint = readTrimmed(targetRoot.appendingPathComponent(runtimeFingerprintName))
        guard !sourceFingerprint.isEmpty, sourceFingerprint == targetFingerprint else {
            return false
        }
        for relativePath in ["SAPD-Wiki-Backend", "app/frontend-dist/index.html", "config/app-config.json", "data/base/base-manifest.json"] {
            if !fileManager.fileExists(atPath: targetRoot.appendingPathComponent(relativePath).path) {
                return false
            }
        }
        if fileManager.fileExists(atPath: sourceRoot.appendingPathComponent("_internal").path),
           !fileManager.fileExists(atPath: targetRoot.appendingPathComponent("_internal").path) {
            return false
        }
        return true
    }

    private func readTrimmed(_ url: URL) -> String {
        guard let data = try? Data(contentsOf: url), let value = String(data: data, encoding: .utf8) else {
            return ""
        }
        return value.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func copyReplacing(_ relativePath: String, from sourceRoot: URL, to targetRoot: URL) throws {
        let source = sourceRoot.appendingPathComponent(relativePath)
        let target = targetRoot.appendingPathComponent(relativePath)
        guard fileManager.fileExists(atPath: source.path) else {
            throw RuntimeError("Required runtime resource is missing: \(relativePath)")
        }
        if fileManager.fileExists(atPath: target.path) {
            try fileManager.removeItem(at: target)
        }
        try fileManager.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
        try fileManager.copyItem(at: source, to: target)
    }

    private func copyReplacingIfPresent(_ relativePath: String, from sourceRoot: URL, to targetRoot: URL) throws {
        let source = sourceRoot.appendingPathComponent(relativePath)
        guard fileManager.fileExists(atPath: source.path) else {
            return
        }
        let target = targetRoot.appendingPathComponent(relativePath)
        if fileManager.fileExists(atPath: target.path) {
            try fileManager.removeItem(at: target)
        }
        try fileManager.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
        try fileManager.copyItem(at: source, to: target)
    }

    private func clearQuarantineRecursively(at root: URL) {
        var urls = [root]
        if let enumerator = fileManager.enumerator(
            at: root,
            includingPropertiesForKeys: nil,
            options: [],
            errorHandler: { url, error in
                AppWrapperLogger.write("prepare-runtime quarantine-enumeration-warning path=\(url.path) error=\(error.localizedDescription)")
                return true
            }
        ) {
            for case let url as URL in enumerator {
                urls.append(url)
            }
        }

        var removed = 0
        var failures = 0
        for url in urls {
            let result = url.path.withCString { path in
                removexattr(path, "com.apple.quarantine", 0)
            }
            if result == 0 {
                removed += 1
            } else if errno != ENOATTR {
                failures += 1
            }
        }
        AppWrapperLogger.write("prepare-runtime quarantine-clear removed=\(removed) failures=\(failures)")
    }

    private func syncBaseData(from sourceRoot: URL, to targetRoot: URL) throws {
        let sourceBase = sourceRoot.appendingPathComponent("data/base", isDirectory: true)
        let targetBase = targetRoot.appendingPathComponent("data/base", isDirectory: true)
        guard fileManager.fileExists(atPath: sourceBase.path) else {
            throw RuntimeError("Runtime base data is missing.")
        }
        if fileManager.fileExists(atPath: targetBase.path) {
            try fileManager.removeItem(at: targetBase)
        }
        try fileManager.createDirectory(at: targetBase.deletingLastPathComponent(), withIntermediateDirectories: true)
        try fileManager.copyItem(at: sourceBase, to: targetBase)
    }

    private func writeRuntimePreferences(to runtimeRoot: URL) throws {
        let configURL = runtimeRoot.appendingPathComponent("config/app-config.json")
        guard fileManager.fileExists(atPath: configURL.path) else {
            throw RuntimeError("Runtime config is missing at \(configURL.path).")
        }

        let data = try Data(contentsOf: configURL)
        var object = (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
        object["app_data_root"] = settings.dataRoot.path
        object["download_dir"] = settings.downloadDirectory.path
        object["runtime_root"] = runtimeRoot.path
        object["user_database_path"] = runtimeRoot
            .appendingPathComponent("data/user/sapd_wiki_user.sqlite3")
            .path
        object["license"] = LicenseStore.currentStatusPayload()

        let output = try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys])
        try output.write(to: configURL, options: .atomic)
        AppWrapperLogger.write("prepare-runtime config-updated dataRoot=\(settings.dataRoot.path) downloadDir=\(settings.downloadDirectory.path) licenseState=\(LicenseStore.currentState().state)")
    }

    private func seedUserDataIfNeeded(from sourceRoot: URL, to targetRoot: URL) throws {
        let sourceUser = sourceRoot.appendingPathComponent("data/user", isDirectory: true)
        let targetUser = targetRoot.appendingPathComponent("data/user", isDirectory: true)
        try fileManager.createDirectory(at: targetUser, withIntermediateDirectories: true)
        let sourceDB = sourceUser.appendingPathComponent("sapd_wiki_user.sqlite3")
        let targetDB = targetUser.appendingPathComponent("sapd_wiki_user.sqlite3")
        guard fileManager.fileExists(atPath: sourceDB.path) else {
            AppWrapperLogger.write("prepare-runtime user-db-seed-skipped missing-source=\(sourceDB.path)")
            return
        }

        let sourceFingerprint = readTrimmed(sourceRoot.appendingPathComponent(runtimeFingerprintName))
        let targetExists = fileManager.fileExists(atPath: targetDB.path)
        guard !targetExists else {
            AppWrapperLogger.write("prepare-runtime user-db-reuse path=\(targetDB.path)")
            return
        }

        try fileManager.copyItem(at: sourceDB, to: targetDB)
        if !sourceFingerprint.isEmpty {
            try sourceFingerprint.write(
                to: targetUser.appendingPathComponent(".sapd-user-db-created-from-runtime"),
                atomically: true,
                encoding: .utf8
            )
        }
        AppWrapperLogger.write("prepare-runtime user-db-created-from-template path=\(targetDB.path) fingerprint=\(sourceFingerprint)")
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var backendProcess: Process?
    private var runtimeRoot: URL?
    private var settings: AppSettings?
    private var settingsWindow: NSWindow?
    private var settingsDataRootField: NSTextField?
    private var settingsDownloadField: NSTextField?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        configureMainMenu()
        createWindow()
        do {
            _ = try LicenseStore.ensureUsableLicense()
            let settings = try AppSettingsStore.ensureConfigured()
            self.settings = settings
            launchBackend(settings: settings)
        } catch {
            showStatus("启动已暂停：\(error.localizedDescription)。请重新打开 SAPD Wiki 完成授权或设置。")
        }
    }

    private func launchBackend(settings: AppSettings) {
        showStatus("正在准备本地运行环境...")
        DispatchQueue.global(qos: .userInitiated).async {
            AppDelegate.prepareAndLaunchBackend(settings: settings) { result in
                DispatchQueue.main.async {
                    guard let delegate = NSApp.delegate as? AppDelegate else {
                        return
                    }
                    switch result {
                    case .success(let launch):
                        delegate.runtimeRoot = launch.runtimeRoot
                        delegate.backendProcess = launch.process
                        delegate.load(url: launch.url)
                    case .failure(let error):
                        delegate.showStatus("启动失败：\(error.localizedDescription)")
                    }
                }
            }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showPrimaryWindow()
        return true
    }

    func applicationWillTerminate(_ notification: Notification) {
        stopBackend()
    }

    private func createWindow() {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        self.webView = webView

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 920),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.center()
        window.title = windowDisplayTitle()
        window.isReleasedWhenClosed = false
        window.animationBehavior = .documentWindow
        window.delegate = self
        window.contentView = webView
        configureToolbar(for: window)
        self.window = window
        showPrimaryWindow()
    }

    private func configureToolbar(for window: NSWindow) {
        let toolbar = NSToolbar(identifier: ToolbarIdentifiers.main)
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        toolbar.allowsUserCustomization = false
        toolbar.autosavesConfiguration = false
        window.toolbar = toolbar
    }

    private func configureMainMenu() {
        let mainMenu = NSMenu(title: "Main Menu")

        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)
        let appMenu = NSMenu(title: appDisplayName)
        appMenuItem.submenu = appMenu

        addMenuItem(to: appMenu, title: "系统设置...", action: #selector(openSettings(_:)), keyEquivalent: ",")
        appMenu.addItem(.separator())
        addMenuItem(to: appMenu, title: "退出 SAPD Wiki", action: #selector(quitApp(_:)), keyEquivalent: "q")

        let windowMenuItem = NSMenuItem()
        mainMenu.addItem(windowMenuItem)
        let windowMenu = NSMenu(title: "窗口")
        windowMenuItem.submenu = windowMenu
        windowMenu.addItem(withTitle: "最小化", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m")
        addMenuItem(to: windowMenu, title: "显示主窗口", action: #selector(showMainWindow(_:)), keyEquivalent: "0")
        NSApp.windowsMenu = windowMenu

        NSApp.mainMenu = mainMenu
    }

    @discardableResult
    private func addMenuItem(to menu: NSMenu, title: String, action: Selector, keyEquivalent: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: keyEquivalent)
        item.target = self
        menu.addItem(item)
        return item
    }

    @objc private func openSettings(_ sender: Any?) {
        let current = settings ?? AppSettingsStore.load() ?? AppSettingsStore.defaultSettings()
        settings = current
        AppSettingsStore.save(current)
        try? AppSettingsStore.ensureDirectories(for: current)

        if let settingsWindow {
            refreshSettingsFields()
            settingsWindow.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
            return
        }

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 720, height: 300),
            styleMask: [.titled, .closable],
            backing: .buffered,
            defer: false
        )
        window.title = "系统设置"
        window.isReleasedWhenClosed = false
        window.center()

        let contentView = NSView()
        contentView.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = NSTextField(labelWithString: "SAPD Wiki 系统设置")
        titleLabel.font = .systemFont(ofSize: 18, weight: .semibold)

        let descriptionLabel = NSTextField(labelWithString: "路径变更会在重启 SAPD Wiki 后完整生效。")
        descriptionLabel.font = .systemFont(ofSize: 12)
        descriptionLabel.textColor = .secondaryLabelColor

        let versionRow = settingsInfoRow(title: "当前版本", value: currentDisplayVersion())
        let dataRootRow = settingsPathRow(
            title: "App 保存位置",
            path: current.dataRoot.path,
            action: #selector(changeDataRootPath(_:))
        ) { field in
            self.settingsDataRootField = field
        }
        let downloadRow = settingsPathRow(
            title: "文件下载路径",
            path: current.downloadDirectory.path,
            action: #selector(changeDownloadPath(_:))
        ) { field in
            self.settingsDownloadField = field
        }

        let doneButton = NSButton(title: "完成", target: self, action: #selector(closeSettingsWindow(_:)))
        doneButton.bezelStyle = .rounded
        doneButton.keyEquivalent = "\r"

        let buttonRow = NSStackView(views: [NSView(), doneButton])
        buttonRow.orientation = .horizontal
        buttonRow.alignment = .centerY
        buttonRow.distribution = .fill
        buttonRow.translatesAutoresizingMaskIntoConstraints = false

        let stack = NSStackView(views: [titleLabel, descriptionLabel, versionRow, dataRootRow, downloadRow, buttonRow])
        stack.orientation = .vertical
        stack.alignment = .leading
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false

        contentView.addSubview(stack)
        window.contentView = contentView
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: contentView.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: contentView.trailingAnchor, constant: -24),
            stack.topAnchor.constraint(equalTo: contentView.topAnchor, constant: 22),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: contentView.bottomAnchor, constant: -20),
            versionRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            dataRootRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            downloadRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
            buttonRow.widthAnchor.constraint(equalTo: stack.widthAnchor),
        ])

        settingsWindow = window
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func settingsInfoRow(title: String, value: String) -> NSStackView {
        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.widthAnchor.constraint(equalToConstant: 104).isActive = true

        let valueLabel = NSTextField(labelWithString: value)
        valueLabel.font = .systemFont(ofSize: 13, weight: .regular)
        valueLabel.textColor = .secondaryLabelColor
        valueLabel.lineBreakMode = .byTruncatingTail
        valueLabel.maximumNumberOfLines = 1
        valueLabel.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)

        let row = NSStackView(views: [titleLabel, valueLabel])
        row.orientation = .horizontal
        row.alignment = .centerY
        row.spacing = 12
        row.distribution = .fill
        row.translatesAutoresizingMaskIntoConstraints = false
        return row
    }

    private func settingsPathRow(title: String, path: String, action: Selector, fieldHandler: (NSTextField) -> Void) -> NSStackView {
        let titleLabel = NSTextField(labelWithString: title)
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.widthAnchor.constraint(equalToConstant: 104).isActive = true

        let pathField = NSTextField(labelWithString: path)
        pathField.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        pathField.textColor = .secondaryLabelColor
        pathField.lineBreakMode = .byTruncatingMiddle
        pathField.maximumNumberOfLines = 1
        pathField.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        fieldHandler(pathField)

        let button = NSButton(title: "更改路径", target: self, action: action)
        button.bezelStyle = .rounded
        button.setContentHuggingPriority(.required, for: .horizontal)

        let row = NSStackView(views: [titleLabel, pathField, button])
        row.orientation = .horizontal
        row.alignment = .centerY
        row.spacing = 12
        row.distribution = .fill
        row.translatesAutoresizingMaskIntoConstraints = false
        return row
    }

    @objc private func changeDataRootPath(_ sender: Any?) {
        let current = settings ?? AppSettingsStore.load() ?? AppSettingsStore.defaultSettings()
        do {
            let selectedParent = try AppSettingsStore.chooseDirectory(
                title: "选择 SAPD Wiki 保存位置",
                message: "系统会在所选位置下创建 SAPDWiki 文件夹，Runtime 和 export 都会放在 SAPDWiki 下面。",
                defaultURL: AppSettingsStore.parentDirectoryForDataRoot(current.dataRoot)
            )
            let nextDataRoot = AppSettingsStore.dataRoot(forSelectedDirectory: selectedParent)
            let shouldMoveDownload = AppSettingsStore.isDefaultDownloadDirectory(current.downloadDirectory, for: current.dataRoot)
            let nextDownload = shouldMoveDownload ? AppSettingsStore.defaultDownloadDirectory(for: nextDataRoot) : current.downloadDirectory
            saveSettings(AppSettings(dataRoot: nextDataRoot, downloadDirectory: nextDownload))
        } catch {
            AppWrapperLogger.write("settings data-root change cancelled-or-failed error=\(error.localizedDescription)")
        }
    }

    @objc private func changeDownloadPath(_ sender: Any?) {
        let current = settings ?? AppSettingsStore.load() ?? AppSettingsStore.defaultSettings()
        do {
            let nextDownload = try AppSettingsStore.chooseDirectory(
                title: "选择 SAPD Wiki 文件下载路径",
                message: "批注导出和后续文件导出会保存到这里。",
                defaultURL: current.downloadDirectory
            )
            saveSettings(AppSettings(dataRoot: current.dataRoot, downloadDirectory: nextDownload))
        } catch {
            AppWrapperLogger.write("settings download change cancelled-or-failed error=\(error.localizedDescription)")
        }
    }

    private func saveSettings(_ next: AppSettings) {
        settings = next
        AppSettingsStore.save(next)
        try? AppSettingsStore.ensureDirectories(for: next)
        refreshSettingsFields()
    }

    private func refreshSettingsFields() {
        guard let current = settings ?? AppSettingsStore.load() else {
            return
        }
        settingsDataRootField?.stringValue = current.dataRoot.path
        settingsDownloadField?.stringValue = current.downloadDirectory.path
    }

    @objc private func closeSettingsWindow(_ sender: Any?) {
        settingsWindow?.orderOut(nil)
    }

    @objc private func showMainWindow(_ sender: Any?) {
        showPrimaryWindow()
    }

    @objc private func quitApp(_ sender: Any?) {
        NSApp.terminate(sender)
    }

    @objc private func reloadPage(_ sender: Any?) {
        guard let webView else {
            return
        }
        AppWrapperLogger.write("webview reload requested url=\(webView.url?.absoluteString ?? "unknown")")
        webView.reload()
    }

    @objc private func reloadPageFromOrigin(_ sender: Any?) {
        guard let webView else {
            return
        }
        AppWrapperLogger.write("webview reload-from-origin requested url=\(webView.url?.absoluteString ?? "unknown")")
        webView.reloadFromOrigin()
    }

    nonisolated private static func prepareAndLaunchBackend(settings: AppSettings, _ completion: @escaping (Result<BackendLaunch, Error>) -> Void) {
        do {
            AppWrapperLogger.write("launch-backend start")
            let runtimeRoot = try RuntimeInstaller(settings: settings).prepareRuntime()
            terminateExistingBackends(runtimeRoot: runtimeRoot)
            let process = try startBackend(runtimeRoot: runtimeRoot)
            let url = try waitForBackend(runtimeRoot: runtimeRoot, process: process)
            AppWrapperLogger.write("launch-backend ready url=\(url.absoluteString)")
            completion(.success(BackendLaunch(runtimeRoot: runtimeRoot, process: process, url: url)))
        } catch {
            AppWrapperLogger.write("launch-backend failed error=\(error.localizedDescription)")
            completion(.failure(error))
        }
    }

    nonisolated private static func startBackend(runtimeRoot: URL) throws -> Process {
        let backendURL = runtimeRoot.appendingPathComponent("SAPD-Wiki-Backend")
        guard FileManager.default.isExecutableFile(atPath: backendURL.path) else {
            throw RuntimeError("SAPD-Wiki-Backend is missing or not executable.")
        }

        let process = Process()
        process.executableURL = backendURL
        process.currentDirectoryURL = runtimeRoot
        process.arguments = ["--bundle-root", runtimeRoot.path, "--no-browser"]

        let logsRoot = runtimeRoot.appendingPathComponent("logs", isDirectory: true)
        try FileManager.default.createDirectory(at: logsRoot, withIntermediateDirectories: true)
        try? FileManager.default.removeItem(at: logsRoot.appendingPathComponent("runtime-state.json"))

        let consoleURL = logsRoot.appendingPathComponent("backend-wrapper-console.log")
        if !FileManager.default.fileExists(atPath: consoleURL.path) {
            FileManager.default.createFile(atPath: consoleURL.path, contents: nil)
        }
        let output = try FileHandle(forWritingTo: consoleURL)
        try output.seekToEnd()
        try output.write(contentsOf: Data("\n--- wrapper start \(AppWrapperLogger.timestamp()) ---\n".utf8))
        process.standardOutput = output
        process.standardError = output
        process.terminationHandler = { terminated in
            AppWrapperLogger.write("backend-process terminated status=\(terminated.terminationStatus) reason=\(terminated.terminationReason.rawValue)")
            if terminated.terminationStatus != 0 {
                DispatchQueue.main.async {
                    if let delegate = NSApp.delegate as? AppDelegate {
                        let logsPath = delegate.runtimeRoot?.appendingPathComponent("logs", isDirectory: true).path ?? "Runtime/logs"
                        delegate.showStatus("本地服务已退出，退出码：\(terminated.terminationStatus)。请查看 \(logsPath)。")
                    }
                }
            }
        }

        AppWrapperLogger.write("backend-process run executable=\(backendURL.path) bundleRoot=\(runtimeRoot.path)")
        try process.run()
        AppWrapperLogger.write("backend-process pid=\(process.processIdentifier)")
        return process
    }

    nonisolated private static func terminateExistingBackends(runtimeRoot: URL) {
        let backendPath = runtimeRoot.appendingPathComponent("SAPD-Wiki-Backend").path
        let bundleRootArg = "--bundle-root \(runtimeRoot.path)"
        guard let output = try? runProcessOutput(executable: "/bin/ps", arguments: ["-ax", "-o", "pid=,command="]) else {
            return
        }
        let matchingPIDs = output
            .split(separator: "\n")
            .compactMap { line -> pid_t? in
                let value = String(line)
                guard value.contains(backendPath), value.contains(bundleRootArg) else {
                    return nil
                }
                let pidText = value.trimmingCharacters(in: .whitespaces).split(separator: " ").first
                return pidText.flatMap { pid_t($0) }
            }

        for pid in matchingPIDs {
            Darwin.kill(pid, SIGTERM)
        }
        if !matchingPIDs.isEmpty {
            let pidsText = matchingPIDs.map { String($0) }.joined(separator: ",")
            AppWrapperLogger.write("stale-backend terminate pids=\(pidsText)")
            Thread.sleep(forTimeInterval: 0.4)
        }
        for pid in matchingPIDs where Darwin.kill(pid, 0) == 0 {
            Darwin.kill(pid, SIGKILL)
            AppWrapperLogger.write("stale-backend force-kill pid=\(pid)")
        }
    }

    nonisolated private static func runProcessOutput(executable: String, arguments: [String]) throws -> String {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: executable)
        process.arguments = arguments
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = Pipe()
        try process.run()
        let data = pipe.fileHandleForReading.readDataToEndOfFile()
        process.waitUntilExit()
        return String(data: data, encoding: .utf8) ?? ""
    }

    nonisolated private static func waitForBackend(runtimeRoot: URL, process: Process) throws -> URL {
        let stateURL = runtimeRoot.appendingPathComponent("logs/runtime-state.json")
        let deadline = Date().addingTimeInterval(35)
        while Date() < deadline {
            if let url = readRuntimeURL(from: stateURL), healthCheck(url: url) {
                return url
            }
            if !process.isRunning {
                throw RuntimeError("本地服务启动失败，退出码：\(process.terminationStatus)。请查看 \(runtimeRoot.appendingPathComponent("logs", isDirectory: true).path)。")
            }
            Thread.sleep(forTimeInterval: 0.35)
        }

        throw RuntimeError("本地服务启动超时。请查看 \(runtimeRoot.appendingPathComponent("logs/runtime.log").path)。")
    }

    nonisolated private static func readRuntimeURL(from stateURL: URL) -> URL? {
        guard let data = try? Data(contentsOf: stateURL),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let value = object["url"] as? String
        else {
            return nil
        }
        return URL(string: value)
    }

    nonisolated private static func healthCheck(url: URL) -> Bool {
        guard let healthURL = URL(string: "/api/v1/health", relativeTo: url)?.absoluteURL else {
            return false
        }
        let semaphore = DispatchSemaphore(value: 0)
        let result = HealthCheckResult()
        let task = URLSession.shared.dataTask(with: healthURL) { data, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200, data != nil {
                result.isReady = true
            }
            semaphore.signal()
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 1.0)
        return result.isReady
    }

    private func load(url: URL) {
        webView?.load(URLRequest(url: url))
        window?.title = windowDisplayTitle()
    }

    private func showPrimaryWindow() {
        guard let window else {
            return
        }
        if window.isMiniaturized {
            window.deminiaturize(nil)
        }
        webView?.isHidden = false
        window.contentView?.isHidden = false
        window.title = windowDisplayTitle()
        window.makeKeyAndOrderFront(nil)
        window.orderFrontRegardless()
        window.contentView?.needsDisplay = true
        webView?.needsDisplay = true
        NSApp.unhide(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func showStatus(_ message: String) {
        let html = """
        <!doctype html>
        <html lang="zh-CN">
        <meta charset="utf-8">
        <style>
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
            color: #1f2937;
            background: #f7f8fb;
          }
          main {
            width: min(560px, calc(100vw - 64px));
            padding: 32px;
            border: 1px solid #d8dee9;
            border-radius: 14px;
            background: white;
            box-shadow: 0 20px 50px rgba(31, 41, 55, 0.12);
          }
          h1 {
            margin: 0 0 12px;
            font-size: 22px;
          }
          p {
            margin: 0;
            line-height: 1.7;
            font-size: 14px;
            color: #4b5563;
          }
        </style>
        <main>
          <h1>SAPD Wiki</h1>
          <p>\(escapeHTML(message))</p>
        </main>
        </html>
        """
        webView?.loadHTMLString(html, baseURL: nil)
    }

    private func stopBackend() {
        AppWrapperLogger.write("stop-backend requested")
        guard let process = backendProcess, process.isRunning else {
            if let runtimeRoot {
                AppDelegate.terminateExistingBackends(runtimeRoot: runtimeRoot)
            }
            return
        }
        process.terminate()
        let cleanupRuntimeRoot = runtimeRoot
        let deadline = Date().addingTimeInterval(2.0)
        while process.isRunning, Date() < deadline {
            Thread.sleep(forTimeInterval: 0.1)
        }
        if process.isRunning {
            process.interrupt()
            Thread.sleep(forTimeInterval: 0.3)
            if let cleanupRuntimeRoot {
                AppDelegate.terminateExistingBackends(runtimeRoot: cleanupRuntimeRoot)
            }
        }
        if let cleanupRuntimeRoot {
            AppDelegate.terminateExistingBackends(runtimeRoot: cleanupRuntimeRoot)
        }
    }

    private func escapeHTML(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }
}

extension AppDelegate: NSToolbarDelegate {
    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.flexibleSpace, ToolbarIdentifiers.reloadPage, ToolbarIdentifiers.reloadFromOrigin]
    }

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.flexibleSpace, ToolbarIdentifiers.reloadPage, ToolbarIdentifiers.reloadFromOrigin]
    }

    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier itemIdentifier: NSToolbarItem.Identifier, willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        switch itemIdentifier {
        case ToolbarIdentifiers.reloadPage:
            return toolbarButton(
                identifier: itemIdentifier,
                label: "刷新页面",
                toolTip: "刷新页面（保留 WebView 缓存）",
                systemSymbolName: "arrow.clockwise",
                action: #selector(reloadPage(_:))
            )
        case ToolbarIdentifiers.reloadFromOrigin:
            return toolbarButton(
                identifier: itemIdentifier,
                label: "强制刷新",
                toolTip: "强制刷新（绕过缓存重新加载）",
                systemSymbolName: "arrow.triangle.2.circlepath",
                action: #selector(reloadPageFromOrigin(_:))
            )
        default:
            return nil
        }
    }

    private func toolbarButton(identifier: NSToolbarItem.Identifier, label: String, toolTip: String, systemSymbolName: String, action: Selector) -> NSToolbarItem {
        let item = NSToolbarItem(itemIdentifier: identifier)
        item.label = label
        item.paletteLabel = label
        item.toolTip = toolTip
        item.image = NSImage(systemSymbolName: systemSymbolName, accessibilityDescription: label)
        item.target = self
        item.action = action
        return item
    }
}

extension AppDelegate: NSWindowDelegate {
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        NSApp.hide(nil)
        AppWrapperLogger.write("window close requested hide-instead-of-quit")
        return false
    }

    func windowDidMiniaturize(_ notification: Notification) {
        AppWrapperLogger.write("window miniaturized")
    }

    func windowDidDeminiaturize(_ notification: Notification) {
        guard notification.object as? NSWindow === window else {
            return
        }
        AppWrapperLogger.write("window deminiaturized")
        showPrimaryWindow()
    }
}

private enum ToolbarIdentifiers {
    static let main = NSToolbar.Identifier("SAPDWiki.MainToolbar")
    static let reloadPage = NSToolbarItem.Identifier("SAPDWiki.ReloadPage")
    static let reloadFromOrigin = NSToolbarItem.Identifier("SAPDWiki.ReloadFromOrigin")
}

private struct BackendLaunch {
    let runtimeRoot: URL
    let process: Process
    let url: URL
}

private final class HealthCheckResult: @unchecked Sendable {
    var isReady = false
}

private enum AppWrapperLogger {
    nonisolated static func timestamp() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    nonisolated static func write(_ message: String) {
        let line = "[\(timestamp())] \(message)\n"
        do {
            let logDir = FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent("Library", isDirectory: true)
                .appendingPathComponent("Logs", isDirectory: true)
                .appendingPathComponent(appDisplayName, isDirectory: true)
            try FileManager.default.createDirectory(at: logDir, withIntermediateDirectories: true)
            let logURL = logDir.appendingPathComponent(wrapperLogName)
            if !FileManager.default.fileExists(atPath: logURL.path) {
                FileManager.default.createFile(atPath: logURL.path, contents: nil)
            }
            let handle = try FileHandle(forWritingTo: logURL)
            try handle.seekToEnd()
            try handle.write(contentsOf: Data(line.utf8))
            try handle.close()
        } catch {
            NSLog("SAPD Wiki wrapper log failed: \(error.localizedDescription)")
        }
    }
}

struct RuntimeError: LocalizedError {
    let message: String

    init(_ message: String) {
        self.message = message
    }

    var errorDescription: String? {
        message
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()
