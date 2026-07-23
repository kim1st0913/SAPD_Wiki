"use strict";

const PROFILE_PORTS = Object.freeze({
  stable: 18_775,
  beta: 18_776,
  dev: 28_775,
});

function configuredPortForProfile(profile) {
  if (!Object.hasOwn(PROFILE_PORTS, profile)) {
    const error = new Error("UNKNOWN_PROFILE");
    error.code = "UNKNOWN_PROFILE";
    throw error;
  }
  return PROFILE_PORTS[profile];
}

function createRuntimeSnapshot(profile = "stable") {
  return {
    desiredState: "disabled",
    serviceState: "stopped",
    authorizationState: "no_clients",
    activityState: "never",
    knowledgeState: "ready",
    auditState: "disabled",
    profile,
    configuredPort: configuredPortForProfile(profile),
    lastErrorCode: null,
  };
}

const STABLE_IDENTITY_FIELDS = Object.freeze([
  "osUser",
  "installationId",
  "runtimeId",
  "releaseChannel",
  "appVersion",
  "instanceId",
  "pid",
  "processStartTime",
  "executableContentHash",
  "configuredPort",
  "leaseEpoch",
]);

function hasCompleteStableIdentity(identity) {
  if (!identity) return false;
  const stringFields = [
    "osUser",
    "installationId",
    "runtimeId",
    "releaseChannel",
    "appVersion",
    "instanceId",
    "executableContentHash",
  ];
  const positiveIntegerFields = [
    "pid",
    "processStartTime",
    "configuredPort",
    "leaseEpoch",
  ];
  return stringFields.every((field) => (
    typeof identity[field] === "string" && identity[field].length > 0
  )) && positiveIntegerFields.every((field) => (
    Number.isSafeInteger(identity[field]) && identity[field] > 0
  ));
}

function stableIdentityMatches(expected, observed) {
  return hasCompleteStableIdentity(expected)
    && hasCompleteStableIdentity(observed)
    && STABLE_IDENTITY_FIELDS.every((field) => expected[field] === observed[field]);
}

function heartbeatIsFresh(identity, nowMs, maximumAgeMs) {
  if (!identity || !Number.isFinite(identity.heartbeatTimeMs)) return false;
  const age = nowMs - identity.heartbeatTimeMs;
  return age >= 0 && age <= maximumAgeMs;
}

module.exports = {
  PROFILE_PORTS,
  STABLE_IDENTITY_FIELDS,
  configuredPortForProfile,
  createRuntimeSnapshot,
  hasCompleteStableIdentity,
  heartbeatIsFresh,
  stableIdentityMatches,
};
