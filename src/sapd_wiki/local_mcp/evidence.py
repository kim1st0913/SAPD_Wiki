"""Safe evidence projection for synthetic knowledge."""

from __future__ import annotations

from .errors import InvalidInputError
from .models import SourceEvidence


class EvidenceResolver:
    def resolve(self, canonical_ref: str, *, include_excerpt: bool) -> tuple[SourceEvidence, ...]:
        if include_excerpt is not False:
            raise InvalidInputError("synthetic evidence requires include_excerpt=false")
        return (SourceEvidence(canonical_ref=canonical_ref),)
