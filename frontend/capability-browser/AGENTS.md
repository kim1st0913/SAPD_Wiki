# Capability Browser Rules

## Design Authority

For every frontend design, layout, style, or UI-component change, regardless of whether Product Design, Impeccable, another plugin, or no skill is used:

- Read the repository-root `DESIGN.md` before proposing or editing. Read only the relevant sections of `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md` and `docs/06-implementation/frontend-display-design-principles-2026-05-30.md`.
- Identify the affected display category, the shared code/style owner, and the canonical component or reference route. Color-system changes must check `frontend/capability-browser/environment-object-apple-shell-demo.html#color-system`.
- Use current formal implementation specifications, `DESIGN.md`, shared tokens, and shared components as authority. Historical screenshots, Stitch output, archived briefs, and plugin defaults are reference only unless the user explicitly selects them as a new direction.
- Project design contracts override plugin aesthetics. A plugin may improve hierarchy or usability but may not silently redefine the Apple Shell + restrained Morandi direction, typography scale, spacing, radii, semantic colors, or shared interaction patterns.
- Reuse existing search, tab, segmented-control, button, pagination, badge, chip, table, panel, and empty-state owners. Do not introduce a page-local variant when a shared equivalent exists.
- Do not add raw colors or new visual tokens for a local correction when an approved token exists. A deliberate new token or shared component requires user approval and a baseline update.
- Preserve the operational-workspace character: dense, scannable, low-noise panes and tables; no marketing composition, nested cards, decorative dashboard walls, or unrelated visual effects.

For a localized correction, inspect the target and its canonical owner, patch the smallest shared or scoped owner, then run the affected static check and one batched browser/DOM acceptance at the reported route and viewport. Include geometry, overflow, interaction state, and console checks when relevant. Do not create or update design documents for a correction that restores an existing approved rule.

## Frontend Data And Object Boundaries

- Components render declared ViewModel or API fields. They must not read raw sheets, SQLite, undeclared JSON, or reimplement ETL, matching, scoring, or business inference.
- The selected object, title, graph focus, detail panel, and related data must use the same explicit object ID and grain. Do not substitute a parent projection, first row, default focus, or stale cache.
- When changing `dataClient`, ViewModel, lazy loading, route restoration, caching, or graph input, validate the affected L0, L1, L2, and focus/object selections that share that path.
- Main business surfaces must not expose raw provenance or implementation fields such as `sheet`, `row`, `column`, `raw_value`, `source_file`, `import_id`, `source_id`, `source_ref`, `debug`, `raw`, `metadata`, `intermediate`, or `generated_at`. Keep source evidence in its declared folded or maintenance surface.
- Treat `0` as a valid sort/order value. Do not use truthy fallbacks for `sortOrder`, `sourceOrder`, `tree_order`, `display_order`, `rowIndex`, or equivalent ordered fields.

## Maturity Assessment

Apply this section only when changing `MaturityAssessmentWorkbench.js`, `maturity-assessment-workbench.css`, maturity-assessment data/contracts, or their acceptance behavior.

If a task intentionally creates or changes a durable maturity business rule, scoring/aggregation definition, template structure, information architecture, interaction contract, reusable layout policy, breakpoint policy, design token, or acceptance rule, update in the same task:

- `frontend/design-handoff/implementation-specs/maturity-assessment-v2-1-complete-frontend-design-2026-07-12.md`
- `/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/SAPD maturity assesment/SAPD_成熟度评估业务设计_V2.1_20260712.md`
- `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md`

A correction that restores existing approved behavior is not a durable contract change merely because it adjusts CSS grid tracks, width, typography, spacing, alignment, clipping, or responsive presentation.

For a code-only defect that does not create or intentionally change a durable contract, do not update the three specifications, `CURRENT_STATE.md`, `progress.md`, `findings.md`, `design-qa.md`, or Open Issues. Keep the change to implementation and the smallest targeted regression evidence, then report that evidence in the task result.

Validate the affected object grain and user workflow. A `5173` result is not App acceptance when the change affects local state, `WKWebView`, or packaging.
