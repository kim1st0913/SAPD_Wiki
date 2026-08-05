"""Read-only metadata and byte streaming for the separate content asset store."""

from __future__ import annotations

import json
import re
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any, BinaryIO
from urllib.parse import quote


ASSET_HASH_PATTERN = re.compile(r"^[0-9a-f]{64}$")
ASSET_ROLES = frozenset(
    {
        "original",
        "derived-preview",
        "derived-semantic-projection",
        "page-preview",
        "region-preview",
    }
)
_ALLOWED_TABLES = frozenset({"asset_schema_meta", "content_assets", "document_assets"})
_DENIED_ACTIONS = frozenset(
    value
    for name in (
        "SQLITE_ATTACH",
        "SQLITE_DETACH",
        "SQLITE_INSERT",
        "SQLITE_UPDATE",
        "SQLITE_DELETE",
        "SQLITE_CREATE_INDEX",
        "SQLITE_CREATE_TABLE",
        "SQLITE_CREATE_TEMP_INDEX",
        "SQLITE_CREATE_TEMP_TABLE",
        "SQLITE_CREATE_TRIGGER",
        "SQLITE_CREATE_VIEW",
        "SQLITE_CREATE_VTABLE",
        "SQLITE_DROP_INDEX",
        "SQLITE_DROP_TABLE",
        "SQLITE_DROP_TRIGGER",
        "SQLITE_DROP_VIEW",
        "SQLITE_DROP_VTABLE",
        "SQLITE_ALTER_TABLE",
        "SQLITE_REINDEX",
        "SQLITE_ANALYZE",
        "SQLITE_TRANSACTION",
        "SQLITE_SAVEPOINT",
    )
    if (value := getattr(sqlite3, name, None)) is not None
)


class ContentAssetError(RuntimeError):
    """Base error for the controlled asset service."""


class ContentAssetNotFound(ContentAssetError):
    """The requested linked asset does not exist."""


class ContentAssetRangeError(ContentAssetError):
    """The requested byte range is invalid."""


@dataclass(frozen=True)
class AssetByteRange:
    start: int
    end: int
    total: int

    @property
    def length(self) -> int:
        return self.end - self.start + 1


def parse_http_byte_range(value: str | None, total: int) -> AssetByteRange:
    if total < 0:
        raise ContentAssetRangeError("asset size is invalid")
    if not value:
        return AssetByteRange(0, max(total - 1, 0), total)
    normalized = value.strip()
    if not normalized.startswith("bytes=") or "," in normalized:
        raise ContentAssetRangeError("only one bytes range is supported")
    spec = normalized.removeprefix("bytes=")
    start_text, separator, end_text = spec.partition("-")
    if not separator:
        raise ContentAssetRangeError("byte range is invalid")
    try:
        if start_text:
            start = int(start_text)
            end = int(end_text) if end_text else total - 1
        else:
            suffix = int(end_text)
            if suffix <= 0:
                raise ValueError
            start = max(total - suffix, 0)
            end = total - 1
    except ValueError as exc:
        raise ContentAssetRangeError("byte range is invalid") from exc
    if total == 0 or start < 0 or end < start or start >= total:
        raise ContentAssetRangeError("byte range is outside the asset")
    return AssetByteRange(start, min(end, total - 1), total)


class ContentAssetService:
    """Open one immutable asset database and expose only linked asset records."""

    def __init__(self, database: Path) -> None:
        candidate = Path(database)
        if not candidate.is_absolute() or candidate.is_symlink():
            raise ContentAssetError("asset database must be an explicit absolute non-symlink path")
        try:
            self.database = candidate.resolve(strict=True)
        except OSError as exc:
            raise ContentAssetError("asset database is unavailable") from exc
        if not self.database.is_file():
            raise ContentAssetError("asset database is unavailable")

    @staticmethod
    def _authorizer(
        action: int,
        arg1: str | None,
        _arg2: str | None,
        database: str | None,
        _trigger: str | None,
    ) -> int:
        if action in _DENIED_ACTIONS:
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_READ:
            if database != "main" or (arg1 or "") not in _ALLOWED_TABLES:
                return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_PRAGMA:
            return sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK

    def _connect(self) -> sqlite3.Connection:
        uri = f"file:{quote(str(self.database), safe='/')}?mode=ro&immutable=1"
        connection: sqlite3.Connection | None = None
        try:
            connection = sqlite3.connect(uri, uri=True, timeout=1.0)
            connection.row_factory = sqlite3.Row
            required = {
                row[0]
                for row in connection.execute(
                    """
                    SELECT name
                    FROM sqlite_master
                    WHERE type='table'
                      AND name IN ('asset_schema_meta', 'content_assets', 'document_assets')
                    """
                )
            }
            if required != _ALLOWED_TABLES:
                raise ContentAssetError("asset database schema is incomplete")
            connection.set_authorizer(self._authorizer)
            return connection
        except ContentAssetError:
            if connection is not None:
                connection.close()
            raise
        except (OSError, sqlite3.Error) as exc:
            if connection is not None:
                connection.close()
            raise ContentAssetError("asset database open failed") from exc

    @staticmethod
    def _metadata(row: sqlite3.Row) -> dict[str, Any]:
        try:
            business_metadata = json.loads(str(row["metadata_json"] or "{}"))
        except json.JSONDecodeError:
            business_metadata = {}
        if not isinstance(business_metadata, dict):
            business_metadata = {}
        business_metadata = {
            key: business_metadata[key]
            for key in ("documentKey", "assetKey", "collectionKey")
            if key in business_metadata
            and isinstance(business_metadata[key], (str, int, float, bool))
        }
        asset_hash = str(row["asset_hash"])
        return {
            "asset_ref": f"asset:{asset_hash}",
            "owner_ref": str(row["owner_ref"]),
            "asset_role": str(row["asset_role"]),
            "ordinal": row["ordinal"],
            "logical_file_name": str(row["logical_file_name"]),
            "asset_hash": asset_hash,
            "mime_type": str(row["mime_type"]),
            "format": str(row["format"]),
            "byte_count": int(row["byte_count"]),
            "business_metadata": business_metadata,
            "asset_url": f"/api/v1/content/assets/{asset_hash}",
        }

    def list_assets(
        self,
        *,
        owner_ref: str,
        asset_role: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        normalized_owner = str(owner_ref or "").strip()
        if not normalized_owner or len(normalized_owner) > 512:
            raise ContentAssetError("owner_ref is required")
        if asset_role is not None and asset_role not in ASSET_ROLES:
            raise ContentAssetError("asset_role is invalid")
        if not 1 <= limit <= 100:
            raise ContentAssetError("asset limit is outside the contract")
        connection = self._connect()
        try:
            parameters: list[Any] = [normalized_owner]
            role_clause = ""
            if asset_role:
                role_clause = " AND link.asset_role=?"
                parameters.append(asset_role)
            parameters.append(limit)
            rows = connection.execute(
                f"""
                SELECT
                  link.owner_ref,
                  link.asset_role,
                  link.ordinal,
                  link.logical_file_name,
                  link.metadata_json,
                  asset.asset_hash,
                  asset.mime_type,
                  asset.format,
                  asset.byte_count
                FROM document_assets AS link
                JOIN content_assets AS asset ON asset.asset_hash=link.asset_hash
                WHERE link.owner_ref=?{role_clause}
                ORDER BY link.asset_role, COALESCE(link.ordinal, 0), link.logical_file_name
                LIMIT ?
                """,
                parameters,
            ).fetchall()
            return [self._metadata(row) for row in rows]
        finally:
            connection.close()

    def asset_metadata(self, asset_hash: str) -> dict[str, Any]:
        normalized_hash = str(asset_hash or "").strip().lower()
        if not ASSET_HASH_PATTERN.fullmatch(normalized_hash):
            raise ContentAssetNotFound("asset is unavailable")
        connection = self._connect()
        try:
            row = connection.execute(
                """
                SELECT
                  link.owner_ref,
                  link.asset_role,
                  link.ordinal,
                  link.logical_file_name,
                  link.metadata_json,
                  asset.asset_hash,
                  asset.mime_type,
                  asset.format,
                  asset.byte_count
                FROM document_assets AS link
                JOIN content_assets AS asset ON asset.asset_hash=link.asset_hash
                WHERE asset.asset_hash=?
                ORDER BY link.owner_ref, link.asset_role, link.logical_file_name
                LIMIT 1
                """,
                (normalized_hash,),
            ).fetchone()
            if row is None:
                raise ContentAssetNotFound("asset is unavailable")
            return self._metadata(row)
        finally:
            connection.close()

    def asset_for_owner(
        self,
        *,
        owner_ref: str,
        asset_role: str = "original",
    ) -> dict[str, Any]:
        items = self.list_assets(
            owner_ref=owner_ref,
            asset_role=asset_role,
            limit=2,
        )
        if not items:
            raise ContentAssetNotFound("asset is unavailable")
        if len(items) != 1:
            raise ContentAssetError(
                "owner_ref and asset_role do not identify exactly one asset"
            )
        return items[0]

    def stream_asset(
        self,
        asset_hash: str,
        writer: BinaryIO,
        byte_range: AssetByteRange,
        *,
        chunk_size: int = 64 * 1024,
    ) -> None:
        normalized_hash = str(asset_hash or "").strip().lower()
        if not ASSET_HASH_PATTERN.fullmatch(normalized_hash):
            raise ContentAssetNotFound("asset is unavailable")
        connection = self._connect()
        try:
            row = connection.execute(
                """
                SELECT asset.rowid, asset.byte_count
                FROM content_assets AS asset
                WHERE asset.asset_hash=?
                  AND EXISTS (
                    SELECT 1
                    FROM document_assets AS link
                    WHERE link.asset_hash=asset.asset_hash
                  )
                """,
                (normalized_hash,),
            ).fetchone()
            if row is None:
                raise ContentAssetNotFound("asset is unavailable")
            if int(row["byte_count"]) != byte_range.total:
                raise ContentAssetRangeError("asset size changed during request")
            remaining = byte_range.length
            with connection.blobopen(
                "content_assets",
                "content_bytes",
                int(row["rowid"]),
                readonly=True,
            ) as blob:
                blob.seek(byte_range.start)
                while remaining:
                    payload = blob.read(min(chunk_size, remaining))
                    if not payload:
                        raise ContentAssetError("asset stream ended unexpectedly")
                    writer.write(payload)
                    remaining -= len(payload)
        finally:
            connection.close()
