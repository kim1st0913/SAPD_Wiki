import Cocoa
import SAPDWikiMCPControl

final class MCPMenuBarController: NSObject {
    private let supervisor: MCPSupervisor
    private let showMainWindow: () -> Void
    private let statusItem: NSStatusItem
    private let statusMenuItem = NSMenuItem(title: "MCP 未启用", action: nil, keyEquivalent: "")
    private let stopMenuItem = NSMenuItem(title: "停止 MCP", action: #selector(stopMCP(_:)), keyEquivalent: "")

    init(supervisor: MCPSupervisor, showMainWindow: @escaping () -> Void) {
        self.supervisor = supervisor
        self.showMainWindow = showMainWindow
        self.statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        super.init()
        configure()
        update(snapshot: supervisor.snapshot)
    }

    func update(snapshot: MCPRuntimeSnapshot) {
        statusItem.button?.title = snapshot.serviceState == .ready ? "SAPD MCP" : "SAPD"
        statusMenuItem.title = statusText(for: snapshot)
        stopMenuItem.isEnabled = snapshot.serviceState != .stopped
    }

    private func configure() {
        statusItem.button?.toolTip = "SAPD Wiki MCP"
        let menu = NSMenu()
        menu.addItem(statusMenuItem)
        menu.addItem(.separator())

        let showItem = NSMenuItem(title: "显示 SAPD Wiki", action: #selector(showApp(_:)), keyEquivalent: "")
        showItem.target = self
        menu.addItem(showItem)

        stopMenuItem.target = self
        menu.addItem(stopMenuItem)
        statusItem.menu = menu
    }

    private func statusText(for snapshot: MCPRuntimeSnapshot) -> String {
        switch snapshot.serviceState {
        case .stopped:
            "MCP 未启用"
        case .starting:
            "MCP 正在启动"
        case .ready:
            snapshot.authorizationState == .pending ? "MCP 等待授权确认" : "MCP 服务已就绪"
        case .stopping:
            "MCP 正在停止"
        case .error:
            "MCP 错误：\(snapshot.lastErrorCode ?? "UNKNOWN")"
        }
    }

    @objc private func showApp(_ sender: Any?) {
        showMainWindow()
    }

    @objc private func stopMCP(_ sender: Any?) {
        _ = supervisor.stop()
    }
}
