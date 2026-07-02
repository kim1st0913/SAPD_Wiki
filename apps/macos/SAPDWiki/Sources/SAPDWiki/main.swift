import Cocoa
import Darwin
import Foundation
import WebKit

private let bundleIdentifier = "com.sapd.wiki.macos"
private let appDisplayName = "SAPD Wiki"
private let wrapperLogName = "app-wrapper.log"
private let runtimeFingerprintName = ".sapd-runtime-fingerprint"

final class RuntimeInstaller {
    private let fileManager = FileManager.default

    func prepareRuntime() throws -> URL {
        guard let sourceRuntime = Bundle.main.resourceURL?.appendingPathComponent("Runtime") else {
            throw RuntimeError("Cannot locate bundled runtime resources.")
        }
        guard fileManager.fileExists(atPath: sourceRuntime.path) else {
            throw RuntimeError("Bundled runtime is missing at \(sourceRuntime.path).")
        }

        AppWrapperLogger.write("prepare-runtime start source=\(sourceRuntime.path)")
        let supportRoot = try applicationSupportRoot()
        let runtimeRoot = supportRoot.appendingPathComponent("Runtime", isDirectory: true)
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

    private func applicationSupportRoot() throws -> URL {
        guard let support = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            throw RuntimeError("Cannot locate Application Support directory.")
        }
        let root = support.appendingPathComponent(appDisplayName, isDirectory: true)
        try fileManager.createDirectory(at: root, withIntermediateDirectories: true)
        return root
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

    private func seedUserDataIfNeeded(from sourceRoot: URL, to targetRoot: URL) throws {
        let sourceUser = sourceRoot.appendingPathComponent("data/user", isDirectory: true)
        let targetUser = targetRoot.appendingPathComponent("data/user", isDirectory: true)
        try fileManager.createDirectory(at: targetUser, withIntermediateDirectories: true)
        let sourceDB = sourceUser.appendingPathComponent("sapd_wiki_user.sqlite3")
        let targetDB = targetUser.appendingPathComponent("sapd_wiki_user.sqlite3")
        if !fileManager.fileExists(atPath: targetDB.path), fileManager.fileExists(atPath: sourceDB.path) {
            try fileManager.copyItem(at: sourceDB, to: targetDB)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var backendProcess: Process?
    private var runtimeRoot: URL?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        createWindow()
        showStatus("正在准备本地运行环境...")
        DispatchQueue.global(qos: .userInitiated).async {
            AppDelegate.prepareAndLaunchBackend { result in
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
        true
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
        window.title = appDisplayName
        window.contentView = webView
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        self.window = window
    }

    nonisolated private static func prepareAndLaunchBackend(_ completion: @escaping (Result<BackendLaunch, Error>) -> Void) {
        do {
            AppWrapperLogger.write("launch-backend start")
            let runtimeRoot = try RuntimeInstaller().prepareRuntime()
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
                        delegate.showStatus("本地服务已退出，退出码：\(terminated.terminationStatus)。请查看 Application Support/SAPD Wiki/Runtime/logs。")
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
                throw RuntimeError("本地服务启动失败，退出码：\(process.terminationStatus)。请查看 Application Support/SAPD Wiki/Runtime/logs。")
            }
            Thread.sleep(forTimeInterval: 0.35)
        }

        throw RuntimeError("本地服务启动超时。请查看 Application Support/SAPD Wiki/Runtime/logs/runtime.log。")
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
        window?.title = appDisplayName
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
