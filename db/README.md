# Database

This directory contains database migration scripts and database-related developer notes.

Runtime database files must not be committed. Local SQLite files belong under `data/database/` during development, and under the application data directory after desktop packaging.

## Migration Order

Run migrations in numeric order:

1. `migrations/001_init_core.sql`
2. `migrations/002_source_tracking.sql`
3. `migrations/003_staging_review.sql`
4. `migrations/004_search.sql`
5. `migrations/005_guides_diagrams.sql`

## Local Command

From the repository root:

```bash
python scripts/sapd_wiki.py init-db
```

The development database is created at:

```text
data/database/sapd_wiki.sqlite3
```
