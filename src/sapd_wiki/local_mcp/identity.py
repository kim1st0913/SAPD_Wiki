"""Stable fixture identity and redirect resolution."""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass
from types import MappingProxyType
from typing import Mapping

from .errors import InvalidInputError, PolicyBlockedError


@dataclass(frozen=True)
class IdentityRedirect:
    target_ref: str
    source_identity_version: str
    target_identity_version: str


class IdentityResolver:
    def __init__(
        self,
        *,
        identity_version: str,
        redirects: Mapping[str, IdentityRedirect] | None = None,
        maximum_hops: int = 8,
    ) -> None:
        if not identity_version.startswith("fixture-"):
            raise PolicyBlockedError("non-synthetic identity version is forbidden")
        if maximum_hops < 1:
            raise ValueError("maximum_hops must be positive")
        self.identity_version = identity_version
        self.redirects = MappingProxyType(dict(redirects or {}))
        self.maximum_hops = maximum_hops

    @staticmethod
    def validate_ref(canonical_ref: str) -> str:
        if not isinstance(canonical_ref, str):
            raise InvalidInputError("canonical_ref must be a string")
        value = unicodedata.normalize("NFKC", canonical_ref).strip()
        if (
            not value.startswith("fixture://")
            or len(value) > 512
            or any(character.isspace() for character in value)
            or any(unicodedata.category(character).startswith("C") for character in value)
        ):
            raise InvalidInputError("canonical_ref must use the synthetic fixture:// namespace")
        return value

    def resolve(self, canonical_ref: str) -> str:
        current = self.validate_ref(canonical_ref)
        visited: set[str] = set()
        for _hop in range(self.maximum_hops + 1):
            if current in visited:
                raise PolicyBlockedError(
                    "identity redirect cycle detected",
                    code="IDENTITY_REDIRECT_CYCLE",
                )
            visited.add(current)
            redirect = self.redirects.get(current)
            if redirect is None:
                return current
            if (
                redirect.source_identity_version != self.identity_version
                or redirect.target_identity_version != self.identity_version
            ):
                raise PolicyBlockedError(
                    "identity redirect belongs to a stale version",
                    code="IDENTITY_VERSION_STALE",
                )
            current = self.validate_ref(redirect.target_ref)
        raise PolicyBlockedError(
            "identity redirect exceeds the maximum hop count",
            code="IDENTITY_REDIRECT_CYCLE",
        )
