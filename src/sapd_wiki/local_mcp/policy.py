"""Fail-closed synthetic exposure policy."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from .errors import PolicyBlockedError
from .models import KnowledgeObject, KnowledgeRecord


_SHA256 = re.compile(r"^sha256:[0-9a-f]{64}$")


@dataclass(frozen=True)
class AiExposurePolicy:
    policy_version: str
    expected_manifest_digest: str
    allowed_object_types: frozenset[str]
    allowed_relation_types: frozenset[str]
    signature_valid: bool

    @classmethod
    def synthetic(
        cls,
        *,
        policy_version: str,
        expected_manifest_digest: str,
        allowed_object_types: Iterable[str] = ("fixture_type",),
        allowed_relation_types: Iterable[str] = ("fixture_related",),
        signature_valid: bool = True,
    ) -> "AiExposurePolicy":
        return cls(
            policy_version=policy_version,
            expected_manifest_digest=expected_manifest_digest,
            allowed_object_types=frozenset(allowed_object_types),
            allowed_relation_types=frozenset(allowed_relation_types),
            signature_valid=signature_valid,
        )

    def validate_integrity(
        self,
        *,
        manifest_digest: str,
        object_types: frozenset[str],
        relation_types: frozenset[str],
    ) -> None:
        if not self.signature_valid:
            raise PolicyBlockedError(
                "synthetic policy signature is invalid",
                code="POLICY_SIGNATURE_INVALID",
            )
        if (
            not self.policy_version.startswith("fixture-")
            or not _SHA256.fullmatch(self.expected_manifest_digest)
            or manifest_digest != self.expected_manifest_digest
        ):
            raise PolicyBlockedError(
                "synthetic base manifest digest does not match policy",
                code="MANIFEST_DIGEST_MISMATCH",
            )
        unknown_objects = object_types - self.allowed_object_types
        if unknown_objects:
            raise PolicyBlockedError(
                "synthetic base contains an unknown object type",
                code="UNKNOWN_OBJECT_TYPE",
            )
        unknown_relations = relation_types - self.allowed_relation_types
        if unknown_relations:
            raise PolicyBlockedError(
                "synthetic base contains an unknown relation type",
                code="UNKNOWN_RELATION_TYPE",
            )
        if not self.allowed_object_types or not self.allowed_relation_types:
            raise PolicyBlockedError("synthetic policy allowlist is empty")

    def project(self, record: KnowledgeRecord) -> KnowledgeObject:
        if (
            not record.canonical_ref.startswith("fixture://")
            or record.object_type not in self.allowed_object_types
            or record.effective_sensitive_level != "public"
        ):
            raise PolicyBlockedError("repository returned an unapproved object")
        if record.ai_use_policy == "public_summary":
            if (
                record.ai_summary is None
                or record.summary_version is None
                or record.summary_hash is None
            ):
                raise PolicyBlockedError("public summary fields are incomplete")
            return KnowledgeObject(
                canonical_ref=record.canonical_ref,
                object_type=record.object_type,
                display_name=record.display_name,
                ai_summary=record.ai_summary,
                summary_version=record.summary_version,
                summary_hash=record.summary_hash,
            )
        if record.ai_use_policy == "metadata_only":
            return KnowledgeObject(
                canonical_ref=record.canonical_ref,
                object_type=record.object_type,
                display_name=record.display_name,
            )
        raise PolicyBlockedError("repository returned a denied object")
