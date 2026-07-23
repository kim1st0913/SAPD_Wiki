import Foundation

public protocol MCPSecretStore: AnyObject {
    func store(secret: Data, for key: String) throws
    func retrieveSecret(for key: String) throws -> Data?
    func deleteSecret(for key: String) throws
}

public final class InMemoryMCPSecretStore: MCPSecretStore {
    private var values: [String: Data] = [:]

    public init() {}

    public func store(secret: Data, for key: String) throws {
        values[key] = secret
    }

    public func retrieveSecret(for key: String) throws -> Data? {
        values[key]
    }

    public func deleteSecret(for key: String) throws {
        values.removeValue(forKey: key)
    }
}

public enum MCPCertificateTrustOperation: String, Equatable {
    case install
    case repair
    case rotate
    case remove
}

public struct MCPCertificateTrustPlan: Equatable {
    public let operation: MCPCertificateTrustOperation
    public let certificateFingerprint: String
    public let confirmationID: String

    public init(
        operation: MCPCertificateTrustOperation,
        certificateFingerprint: String,
        confirmationID: String
    ) {
        self.operation = operation
        self.certificateFingerprint = certificateFingerprint
        self.confirmationID = confirmationID
    }
}

public struct MCPExplicitConfirmation: Equatable {
    public let confirmationID: String
    public let approved: Bool

    public init(confirmationID: String, approved: Bool) {
        self.confirmationID = confirmationID
        self.approved = approved
    }
}

public protocol MCPCertificateTrustStore: AnyObject {
    func isTrusted(certificateFingerprint: String) throws -> Bool
    func apply(
        plan: MCPCertificateTrustPlan,
        confirmation: MCPExplicitConfirmation
    ) throws
}

public final class RecordingMCPCertificateTrustStore: MCPCertificateTrustStore {
    public private(set) var appliedPlans: [MCPCertificateTrustPlan] = []
    private var trustedFingerprints: Set<String> = []

    public init() {}

    public func isTrusted(certificateFingerprint: String) throws -> Bool {
        trustedFingerprints.contains(certificateFingerprint)
    }

    public func apply(
        plan: MCPCertificateTrustPlan,
        confirmation: MCPExplicitConfirmation
    ) throws {
        guard confirmation.approved, confirmation.confirmationID == plan.confirmationID else {
            throw MCPControlError("EXPLICIT_CONFIRMATION_REQUIRED")
        }
        appliedPlans.append(plan)
        switch plan.operation {
        case .install, .repair, .rotate:
            trustedFingerprints.insert(plan.certificateFingerprint)
        case .remove:
            trustedFingerprints.remove(plan.certificateFingerprint)
        }
    }
}

public struct MCPSecretTransportChecks: Equatable {
    public let authenticated: Bool
    public let instanceBound: Bool
    public let peerUserVerified: Bool
    public let peerProcessVerified: Bool
    public let minimumACL: Bool

    public init(
        authenticated: Bool,
        instanceBound: Bool,
        peerUserVerified: Bool,
        peerProcessVerified: Bool,
        minimumACL: Bool
    ) {
        self.authenticated = authenticated
        self.instanceBound = instanceBound
        self.peerUserVerified = peerUserVerified
        self.peerProcessVerified = peerProcessVerified
        self.minimumACL = minimumACL
    }

    public var isSafe: Bool {
        authenticated
            && instanceBound
            && peerUserVerified
            && peerProcessVerified
            && minimumACL
    }
}

public func validateMCPSecretTransport(_ checks: MCPSecretTransportChecks) throws {
    guard checks.isSafe else {
        throw MCPControlError("KEY_PASSPHRASE_IPC_UNSAFE")
    }
}
