"""Explicit synthetic-only fixture factory for the Web development Sidecar."""

from __future__ import annotations

import hashlib
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


def sha256_file(path: Path) -> str:
    return f"sha256:{hashlib.sha256(Path(path).read_bytes()).hexdigest()}"
