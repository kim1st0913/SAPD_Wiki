import Foundation
import SAPDWikiMCPControl

/// D5 exposes platform boundaries without mutating Keychain, trust settings, or
/// launching a production Sidecar. L1/C1 replace these fail-closed adapters
/// after real-platform validation and explicit user authorization.
final class MacMCPProcessRuntime: MCPProcessRuntime {
    func launch(_ request: MCPLaunchRequest) throws -> MCPInstanceIdentity {
        throw MCPControlError("REAL_PLATFORM_VALIDATION_REQUIRED")
    }

    func requestGracefulStop(for identity: MCPInstanceIdentity) throws -> MCPGracefulStopResult {
        throw MCPControlError("REAL_PLATFORM_VALIDATION_REQUIRED")
    }

    func observeProcess(pid: Int32) -> MCPInstanceIdentity? {
        nil
    }

    func boundedTerminate(identity: MCPInstanceIdentity, timeout: TimeInterval) throws -> Bool {
        false
    }
}

final class MacKeychainMCPSecretStore: MCPSecretStore {
    func store(secret: Data, for key: String) throws {
        throw MCPControlError("REAL_PLATFORM_VALIDATION_REQUIRED")
    }

    func retrieveSecret(for key: String) throws -> Data? {
        throw MCPControlError("REAL_PLATFORM_VALIDATION_REQUIRED")
    }

    func deleteSecret(for key: String) throws {
        throw MCPControlError("REAL_PLATFORM_VALIDATION_REQUIRED")
    }
}

final class MacCertificateTrustStore: MCPCertificateTrustStore {
    func isTrusted(certificateFingerprint: String) throws -> Bool {
        throw MCPControlError("REAL_PLATFORM_VALIDATION_REQUIRED")
    }

    func apply(
        plan: MCPCertificateTrustPlan,
        confirmation: MCPExplicitConfirmation
    ) throws {
        throw MCPControlError("REAL_PLATFORM_VALIDATION_REQUIRED")
    }
}
