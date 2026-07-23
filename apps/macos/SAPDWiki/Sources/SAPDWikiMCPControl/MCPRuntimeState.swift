import Foundation

public enum MCPProfile: String, Codable, CaseIterable {
    case stable
    case beta
    case dev

    public var configuredPort: Int {
        switch self {
        case .stable:
            18_775
        case .beta:
            18_776
        case .dev:
            28_775
        }
    }
}

public enum MCPDesiredState: String, Codable {
    case disabled
    case enabled
}

public enum MCPServiceState: String, Codable {
    case stopped
    case starting
    case ready
    case stopping
    case error
}

public enum MCPAuthorizationState: String, Codable {
    case noClients = "no_clients"
    case pending
    case authorized
    case revoked
    case error
}

public enum MCPActivityState: String, Codable {
    case never
    case idle
    case recent
}

public enum MCPKnowledgeState: String, Codable {
    case ready
    case degraded
    case blocked
}

public enum MCPAuditState: String, Codable {
    case disabled
    case ready
    case degraded
}

public struct MCPRuntimeSnapshot: Codable, Equatable {
    public var desiredState: MCPDesiredState
    public var serviceState: MCPServiceState
    public var authorizationState: MCPAuthorizationState
    public var activityState: MCPActivityState
    public var knowledgeState: MCPKnowledgeState
    public var auditState: MCPAuditState
    public let profile: MCPProfile
    public let configuredPort: Int
    public var lastErrorCode: String?

    public init(
        desiredState: MCPDesiredState = .disabled,
        serviceState: MCPServiceState = .stopped,
        authorizationState: MCPAuthorizationState = .noClients,
        activityState: MCPActivityState = .never,
        knowledgeState: MCPKnowledgeState = .ready,
        auditState: MCPAuditState = .disabled,
        profile: MCPProfile,
        lastErrorCode: String? = nil
    ) {
        self.desiredState = desiredState
        self.serviceState = serviceState
        self.authorizationState = authorizationState
        self.activityState = activityState
        self.knowledgeState = knowledgeState
        self.auditState = auditState
        self.profile = profile
        self.configuredPort = profile.configuredPort
        self.lastErrorCode = lastErrorCode
    }

    enum CodingKeys: String, CodingKey {
        case desiredState = "desired_state"
        case serviceState = "service_state"
        case authorizationState = "authorization_state"
        case activityState = "activity_state"
        case knowledgeState = "knowledge_state"
        case auditState = "audit_state"
        case profile
        case configuredPort = "configured_port"
        case lastErrorCode = "last_error_code"
    }
}

public struct MCPInstanceIdentity: Equatable {
    public let osUser: String
    public let installationID: String
    public let runtimeID: String
    public let releaseChannel: String
    public let appVersion: String
    public let instanceID: String
    public let pid: Int32
    public let processStartTime: UInt64
    public let executableContentHash: String
    public let configuredPort: Int
    public let leaseEpoch: UInt64
    public let heartbeatTime: Date

    public init(
        osUser: String,
        installationID: String,
        runtimeID: String,
        releaseChannel: String,
        appVersion: String,
        instanceID: String,
        pid: Int32,
        processStartTime: UInt64,
        executableContentHash: String,
        configuredPort: Int,
        leaseEpoch: UInt64,
        heartbeatTime: Date
    ) {
        self.osUser = osUser
        self.installationID = installationID
        self.runtimeID = runtimeID
        self.releaseChannel = releaseChannel
        self.appVersion = appVersion
        self.instanceID = instanceID
        self.pid = pid
        self.processStartTime = processStartTime
        self.executableContentHash = executableContentHash
        self.configuredPort = configuredPort
        self.leaseEpoch = leaseEpoch
        self.heartbeatTime = heartbeatTime
    }

    public func hasSameStableIdentity(as other: MCPInstanceIdentity) -> Bool {
        hasCompleteStableIdentity
            && other.hasCompleteStableIdentity
            && osUser == other.osUser
            && installationID == other.installationID
            && runtimeID == other.runtimeID
            && releaseChannel == other.releaseChannel
            && appVersion == other.appVersion
            && instanceID == other.instanceID
            && pid == other.pid
            && processStartTime == other.processStartTime
            && executableContentHash == other.executableContentHash
            && configuredPort == other.configuredPort
            && leaseEpoch == other.leaseEpoch
    }

    public var hasCompleteStableIdentity: Bool {
        !osUser.isEmpty
            && !installationID.isEmpty
            && !runtimeID.isEmpty
            && !releaseChannel.isEmpty
            && !appVersion.isEmpty
            && !instanceID.isEmpty
            && pid > 0
            && processStartTime > 0
            && !executableContentHash.isEmpty
            && configuredPort > 0
            && leaseEpoch > 0
    }

    public func heartbeatIsFresh(at now: Date, maximumAge: TimeInterval) -> Bool {
        let age = now.timeIntervalSince(heartbeatTime)
        return age >= 0 && age <= maximumAge
    }
}

public enum MCPBridgeAction: String, CaseIterable {
    case getStatus = "get_status"
    case start
    case stop
    case retry
}

public struct MCPBridgeResponse: Equatable {
    public let ok: Bool
    public let errorCode: String?
    public let snapshot: MCPRuntimeSnapshot

    public init(ok: Bool, errorCode: String?, snapshot: MCPRuntimeSnapshot) {
        self.ok = ok
        self.errorCode = errorCode
        self.snapshot = snapshot
    }
}
