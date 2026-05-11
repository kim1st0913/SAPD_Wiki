PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS source_files (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (
    file_type IN ('xlsx', 'pptx', 'drawio', 'docx', 'md', 'csv', 'json', 'pdf', 'unknown')
  ),
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL UNIQUE,
  file_size INTEGER,
  usage_policy TEXT NOT NULL CHECK (
    usage_policy IN ('import_source', 'guide', 'view_only', 'attachment', 'raw_sample')
  ),
  sensitive_level TEXT NOT NULL DEFAULT 'unknown' CHECK (
    sensitive_level IN ('unknown', 'internal', 'public', 'confidential')
  ),
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('active', 'archived', 'missing')
  ),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_source_files_file_name ON source_files(file_name);
CREATE INDEX IF NOT EXISTS idx_source_files_file_type ON source_files(file_type);
CREATE INDEX IF NOT EXISTS idx_source_files_usage_policy ON source_files(usage_policy);
CREATE INDEX IF NOT EXISTS idx_source_files_sensitive_level ON source_files(sensitive_level);
CREATE INDEX IF NOT EXISTS idx_source_files_status ON source_files(status);

CREATE TABLE IF NOT EXISTS import_jobs (
  id TEXT PRIMARY KEY,
  source_file_id TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (
    job_type IN ('initial_import', 'reimport', 'batch_import', 'manual_edit')
  ),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'parsed', 'reviewing', 'approved', 'rejected', 'failed')
  ),
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at TEXT,
  summary_json TEXT,
  error_json TEXT,
  FOREIGN KEY (source_file_id) REFERENCES source_files(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_source_file_id ON import_jobs(source_file_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_job_type ON import_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (
    status IN ('draft', 'active', 'deprecated')
  ),
  parent_id TEXT,
  source_file_id TEXT,
  source_hash TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (parent_id) REFERENCES knowledge_items(id) ON DELETE SET NULL,
  FOREIGN KEY (source_file_id) REFERENCES source_files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_items_type_code ON knowledge_items(type, code);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_type_title ON knowledge_items(type, title);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_parent_id ON knowledge_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_status ON knowledge_items(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_source_file_id ON knowledge_items(source_file_id);

CREATE TABLE IF NOT EXISTS knowledge_relations (
  id TEXT PRIMARY KEY,
  source_item_id TEXT NOT NULL,
  target_item_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  relation_label TEXT,
  confidence TEXT NOT NULL DEFAULT 'exact' CHECK (
    confidence IN ('exact', 'inferred', 'manual')
  ),
  source_file_id TEXT,
  import_job_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
  FOREIGN KEY (target_item_id) REFERENCES knowledge_items(id) ON DELETE CASCADE,
  FOREIGN KEY (source_file_id) REFERENCES source_files(id) ON DELETE SET NULL,
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_knowledge_relations_source_type
  ON knowledge_relations(source_item_id, relation_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_relations_target_type
  ON knowledge_relations(target_item_id, relation_type);

CREATE INDEX IF NOT EXISTS idx_knowledge_relations_pair
  ON knowledge_relations(source_item_id, relation_type, target_item_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_relations_source_file_id
  ON knowledge_relations(source_file_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_relations_import_job_id
  ON knowledge_relations(import_job_id);

