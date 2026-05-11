PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guide_pages (
  id TEXT PRIMARY KEY,
  source_file_id TEXT NOT NULL,
  slide_number INTEGER NOT NULL,
  title TEXT,
  content TEXT,
  note TEXT,
  media_count INTEGER,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_file_id) REFERENCES source_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_guide_pages_source_file_id ON guide_pages(source_file_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_guide_pages_source_slide
  ON guide_pages(source_file_id, slide_number);

CREATE TABLE IF NOT EXISTS diagram_views (
  id TEXT PRIMARY KEY,
  source_file_id TEXT NOT NULL,
  page_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  vertex_count INTEGER,
  edge_count INTEGER,
  preview_path TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_file_id) REFERENCES source_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_diagram_views_source_file_id ON diagram_views(source_file_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_diagram_views_source_page
  ON diagram_views(source_file_id, page_index);

