# SAPD Wiki Instructions

## Product Contract

SAPD Wiki is a local, maintainable knowledge system, not a static website. It must preserve source traceability, support local user state, and ship as a reliable desktop/offline application.

Protect these invariants:

- Original sources, protected dictionaries, standards, lifecycle baselines, generated packages, and user databases have distinct ownership. Do not overwrite any of them without explicit scope, a backup or recovery path, and acceptance evidence.
- Frontend code consumes the declared `dataClient` or `/api/v1/*` contract. It must not recreate ETL, matching, scoring, or business inference from raw sheets, SQLite, or ad hoc JSON.
- Current UI identity comes from an explicit selected ID or an equally specific backend response. Do not substitute `rows[0]`, default focus, stale cache, or a parent-level projection for the selected object.
- Preserve Excel merged ranges when they encode business relationships. Do not reconstruct them later with global forward-fill.
- Tests and demos must not mutate a real user database unless the user explicitly approves the write scope and recovery path.

## Authority And Scope

Within system and developer constraints, resolve project-source disagreements in this order:

1. The current user request and acceptance criteria.
2. The nearest applicable `AGENTS.md`.
3. Current formal business, API, data, implementation, and design contracts.
4. Current shared code owners, tests, and verified runtime behavior.
5. Historical screenshots, archived briefs, handoffs, and retired documents as reference only.

Skills provide task workflows; they do not expand the user's requested scope or authorization. If a skill blocks authorized work, identify its exact file and the unresolved condition; existing approval remains valid.

The dirty working tree and current runtime evidence define implementation state. Handoffs and state documents may explain that state but never authorize overwriting newer local work.

## Context Loading

- For a bounded defect with a clear owner, read the nearest instructions, the target owner, and the smallest relevant test or contract. Frontend visual work also follows `frontend/capability-browser/AGENTS.md`.
- For a new main-control task, handoff recovery, or material cross-module, data, App, packaging, release, or architecture work, read `CURRENT_STATE.md`, the recent relevant part of `progress.md`, and current relevant decisions in `findings.md`.
- Read archives, full logs or diffs, large data packages, backups, and unrelated specifications only when current evidence points to them.

## Execution And Verification

- Start with the smallest focused inspection that can identify the controlling code, style, API, data, user-state, or packaging owner. For an authorized change, once the owner and intended behavior are supported, implement instead of continuing discovery only to gain confidence. A review-only request ends with findings.
- Treat adjacent systems as risks to inspect, not automatic scope. Expand only when evidence crosses a data, API, user-state, object-grain, source-authority, packaging, release, security, or durable shared-contract boundary.
- Repeated feedback alone does not prove a wider boundary. Repeated regressions should trigger inspection of the shared owner and missing acceptance rule.
- For a bounded UI correction, use the supplied route, screenshot, and viewport as pre-fix evidence when sufficient, then run the affected static check and one targeted browser or DOM acceptance check. Broaden testing only after a failure, new change, or unresolved boundary risk.
- Do not update project memory, Open Issues, design QA, implementation specifications, or business-design documents for a small correction that restores an existing contract.
- Stop when the scoped observable behavior passes targeted acceptance and no material boundary evidence remains.
- Keep the stable local preview at `http://127.0.0.1:5173/`. Do not launch system Chrome unless the user requests it or an approved acceptance workflow requires it.

## Parallel Work

Follow the global `AGENTS.md` model and main/worker role policy. Use one worker for a bounded execution task with one clear owner; parallelize independent tasks when useful. Existing user authorization remains valid.

- Give each worker a clear deliverable, minimal context, disjoint write set, acceptance evidence, and stop condition.
- Use separate worktrees for concurrent writers. Keep dependent work and integration serial under the assigned execution owner; a single worker may use the existing checkout when host rules permit.
- The parent makes scope and risk decisions, reviews integrated evidence, and accepts the result; workers perform repository execution and integration. Avoid duplicate work, overlapping writes, and repeated polling.

## Project Memory

- Update `CURRENT_STATE.md` only when the active main line, forbidden scope, material risk, or next project step changes.
- Update `progress.md` after a material task, checkpoint, or handoff. Batch related small fixes; do not write after every patch.
- Update `findings.md` only for durable decisions, unresolved material risks, or stable evidence entry points.
- Use `docs/06-implementation/open-issues.md` only for unresolved work, cross-module impact, data/audit/security/user-state/release boundaries, medium or high severity, required business judgment, or incomplete validation.
- Create a long-lived document only for a durable cross-module contract, user-facing deliverable, or data, security, release, or audit boundary.

## Runtime And Change Boundaries

For a non-trivial change, identify the affected runtime:

- `shared runtime`: shared frontend or API behavior, usually affecting Web and App.
- `data / ETL / package`: source-to-package-to-page behavior requiring chain verification.
- `web-only`: development server or browser-specific behavior.
- `app-only`: `WKWebView`, windowing, local user storage, packaging runtime, signing, or install behavior.
- `release blocker`: startup, user state, core navigation/search, export, or data safety.

Passing at `5173` does not prove the DMG App. Use the release matrix and App Runtime checks for `app-only` work and release blockers.

- Do not commit, push, or open a PR unless the user explicitly requests that action. Never run `git add .`; stage only exact related paths when staging is authorized.
- All frontend work follows `DESIGN.md` and the nearest frontend instructions. Plugins may improve the implementation but may not silently redefine project tokens, shared components, or approved interaction contracts.
- Use SAPD testing, data QA, delivery, and security Skills only when their described boundary is in scope.

## Completion

Report the outcome, changed scope, affected runtime, root layer when relevant, validation performed, and remaining risk. Add only applicable evidence: frontend route and visible result; data source/package state and object grain; user-state writes and cleanup; App/DMG Runtime evidence and remaining manual UAT; or the Open Issue for unresolved material work.
