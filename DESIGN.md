# SAPD Wiki Design Context

## Register

Product UI for a local security architecture relationship workspace.

## Layout System

- Use three-part workspaces when helpful: navigation tree, relationship table or matrix, detail or evidence area.
- Prefer dense tables, tree tables, split panes, matrix rows, and compact chips.
- Avoid nested cards. Use sections, panes, tables, and restrained borders.
- Every major area should support scanning and comparison before decoration.

## Visual Language

- Light, calm, enterprise workspace.
- Use an Apple shell direction on top of the restrained Morandi palette: bright tinted neutrals, macOS-like sidebar surfaces, clear iOS-blue selected states, and low-noise panels.
- Apple direction handoff is tracked in `docs/06-implementation/apple-color-direction-handoff-2026-05-29.md`; current formal frontend colors should follow that token path rather than the older warm Morandi baseline alone.
- The canonical demo workspace is `frontend/capability-browser/environment-object-apple-shell-demo.html` and can be viewed at `http://127.0.0.1:5173/environment-object-apple-shell-demo.html#color-system`. Future frontend color changes must check the `颜色系统` tab first and keep shell neutrals, selected states, tabs, status badges, relationship chips, table row colors, lifecycle tones, standard-framework colors, and graph semantic colors aligned with it. Future new page demos should be added to this workspace instead of creating a new standalone canonical demo route.
- Keep chroma low. Avoid pure blue, bright green, saturated orange, purple-blue gradients, and high-contrast candy colors in normal UI.
- Keep color semantic: selected, pending review, missing, warning, normal.
- Avoid one-note purple or blue gradients.
- Avoid large KPI cards unless they directly support data review.

## Typography

- Use system UI fonts for local reliability.
- Keep headings compact inside tool surfaces.
- Use weight and spacing for hierarchy instead of oversized hero text.
- Chinese labels should be concise and business-specific.

## Components

- Navigation: tree or nested list.
- Main relationship display: data table, tree table, matrix, or split table.
- Status: compact badges such as `待复核`, `待确认`, `待补充`, `不适用`.
- Relationship chips should use the shared Morandi roles in `styles.css` and the color demo: blue for security technical service, sage for security technology module, clay for security technical measure or missing state, lavender for focus/system, sand for standard/framework, blue-gray/slate for environment and weak structure.
- Relationship graph colors must prioritize semantic roles over hierarchy: current/focus nodes use muted lavender, technical uses muted blue, management uses sage, standards use sand. Pure hierarchy levels may use sand, clay, and slate, with clear lightness differences, but must not override semantic focus/view colors.
- Tabs, segmented controls, table headers, hover rows, active tree rows, and CSF / lifecycle color rows should reuse the demo roles instead of introducing one-off local colors.
- Source evidence: folded panel only.
- Business `参考来源`: use the shared low-noise label + rounded reference box pattern. It may appear inside business tables only when the value is a user-readable business reference, not a raw provenance field.
- Filters: search and simple controls, not heavy dashboard filter bars.

## Frontend Display Governance

- The global frontend design baseline is `docs/06-implementation/frontend-global-design-baseline-2026-05-30.md`; new and existing pages must converge to it by default.
- Current frontend display categories and text / table / character rules are governed by `docs/06-implementation/frontend-display-design-principles-2026-05-30.md`.
- Future frontend work must first identify the affected display category, then follow the corresponding typography, table, tab, chip, graph, empty-state, and field-boundary rules.
- If the user says "按全局设计基线", "像 Apple demo 一样", or "这个页面不统一", Codex must apply the baseline without requiring a long prompt from the user.
- Do not apply broad visual overrides across tables, tabs, directories, and graphs unless the governing document explicitly defines a shared rule.
- New display categories must update the governance document before implementation.
- Current baseline explicitly treats tabs as navigation-only, relationship chips as cell-contained business objects, lifecycle stage tabs as protected controls, and semantic object colors as cross-page invariants.
- Multi-tab layouts must choose width behavior by type: view-switch tabs are content-sized, sequence tabs such as LC-AP / LC-DT are measured equal-width, and statistics stay outside tabs.
- Relationship matrix chips are static relationship labels by default; they must not inherit parent-row navigation unless an explicit business destination exists.
- Business `参考来源` display is part of the global baseline: label `参考来源` above a subtle rounded reference box; do not render it as plain text, strong chips, buttons, badges, or raw source evidence.

## Field Boundary Rules

Primary UI must not display raw source fields such as `sheet`, `row`, `column`, `raw_value`, `source_file`, `import_id`, `source_id`, `generated_at`, `debug`, `raw`, or `metadata`.

Those fields may appear only in source evidence panels, collapsed by default.

## Current Frontend Architecture

- Static HTML, CSS, and vanilla JavaScript.
- `dataClient.js` reads exported JSON and simulates future API boundaries.
- `viewModels.js` converts exported data into UI-safe projections.
- Components render only ViewModel fields.
- Do not introduce React, Vue, or complex state management in the current MVP.
