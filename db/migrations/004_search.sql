CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_items_fts USING fts5(
  title,
  description,
  code,
  category,
  content='knowledge_items',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS knowledge_items_ai
AFTER INSERT ON knowledge_items
BEGIN
  INSERT INTO knowledge_items_fts(rowid, title, description, code, category)
  VALUES (new.rowid, new.title, new.description, new.code, new.category);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_items_ad
AFTER DELETE ON knowledge_items
BEGIN
  INSERT INTO knowledge_items_fts(knowledge_items_fts, rowid, title, description, code, category)
  VALUES ('delete', old.rowid, old.title, old.description, old.code, old.category);
END;

CREATE TRIGGER IF NOT EXISTS knowledge_items_au
AFTER UPDATE ON knowledge_items
BEGIN
  INSERT INTO knowledge_items_fts(knowledge_items_fts, rowid, title, description, code, category)
  VALUES ('delete', old.rowid, old.title, old.description, old.code, old.category);

  INSERT INTO knowledge_items_fts(rowid, title, description, code, category)
  VALUES (new.rowid, new.title, new.description, new.code, new.category);
END;

