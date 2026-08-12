"""Identity and semantic-digest contracts for read-only UI projections."""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence
from urllib.parse import quote


_SHA256_PATTERN = re.compile(r"^[0-9a-f]{64}$")
UI_PROJECTION_SUITE_VERSION = "sapd-ui-projection-v1"


class ProjectionManifestError(RuntimeError):
    """The immutable release identity required by a projection is unavailable."""


class SemanticDigestError(ValueError):
    """A semantic payload does not satisfy its collection-order contract."""


@dataclass(frozen=True)
class ProjectionIdentity:
    knowledge_version: str
    database_schema_version: str
    artifact_db_sha256: str
    parent_source_db_sha256: str
    projection_contract_version: str
    content_asset_sha256: str

    def to_dict(self) -> dict[str, str]:
        return {
            "knowledge_version": self.knowledge_version,
            "database_schema_version": self.database_schema_version,
            "artifact_db_sha256": self.artifact_db_sha256,
            "parent_source_db_sha256": self.parent_source_db_sha256,
            "projection_contract_version": self.projection_contract_version,
            "content_asset_sha256": self.content_asset_sha256,
        }


def _required_text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ProjectionManifestError(f"projection manifest field is missing: {field}")
    return value.strip()


def _required_sha256(value: Any, field: str) -> str:
    digest = _required_text(value, field).lower()
    if not _SHA256_PATTERN.fullmatch(digest):
        raise ProjectionManifestError(f"projection manifest SHA-256 is invalid: {field}")
    return digest


def knowledge_version_for_artifact_sha256(artifact_db_sha256: str) -> str:
    """Derive the shared knowledge version from a verified artifact digest."""

    digest = _required_sha256(artifact_db_sha256, "artifact_db_sha256")
    return f"base-{digest[:16]}"


def parent_source_db_sha256(base_database: Path) -> str:
    """Read the candidate's parent/source provenance without mutating the DB."""

    path = Path(base_database).resolve(strict=True)
    uri = f"file:{quote(str(path), safe='/')}?mode=ro&immutable=1"
    try:
        with closing(sqlite3.connect(uri, uri=True, timeout=1.0)) as connection:
            row = connection.execute(
                """
                SELECT value
                FROM content_schema_meta
                WHERE key = 'base_database_sha256'
                """
            ).fetchone()
    except (OSError, sqlite3.Error) as exc:
        raise ProjectionManifestError(
            "base database parent/source provenance is unavailable"
        ) from exc
    if row is None:
        raise ProjectionManifestError(
            "base database parent/source provenance is missing"
        )
    return _required_sha256(row[0], "content_schema_meta.base_database_sha256")


def build_release_projection_identity(
    *,
    base_database: Path,
    artifact_db_sha256: str,
) -> dict[str, str]:
    """Build the three shared release-manifest identity fields."""

    artifact_digest = _required_sha256(
        artifact_db_sha256,
        "artifact_db_sha256",
    )
    return {
        "knowledge_version": knowledge_version_for_artifact_sha256(
            artifact_digest
        ),
        "parent_source_db_sha256": parent_source_db_sha256(base_database),
        "projection_contract_version": UI_PROJECTION_SUITE_VERSION,
    }


def load_projection_identity(
    manifest_path: Path,
) -> ProjectionIdentity:
    """Load verified build identity without hashing database or asset files.

    The build/package gate owns byte verification. Runtime projections consume the
    resulting immutable ``base-manifest.json`` fields as process-level context.
    """

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ProjectionManifestError("projection identity manifest is unavailable") from exc
    if not isinstance(payload, dict):
        raise ProjectionManifestError("projection identity manifest must be an object")
    base_database = payload.get("base_database")
    content_asset_database = payload.get("content_asset_database")
    if not isinstance(base_database, dict) or not isinstance(content_asset_database, dict):
        raise ProjectionManifestError("projection identity database entries are missing")
    projection_contract = _required_text(
        payload.get("projection_contract_version"),
        "projection_contract_version",
    )
    if projection_contract != UI_PROJECTION_SUITE_VERSION:
        raise ProjectionManifestError("projection contract version does not match runtime")
    artifact_db_sha256 = _required_sha256(
        base_database.get("sha256"),
        "base_database.sha256",
    )
    knowledge_version = _required_text(
        payload.get("knowledge_version"),
        "knowledge_version",
    )
    if knowledge_version != knowledge_version_for_artifact_sha256(
        artifact_db_sha256
    ):
        raise ProjectionManifestError(
            "knowledge version does not match artifact database SHA-256"
        )
    return ProjectionIdentity(
        knowledge_version=knowledge_version,
        database_schema_version=_required_text(
            base_database.get("schema_version"),
            "base_database.schema_version",
        ),
        artifact_db_sha256=artifact_db_sha256,
        parent_source_db_sha256=_required_sha256(
            payload.get("parent_source_db_sha256"),
            "parent_source_db_sha256",
        ),
        projection_contract_version=projection_contract,
        content_asset_sha256=_required_sha256(
            content_asset_database.get("sha256"),
            "content_asset_database.sha256",
        ),
    )


def _field_value(item: Mapping[str, Any], field_path: str, collection_path: str) -> Any:
    value: Any = item
    for part in field_path.split("."):
        if not isinstance(value, Mapping) or part not in value:
            raise SemanticDigestError(
                f"stable field {field_path!r} is missing from {collection_path!r}"
            )
        value = value[part]
    if isinstance(value, (dict, list)):
        raise SemanticDigestError(
            f"stable field {field_path!r} in {collection_path!r} must be scalar"
        )
    return value


def semantic_digest(
    payload: Mapping[str, Any],
    *,
    unordered_collections: Mapping[str, Sequence[str]],
    ordered_collections: Mapping[str, Sequence[str]],
) -> str:
    """Return a deterministic digest with explicit set/sequence semantics.

    Unordered collections are sorted by declared stable fields. Ordered business
    sequences keep their original order; declared order fields are validated and
    remain part of the hashed payload. Every list must be classified explicitly.
    """

    unordered = {
        str(path): tuple(str(field) for field in fields)
        for path, fields in unordered_collections.items()
    }
    ordered = {
        str(path): tuple(str(field) for field in fields)
        for path, fields in ordered_collections.items()
    }
    overlap = set(unordered) & set(ordered)
    if overlap:
        raise SemanticDigestError(
            f"collection paths cannot be both ordered and unordered: {sorted(overlap)}"
        )
    seen: set[str] = set()

    def canonicalize(value: Any, path: str) -> Any:
        if isinstance(value, Mapping):
            return {
                str(key): canonicalize(child, f"{path}.{key}" if path else str(key))
                for key, child in sorted(value.items(), key=lambda pair: str(pair[0]))
            }
        if isinstance(value, list):
            if path not in unordered and path not in ordered:
                raise SemanticDigestError(f"list collection is not classified: {path!r}")
            seen.add(path)
            rules = unordered.get(path) or ordered.get(path) or ()
            keyed: list[tuple[str, Any]] = []
            for item in value:
                if rules:
                    if not isinstance(item, Mapping):
                        raise SemanticDigestError(
                            f"collection {path!r} requires object items for stable fields"
                        )
                    stable_values = tuple(
                        _field_value(item, field, path) for field in rules
                    )
                    stable_key = json.dumps(
                        stable_values,
                        ensure_ascii=False,
                        separators=(",", ":"),
                    )
                else:
                    stable_key = ""
                keyed.append((stable_key, canonicalize(item, f"{path}[]")))
            if path in unordered:
                keys = [key for key, _item in keyed]
                if len(keys) != len(set(keys)):
                    raise SemanticDigestError(
                        f"unordered collection has duplicate stable keys: {path!r}"
                    )
                keyed.sort(key=lambda pair: pair[0])
            return [item for _key, item in keyed]
        if value is None or isinstance(value, (bool, int, float, str)):
            return value
        raise SemanticDigestError(f"unsupported semantic value at {path!r}")

    canonical = canonicalize(payload, "")
    missing = (set(unordered) | set(ordered)) - seen
    if missing:
        raise SemanticDigestError(
            f"declared collection paths are missing: {sorted(missing)}"
        )
    encoded = json.dumps(
        canonical,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"
