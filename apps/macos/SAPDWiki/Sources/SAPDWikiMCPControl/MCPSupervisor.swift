import Foundation

public enum MCPGracefulStopResult {
    case stopped
    case stillRunning
}

public struct MCPLaunchRequest: Equatable {
    public let profile: MCPProfile
    public let configuredPort: Int

    public init(profile: MCPProfile) {
        self.profile = profile
        self.configuredPort = profile.configuredPort
    }
}

public protocol MCPProcessRuntime: AnyObject {
    func launch(_ request: MCPLaunchRequest) throws -> MCPInstanceIdentity
    func requestGracefulStop(for identity: MCPInstanceIdentity) throws -> MCPGracefulStopResult
    func observeProcess(pid: Int32) -> MCPInstanceIdentity?
    func boundedTerminate(identity: MCPInstanceIdentity, timeout: TimeInterval) throws -> Bool
}

public struct MCPAuthorizationRequest: Equatable {
    public let requestID: String
    public let clientDisplayName: String

    public init(requestID: String, clientDisplayName: String) {
        self.requestID = requestID.range(
            of: #"^[A-Za-z0-9_-]{1,80}$"#,
            options: .regularExpression
        ) == nil ? "invalid-request" : requestID
        let visibleName = clientDisplayName
            .components(separatedBy: .controlCharacters)
            .joined()
            .trimmingCharacters(in: .whitespacesAndNewlines)
        self.clientDisplayName = visibleName.isEmpty
            ? "未知客户端"
            : String(visibleName.prefix(80))
    }
}

public struct MCPControlError: LocalizedError, Equatable {
    public let code: String

    public init(_ code: String) {
        self.code = code
    }

    public var errorDescription: String? {
        code
    }
}

public final class MCPSupervisor {
    public private(set) var snapshot: MCPRuntimeSnapshot
    public var onSnapshotChange: ((MCPRuntimeSnapshot) -> Void)?
    public var onAuthorizationRequest: ((MCPAuthorizationRequest) -> Void)?

    private let processRuntime: MCPProcessRuntime
    private var ownedIdentity: MCPInstanceIdentity?

    public init(profile: MCPProfile, processRuntime: MCPProcessRuntime) {
        self.snapshot = MCPRuntimeSnapshot(profile: profile)
        self.processRuntime = processRuntime
    }

    @discardableResult
    public func start() -> MCPBridgeResponse {
        if snapshot.serviceState == .ready || snapshot.serviceState == .starting {
            return response(ok: true)
        }
        guard ownedIdentity == nil else {
            fail(code: "OWNED_PROCESS_REQUIRES_RECOVERY")
            return response(ok: false)
        }

        snapshot.desiredState = .enabled
        snapshot.serviceState = .starting
        snapshot.lastErrorCode = nil
        publish()

        do {
            let identity = try processRuntime.launch(MCPLaunchRequest(profile: snapshot.profile))
            ownedIdentity = identity
            guard identity.hasCompleteStableIdentity else {
                throw MCPControlError("PROCESS_IDENTITY_INCOMPLETE")
            }
            guard identity.configuredPort == snapshot.configuredPort else {
                throw MCPControlError("FIXED_PORT_MISMATCH")
            }
            snapshot.serviceState = .ready
            publish()
            return response(ok: true)
        } catch let error as MCPControlError {
            fail(code: error.code)
            return response(ok: false)
        } catch {
            fail(code: "PROCESS_START_FAILED")
            return response(ok: false)
        }
    }

    @discardableResult
    public func stop() -> MCPBridgeResponse {
        snapshot.desiredState = .disabled
        guard let identity = ownedIdentity else {
            snapshot.serviceState = .stopped
            snapshot.lastErrorCode = nil
            publish()
            return response(ok: true)
        }

        snapshot.serviceState = .stopping
        snapshot.lastErrorCode = nil
        publish()

        do {
            guard let observed = processRuntime.observeProcess(pid: identity.pid) else {
                fail(code: "PROCESS_IDENTITY_UNVERIFIED")
                return response(ok: false)
            }
            guard identity.hasSameStableIdentity(as: observed) else {
                fail(code: "PROCESS_OWNERSHIP_AMBIGUOUS")
                return response(ok: false)
            }
            switch try processRuntime.requestGracefulStop(for: identity) {
            case .stopped:
                finishStopped()
                return response(ok: true)
            case .stillRunning:
                guard try processRuntime.boundedTerminate(identity: observed, timeout: 2.0) else {
                    fail(code: "PROCESS_TERMINATION_TIMEOUT")
                    return response(ok: false)
                }
                finishStopped()
                return response(ok: true)
            }
        } catch let error as MCPControlError {
            fail(code: error.code)
            return response(ok: false)
        } catch {
            fail(code: "PROCESS_STOP_FAILED")
            return response(ok: false)
        }
    }

    @discardableResult
    public func retry() -> MCPBridgeResponse {
        if ownedIdentity != nil {
            let stopped = stop()
            guard stopped.ok else {
                return stopped
            }
        }
        return start()
    }

    public func handleProcessExit(identity: MCPInstanceIdentity, expected: Bool) {
        guard let ownedIdentity, ownedIdentity.hasSameStableIdentity(as: identity) else {
            return
        }
        self.ownedIdentity = nil
        if snapshot.desiredState == .disabled || expected {
            snapshot.serviceState = .stopped
            snapshot.lastErrorCode = nil
        } else {
            snapshot.serviceState = .error
            snapshot.lastErrorCode = "PROCESS_EXITED"
        }
        publish()
    }

    public func receiveAuthorizationRequest(_ request: MCPAuthorizationRequest) {
        snapshot.authorizationState = .pending
        publish()
        onAuthorizationRequest?(request)
    }

    public func handleBridgeAction(
        _ action: MCPBridgeAction,
        parameters: [String: String] = [:]
    ) -> MCPBridgeResponse {
        guard parameters.isEmpty else {
            return MCPBridgeResponse(ok: false, errorCode: "INVALID_PARAMETERS", snapshot: snapshot)
        }
        switch action {
        case .getStatus:
            return response(ok: true)
        case .start:
            return start()
        case .stop:
            return stop()
        case .retry:
            return retry()
        }
    }

    private func finishStopped() {
        ownedIdentity = nil
        snapshot.serviceState = .stopped
        snapshot.lastErrorCode = nil
        publish()
    }

    private func fail(code: String) {
        snapshot.serviceState = .error
        snapshot.lastErrorCode = code
        publish()
    }

    private func publish() {
        onSnapshotChange?(snapshot)
    }

    private func response(ok: Bool) -> MCPBridgeResponse {
        MCPBridgeResponse(ok: ok, errorCode: ok ? nil : snapshot.lastErrorCode, snapshot: snapshot)
    }
}
