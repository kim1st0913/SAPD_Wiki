import Foundation
import Testing
@testable import SAPDWikiMCPControl

@Suite("MCP security boundaries", .serialized)
struct MCPSecurityBoundaryTests {
    @Test
    func inMemorySecretStoreNeverNeedsPlatformStorage() throws {
        let store = InMemoryMCPSecretStore()
        let secret = Data("synthetic-secret".utf8)

        try store.store(secret: secret, for: "fixture")
        #expect(try store.retrieveSecret(for: "fixture") == secret)
        try store.deleteSecret(for: "fixture")
        #expect(try store.retrieveSecret(for: "fixture") == nil)
    }

    @Test
    func trustMutationRequiresMatchingExplicitConfirmation() throws {
        let store = RecordingMCPCertificateTrustStore()
        let plan = MCPCertificateTrustPlan(
            operation: .install,
            certificateFingerprint: "synthetic-fingerprint",
            confirmationID: "confirmation-1"
        )

        #expect(throws: MCPControlError("EXPLICIT_CONFIRMATION_REQUIRED")) {
            try store.apply(
                plan: plan,
                confirmation: MCPExplicitConfirmation(confirmationID: "wrong", approved: true)
            )
        }
        #expect(store.appliedPlans.isEmpty)

        try store.apply(
            plan: plan,
            confirmation: MCPExplicitConfirmation(confirmationID: "confirmation-1", approved: true)
        )
        #expect(store.appliedPlans == [plan])
        #expect(try store.isTrusted(certificateFingerprint: "synthetic-fingerprint"))
    }

    @Test
    func unsafeSecretIPCIsBlocked() {
        let checks = MCPSecretTransportChecks(
            authenticated: true,
            instanceBound: true,
            peerUserVerified: true,
            peerProcessVerified: false,
            minimumACL: true
        )

        #expect(throws: MCPControlError("KEY_PASSPHRASE_IPC_UNSAFE")) {
            try validateMCPSecretTransport(checks)
        }
    }

    @Test
    func fullyVerifiedSecretIPCContractPasses() throws {
        let checks = MCPSecretTransportChecks(
            authenticated: true,
            instanceBound: true,
            peerUserVerified: true,
            peerProcessVerified: true,
            minimumACL: true
        )

        try validateMCPSecretTransport(checks)
    }
}
