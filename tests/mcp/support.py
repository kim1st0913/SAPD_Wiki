from __future__ import annotations

import hashlib
import sqlite3
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

SCHEMA_PATH = ROOT / "tests" / "fixtures" / "mcp" / "v1" / "synthetic-base-schema.sql"
MANIFEST_DIGEST = "sha256:" + ("b" * 64)
POLICY_VERSION = "fixture-policy-v1"
KNOWLEDGE_VERSION = "fixture-knowledge-v1"
IDENTITY_VERSION = "fixture-identity-v1"
SCOPE = "sapd.base.public.summary.read"


def sha256_file(path: Path) -> str:
    return f"sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}"


def snapshot(root: Path) -> tuple[str, ...]:
    return tuple(
        sorted(
            str(path.relative_to(root))
            for path in root.rglob("*")
            if path.name != "synthetic-base.sqlite3"
        )
    )


def build_synthetic_base(
    root: Path,
    *,
    large_summary: bool = False,
    object_type: str = "fixture_type",
    relation_type: str = "fixture_related",
    knowledge_version: str = KNOWLEDGE_VERSION,
    policy_version: str = POLICY_VERSION,
    identity_version: str = IDENTITY_VERSION,
    manifest_digest: str = MANIFEST_DIGEST,
) -> Path:
    resolved = root.resolve(strict=True)
    if not resolved.is_dir() or root.is_symlink():
        raise ValueError("root must be an existing non-symlink directory")
    database = resolved / "synthetic-base.sqlite3"
    if database.exists():
        raise ValueError("database already exists")
    connection = sqlite3.connect(database)
    try:
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        summary_a = "A" * 9000 if large_summary else "Synthetic common summary Alpha."
        objects = [
            (
                "fixture://objects/public-a",
                object_type,
                "Synthetic common Alpha",
                "public",
                "public_summary",
                summary_a,
                1,
                "sha256:" + ("a" * 64),
            ),
            (
                "fixture://objects/public-b",
                object_type,
                "Synthetic common Beta",
                "public",
                "metadata_only",
                None,
                None,
                None,
            ),
            (
                "fixture://objects/public-c",
                object_type,
                "Synthetic common Gamma",
                "public",
                "public_summary",
                "Synthetic common summary Gamma.",
                1,
                "sha256:" + ("c" * 64),
            ),
            (
                "fixture://objects/hidden-a",
                object_type,
                "Synthetic common Hidden",
                "internal",
                "deny",
                None,
                None,
                None,
            ),
        ]
        connection.executemany(
            """
            INSERT INTO knowledge_objects (
                canonical_ref, object_type, display_name,
                effective_sensitive_level, ai_use_policy,
                ai_summary, summary_version, summary_hash
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            objects,
        )
        connection.executemany(
            """
            INSERT INTO knowledge_relations (
                relation_ref, relation_type, source_ref, target_ref
            ) VALUES (?, ?, ?, ?)
            """,
            [
                (
                    "fixture://relations/a-to-b",
                    relation_type,
                    "fixture://objects/public-a",
                    "fixture://objects/public-b",
                ),
                (
                    "fixture://relations/a-to-c",
                    relation_type,
                    "fixture://objects/public-a",
                    "fixture://objects/public-c",
                ),
                (
                    "fixture://relations/a-to-hidden",
                    relation_type,
                    "fixture://objects/public-a",
                    "fixture://objects/hidden-a",
                ),
            ],
        )
        connection.execute(
            """
            INSERT INTO knowledge_versions (
                knowledge_version, policy_version, identity_version, manifest_digest
            ) VALUES (?, ?, ?, ?)
            """,
            (knowledge_version, policy_version, identity_version, manifest_digest),
        )
        connection.execute(
            """
            INSERT INTO synthetic_user_store_trap (
                trap_id, expected_access_attempts
            ) VALUES ('fixture-user-store-trap', 0)
            """
        )
        connection.commit()
    finally:
        connection.close()
    return database


def request_context(**overrides: Any):
    from sapd_wiki.local_mcp.models import RequestContext

    values = {
        "client_id": "fixture-client-a",
        "grant_version": "fixture-grant-a",
        "scope": SCOPE,
        "correlation_id": "fixture-correlation-a",
    }
    values.update(overrides)
    return RequestContext(**values)


def create_service(root: Path, database: Path, **overrides: Any):
    from sapd_wiki.local_mcp.query_service import KnowledgeQueryService

    values: dict[str, Any] = {
        "synthetic_root": root,
        "synthetic_base": database,
        "cursor_key": b"fixture-cursor-key-" + (b"x" * 32),
    }
    values.update(overrides)
    return KnowledgeQueryService.create(**values)
