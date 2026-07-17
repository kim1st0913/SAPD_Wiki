# SAPD Wiki Instructions

## Product Contract

SAPD Wiki is a local, maintainable knowledge system, not a static website. It must preserve source traceability, support local user state, and ship as a reliable desktop/offline application.

Protect these invariants:

- Original sources, protected dictionaries, standards, lifecycle baselines, generated packages, and user databases have distinct ownership. Do not overwrite a protected baseline, source Excel, SQLite, generated package, or real user data without explicit scope, backup/recovery path, and acceptance check.
- Frontend code consumes the declared `dataClient` or `/api/v1/*` contract. It must not recreate ETL, matching, scoring, or business inference from raw sheets, SQLite, or ad hoc JSON.
- Current UI identity comes from an explicit selected ID or an equally specific backend response. Do not use `rows[0]`, a default focus, stale cache, or a parent-level projection as a substitute for the selected object.
- Preserve Excel merged ranges when they encode business relationships. Do not infer them later with global forward-fill.
- Tests and demos must not mutate a real user database unless the user explicitly approves.

## Work Routing And Stop Rule

Start with the nearest applicable `AGENTS.md` and one focused inspection batch over the smallest implementation and test files needed to identify the controlling code, style, API, data, state, or packaging owner. If that batch does not establish the owner or required evidence, make only the smallest useful follow-up read.

For a bounded implementation defect with a clear owner and no evidence of a wider boundary:

- Once the owner and intended behavior are supported, edit instead of continuing discovery merely to increase confidence.
- Do not read or update `CURRENT_STATE.md`, `progress.md`, `findings.md`, `task_plan.md`, `design-qa.md`, Open Issues, implementation specifications, business-design documents, archives, broad diffs, full data packages, or backups. Do not invoke a skill or plugin unless the user requests it or the inspection establishes a need for a specialized workflow.
- Batch independent reads and deterministic validations. Reuse a known tool workflow; inspect tool or browser documentation only after an intended operation is unknown or fails.
- For a UI defect, use the supplied screenshot, route, and viewport as pre-fix evidence when they are sufficient. After the patch, run the affected static or targeted test and one browser or DOM acceptance check at the reported route and viewport. In that check, batch navigation, geometry or state assertions, overflow and console checks, and cleanup when practical.
- Do not run sibling sampling, negative controls, full suites, data-boundary checks, release checks, or DMG validation unless evidence shows that the affected boundary requires them.

Escalate only when bounded evidence crosses a data, API, user-state, object-grain, source-authority, packaging, release, or security boundary. Repeated feedback, a rejected visual result, or another screenshot does not by itself establish such a boundary.

Stop when the scoped behavior passes its targeted acceptance check and no material boundary evidence remains. Resolve the request in the fewest useful tool loops, without letting loop reduction outrank correctness or required evidence.

Read project-state or governance documents only when current project state or the affected boundary materially requires them. Update `progress.md` only after material project-state, data, contract, cross-module, or release work. Create a long-lived document only for a durable cross-module contract, a user-facing deliverable, or a data, security, or audit boundary.

Keep the working surface light: use summaries before full logs or process lists; keep the stable local preview at `http://127.0.0.1:5173/`; do not launch system Chrome unless the user approves it.

## Classify Impact Before Changing

State the affected runtime before a non-trivial change:

- `shared runtime`: shared frontend/API behavior, usually affects Web and App.
- `data / ETL / package`: source-to-package-to-page behavior, requiring chain verification.
- `web-only`: development server or browser-specific behavior.
- `app-only`: `WKWebView`, windowing, local user storage, packaging runtime, signing, or install behavior.
- `release blocker`: startup, user state, core navigation/search, export, or data safety.

Passing at `5173` does not prove the DMG App. Use the release matrix and app runtime checks whenever the impact is `app-only` or a release blocker.

## Change Boundaries

- Do not commit, push, open a PR, or run `git add .` unless the user explicitly asks for that action.
- Use existing implementation specs and UI patterns for ordinary frontend fixes. Invoke `impeccable` only for an explicit design/rebuild/UX-audit request, not for a localized bug fix or spec-led implementation.
- Maturity-assessment rules are local to `frontend/capability-browser/AGENTS.md`.

## Completion

For changes, report: outcome, impact surface, root layer when relevant, validation performed, and remaining risk. Add the user navigation path for frontend changes, package/data status for data work, and DMG evidence for app/release work. Record cross-module, data, audit, security, or unresolved business issues in `docs/06-implementation/open-issues.md`; close small, fully verified fixes in the current task.
