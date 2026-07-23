"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  configuredPortForProfile,
  heartbeatIsFresh,
  stableIdentityMatches,
} = require("../mcp/runtime-state.cjs");
const { MCPSupervisor } = require("../mcp/supervisor.cjs");

function identity(overrides = {}) {
  return {
    osUser: "synthetic-user",
    installationId: "synthetic-installation",
    runtimeId: "synthetic-runtime",
    releaseChannel: "stable",
    appVersion: "0.test",
    instanceId: "synthetic-instance",
    pid: 42,
    processStartTime: 100,
    executableContentHash: "synthetic-sha256",
    configuredPort: 18_775,
    leaseEpoch: 1,
    heartbeatTimeMs: 1_000,
    ...overrides,
  };
}

class FakeProcessRuntime {
  constructor(ownedIdentity = identity()) {
    this.identity = ownedIdentity;
    this.observedIdentity = ownedIdentity;
    this.gracefulResult = "running";
    this.terminateResult = true;
    this.launchRequests = [];
    this.gracefulCalls = 0;
    this.terminateCalls = 0;
  }

  launch(request) {
    this.launchRequests.push(request);
    return this.identity;
  }

  requestGracefulStop() {
    this.gracefulCalls += 1;
    return this.gracefulResult;
  }

  observeProcess() {
    return this.observedIdentity;
  }

  boundedTerminate() {
    this.terminateCalls += 1;
    return this.terminateResult;
  }
}

test("profiles use fixed ports and never select a random fallback", () => {
  assert.equal(configuredPortForProfile("stable"), 18_775);
  assert.equal(configuredPortForProfile("beta"), 18_776);
  assert.equal(configuredPortForProfile("dev"), 28_775);
  assert.throws(() => configuredPortForProfile("random"), { code: "UNKNOWN_PROFILE" });
});

test("supervisor starts and performs graceful stop without bounded termination", () => {
  const runtime = new FakeProcessRuntime();
  runtime.gracefulResult = "stopped";
  const supervisor = new MCPSupervisor({ profile: "stable", processRuntime: runtime });

  assert.equal(supervisor.start().ok, true);
  assert.equal(supervisor.publicSnapshot().serviceState, "ready");
  assert.deepEqual(runtime.launchRequests, [{ profile: "stable", configuredPort: 18_775 }]);
  assert.equal(supervisor.stop().ok, true);
  assert.equal(supervisor.publicSnapshot().serviceState, "stopped");
  assert.equal(runtime.terminateCalls, 0);
});

test("bounded termination occurs only after complete stable identity match", () => {
  const runtime = new FakeProcessRuntime();
  const supervisor = new MCPSupervisor({ processRuntime: runtime });

  assert.equal(supervisor.start().ok, true);
  assert.equal(supervisor.stop().ok, true);
  assert.equal(runtime.terminateCalls, 1);
});

test("ambiguous process identity is never killed", () => {
  const runtime = new FakeProcessRuntime();
  runtime.observedIdentity = identity({ instanceId: "another-instance" });
  const supervisor = new MCPSupervisor({ processRuntime: runtime });

  assert.equal(supervisor.start().ok, true);
  const stopped = supervisor.stop();
  assert.equal(stopped.ok, false);
  assert.equal(stopped.errorCode, "PROCESS_OWNERSHIP_AMBIGUOUS");
  assert.equal(runtime.gracefulCalls, 0);
  assert.equal(runtime.terminateCalls, 0);
});

test("PID reuse is detected by process start time and is never killed", () => {
  const runtime = new FakeProcessRuntime();
  runtime.observedIdentity = identity({ processStartTime: 101 });
  const supervisor = new MCPSupervisor({ processRuntime: runtime });

  supervisor.start();
  assert.equal(supervisor.stop().errorCode, "PROCESS_OWNERSHIP_AMBIGUOUS");
  assert.equal(runtime.gracefulCalls, 0);
  assert.equal(runtime.terminateCalls, 0);
});

test("incomplete identity is never killed and blocks a second launch", () => {
  const runtime = new FakeProcessRuntime(identity({ instanceId: "" }));
  const supervisor = new MCPSupervisor({ processRuntime: runtime });

  assert.equal(supervisor.start().errorCode, "PROCESS_IDENTITY_INCOMPLETE");
  assert.equal(supervisor.stop().errorCode, "PROCESS_OWNERSHIP_AMBIGUOUS");
  assert.equal(runtime.gracefulCalls, 0);
  assert.equal(runtime.terminateCalls, 0);
  assert.equal(supervisor.start().errorCode, "OWNED_PROCESS_REQUIRES_RECOVERY");
  assert.equal(runtime.launchRequests.length, 1);
});

test("zero or wrongly typed stable identity fields are incomplete", () => {
  for (const incomplete of [
    identity({ pid: 0 }),
    identity({ processStartTime: "100" }),
    identity({ configuredPort: 0 }),
    identity({ leaseEpoch: 0 }),
  ]) {
    const runtime = new FakeProcessRuntime(incomplete);
    const supervisor = new MCPSupervisor({ processRuntime: runtime });

    assert.equal(supervisor.start().errorCode, "PROCESS_IDENTITY_INCOMPLETE");
    assert.equal(runtime.gracefulCalls, 0);
    assert.equal(runtime.terminateCalls, 0);
  }
});

test("heartbeat is freshness metadata rather than stable identity", () => {
  const expected = identity({ heartbeatTimeMs: 1_000 });
  const observed = identity({ heartbeatTimeMs: 5_000 });

  assert.equal(stableIdentityMatches(expected, observed), true);
  assert.equal(heartbeatIsFresh(expected, 5_000, 1_000), false);
  assert.equal(heartbeatIsFresh(observed, 5_000, 1_000), true);
});

test("bridge action parameters are closed and cannot carry commands or paths", () => {
  const runtime = new FakeProcessRuntime();
  const supervisor = new MCPSupervisor({ processRuntime: runtime });
  const response = supervisor.handleBridgeAction("start", { command: "arbitrary" });

  assert.equal(response.ok, false);
  assert.equal(response.errorCode, "INVALID_PARAMETERS");
  assert.equal(runtime.launchRequests.length, 0);
});

test("unexpected owned process exit becomes a recoverable error", () => {
  const owned = identity();
  const runtime = new FakeProcessRuntime(owned);
  const supervisor = new MCPSupervisor({ processRuntime: runtime });
  supervisor.start();

  supervisor.handleProcessExit(owned, { expected: false });

  assert.equal(supervisor.publicSnapshot().serviceState, "error");
  assert.equal(supervisor.publicSnapshot().lastErrorCode, "PROCESS_EXITED");
});

test("retry stops a verified owned process before relaunch", () => {
  const runtime = new FakeProcessRuntime();
  runtime.gracefulResult = "stopped";
  const supervisor = new MCPSupervisor({ processRuntime: runtime });
  supervisor.start();

  assert.equal(supervisor.retry().ok, true);
  assert.equal(runtime.gracefulCalls, 1);
  assert.equal(runtime.launchRequests.length, 2);
  assert.equal(supervisor.publicSnapshot().serviceState, "ready");
});

test("authorization request publishes only a sanitized UI event shape", () => {
  const runtime = new FakeProcessRuntime();
  const supervisor = new MCPSupervisor({ processRuntime: runtime });
  let received;
  supervisor.on("authorization-request", (request) => {
    received = request;
  });

  supervisor.receiveAuthorizationRequest({
    requestId: "synthetic-request",
    clientDisplayName: "Synthetic Codex",
  });

  assert.deepEqual(received, {
    requestId: "synthetic-request",
    clientDisplayName: "Synthetic Codex",
  });
  assert.equal(supervisor.publicSnapshot().authorizationState, "pending");
});
