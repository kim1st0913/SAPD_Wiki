PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS content_schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS content_documents (
  id TEXT PRIMARY KEY,
  stable_ref TEXT NOT NULL UNIQUE,
  document_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  format TEXT NOT NULL CHECK (
    format IN ('drawio', 'pdf', 'pptx', 'md', 'html')
  ),
  semantic_source INTEGER NOT NULL CHECK (semantic_source IN (0, 1)),
  parser TEXT NOT NULL,
  ocr_policy TEXT NOT NULL,
  logical_file_name TEXT NOT NULL UNIQUE,
  source_asset_hash TEXT NOT NULL,
  manifest_id TEXT NOT NULL,
  manifest_version TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_documents_format
  ON content_documents(format);
CREATE INDEX IF NOT EXISTS idx_content_documents_source_asset
  ON content_documents(source_asset_hash);

CREATE TABLE IF NOT EXISTS content_fragments (
  id TEXT PRIMARY KEY,
  stable_ref TEXT NOT NULL UNIQUE,
  document_id TEXT NOT NULL,
  fragment_type TEXT NOT NULL CHECK (
    fragment_type IN (
      'drawio_page',
      'drawio_node',
      'drawio_edge',
      'pdf_page',
      'pptx_slide',
      'markdown_section',
      'html_section',
      'manual_catalog'
    )
  ),
  ordinal INTEGER NOT NULL,
  title TEXT,
  body TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  source_locator TEXT NOT NULL,
  extraction_status TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES content_documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_fragments_document
  ON content_fragments(document_id, ordinal);
CREATE INDEX IF NOT EXISTS idx_content_fragments_type
  ON content_fragments(fragment_type);
CREATE INDEX IF NOT EXISTS idx_content_fragments_content_hash
  ON content_fragments(content_hash);

CREATE TABLE IF NOT EXISTS content_relations (
  id TEXT PRIMARY KEY,
  stable_ref TEXT NOT NULL UNIQUE,
  source_ref TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  relation_label TEXT,
  ordinal INTEGER,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_relations_source
  ON content_relations(source_ref, relation_type);
CREATE INDEX IF NOT EXISTS idx_content_relations_target
  ON content_relations(target_ref, relation_type);
CREATE UNIQUE INDEX IF NOT EXISTS ux_content_relations_identity
  ON content_relations(source_ref, relation_type, target_ref, stable_ref);

CREATE TABLE IF NOT EXISTS content_bindings (
  id TEXT PRIMARY KEY,
  content_ref TEXT NOT NULL,
  knowledge_ref TEXT NOT NULL,
  binding_type TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (
    confidence IN ('exact', 'manual', 'candidate')
  ),
  status TEXT NOT NULL CHECK (
    status IN ('active', 'rejected', 'superseded')
  ),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_content_bindings_identity
  ON content_bindings(content_ref, knowledge_ref, binding_type);
CREATE INDEX IF NOT EXISTS idx_content_bindings_knowledge
  ON content_bindings(knowledge_ref, status);

CREATE TABLE IF NOT EXISTS content_source_evidence (
  id TEXT PRIMARY KEY,
  target_ref TEXT NOT NULL,
  source_asset_hash TEXT NOT NULL,
  source_locator TEXT NOT NULL,
  extraction_method TEXT NOT NULL,
  evidence_hash TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_content_source_evidence_identity
  ON content_source_evidence(
    target_ref,
    source_asset_hash,
    source_locator,
    extraction_method
  );
CREATE INDEX IF NOT EXISTS idx_content_source_evidence_target
  ON content_source_evidence(target_ref);

CREATE VIRTUAL TABLE IF NOT EXISTS content_fragments_fts USING fts5(
  title,
  body,
  notes,
  content='content_fragments',
  content_rowid='rowid',
  tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS content_fragments_ai
AFTER INSERT ON content_fragments
BEGIN
  INSERT INTO content_fragments_fts(rowid, title, body, notes)
  VALUES (new.rowid, new.title, new.body, new.notes);
END;

CREATE TRIGGER IF NOT EXISTS content_fragments_ad
AFTER DELETE ON content_fragments
BEGIN
  INSERT INTO content_fragments_fts(
    content_fragments_fts,
    rowid,
    title,
    body,
    notes
  )
  VALUES ('delete', old.rowid, old.title, old.body, old.notes);
END;

CREATE TRIGGER IF NOT EXISTS content_fragments_au
AFTER UPDATE ON content_fragments
BEGIN
  INSERT INTO content_fragments_fts(
    content_fragments_fts,
    rowid,
    title,
    body,
    notes
  )
  VALUES ('delete', old.rowid, old.title, old.body, old.notes);

  INSERT INTO content_fragments_fts(rowid, title, body, notes)
  VALUES (new.rowid, new.title, new.body, new.notes);
END;
