import Foundation
import SAPDWikiMCPControl
import WebKit

final class MacMCPBridge: NSObject, WKScriptMessageHandler {
    static let handlerName = "sapdMCP"

    private let supervisor: MCPSupervisor
    private var trustedOrigin: MCPLocalOrigin?

    init(supervisor: MCPSupervisor) {
        self.supervisor = supervisor
    }

    func install(in configuration: WKWebViewConfiguration) {
        configuration.userContentController.add(self, name: Self.handlerName)
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.bootstrapScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
    }

    func updateTrustedOrigin(from url: URL) {
        trustedOrigin = MCPLocalOrigin(url: url)
    }

    func allowsNavigation(to url: URL) -> Bool {
        trustedOrigin?.matches(url: url) == true
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.handlerName,
              message.frameInfo.isMainFrame,
              let trustedOrigin,
              trustedOrigin.matches(
                  scheme: message.frameInfo.securityOrigin.protocol,
                  host: message.frameInfo.securityOrigin.host,
                  port: message.frameInfo.securityOrigin.port
              ),
              let envelope = MCPBridgeEnvelope(object: message.body)
        else {
            return
        }

        let response = supervisor.handleBridgeAction(
            envelope.action,
            parameters: envelope.parameters
        )
        send(response: response, requestID: envelope.requestID, webView: message.webView)
    }

    private func send(
        response: MCPBridgeResponse,
        requestID: String,
        webView: WKWebView?
    ) {
        let snapshot = response.snapshot
        let payload: [String: Any] = [
            "requestId": requestID,
            "ok": response.ok,
            "errorCode": response.errorCode ?? NSNull(),
            "status": [
                "desiredState": snapshot.desiredState.rawValue,
                "serviceState": snapshot.serviceState.rawValue,
                "authorizationState": snapshot.authorizationState.rawValue,
                "activityState": snapshot.activityState.rawValue,
                "knowledgeState": snapshot.knowledgeState.rawValue,
                "auditState": snapshot.auditState.rawValue,
                "profile": snapshot.profile.rawValue,
                "configuredPort": snapshot.configuredPort,
                "lastErrorCode": snapshot.lastErrorCode ?? NSNull(),
            ],
        ]
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8)
        else {
            return
        }
        webView?.evaluateJavaScript(
            "window.dispatchEvent(new CustomEvent('sapd:mcp-response',{detail:\(json)}));"
        )
    }

    private static let bootstrapScript = """
    (() => {
      const pending = new Map();
      const allowed = new Set(["get_status", "start", "stop", "retry"]);
      const invoke = (action, parameters = {}) => {
        if (!allowed.has(action) || Object.keys(parameters).length !== 0) {
          return Promise.reject(new Error("INVALID_PARAMETERS"));
        }
        const requestId = globalThis.crypto.randomUUID().replaceAll("-", "");
        return new Promise((resolve) => {
          pending.set(requestId, resolve);
          window.webkit.messageHandlers.sapdMCP.postMessage({
            request_id: requestId,
            action,
            parameters: {}
          });
        });
      };
      window.addEventListener("sapd:mcp-response", (event) => {
        const detail = event.detail || {};
        const resolve = pending.get(detail.requestId);
        if (!resolve) return;
        pending.delete(detail.requestId);
        resolve(Object.freeze(detail));
      });
      const existing = window.sapdDesktop || {};
      Object.defineProperty(window, "sapdDesktop", {
        configurable: false,
        writable: false,
        value: Object.freeze({
          ...existing,
          platform: "darwin",
          isDesktop: true,
          mcp: Object.freeze({ invoke })
        })
      });
    })();
    """
}
