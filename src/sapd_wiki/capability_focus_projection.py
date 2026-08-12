"""Read-only SQLite projection for an explicitly selected capability focus."""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path
from typing import Any

from .local_mcp.base_query_service import BaseKnowledgeRepository
from .local_mcp.readonly_runtime import FormalBaseRuntimeContext
from .projection_contract import (
    UI_PROJECTION_SUITE_VERSION,
    ProjectionIdentity,
    semantic_digest,
)


_FOCUS_TYPE = "capability_focus"
_SERVICE_TYPE = "security_technical_service"
_RELATION_TYPE = "supports_focus"
_FOCUS_CODE_PATTERN = re.compile(r"^[A-Z0-9][A-Z0-9&.-]{1,63}$")
_UUID_PATTERN = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"
)


def _identity_value(value: Any, *, field: str, pattern: re.Pattern[str]) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field} must be a string")
    normalized = unicodedata.normalize("NFKC", value).strip()
    if not pattern.fullmatch(normalized):
        raise ValueError(f"{field} is invalid")
    return normalized


def _project_business_object(item: dict[str, Any]) -> dict[str, Any]:
    projected = {
        "canonical_ref": str(item["canonical_ref"]),
        "object_type": str(item["object_type"]),
        "title": str(item["display_name"]),
        "status": str(item["status"]),
        "description": str(item.get("description") or ""),
    }
    for field in ("id", "code", "category"):
        if item.get(field) not in (None, ""):
            projected[field] = str(item[field])
    return projected


class CapabilityFocusProjectionService:
    """Project a capability focus and its incoming technical-service relations."""

    def __init__(
        self,
        *,
        base_database: Path,
        identity: ProjectionIdentity,
    ) -> None:
        self._base_database = Path(base_database)
        self._identity = identity

    def project(self, *, focus_id: str, code: str) -> dict[str, Any]:
        selected_id = _identity_value(
            focus_id,
            field="id",
            pattern=_UUID_PATTERN,
        )
        selected_code = _identity_value(
            code,
            field="code",
            pattern=_FOCUS_CODE_PATTERN,
        )
        with FormalBaseRuntimeContext(base_database=self._base_database) as runtime:
            repository = BaseKnowledgeRepository(runtime)
            focus = repository.get_base_object_by_exact_identity(
                object_type=_FOCUS_TYPE,
                object_id=selected_id,
                code=selected_code,
            )
            if focus is None:
                raise KeyError(f"{_FOCUS_TYPE}:{selected_id}:{selected_code}")
            canonical_ref = str(focus["canonical_ref"])
            incoming = repository.related(
                canonical_ref=canonical_ref,
                direction="incoming",
                after_ref="",
                limit=1000,
            )
            services_by_ref: dict[str, dict[str, Any]] = {}
            relations: list[dict[str, Any]] = []
            for relation in incoming:
                if (
                    relation.get("relation_type") != _RELATION_TYPE
                    or relation.get("target_ref") != canonical_ref
                ):
                    continue
                source_ref = str(relation.get("source_ref") or "")
                source = repository.get_base_object_by_canonical_ref(source_ref)
                if source is None or source.get("object_type") != _SERVICE_TYPE:
                    continue
                services_by_ref[source_ref] = {
                    **_project_business_object(source),
                    "targetRef": f"{_SERVICE_TYPE}:{source['id']}",
                }
                relations.append(
                    {
                        "relation_ref": str(relation["relation_ref"]),
                        "relation_type": _RELATION_TYPE,
                        "source_ref": source_ref,
                        "target_ref": canonical_ref,
                        "confidence": str(relation["confidence"]),
                    }
                )
        if not relations:
            raise KeyError(f"{_RELATION_TYPE}:{canonical_ref}")

        target_ref = f"{_FOCUS_TYPE}:{selected_id}"
        data = {
            "targetRef": target_ref,
            "focus": {
                **_project_business_object(focus),
                "targetRef": target_ref,
            },
            "security_technical_services": list(services_by_ref.values()),
            "relations": relations,
            "counts": {
                "focus": 1,
                "security_technical_services": len(services_by_ref),
                "supports_focus": len(relations),
            },
        }
        digest = semantic_digest(
            data,
            unordered_collections={
                "security_technical_services": ("canonical_ref",),
                "relations": (
                    "relation_type",
                    "source_ref",
                    "target_ref",
                    "relation_ref",
                ),
            },
            ordered_collections={},
        )
        return {
            "contract_version": UI_PROJECTION_SUITE_VERSION,
            "identity": self._identity.to_dict(),
            "data": data,
            "semantic_digest": digest,
        }
