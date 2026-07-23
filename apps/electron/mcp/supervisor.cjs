"use strict";

const { EventEmitter } = require("node:events");
const {
  configuredPortForProfile,
  createRuntimeSnapshot,
  hasCompleteStableIdentity,
  stableIdentityMatches,
} = require("./runtime-state.cjs");

class MCPControlError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

class MCPSupervisor extends EventEmitter {
  constructor({ profile = "stable", processRuntime }) {
    super();
    if (!processRuntime) throw new TypeError("processRuntime is required");
    this.processRuntime = processRuntime;
    this.snapshot = createRuntimeSnapshot(profile);
    this.ownedIdentity = null;
  }

  publicSnapshot() {
    return Object.freeze({ ...this.snapshot });
  }

  start() {
    if (["ready", "starting"].includes(this.snapshot.serviceState)) {
      return this.response(true);
    }
    if (this.ownedIdentity) {
      this.fail("OWNED_PROCESS_REQUIRES_RECOVERY");
      return this.response(false);
    }
    this.patch({
      desiredState: "enabled",
      serviceState: "starting",
      lastErrorCode: null,
    });
    try {
      const configuredPort = configuredPortForProfile(this.snapshot.profile);
      const identity = this.processRuntime.launch({
        profile: this.snapshot.profile,
        configuredPort,
      });
      this.ownedIdentity = identity;
      if (!hasCompleteStableIdentity(identity)) {
        throw new MCPControlError("PROCESS_IDENTITY_INCOMPLETE");
      }
      if (!identity || identity.configuredPort !== configuredPort) {
        throw new MCPControlError("FIXED_PORT_MISMATCH");
      }
      this.patch({ serviceState: "ready" });
      return this.response(true);
    } catch (error) {
      this.fail(error.code || "PROCESS_START_FAILED");
      return this.response(false);
    }
  }

  stop() {
    this.patch({ desiredState: "disabled" });
    if (!this.ownedIdentity) {
      this.patch({ serviceState: "stopped", lastErrorCode: null });
      return this.response(true);
    }

    const expected = this.ownedIdentity;
    this.patch({ serviceState: "stopping", lastErrorCode: null });
    try {
      const observed = this.processRuntime.observeProcess(expected.pid);
      if (!observed) {
        this.fail("PROCESS_IDENTITY_UNVERIFIED");
        return this.response(false);
      }
      if (!stableIdentityMatches(expected, observed)) {
        this.fail("PROCESS_OWNERSHIP_AMBIGUOUS");
        return this.response(false);
      }
      const gracefulResult = this.processRuntime.requestGracefulStop(expected);
      if (gracefulResult === "stopped") {
        this.finishStopped();
        return this.response(true);
      }
      if (gracefulResult !== "running") {
        throw new MCPControlError("INVALID_GRACEFUL_STOP_RESULT");
      }

      const stopped = this.processRuntime.boundedTerminate(observed, 2_000);
      if (!stopped) {
        this.fail("PROCESS_TERMINATION_TIMEOUT");
        return this.response(false);
      }
      this.finishStopped();
      return this.response(true);
    } catch (error) {
      this.fail(error.code || "PROCESS_STOP_FAILED");
      return this.response(false);
    }
  }

  retry() {
    if (this.ownedIdentity) {
      const stopped = this.stop();
      if (!stopped.ok) return stopped;
    }
    return this.start();
  }

  handleProcessExit(identity, { expected = false } = {}) {
    if (!this.ownedIdentity || !stableIdentityMatches(this.ownedIdentity, identity)) return;
    this.ownedIdentity = null;
    if (this.snapshot.desiredState === "disabled" || expected) {
      this.patch({ serviceState: "stopped", lastErrorCode: null });
    } else {
      this.fail("PROCESS_EXITED");
    }
  }

  receiveAuthorizationRequest({ requestId, clientDisplayName }) {
    const safeRequestId = typeof requestId === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(requestId)
      ? requestId
      : "invalid-request";
    const visibleName = String(clientDisplayName || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, 80) || "未知客户端";
    this.patch({ authorizationState: "pending" });
    this.emit("authorization-request", Object.freeze({
      requestId: safeRequestId,
      clientDisplayName: visibleName,
    }));
  }

  handleBridgeAction(action, parameters = {}) {
    if (!parameters || Object.keys(parameters).length !== 0) {
      return {
        ok: false,
        errorCode: "INVALID_PARAMETERS",
        status: this.publicSnapshot(),
      };
    }
    switch (action) {
      case "get_status":
        return this.response(true);
      case "start":
        return this.start();
      case "stop":
        return this.stop();
      case "retry":
        return this.retry();
      default:
        return {
          ok: false,
          errorCode: "UNKNOWN_ACTION",
          status: this.publicSnapshot(),
        };
    }
  }

  response(ok) {
    return {
      ok,
      errorCode: ok ? null : this.snapshot.lastErrorCode,
      status: this.publicSnapshot(),
    };
  }

  finishStopped() {
    this.ownedIdentity = null;
    this.patch({ serviceState: "stopped", lastErrorCode: null });
  }

  fail(code) {
    this.patch({ serviceState: "error", lastErrorCode: code });
  }

  patch(values) {
    Object.assign(this.snapshot, values);
    this.emit("snapshot", this.publicSnapshot());
  }
}

module.exports = {
  MCPControlError,
  MCPSupervisor,
};
