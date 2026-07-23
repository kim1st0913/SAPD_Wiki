import Cocoa
import SAPDWikiMCPControl

final class MCPAuthorizationPromptController {
    func present(request: MCPAuthorizationRequest, parentWindow: NSWindow?) {
        let alert = NSAlert()
        alert.alertStyle = .informational
        alert.messageText = "MCP 授权请求"
        alert.informativeText = "\(request.clientDisplayName) 正在请求授权。请返回 SAPD Wiki 的 AI 集成页面继续确认。"
        alert.addButton(withTitle: "返回 SAPD Wiki")
        alert.addButton(withTitle: "稍后")

        if let parentWindow, parentWindow.isVisible {
            alert.beginSheetModal(for: parentWindow, completionHandler: nil)
        } else {
            alert.runModal()
        }
    }
}
