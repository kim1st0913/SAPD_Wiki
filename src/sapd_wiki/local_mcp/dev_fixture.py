"""Explicit synthetic-only fixture factory for the Web development Sidecar."""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
from pathlib import Path


MANIFEST_DIGEST = "sha256:" + ("b" * 64)
POLICY_VERSION = "fixture-policy-v1"
KNOWLEDGE_VERSION = "fixture-knowledge-v1"
IDENTITY_VERSION = "fixture-identity-v1"

_SCHEMA = """
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
CREATE TABLE synthetic_user_store_trap (
    trap_id TEXT PRIMARY KEY,
    expected_access_attempts INTEGER NOT NULL CHECK (expected_access_attempts = 0)
);
"""

_FORMAL_BASE_SCHEMA = """
PRAGMA foreign_keys = ON;
CREATE TABLE source_files (
    id TEXT PRIMARY KEY,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    usage_policy TEXT NOT NULL,
    sensitive_level TEXT NOT NULL,
    status TEXT NOT NULL
);
CREATE TABLE knowledge_items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    code TEXT,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    status TEXT NOT NULL,
    parent_id TEXT,
    source_file_id TEXT,
    source_hash TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    stable_key TEXT,
    stable_ref TEXT NOT NULL UNIQUE,
    public_id TEXT
);
CREATE TABLE knowledge_relations (
    id TEXT PRIMARY KEY,
    source_item_id TEXT NOT NULL REFERENCES knowledge_items(id),
    target_item_id TEXT NOT NULL REFERENCES knowledge_items(id),
    relation_type TEXT NOT NULL,
    relation_label TEXT,
    confidence TEXT NOT NULL,
    source_file_id TEXT,
    import_job_id TEXT,
    metadata_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    stable_key TEXT,
    stable_ref TEXT NOT NULL UNIQUE,
    public_id TEXT
);
CREATE TABLE source_references (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    source_file_id TEXT NOT NULL REFERENCES source_files(id),
    source_sheet TEXT,
    source_row INTEGER,
    source_column TEXT,
    source_cell TEXT,
    raw_value TEXT,
    source_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def _validated_empty_root(root: Path) -> Path:
    if not root.is_absolute() or root.is_symlink():
        raise ValueError("synthetic root must be an explicit absolute non-symlink path")
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    resolved = root.resolve(strict=True)
    if not resolved.is_dir():
        raise ValueError("synthetic root must be a directory")
    os.chmod(resolved, 0o700)
    return resolved


def create_dev_synthetic_base(root: Path) -> Path:
    """Create the frozen fixture slot; never accepts an application runtime or user path."""

    resolved = _validated_empty_root(Path(root))
    database = resolved / "synthetic-base.sqlite3"
    if database.exists() or database.is_symlink():
        raise ValueError("synthetic fixture slot already exists")
    connection = sqlite3.connect(database)
    try:
        connection.executescript(_SCHEMA)
        connection.executemany(
            """
            INSERT INTO knowledge_objects(
                canonical_ref, object_type, display_name,
                effective_sensitive_level, ai_use_policy,
                ai_summary, summary_version, summary_hash
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "fixture://objects/public-a",
                    "fixture_type",
                    "Synthetic common Alpha",
                    "public",
                    "public_summary",
                    "Synthetic common summary Alpha.",
                    1,
                    "sha256:" + ("a" * 64),
                ),
                (
                    "fixture://objects/public-b",
                    "fixture_type",
                    "Synthetic common Beta",
                    "public",
                    "metadata_only",
                    None,
                    None,
                    None,
                ),
                (
                    "fixture://objects/public-c",
                    "fixture_type",
                    "Synthetic common Gamma",
                    "public",
                    "public_summary",
                    "Synthetic common summary Gamma.",
                    1,
                    "sha256:" + ("c" * 64),
                ),
                (
                    "fixture://objects/hidden-a",
                    "fixture_type",
                    "Synthetic common Hidden",
                    "internal",
                    "deny",
                    None,
                    None,
                    None,
                ),
            ],
        )
        connection.executemany(
            """
            INSERT INTO knowledge_relations(
                relation_ref, relation_type, source_ref, target_ref
            ) VALUES(?, ?, ?, ?)
            """,
            [
                (
                    "fixture://relations/a-to-b",
                    "fixture_related",
                    "fixture://objects/public-a",
                    "fixture://objects/public-b",
                ),
                (
                    "fixture://relations/a-to-c",
                    "fixture_related",
                    "fixture://objects/public-a",
                    "fixture://objects/public-c",
                ),
                (
                    "fixture://relations/a-to-hidden",
                    "fixture_related",
                    "fixture://objects/public-a",
                    "fixture://objects/hidden-a",
                ),
            ],
        )
        connection.execute(
            """
            INSERT INTO knowledge_versions(
                knowledge_version, policy_version, identity_version, manifest_digest
            ) VALUES(?, ?, ?, ?)
            """,
            (KNOWLEDGE_VERSION, POLICY_VERSION, IDENTITY_VERSION, MANIFEST_DIGEST),
        )
        connection.execute(
            """
            INSERT INTO synthetic_user_store_trap(trap_id, expected_access_attempts)
            VALUES('fixture-user-store-trap', 0)
            """
        )
        connection.commit()
    finally:
        connection.close()
    os.chmod(database, 0o600)
    return database


def create_dev_formal_base(root: Path) -> Path:
    """Create a formal-shaped base fixture without any user-store tables or paths in DTOs."""

    resolved = _validated_empty_root(Path(root))
    database = resolved / "base-knowledge.sqlite3"
    if database.exists() or database.is_symlink():
        raise ValueError("formal base fixture slot already exists")
    connection = sqlite3.connect(database)
    try:
        connection.executescript(_FORMAL_BASE_SCHEMA)
        connection.execute(
            """
            INSERT INTO source_files(
                id, file_name, file_type, file_path, file_hash,
                usage_policy, sensitive_level, status
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "source-a",
                "Synthetic Standard.xlsx",
                "xlsx",
                "/private/synthetic/source.xlsx",
                "sha256:" + ("f" * 64),
                "import_source",
                "confidential",
                "active",
            ),
        )
        connection.executemany(
            """
            INSERT INTO knowledge_items(
                id, type, code, title, description, category, status,
                parent_id, source_file_id, source_hash, metadata_json,
                created_at, updated_at, stable_key, stable_ref, public_id
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "object-a",
                    "fixture_standard_control",
                    "STD-A",
                    "Synthetic common Alpha",
                    "Synthetic complete standard content Alpha.",
                    "standard",
                    "active",
                    None,
                    "source-a",
                    "sha256:" + ("a" * 64),
                    json.dumps(
                        {
                            "control_objective": "Protect synthetic identities.",
                            "source_edition": "2026",
                            "file_path": "/private/synthetic/hidden.xlsx",
                            "debug": "never expose",
                        },
                        ensure_ascii=False,
                    ),
                    "2026-07-24T00:00:00Z",
                    "2026-07-24T00:00:00Z",
                    "fixture-standard-a",
                    "fixture://objects/public-a",
                    "fixture-public-a",
                ),
                (
                    "object-b",
                    "fixture_standard_control",
                    "STD-B",
                    "Synthetic common Beta",
                    "Synthetic complete standard content Beta.",
                    "standard",
                    "deprecated",
                    None,
                    "source-a",
                    "sha256:" + ("b" * 64),
                    json.dumps(
                        {"control_objective": "Keep deprecated knowledge callable."},
                        ensure_ascii=False,
                    ),
                    "2026-07-24T00:00:00Z",
                    "2026-07-24T00:00:00Z",
                    "fixture-standard-b",
                    "fixture://objects/public-b",
                    "fixture-public-b",
                ),
                (
                    "object-c",
                    "fixture_internal_knowledge",
                    "INT-C",
                    "Synthetic common Gamma",
                    "Synthetic internal base content Gamma.",
                    "internal",
                    "active",
                    None,
                    "source-a",
                    "sha256:" + ("c" * 64),
                    json.dumps(
                        {"business_rule": "Base inclusion authorizes AI read."},
                        ensure_ascii=False,
                    ),
                    "2026-07-24T00:00:00Z",
                    "2026-07-24T00:00:00Z",
                    "fixture-internal-c",
                    "fixture://objects/public-c",
                    "fixture-public-c",
                ),
            ],
        )
        connection.executemany(
            """
            INSERT INTO knowledge_relations(
                id, source_item_id, target_item_id, relation_type,
                relation_label, confidence, source_file_id, import_job_id,
                metadata_json, created_at, updated_at, stable_key, stable_ref, public_id
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "relation-a-b",
                    "object-a",
                    "object-b",
                    "fixture_related",
                    "A relates to B",
                    "exact",
                    "source-a",
                    None,
                    '{"relationship_basis":"synthetic"}',
                    "2026-07-24T00:00:00Z",
                    "2026-07-24T00:00:00Z",
                    "fixture-relation-a-b",
                    "fixture://relations/a-to-b",
                    "fixture-public-relation-a-b",
                ),
                (
                    "relation-a-c",
                    "object-a",
                    "object-c",
                    "fixture_related",
                    "A relates to C",
                    "manual",
                    "source-a",
                    None,
                    '{"relationship_basis":"synthetic"}',
                    "2026-07-24T00:00:00Z",
                    "2026-07-24T00:00:00Z",
                    "fixture-relation-a-c",
                    "fixture://relations/a-to-c",
                    "fixture-public-relation-a-c",
                ),
            ],
        )
        connection.execute(
            """
            INSERT INTO source_references(
                id, target_type, target_id, source_file_id,
                source_sheet, source_row, source_column, source_cell,
                raw_value, source_hash, created_at
            ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "evidence-a",
                "item",
                "object-a",
                "source-a",
                "Controls",
                2,
                "Description",
                "C2",
                "Synthetic raw value that must not be returned.",
                "sha256:" + ("e" * 64),
                "2026-07-24T00:00:00Z",
            ),
        )
        connection.commit()
    finally:
        connection.close()
    os.chmod(database, 0o600)
    return database


def sha256_file(path: Path) -> str:
    return f"sha256:{hashlib.sha256(Path(path).read_bytes()).hexdigest()}"
