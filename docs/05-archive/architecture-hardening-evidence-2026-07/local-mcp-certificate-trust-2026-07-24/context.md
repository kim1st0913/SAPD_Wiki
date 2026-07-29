# Local MCP Certificate And Trust Hardening Context

> Archive status: `completed / historical security review evidence`.

## Source identity

- Source root: `/Users/kim1st/Documents/kim note/06_dev_projects/SAPD_Wiki`
- Target revision: `e2443ac8c08e85bca3378dba51387a519a740ba1`
- Source drift: present; the design and execution plan are intentionally being revised in this analysis.
- Evidence collection digest: `sha256:d22502ed34da6aac7e2c8b0180bffaca71ef397abb9b8a6b24ce0bc732ba5cc6`
- Digest method: SHA-256 of a Git tar archive containing E001–E005 at the target revision.

## Evidence inventory

| Evidence | Title | Path | What it establishes |
|---|---|---|---|
| `E001` | Certificate and trust design v1 | `docs/01-architecture/sapd-wiki-local-mcp-certificate-and-trust-management-design-v1.md` | The selected per-user, per-install CA direction, product states, CurrentUser trust and deleted CA private key. |
| `E002` | Certificate productization plan v0.3 | `docs/06-implementation/local-mcp-certificate-productization-and-client-validation-plan-v0.3.md` | The original C0–C1 order and the pre-hardening five-work-package implementation gate. |
| `E003` | Current Web Dev TLS generator | `src/sapd_wiki/local_mcp/dev_tls.py` | The current implementation generates a short-lived CA and leaf in a temporary directory and uses an in-memory passphrase. |
| `E004` | TLS secret transport boundary | `src/sapd_wiki/local_mcp/tls.py` | Encrypted PKCS#8 loading and `KEY_PASSPHRASE_IPC_UNSAFE` exist, while production trust writes remain fail-closed. |
| `E005` | Current AI integration settings component | `frontend/capability-browser/components/SystemSettings.js` | The current page implements runtime, client authorization, audit and reset surfaces but not a certificate-management section. |

## Supplemental primary sources

- Apple `SecTrustSettingsSetTrustSettings`: per-user trust changes prompt for login authentication; `NULL` trust settings mean always trust regardless of use.
- Apple Keychain accessibility: `ThisDeviceOnly` items do not migrate to another device and accessibility should be as restrictive as the runtime allows.
- Microsoft CurrentUser stores: CurrentUser and LocalMachine are distinct system-store locations.
- Microsoft DPAPI `CryptProtectData`: the default associates protected data with the current user; `CRYPTPROTECT_LOCAL_MACHINE` broadens access to other users on the device.

## Assessment limits

- No production Keychain, Windows certificate-store or DPAPI adapter exists in the inspected revision.
- No real CurrentUser trust mutation was performed.
- No real Codex certificate-chain compatibility test was performed.
- Performance and memory effects are source-derived or hypothetical, not measured.
- The accepted UI screenshot is local audit evidence only and is not part of the distributable evidence collection.
