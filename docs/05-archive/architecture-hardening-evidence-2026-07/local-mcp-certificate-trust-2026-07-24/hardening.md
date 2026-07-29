# Security Hardening Review: SAPD Wiki Local MCP Certificate And Trust

> Archive status: `completed / historical security review evidence`. The current contract is
> `docs/01-architecture/sapd-wiki-local-mcp-certificate-and-trust-management-design-v1.md`.

## Evidence Basis

This review is derived from the current certificate design, C0 implementation plan, Web Dev TLS generator, TLS secret boundary and AI integration settings component at revision `e2443ac8c08e85bca3378dba51387a519a740ba1`. The five-file evidence collection is bound by `sha256:d22502ed34da6aac7e2c8b0180bffaca71ef397abb9b8a6b24ce0bc732ba5cc6`.

The implementation currently proves encrypted PKCS#8 loading, unsafe secret-transport rejection and temporary loopback TLS. It does not yet implement a durable identity owner, production Keychain/DPAPI custody, CurrentUser trust mutation or certificate UI. The review therefore makes source-backed design claims, not remediation claims.

## Constraints

We assume a balanced security/reliability profile: offline and local-only operation, no third-party identity server, `127.0.0.1` binding, per-user trust, macOS and Windows parity, Web-first validation and explicit authorization before any real trust write. The design does not attempt to resist an attacker who fully controls the same OS user session.

Application code signing, OAuth policy, License, real knowledge data and packaging are separate boundaries.

## Opportunity Portfolio

| Opportunity | Evidence | Options | Recommendation | Proposal |
|---|---|---|---|---|
| Make the App the sole certificate and trust owner | Selected design, C0 plan, temporary TLS implementation, secret boundary and current settings UI (`E001`–`E005`) | App-owned ephemeral CA key; persistent CA key; directly trusted self-signed leaf | Keep the selected App-owned ephemeral CA key, add transactional custody and retain the self-signed leaf only as a compatibility probe | [Complete proposal](proposals/certificate-trust-owner.md) |

## Recommendation Summary

We should preserve the approved per-user, per-install CA direction and delete the CA private key after signing. The important change is to stop treating the identity as a collection of files. One App controller must own a versioned manifest, active generations, platform secrets, restricted CurrentUser trust, one-shot Sidecar secret delivery and a durable operation journal.

This has a visible UX consequence: annual “renewal” is a full local identity rotation and requires another trust confirmation. I recommend accepting that explicit step instead of retaining a permanent trusted signer. A directly trusted self-signed leaf may reduce authority further, but it should change the decision only after real Codex/macOS/Windows compatibility evidence exists.

The selected design is mapped to an [implementation handoff](implementation/app-owned-ephemeral-ca.md) and the repository’s v0.4 C0 plan.

## Next Decisions

- Approve the hardened Option 1 as the implementation baseline.
- Decide whether C0 should include a bounded self-signed-leaf compatibility probe.
- Confirm the macOS Keychain accessibility target and the maximum inactive rollback window.
- Keep real CurrentUser trust writes, Codex configuration and platform packaging behind separate authorization.
