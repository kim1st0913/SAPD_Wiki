"use strict";

class InMemorySecretStore {
  constructor() {
    this.values = new Map();
  }

  store(key, secret) {
    this.values.set(key, Buffer.from(secret));
  }

  retrieve(key) {
    const value = this.values.get(key);
    return value ? Buffer.from(value) : null;
  }

  delete(key) {
    this.values.delete(key);
  }
}

class RecordingTrustStore {
  constructor() {
    this.appliedPlans = [];
    this.trustedFingerprints = new Set();
  }

  isTrusted(fingerprint) {
    return this.trustedFingerprints.has(fingerprint);
  }

  apply(plan, confirmation) {
    if (
      !confirmation
      || confirmation.approved !== true
      || confirmation.confirmationId !== plan.confirmationId
    ) {
      const error = new Error("EXPLICIT_CONFIRMATION_REQUIRED");
      error.code = "EXPLICIT_CONFIRMATION_REQUIRED";
      throw error;
    }
    this.appliedPlans.push({ ...plan });
    if (plan.operation === "remove") {
      this.trustedFingerprints.delete(plan.certificateFingerprint);
    } else {
      this.trustedFingerprints.add(plan.certificateFingerprint);
    }
  }
}

function validateSecretTransport(checks) {
  const required = [
    "authenticated",
    "instanceBound",
    "peerUserVerified",
    "peerProcessVerified",
    "minimumAcl",
  ];
  if (!checks || !required.every((key) => checks[key] === true)) {
    const error = new Error("KEY_PASSPHRASE_IPC_UNSAFE");
    error.code = "KEY_PASSPHRASE_IPC_UNSAFE";
    throw error;
  }
}

class WindowsCurrentUserSecretStore {
  store() {
    throw platformValidationRequired();
  }

  retrieve() {
    throw platformValidationRequired();
  }

  delete() {
    throw platformValidationRequired();
  }
}

class WindowsCurrentUserTrustStore {
  isTrusted() {
    throw platformValidationRequired();
  }

  apply() {
    throw platformValidationRequired();
  }
}

function platformValidationRequired() {
  const error = new Error("REAL_PLATFORM_VALIDATION_REQUIRED");
  error.code = "REAL_PLATFORM_VALIDATION_REQUIRED";
  return error;
}

module.exports = {
  InMemorySecretStore,
  RecordingTrustStore,
  WindowsCurrentUserSecretStore,
  WindowsCurrentUserTrustStore,
  validateSecretTransport,
};
