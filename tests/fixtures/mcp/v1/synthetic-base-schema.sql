PRAGMA foreign_keys = ON;

CREATE TABLE knowledge_objects (
    canonical_ref TEXT PRIMARY KEY CHECK (canonical_ref LIKE 'fixture://%'),
    object_type TEXT NOT NULL,
    display_name TEXT NOT NULL,
    effective_sensitive_level TEXT NOT NULL,
    ai_use_policy TEXT NOT NULL,
    ai_summary TEXT,
    summary_version INTEGER,
    summary_hash TEXT
);

CREATE TABLE knowledge_relations (
    relation_ref TEXT PRIMARY KEY CHECK (relation_ref LIKE 'fixture://%'),
    relation_type TEXT NOT NULL,
    source_ref TEXT NOT NULL REFERENCES knowledge_objects(canonical_ref),
    target_ref TEXT NOT NULL REFERENCES knowledge_objects(canonical_ref)
);

CREATE TABLE knowledge_versions (
    knowledge_version TEXT PRIMARY KEY,
    policy_version TEXT NOT NULL,
    identity_version TEXT NOT NULL,
    manifest_digest TEXT NOT NULL
);

-- This sentinel is part of the synthetic base only. T1 must prove that no path
-- supplied as a user-store sentinel is opened or created.
CREATE TABLE synthetic_user_store_trap (
    trap_id TEXT PRIMARY KEY,
    expected_access_attempts INTEGER NOT NULL CHECK (expected_access_attempts = 0)
);
