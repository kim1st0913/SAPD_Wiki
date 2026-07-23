from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "tests/fixtures/mcp/v1/synthetic-base-schema.sql"


def sha256_file(path: Path) -> str:
    return f"sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}"


def build_synthetic_base(test_root: Path, database_path: Path) -> str:
    root = test_root.resolve(strict=True)
    if not root.is_dir() or test_root.is_symlink():
        raise ValueError("test_root must be an existing non-symlink directory")
    if not database_path.is_absolute():
        raise ValueError("database_path must be explicit and absolute")
    if database_path.exists():
        raise ValueError("synthetic base path must not already exist")
    if database_path.parent.resolve(strict=True) != root:
        raise ValueError("synthetic base must be created directly inside test_root")
    if database_path.name != "synthetic-base.sqlite3":
        raise ValueError("unexpected synthetic base filename")

    schema = SCHEMA_PATH.read_text(encoding="utf-8")
    connection = sqlite3.connect(database_path)
    try:
        connection.executescript(schema)
        connection.executemany(
            """
            INSERT INTO knowledge_objects (
                canonical_ref,
                object_type,
                display_name,
                effective_sensitive_level,
                ai_use_policy,
                ai_summary,
                summary_version,
                summary_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "fixture://objects/public-a",
                    "fixture_type",
                    "Synthetic Public A",
                    "public",
                    "public_summary",
                    "Synthetic summary A.",
                    1,
                    "sha256:" + ("a" * 64),
                ),
                (
                    "fixture://objects/public-b",
                    "fixture_type",
                    "Synthetic Public B",
                    "public",
                    "metadata_only",
                    None,
                    None,
                    None,
                ),
                (
                    "fixture://objects/denied-a",
                    "fixture_type",
                    "Synthetic Denied A",
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
            INSERT INTO knowledge_relations (
                relation_ref,
                relation_type,
                source_ref,
                target_ref
            ) VALUES (?, ?, ?, ?)
            """,
            [
                (
                    "fixture://relations/public-a-to-public-b",
                    "fixture_related",
                    "fixture://objects/public-a",
                    "fixture://objects/public-b",
                ),
                (
                    "fixture://relations/public-a-to-denied-a",
                    "fixture_related",
                    "fixture://objects/public-a",
                    "fixture://objects/denied-a",
                ),
            ],
        )
        connection.execute(
            """
            INSERT INTO knowledge_versions (
                knowledge_version,
                policy_version,
                identity_version,
                manifest_digest
            ) VALUES (?, ?, ?, ?)
            """,
            (
                "fixture-knowledge-v1",
                "fixture-policy-v1",
                "fixture-identity-v1",
                "sha256:" + ("b" * 64),
            ),
        )
        connection.execute(
            """
            INSERT INTO synthetic_user_store_trap (
                trap_id,
                expected_access_attempts
            ) VALUES (?, ?)
            """,
            ("fixture-user-store-trap", 0),
        )
        connection.commit()
    finally:
        connection.close()
    return sha256_file(database_path)
