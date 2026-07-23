"""Explicit internal records and public DTOs for the read-only service."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RequestContext:
    client_id: str
    grant_version: str
    scope: str
    correlation_id: str


@dataclass(frozen=True)
class KnowledgeVersions:
    knowledge_version: str
    policy_version: str
    identity_version: str
    manifest_digest: str

    def to_dict(self) -> dict[str, str]:
        return {
            "knowledge_version": self.knowledge_version,
            "policy_version": self.policy_version,
            "identity_version": self.identity_version,
            "manifest_digest": self.manifest_digest,
        }


@dataclass(frozen=True)
class KnowledgeRecord:
    canonical_ref: str
    object_type: str
    display_name: str
    effective_sensitive_level: str
    ai_use_policy: str
    ai_summary: str | None
    summary_version: int | None
    summary_hash: str | None


@dataclass(frozen=True)
class KnowledgeObject:
    canonical_ref: str
    object_type: str
    display_name: str
    ai_summary: str | None = None
    summary_version: int | None = None
    summary_hash: str | None = None

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "canonical_ref": self.canonical_ref,
            "object_type": self.object_type,
            "display_name": self.display_name,
        }
        if self.ai_summary is not None:
            payload.update(
                {
                    "ai_summary": self.ai_summary,
                    "summary_version": self.summary_version,
                    "summary_hash": self.summary_hash,
                }
            )
        return payload


@dataclass(frozen=True)
class KnowledgeRelation:
    relation_ref: str
    relation_type: str
    source_ref: str
    target_ref: str

    def to_dict(self) -> dict[str, str]:
        return {
            "relation_ref": self.relation_ref,
            "relation_type": self.relation_type,
            "source_ref": self.source_ref,
            "target_ref": self.target_ref,
        }


@dataclass(frozen=True)
class SourceEvidence:
    canonical_ref: str
    evidence_kind: str = "hand_authored_synthetic"
    source_basis: str = "fixture-only"
    excerpt_included: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "canonical_ref": self.canonical_ref,
            "evidence_kind": self.evidence_kind,
            "source_basis": self.source_basis,
            "excerpt_included": self.excerpt_included,
        }


@dataclass(frozen=True)
class Page:
    next_cursor: str | None = None
    has_more: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {"next_cursor": self.next_cursor, "has_more": self.has_more}


@dataclass(frozen=True)
class ServiceResponse:
    contract_version: str
    source_channel: str
    knowledge_version: str
    policy_version: str
    identity_version: str
    grant_version: str
    content_trust: str
    data: dict[str, Any]
    page: Page
    warnings: tuple[str, ...]
    correlation_id: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract_version": self.contract_version,
            "source_channel": self.source_channel,
            "knowledge_version": self.knowledge_version,
            "policy_version": self.policy_version,
            "identity_version": self.identity_version,
            "grant_version": self.grant_version,
            "content_trust": self.content_trust,
            "data": self.data,
            "page": self.page.to_dict(),
            "warnings": list(self.warnings),
            "correlation_id": self.correlation_id,
        }
