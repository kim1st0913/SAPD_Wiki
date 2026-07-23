"use strict";

function platformValidationRequired() {
  const error = new Error("REAL_PLATFORM_VALIDATION_REQUIRED");
  error.code = "REAL_PLATFORM_VALIDATION_REQUIRED";
  return error;
}

/// D5 deliberately fails closed. L1/C1 replaces this adapter only after the
/// Windows Sidecar path, process identity probe, and graceful control channel
/// have been validated on a real Windows host.
class WindowsMCPProcessRuntime {
  launch() {
    throw platformValidationRequired();
  }

  requestGracefulStop() {
    throw platformValidationRequired();
  }

  observeProcess() {
    return null;
  }

  boundedTerminate() {
    return false;
  }
}

module.exports = {
  WindowsMCPProcessRuntime,
};
