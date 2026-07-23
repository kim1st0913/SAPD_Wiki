import Foundation
import Testing
@testable import SAPDWikiMCPControl

@Suite("MCP supervisor", .serialized)
struct MCPSupervisorTests {
    @Test
    func profilesUseFixedPortsWithoutRandomFallback() {
        #expect(MCPProfile.stable.configuredPort == 18_775)
        #expect(MCPProfile.beta.configuredPort == 18_776)
        #expect(MCPProfile.dev.configuredPort == 28_775)
    }

    @Test
    func startAndGracefulStopKeepWebRuntimeOwnershipSeparate() {
        let runtime = FakeProcessRuntime(identity: identity())
        let supervisor = MCPSupervisor(profile: .stable, processRuntime: runtime)

        #expect(supervisor.start().ok)
        #expect(supervisor.snapshot.serviceState == .ready)
        #expect(runtime.launchRequests == [MCPLaunchRequest(profile: .stable)])

        runtime.gracefulResult = .stopped
        #expect(supervisor.stop().ok)
        #expect(supervisor.snapshot.serviceState == .stopped)
        #expect(runtime.terminateCalls == 0)
    }

    @Test
    func matchingStableIdentityAllowsBoundedTermination() {
        let runtime = FakeProcessRuntime(identity: identity())
        let supervisor = MCPSupervisor(profile: .stable, processRuntime: runtime)

        #expect(supervisor.start().ok)
        #expect(supervisor.stop().ok)
        #expect(runtime.gracefulCalls == 1)
        #expect(runtime.terminateCalls == 1)
    }

    @Test
    func ambiguousOwnershipNeverTerminates() {
        let owned = identity()
        let runtime = FakeProcessRuntime(identity: owned)
        let supervisor = MCPSupervisor(profile: .stable, processRuntime: runtime)
        #expect(supervisor.start().ok)

        runtime.gracefulResult = .stillRunning
        runtime.observedIdentity = identity(instanceID: "another-instance")
        let response = supervisor.stop()

        #expect(!response.ok)
        #expect(response.errorCode == "PROCESS_OWNERSHIP_AMBIGUOUS")
        #expect(runtime.gracefulCalls == 0)
        #expect(runtime.terminateCalls == 0)
    }

    @Test
    func pidReuseNeverTerminates() {
        let owned = identity()
        let runtime = FakeProcessRuntime(identity: owned)
        let supervisor = MCPSupervisor(profile: .stable, processRuntime: runtime)
        #expect(supervisor.start().ok)

        runtime.gracefulResult = .stillRunning
        runtime.observedIdentity = identity(processStartTime: owned.processStartTime + 1)
        let response = supervisor.stop()

        #expect(!response.ok)
        #expect(response.errorCode == "PROCESS_OWNERSHIP_AMBIGUOUS")
        #expect(runtime.gracefulCalls == 0)
        #expect(runtime.terminateCalls == 0)
    }

    @Test
    func incompleteIdentityNeverTerminatesOrAllowsSecondLaunch() {
        let runtime = FakeProcessRuntime(identity: identity(instanceID: ""))
        let supervisor = MCPSupervisor(profile: .stable, processRuntime: runtime)

        #expect(supervisor.start().errorCode == "PROCESS_IDENTITY_INCOMPLETE")
        #expect(supervisor.stop().errorCode == "PROCESS_OWNERSHIP_AMBIGUOUS")
        #expect(runtime.gracefulCalls == 0)
        #expect(runtime.terminateCalls == 0)
        #expect(supervisor.start().errorCode == "OWNED_PROCESS_REQUIRES_RECOVERY")
        #expect(runtime.launchRequests.count == 1)
    }

    @Test
    func heartbeatIsFreshnessOnlyAndDoesNotChangeStableIdentity() {
        let owned = identity(heartbeatTime: Date(timeIntervalSince1970: 100))
        let observed = identity(heartbeatTime: Date(timeIntervalSince1970: 200))

        #expect(owned.hasSameStableIdentity(as: observed))
        #expect(!owned.heartbeatIsFresh(at: Date(timeIntervalSince1970: 200), maximumAge: 30))
        #expect(observed.heartbeatIsFresh(at: Date(timeIntervalSince1970: 200), maximumAge: 30))
    }

    @Test
    func bridgeUsesClosedParameterSchema() {
        let runtime = FakeProcessRuntime(identity: identity())
        let supervisor = MCPSupervisor(profile: .stable, processRuntime: runtime)

        let rejected = supervisor.handleBridgeAction(.start, parameters: ["command": "arbitrary"])
        #expect(!rejected.ok)
        #expect(rejected.errorCode == "INVALID_PARAMETERS")
        #expect(runtime.launchRequests.isEmpty)
    }

    @Test
    func bridgeEnvelopeRejectsExtraKeysAndArbitraryParameters() {
        #expect(MCPBridgeEnvelope(object: [
            "request_id": "fixture",
            "action": "start",
            "parameters": [:],
            "command": "arbitrary",
        ]) == nil)
        #expect(MCPBridgeEnvelope(object: [
            "request_id": "fixture",
            "action": "start",
            "parameters": ["path": "/tmp/sidecar"],
        ]) == nil)
        #expect(MCPBridgeEnvelope(object: [
            "request_id": "fixture",
            "action": "get_status",
            "parameters": [:],
        ]) != nil)
    }

    @Test
    func localOriginRequiresExactLoopbackSchemeHostAndPort() throws {
        let origin = try #require(MCPLocalOrigin(url: URL(string: "http://127.0.0.1:5173/settings")!))
        #expect(origin.matches(url: URL(string: "http://127.0.0.1:5173/other")!))
        #expect(!origin.matches(url: URL(string: "http://localhost:5173/")!))
        #expect(!origin.matches(url: URL(string: "http://127.0.0.1:5174/")!))
        #expect(MCPLocalOrigin(url: URL(string: "https://example.com:5173/")!) == nil)
        #expect(MCPLocalOrigin(url: URL(string: "http://user@127.0.0.1:5173/")!) == nil)
    }

    @Test
    func pendingAuthorizationPublishesNativePromptEvent() {
        let runtime = FakeProcessRuntime(identity: identity())
        let supervisor = MCPSupervisor(profile: .stable, processRuntime: runtime)
        var received: MCPAuthorizationRequest?
        supervisor.onAuthorizationRequest = { received = $0 }

        let request = MCPAuthorizationRequest(requestID: "synthetic-request", clientDisplayName: "Synthetic Codex")
        supervisor.receiveAuthorizationRequest(request)

        #expect(received == request)
        #expect(supervisor.snapshot.authorizationState == .pending)
    }

    @Test
    func unexpectedOwnedProcessExitBecomesRecoverableError() {
        let owned = identity()
        let runtime = FakeProcessRuntime(identity: owned)
        let supervisor = MCPSupervisor(profile: .stable, processRuntime: runtime)
        #expect(supervisor.start().ok)

        supervisor.handleProcessExit(identity: owned, expected: false)

        #expect(supervisor.snapshot.serviceState == .error)
        #expect(supervisor.snapshot.lastErrorCode == "PROCESS_EXITED")
    }

    @Test
    func retryStopsVerifiedOwnedProcessBeforeRelaunch() {
        let runtime = FakeProcessRuntime(identity: identity())
        runtime.gracefulResult = .stopped
        let supervisor = MCPSupervisor(profile: .stable, processRuntime: runtime)
        #expect(supervisor.start().ok)

        #expect(supervisor.retry().ok)
        #expect(runtime.gracefulCalls == 1)
        #expect(runtime.launchRequests.count == 2)
        #expect(supervisor.snapshot.serviceState == .ready)
    }
}

private final class FakeProcessRuntime: MCPProcessRuntime {
    let identity: MCPInstanceIdentity
    var launchRequests: [MCPLaunchRequest] = []
    var gracefulResult: MCPGracefulStopResult = .stillRunning
    var observedIdentity: MCPInstanceIdentity?
    var terminateResult = true
    var gracefulCalls = 0
    var terminateCalls = 0

    init(identity: MCPInstanceIdentity) {
        self.identity = identity
        self.observedIdentity = identity
    }

    func launch(_ request: MCPLaunchRequest) throws -> MCPInstanceIdentity {
        launchRequests.append(request)
        return identity
    }

    func requestGracefulStop(for identity: MCPInstanceIdentity) throws -> MCPGracefulStopResult {
        gracefulCalls += 1
        return gracefulResult
    }

    func observeProcess(pid: Int32) -> MCPInstanceIdentity? {
        observedIdentity
    }

    func boundedTerminate(identity: MCPInstanceIdentity, timeout: TimeInterval) throws -> Bool {
        terminateCalls += 1
        return terminateResult
    }
}

private func identity(
    instanceID: String = "synthetic-instance",
    processStartTime: UInt64 = 10,
    heartbeatTime: Date = Date(timeIntervalSince1970: 100)
) -> MCPInstanceIdentity {
    MCPInstanceIdentity(
        osUser: "synthetic-user",
        installationID: "synthetic-installation",
        runtimeID: "synthetic-runtime",
        releaseChannel: "stable",
        appVersion: "0.test",
        instanceID: instanceID,
        pid: 42,
        processStartTime: processStartTime,
        executableContentHash: "synthetic-sha256",
        configuredPort: 18_775,
        leaseEpoch: 1,
        heartbeatTime: heartbeatTime
    )
}
