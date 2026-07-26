PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS asset_schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_assets (
  asset_hash TEXT PRIMARY KEY,
  mime_type TEXT NOT NULL,
  format TEXT NOT NULL,
  byte_count INTEGER NOT NULL CHECK (byte_count >= 0),
  content_bytes BLOB NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (length(content_bytes) = byte_count)
);

CREATE INDEX IF NOT EXISTS idx_content_assets_format
  ON content_assets(format);
CREATE INDEX IF NOT EXISTS idx_content_assets_mime
  ON content_assets(mime_type);

CREATE TABLE IF NOT EXISTS document_assets (
  id TEXT PRIMARY KEY,
  owner_ref TEXT NOT NULL,
  asset_hash TEXT NOT NULL,
  asset_role TEXT NOT NULL CHECK (
    asset_role IN (
      'original',
      'derived-preview',
      'derived-semantic-projection',
      'page-preview',
      'region-preview'
    )
  ),
  ordinal INTEGER,
  logical_file_name TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (asset_hash) REFERENCES content_assets(asset_hash) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_document_assets_identity
  ON document_assets(owner_ref, asset_role, logical_file_name);
CREATE INDEX IF NOT EXISTS idx_document_assets_owner
  ON document_assets(owner_ref, asset_role, ordinal);
CREATE INDEX IF NOT EXISTS idx_document_assets_hash
  ON document_assets(asset_hash);
