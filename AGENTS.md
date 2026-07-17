# SAPD Wiki Instructions

## Product Contract

SAPD Wiki is a local, maintainable knowledge system, not a static website. It must preserve source traceability, support local user state, and ship as a reliable desktop/offline application.

Protect these invariants:

- Original sources, protected dictionaries, standards, lifecycle baselines, generated packages, and user databases have distinct ownership. Do not overwrite a protected baseline, source Excel, SQLite, generated package, or real user data without explicit scope, backup/recovery path, and acceptance evidence.
- Frontend code consumes the declared `dataClient` or `/api/v1/*` contract. It must not recreate ETL, matching, scoring, or business inference from raw sheets, SQLite, or ad hoc JSON.
- Current UI identity comes from an explicit selected ID or an equally specific backend response. Do not use `rows[0]`, a default focus, stale cache, or a parent-level projection as a substitute for the selected object.
- Preserve Excel merged ranges when they encode business relationships. Do not infer them later with global forward-fill.
- Tests and demos must not mutate a real user database unless the user explicitly approves the write scope and recovery path.

## Authority And Context

Within this project, use the following authority order when sources disagree:

1. The current user request and acceptance criteria.
2. The nearest applicable `AGENTS.md`.
3. Current formal business, API, data, implementation, and design contracts.
4. Current shared code owners, tests, and verified runtime behavior.
5. Historical screenshots, archived briefs, old handoffs, and retired documents as reference only.

The dirty working tree and current runtime evidence define the implementation state. A handoff or state document may explain that state but never authorizes overwriting newer local work. Explain material decisions in clear Chinese; keep code, commands, paths, identifiers, and quoted source text in their native form.

Load context by task type:

- For a bounded defect with a clear owner, read the nearest `AGENTS.md`, the target owner, and the smallest relevant test or reference. Frontend visual work must also follow the frontend design gate in `frontend/capability-browser/AGENTS.md`.
- For a new main-control task, a handoff recovery, or material cross-module, data, App, packaging, release, or architecture work, read `CURRENT_STATE.md`, only the recent relevant portion of `progress.md`, and only the current relevant decisions in `findings.md`.
- Do not default-read archives, full historical logs, broad diffs, full data packages, backups, or unrelated specifications. Use them only when current evidence points there.

## Work Routing And Stop Rule

Start with one focused inspection batch over the smallest implementation and test files needed to identify the controlling code, style, API, data, user-state, or packaging owner. If that batch does not establish the owner or required evidence, make only the smallest useful follow-up read.

For a bounded implementation defect with a clear owner and no evidence of a wider boundary:

- Once the owner and intended behavior are supported, edit instead of continuing discovery merely to increase confidence.
- Do not update project-state documents, Open Issues, design QA, implementation specifications, or business-design documents for a small correction that restores an existing contract.
- Do not invoke a skill or plugin unless the user requests it or the affected boundary needs its specialized workflow. Project contracts still apply when no plugin is used.
- Batch independent reads and deterministic validations. Reuse a known tool workflow; inspect tool or browser documentation only after an intended operation is unknown or fails.
- For a UI defect, use the supplied screenshot, route, and viewport as pre-fix evidence when sufficient. After the patch, run the affected static or targeted test and one batched browser or DOM acceptance check at the reported route and viewport.
- Do not run sibling sampling, negative controls, full suites, data-boundary checks, release checks, or DMG validation unless evidence shows that the affected boundary requires them.

Escalate only when evidence crosses a data, API, user-state, object-grain, source-authority, packaging, release, security, or durable shared-contract boundary. Repeated feedback or another screenshot is not automatically a wider boundary, but repeated regressions should trigger inspection of the shared owner and missing acceptance rule.

Stop when the scoped behavior passes its targeted acceptance check and no material boundary evidence remains. Resolve the request in the fewest useful tool loops without letting loop reduction outrank correctness.

Keep the working surface light: use summaries before full logs or process lists; keep the stable local preview at `http://127.0.0.1:5173/`; do not launch system Chrome unless the user approves it.

## Parallel Agent Orchestration

The user authorizes the parent Agent to use internal subagents for SAPD without asking again when a task contains independent, material workstreams. Use the smallest useful set, usually one to three subagents.

- Keep the immediate blocker and final integration on the parent. Delegate only non-blocking research, verification, or implementation slices with disjoint ownership; do not delegate a result the parent's next action immediately depends on.
- Do not spawn for a bounded defect with one clear owner or when coordination would cost more than the work.
- Before a coding subagent starts, define its objective, minimum inputs, exact write set, dependencies, acceptance evidence, timeout, and stop condition. Coding write sets must not overlap.
- Coding subagents work in their forked workspace. Concurrent or independent user-owned tasks require separate worktrees; a successor replacing a stopped source task may remain in the same checkout as its sole writer. Never use two same-checkout tasks as worker agents.
- Prefer minimal task packets and fresh subagent context; pass the full parent history only when the subtask truly depends on it. Use task-appropriate reasoning effort instead of escalating bounded workers to `xhigh` by default.
- While subagents run, the parent continues meaningful non-overlapping work. Do not duplicate delegated work or repeatedly poll; review returned patches before integration and close completed subagents.
- Design or Product Design work may run in parallel as read-only evidence or a bounded specification. It must not concurrently rewrite production files owned by an implementation subagent.
- Only the parent integrates results, updates project memory, selects the final acceptance matrix, reviews its evidence, and reports completion. A subagent check may satisfy final acceptance only when it runs against the integrated snapshot; otherwise it is supporting evidence and must not trigger a duplicate full matrix.
- In one checkout, only one active writer may own a file or tightly coupled file set. If concurrent writers are discovered, stop one path or isolate it before further edits; interleaved validation is invalid.
- If internal subagent or worktree tools are unavailable, fall back to parent-only serial execution. Do not emulate delegation with another same-checkout user task.

## Session Health And Handoff

- Keep the parent responsive by delegating high-hang-risk browser uploads, file choosers, exploratory test matrices, or post-integration validation when their evidence can be reviewed without rerunning the same work.
- When a task is slow or stuck, use `codex-session-handoff` to classify the blocked layer and select a bounded recovery. Do not treat all silence as model latency or use handoff as a substitute for subagent orchestration.
- Proactively report the diagnosis and exact recovery option. Do not silently create, replace, or archive a user-owned task; perform an actual handoff only when the user asks for or accepts one.

## Project Memory

- Update `CURRENT_STATE.md` only when the active main line, forbidden scope, material risk, or next project step changes.
- Update `progress.md` after a material task, checkpoint, or handoff. Batch consecutive small fixes from one task into one compact entry instead of writing after every patch.
- Update `findings.md` only for durable decisions, unresolved material risks, or stable evidence entry points.
- Use `docs/06-implementation/open-issues.md` only for unresolved work, cross-module impact, data/audit/security/user-state/release boundaries, medium or high severity, required business judgment, or incomplete validation. Do not create an issue for a small fix completed and verified in the same task.
- Create a long-lived document only for a durable cross-module contract, a user-facing deliverable, or a data, security, release, or audit boundary.

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
- All frontend work, with or without a plugin, follows `DESIGN.md` and the nearest frontend `AGENTS.md`. A plugin may propose improvements but may not silently redefine project tokens, shared components, or approved interaction contracts.
- Use `impeccable` only for an explicit design, redesign, or UX-audit request, not for a localized bug fix or spec-led implementation.
- Maturity-assessment and capability-browser rules are local to `frontend/capability-browser/AGENTS.md`.
- Use SAPD testing, data QA, delivery, and security skills only when their described boundary is actually in scope.

## Completion

For every change, report the outcome, changed scope, impact surface, root layer when relevant, validation performed, and remaining risk.

Add only the conditional evidence that applies:

- Frontend: user navigation path, target route, expected visible result, and browser/DOM validation status.
- Data or ETL: source/package/database change status, object grain, counts or data state when relevant, and protected-boundary status.
- User state: writes performed during implementation or testing, cleanup/recovery status, and whether real user data was preserved.
- App or release: DMG/runtime evidence completed and any remaining manual UAT.
- Unresolved material work: the Open Issue entry or the reason it remains outside the current scope.
