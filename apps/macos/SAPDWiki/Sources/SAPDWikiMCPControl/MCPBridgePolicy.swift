import Foundation

public struct MCPLocalOrigin: Equatable {
    public let scheme: String
    public let host: String
    public let port: Int

    public init?(url: URL) {
        guard let scheme = url.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              url.host?.lowercased() == "127.0.0.1",
              let port = url.port,
              url.user == nil,
              url.password == nil
        else {
            return nil
        }
        self.scheme = scheme
        self.host = "127.0.0.1"
        self.port = port
    }

    public func matches(scheme: String, host: String, port: Int) -> Bool {
        self.scheme == scheme.lowercased()
            && self.host == host.lowercased()
            && self.port == port
    }

    public func matches(url: URL) -> Bool {
        guard let candidate = MCPLocalOrigin(url: url) else {
            return false
        }
        return candidate == self
    }
}

public struct MCPBridgeEnvelope: Equatable {
    public let requestID: String
    public let action: MCPBridgeAction
    public let parameters: [String: String]

    public init?(object: Any) {
        guard let body = object as? [String: Any],
              Set(body.keys) == Set(["request_id", "action", "parameters"]),
              let requestID = body["request_id"] as? String,
              requestID.range(of: #"^[A-Za-z0-9_-]{1,80}$"#, options: .regularExpression) != nil,
              let rawAction = body["action"] as? String,
              let action = MCPBridgeAction(rawValue: rawAction),
              let rawParameters = body["parameters"] as? [String: Any],
              rawParameters.isEmpty
        else {
            return nil
        }
        self.requestID = requestID
        self.action = action
        self.parameters = [:]
    }
}
