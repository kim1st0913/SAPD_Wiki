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
- Use restrained blue-gray neutrals with a small accent for selection and state.
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
- Source evidence: folded panel only.
- Filters: search and simple controls, not heavy dashboard filter bars.

## Field Boundary Rules

Primary UI must not display raw source fields such as `sheet`, `row`, `column`, `raw_value`, `source_file`, `import_id`, `source_id`, `generated_at`, `debug`, `raw`, or `metadata`.

Those fields may appear only in source evidence panels, collapsed by default.

## Current Frontend Architecture

- Static HTML, CSS, and vanilla JavaScript.
- `dataClient.js` reads exported JSON and simulates future API boundaries.
- `viewModels.js` converts exported data into UI-safe projections.
- Components render only ViewModel fields.
- Do not introduce React, Vue, or complex state management in the current MVP.
