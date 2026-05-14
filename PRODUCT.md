# SAPD Wiki Product Context

register: product

## Product Purpose

SAPD Wiki is a local, static-first security architecture knowledge workspace. It turns Excel-based security capability, scope, service, process, function, standard, and role knowledge into structured relationship views that help users inspect business logic, find mapping errors, and maintain a long-lived local knowledge base.

## Primary Users

- Non-developer project owner who needs to review security architecture data and guide AI-assisted implementation.
- Security architecture and governance practitioners who need to inspect capability, scope, service, process, function, and reference mappings.
- Future maintainers who need clear data contracts, source evidence, and predictable local workflows.

## Product Tone

Quiet, precise, professional, consulting-style. The interface should feel like a dense business relationship workspace, not a marketing website, document library, dashboard toy, or decorative card wall.

## Strategic Principles

- Relationships are the product. Tables, trees, matrices, and linked inspectors are preferred over KPI cards and decorative panels.
- Source evidence is important but secondary. It belongs in folded evidence panels, not primary business views.
- Frontend consumes ViewModel projections. It must not directly display raw JSON, sheet, row, column, raw_value, generated_at, or debug fields.
- Local-first matters. The app should work from exported static JSON and remain understandable without online services.
- Business semantics win over visual flourish. Visual design should clarify mappings, constraints, exceptions, and review status.

## Anti-References

- SaaS marketing landing pages.
- Card-heavy document libraries.
- Full knowledge graph views as the default answer.
- KPI dashboards that hide relationship detail.
- Generic blue-purple AI dashboards.
- Decorative glassmorphism, gradient text, nested cards, and large hero metrics.
