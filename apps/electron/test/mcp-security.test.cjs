"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  InMemorySecretStore,
  RecordingTrustStore,
  WindowsCurrentUserSecretStore,
  WindowsCurrentUserTrustStore,
  validateSecretTransport,
} = require("../mcp/security.cjs");

test("in-memory secret store stays synthetic and returns defensive copies", () => {
  const store = new InMemorySecretStore();
  const secret = Buffer.from("synthetic-secret");
  store.store("fixture", secret);

  const retrieved = store.retrieve("fixture");
  assert.deepEqual(retrieved, secret);
  retrieved.fill(0);
  assert.deepEqual(store.retrieve("fixture"), secret);
  store.delete("fixture");
  assert.equal(store.retrieve("fixture"), null);
});

test("recording trust store requires a matching explicit confirmation", () => {
  const store = new RecordingTrustStore();
  const plan = {
    operation: "install",
    certificateFingerprint: "synthetic-fingerprint",
    confirmationId: "confirmation-1",
  };

  assert.throws(
    () => store.apply(plan, { approved: true, confirmationId: "wrong" }),
    { code: "EXPLICIT_CONFIRMATION_REQUIRED" },
  );
  assert.deepEqual(store.appliedPlans, []);

  store.apply(plan, { approved: true, confirmationId: "confirmation-1" });
  assert.equal(store.isTrusted("synthetic-fingerprint"), true);
});

test("unsafe passphrase IPC is blocked unless every peer check passes", () => {
  assert.throws(
    () => validateSecretTransport({
      authenticated: true,
      instanceBound: true,
      peerUserVerified: true,
      peerProcessVerified: false,
      minimumAcl: true,
    }),
    { code: "KEY_PASSPHRASE_IPC_UNSAFE" },
  );
  assert.doesNotThrow(() => validateSecretTransport({
    authenticated: true,
    instanceBound: true,
    peerUserVerified: true,
    peerProcessVerified: true,
    minimumAcl: true,
  }));
});

test("real Windows storage and trust adapters fail closed before L1/C1", () => {
  const secrets = new WindowsCurrentUserSecretStore();
  const trust = new WindowsCurrentUserTrustStore();

  assert.throws(() => secrets.store(), { code: "REAL_PLATFORM_VALIDATION_REQUIRED" });
  assert.throws(() => trust.apply(), { code: "REAL_PLATFORM_VALIDATION_REQUIRED" });
});
