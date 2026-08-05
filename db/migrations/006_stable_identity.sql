-- sapd:add-column-if-missing
ALTER TABLE knowledge_items ADD COLUMN stable_key TEXT;
-- sapd:add-column-if-missing
ALTER TABLE knowledge_items ADD COLUMN stable_ref TEXT;
-- sapd:add-column-if-missing
ALTER TABLE knowledge_items ADD COLUMN public_id TEXT;

-- sapd:add-column-if-missing
ALTER TABLE knowledge_relations ADD COLUMN stable_key TEXT;
-- sapd:add-column-if-missing
ALTER TABLE knowledge_relations ADD COLUMN stable_ref TEXT;
-- sapd:add-column-if-missing
ALTER TABLE knowledge_relations ADD COLUMN public_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_items_stable_ref
  ON knowledge_items(stable_ref);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_stable_key
  ON knowledge_items(type, stable_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_relations_stable_ref
  ON knowledge_relations(stable_ref);
CREATE INDEX IF NOT EXISTS idx_knowledge_relations_stable_key
  ON knowledge_relations(relation_type, stable_key);
