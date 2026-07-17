# Capability Browser Rules

Apply the maturity section only when changing `MaturityAssessmentWorkbench.js`, `maturity-assessment-workbench.css`, maturity assessment data/contracts, or their acceptance behavior.

If a task intentionally creates or changes a durable maturity business rule, scoring/aggregation definition, template structure, information architecture, interaction contract, reusable layout policy, breakpoint policy, design token, or acceptance rule, update in the same task:

- `frontend/design-handoff/implementation-specs/maturity-assessment-v2-1-complete-frontend-design-2026-07-12.md`
- `/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/SAPD maturity assesment/SAPD_成熟度评估业务设计_V2.1_20260712.md`
- `frontend/design-handoff/implementation-specs/frontend-global-optimization-plan-2026-07-11.md`

A correction that restores existing approved behavior is not a durable contract change merely because it adjusts CSS grid tracks, width, typography, spacing, alignment, clipping, or responsive presentation.

For a code-only defect that does not create or intentionally change a durable contract, do not update the three specifications, `CURRENT_STATE.md`, `progress.md`, `findings.md`, `design-qa.md`, or Open Issues. Keep the change to implementation and the smallest targeted regression evidence, then report that evidence in the task result.

Validate the affected object grain and user workflow. A `5173` result is not App acceptance when the change affects local state, `WKWebView`, or packaging.
