PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS staging_items (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  proposed_action TEXT NOT NULL CHECK (
    proposed_action IN ('create', 'update', 'skip', 'conflict')
  ),
  matched_item_id TEXT,
  type TEXT NOT NULL,
  code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  metadata_json TEXT,
  source_reference_json TEXT NOT NULL,
  validation_status TEXT NOT NULL CHECK (
    validation_status IN ('ok', 'warning', 'error')
  ),
  validation_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (matched_item_id) REFERENCES knowledge_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_staging_items_import_job_id ON staging_items(import_job_id);
CREATE INDEX IF NOT EXISTS idx_staging_items_action ON staging_items(proposed_action);
CREATE INDEX IF NOT EXISTS idx_staging_items_type_code ON staging_items(type, code);
CREATE INDEX IF NOT EXISTS idx_staging_items_validation_status ON staging_items(validation_status);

CREATE TABLE IF NOT EXISTS staging_relations (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  proposed_action TEXT NOT NULL CHECK (
    proposed_action IN ('create', 'update', 'skip', 'conflict')
  ),
  matched_relation_id TEXT,
  source_item_key TEXT NOT NULL,
  target_item_key TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  metadata_json TEXT,
  source_reference_json TEXT NOT NULL,
  validation_status TEXT NOT NULL CHECK (
    validation_status IN ('ok', 'warning', 'error')
  ),
  validation_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (matched_relation_id) REFERENCES knowledge_relations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_staging_relations_import_job_id ON staging_relations(import_job_id);
CREATE INDEX IF NOT EXISTS idx_staging_relations_action ON staging_relations(proposed_action);
CREATE INDEX IF NOT EXISTS idx_staging_relations_relation_type ON staging_relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_staging_relations_validation_status ON staging_relations(validation_status);

CREATE TABLE IF NOT EXISTS review_decisions (
  id TEXT PRIMARY KEY,
  import_job_id TEXT NOT NULL,
  staging_type TEXT NOT NULL CHECK (staging_type IN ('item', 'relation')),
  staging_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (
    decision IN ('approve', 'reject', 'merge', 'keep_manual', 'needs_fix')
  ),
  note TEXT,
  decided_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_review_decisions_import_job_id ON review_decisions(import_job_id);
CREATE INDEX IF NOT EXISTS idx_review_decisions_staging ON review_decisions(staging_type, staging_id);
CREATE INDEX IF NOT EXISTS idx_review_decisions_decision ON review_decisions(decision);

CREATE TABLE IF NOT EXISTS change_logs (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('item', 'relation')),
  target_id TEXT NOT NULL,
  change_type TEXT NOT NULL CHECK (
    change_type IN ('create', 'update', 'deprecate', 'merge')
  ),
  before_json TEXT,
  after_json TEXT,
  import_job_id TEXT,
  changed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (import_job_id) REFERENCES import_jobs(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_change_logs_target ON change_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_import_job_id ON change_logs(import_job_id);
CREATE INDEX IF NOT EXISTS idx_change_logs_change_type ON change_logs(change_type);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

