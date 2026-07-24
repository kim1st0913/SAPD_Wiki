# Implementation Plan: App-Owned Identity With An Ephemeral CA Signing Key

## Selected Design And Constraints

The user selected the per-user, per-install App-managed CA. The CA private key exists only while signing one loopback server generation and is deleted afterward. CurrentUser trust, real Keychain/DPAPI writes, Codex configuration, App packaging and real data remain separately authorized.

## Source Revision And Drift Check

- Evidence revision: `e2443ac8c08e85bca3378dba51387a519a740ba1`
- Evidence digest: `sha256:d22502ed34da6aac7e2c8b0180bffaca71ef397abb9b8a6b24ce0bc732ba5cc6`
- Current design drift: expected; v1.1 and the v0.4 C0 plan are the outputs of this review.
- Before coding, refresh the target revision and stop for renewed design review if trust scope, process ownership, platform bridge authority or data boundaries changed.

## Affected Components

- `src/sapd_wiki/local_mcp/`: identity, TLS, manifest, operation journal and controller.
- `frontend/capability-browser/components/SystemSettings.js`: certificate status and actions.
- macOS App: Data Protection Keychain, User trust, GUI confirmation and cleanup.
- Windows Electron: DPAPI CurrentUser, CurrentUser Root, main-process bridge and uninstall.
- Targeted schemas, fixtures, platform adapters, lifecycle tests and real-client evidence.

## Ordered Work Packages

1. C0-1: freeze certificate, identity manifest, state, reason and operation schemas.
2. C0-2: implement the certificate generator, fixed secure directory, ownership checks and atomic generations.
3. C0-3: implement fake-first platform secret custody and one-shot Sidecar transport.
4. C0-4: implement fake trust adapters, then separately authorize real CurrentUser experiments with snapshots.
5. C0-5: implement operation journal recovery, bounded rollback, upgrade/downgrade and uninstall behavior.
6. C0-6: add certificate management to AI integration and the global status surface.
7. C0-7: run automated lifecycle, platform UAT and current Codex validation.

The detailed acceptance contract is `docs/06-implementation/local-mcp-certificate-productization-and-client-validation-plan-v0.4.md`.

## Compatibility And Migration

- Temporary short-lived CA identities remain test-only and must never be migrated into durable trust.
- The first durable provisioning creates a new install/profile/generation.
- Ordinary upgrade preserves the manifest, active generation, secret and trust.
- Unknown newer manifest versions fail closed.
- A directly trusted self-signed leaf remains an isolated compatibility probe and cannot silently replace the selected chain.

## Tactical Protections During Migration

- Preserve encrypted PKCS#8 and `KEY_PASSPHRASE_IPC_UNSAFE`.
- Keep production trust stores fail-closed until the separately authorized adapter stage.
- Keep browsers/renderers unable to choose paths, provide fingerprints or invoke platform certificate commands.
- Continue exact Host/Origin/session/body-limit and loopback-only control protections.
- Continue synthetic-only MCP data boundaries.

## Tests And Security Validation

- Schema positive/negative fixtures for all state and operation transitions.
- Certificate extensions, key/chain matching, CA-key deletion and plaintext-key rejection.
- Filesystem ownership, ACL and link/reparse substitution negatives.
- Secret transport wrong-user/process/generation/nonce/ACL/replay negatives.
- Crash recovery after every journal phase.
- Duplicate subject/different fingerprint, trust loss, secret loss, time skew and corrupt manifest.
- CurrentUser/LocalMachine before-and-after trust snapshots.
- Reset, orphan, upgrade, downgrade, migration and uninstall matrices.
- Keyboard, focus, aria-live, narrow and 200% zoom acceptance.

## Performance And Resource Benchmarks

Measure current temporary identity versus the durable controller for:

- certificate generation and full rotation duration;
- Sidecar startup to healthy HTTPS;
- first Codex connection after App restart;
- controller and Sidecar peak RSS during startup/rotation;
- fixed security-directory size with active plus one retiring generation.

No benchmark threshold is currently supplied. C0 must record results and identify any user-visible startup regression before C1.

## Rollout And Rollback

Roll out Web-first with fake platform adapters. Real CurrentUser trust starts only after an explicit authorization naming platform, profile, fingerprint, pre-state snapshot and cleanup choice. App production adapters and packaging follow current Codex validation.

Before a real trust write, rollback removes the candidate implementation. After durable provisioning, rollback restores compatible App code while preserving the existing identity; it must not delete or regenerate identity. Rotation failures restore the previous active generation unless it is expired.

## Acceptance Criteria

- One App writer owns each install/profile and every mutation is journaled and idempotent.
- No passphrase or private path appears in unsafe transport or user-visible projections.
- Real trust never escapes CurrentUser and deletion never targets an unowned fingerprint.
- App/MCP restart, port change and ordinary upgrade keep fingerprints stable.
- Every interrupted operation recovers, rolls back or fails closed.
- Current Codex connects through the stable identity before macOS/Windows packaging begins.

## Open Decisions

- Critical loopback name-constraint compatibility.
- macOS Keychain accessibility class.
- Windows domain/roaming profile test coverage.
- Whether the inactive rollback generation can be cleaned earlier than the 24-hour maximum after known clients reconnect.
