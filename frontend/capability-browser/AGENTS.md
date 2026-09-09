# Capability Browser Rules

## Design Authority

For frontend design, layout, style, or UI-component work:

- Read repository-root `DESIGN.md` first. Consult only the relevant section of `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md` or `docs/06-implementation/frontend-display-design-principles-2026-05-30.md` when `DESIGN.md`, the current formal specification, and the shared owner do not resolve the decision.
- Identify the display category, shared code/style owner, and canonical component or reference route. For color-system changes, check `frontend/capability-browser/environment-object-apple-shell-demo.html#color-system`.
- Current formal specifications, `DESIGN.md`, shared tokens, and shared components are authoritative. Historical screenshots, Stitch output, archived briefs, and plugin defaults are reference only unless the user selects a new direction.
- Project design contracts override plugin aesthetics. Do not silently redefine the Apple Shell with restrained Morandi direction, typography, spacing, radii, semantic colors, or shared interactions.
- Reuse shared search, tabs, segmented controls, buttons, pagination, badges, chips, tables, panels, and empty states. Do not add a page-local variant when a shared equivalent exists.
- Use approved tokens. A new token or shared component requires an intentional design-system change and baseline update; a local correction does not.
- Preserve a dense, scannable, low-noise operational workspace. Avoid marketing composition, nested cards, decorative dashboard walls, and unrelated effects.

For a localized correction, patch the canonical shared or scoped owner and verify the reported route and viewport. Check geometry, overflow, interaction state, and console output only when relevant to the defect.

## Frontend Data And Object Boundaries

- Components render declared ViewModel or API fields. They must not read raw sheets, SQLite, undeclared JSON, or reimplement ETL, matching, scoring, or business inference.
- The selected object, title, graph focus, detail panel, and related data must use the same explicit object ID and grain. Do not substitute a parent projection, first row, default focus, or stale cache.
- When changing `dataClient`, ViewModel, lazy loading, route restoration, caching, or graph input, validate the affected L0, L1, L2, and focus/object selections that share that path.
- Main business surfaces must not expose raw provenance or implementation fields such as `sheet`, `row`, `column`, `raw_value`, `source_file`, `import_id`, `source_id`, `source_ref`, `debug`, `raw`, `metadata`, `intermediate`, or `generated_at`. Keep source evidence in its declared folded panel or maintenance surface, as defined by `DESIGN.md` and the current page contract.
- Treat `0` as a valid sort/order value. Do not use truthy fallbacks for `sortOrder`, `sourceOrder`, `tree_order`, `display_order`, `rowIndex`, or equivalent ordered fields.

## Search And User-State Acceptance

When changing search, filtering or restored selections, preserve the declared business-object or occurrence grain. Keep global search, page-local search and each business domain's history isolated. Validate the affected count, next/previous selection and deep-link target; use a known false positive or stale/fallback state when it tests a plausible regression. DOM text matching must not replace business-object search.

## Maturity Assessment

Apply this section only when changing `MaturityAssessmentWorkbench.js`, `maturity-assessment-workbench.css`, maturity-assessment data/contracts, or their acceptance behavior.

When a task intentionally changes a durable maturity business rule, scoring or aggregation definition, template structure, information architecture, interaction contract, reusable layout or breakpoint policy, design token, or acceptance rule, update these three authorities in the same task:

- `frontend/design-handoff/implementation-specs/maturity-assessment-v2-1-complete-frontend-design-2026-07-12.md`
- `/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/SAPD maturity assesment/SAPD_成熟度评估业务设计_V2.1_20260712.md`
- `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md`

CSS geometry, typography, spacing, alignment, clipping, or responsive corrections that restore approved behavior are implementation fixes, not durable contract changes. For those fixes, do not update the three specifications or project-memory documents.

Validate the affected object grain and user workflow. A `5173` result is not App acceptance when the change affects local state, `WKWebView`, or packaging.
