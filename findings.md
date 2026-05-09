# Findings: SAPD 工作知识库系统

## 2026-05-09 Initial Findings

The provided concept document positions the project as a local structured knowledge asset system, not a simple file manager.

Key requirements extracted:

- GitHub should maintain the engineering project.
- Existing knowledge exists across Excel, Draw.io, PPT, DOCX and other file formats.
- Knowledge should be structured and stored in a database.
- Updates must support manual edits, batch uploads, and third-party ETL mapping.
- UI should support different knowledge type pages, relation queries, multi-dimensional export, and full export.
- The app should run locally through HTML/frontend pages with good performance.
- Final delivery should be a local executable/package with required components bundled.
- Feature pages should be extensible.
- User is not a developer and needs Codex-guided phased execution.

Architecture judgment:

- V1 should use SQLite and local file storage.
- React + TypeScript + Tauri is a reasonable default for local frontend/desktop delivery.
- Python or Node.js ETL scripts can parse files and populate SQLite.
- SQLite FTS5 is enough for first-stage keyword/full-text search.
- DuckDB, graph databases, and RAG should be future enhancements, not the V1 foundation.

Implementation judgment:

- Start with Excel, Markdown and DOCX.
- Delay PPT and Draw.io deep parsing until the import model is proven.
- Preserve raw files and source metadata.
- Require import jobs, file hashes, source locations and change logs.
- Add review/diff workflow before accepting bulk or ETL updates.

Important project risk:

- If the system only previews files, it loses most of its value. The important work is extracting knowledge objects and relationships from source files.

Recommended immediate docs:

- `docs/data-model.md`
- `docs/import-rules.md`
- `docs/sample-files.md`
- `README.md`
- `.gitignore`

## 2026-05-09 Data Definition and ETL Planning Findings

The user clarified a critical concern: before development, they do not yet know how to turn multi-source files into fields, mappings and ETL rules. This is a product/data-design problem that must happen before implementation.

New planning judgment:

- Add a pre-development stage focused on "data discovery and knowledge modeling".
- Do not ask a non-developer user to define database tables directly.
- Start from real files, user questions, export needs and repeated business concepts.
- Derive fields from examples, then turn stable fields into a canonical data dictionary.
- Treat each source file as evidence, not as the final data model.
- Build mapping tables that connect source columns/locations to canonical fields.
- ETL should be designed as a reviewable pipeline: extract, normalize, map, validate, review, load.
- V1 import should include a staging area and review workflow before records enter the main knowledge tables.

Important design implication:

- Development should not start with UI pages. It should start with sample-file inventory, knowledge object definitions, field dictionary, mapping rules and update rules.

Docs to add or revise:

- `docs/data-definition-guide.md`
- `docs/data-dictionary-template.md`
- `docs/import-rules.md`
- `docs/sample-file-inventory.md`

## 2026-05-09 Supplemental Implementation Guide Findings

Source reviewed: `/Users/kim1st/Documents/kim note/non-developer-knowledge-base-implementation-guide.md`.

Key additions from the supplemental guide:

- Non-developer workflow should explicitly produce three structured inputs before coding: `knowledge_objects.xlsx`, `field_dictionary.xlsx`, and `mapping_rules.xlsx`.
- The first file inventory should be treated as a "knowledge asset inventory", not a simple directory listing.
- V1 knowledge objects can include Capability, Process, ArchitectureElement, Control, Risk, Indicator, SourceFile, Relation and Tag.
- For maturity or assessment spreadsheets, a single Excel row may split into multiple objects: Capability, Indicator, AssessmentResult, ImprovementTask, Relation and SourceFile.
- ETL should be explained to the user as Extract, Transform and Load:
  - Extract: read sheets, rows, headings, slides and draw.io nodes.
  - Transform: rename fields, standardize values, generate IDs, split or merge fields, detect duplicates and create relationships.
  - Load: write staged records and reviewed records to database tables.
- Development tasks for Codex should be sequenced after data inputs are ready: project skeleton, SQLite schema, Excel ETL, staging/review, then base pages.

Planning consequence:

- Phase 1 should now output both markdown docs and spreadsheet-like configuration templates. Markdown can be used first; actual `.xlsx` files can be generated later once sample data is available.
