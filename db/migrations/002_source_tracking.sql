PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS source_references (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('item', 'relation')),
  target_id TEXT NOT NULL,
  source_file_id TEXT NOT NULL,
  source_sheet TEXT,
  source_row INTEGER,
  source_column TEXT,
  source_cell TEXT,
  raw_value TEXT,
  source_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_file_id) REFERENCES source_files(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_source_references_target
  ON source_references(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_source_references_location
  ON source_references(source_file_id, source_sheet, source_row);

CREATE TABLE IF NOT EXISTS item_aliases (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  alias TEXT NOT NULL,
  alias_type TEXT NOT NULL CHECK (
    alias_type IN ('original', 'normalized', 'manual')
  ),
  source_reference_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
  FOREIGN KEY (source_reference_id) REFERENCES source_references(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_item_aliases_item_id ON item_aliases(item_id);
CREATE INDEX IF NOT EXISTS idx_item_aliases_alias ON item_aliases(alias);

