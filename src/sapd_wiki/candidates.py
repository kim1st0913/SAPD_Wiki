from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return " ".join(str(value).replace("\n", " ").split()).strip()


CODE_IDENTITY_TYPES = {
    "capability_category",
    "capability_domain",
    "capability",
    "capability_focus",
    "environment_segment_type",
    "scope_type",
    "security_technical_service",
}


def item_key(item_type: str, code: str | None, title: str, qualifier: str | None = None) -> str:
    normalized_code = normalize_text(code or "")
    if normalized_code and item_type in CODE_IDENTITY_TYPES:
        parts = [item_type, normalized_code]
    else:
        parts = [item_type, normalized_code, normalize_text(title)]
    if qualifier:
        parts.append(normalize_text(qualifier))
    return "::".join(parts)


@dataclass(frozen=True)
class SourceRef:
    sheet: str
    row: int
    column: str | None = None
    cell: str | None = None
    raw_value: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_sheet": self.sheet,
            "source_row": self.row,
            "source_column": self.column,
            "source_cell": self.cell,
            "raw_value": self.raw_value,
        }


@dataclass
class ObjectCandidate:
    type: str
    title: str
    code: str | None = None
    description: str | None = None
    category: str | None = None
    qualifier: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    sources: list[SourceRef] = field(default_factory=list)

    @property
    def key(self) -> str:
        return item_key(self.type, self.code, self.title, self.qualifier)


@dataclass
class RelationCandidate:
    source_key: str
    target_key: str
    relation_type: str
    relation_label: str
    confidence: str = "exact"
    metadata: dict[str, Any] = field(default_factory=dict)
    sources: list[SourceRef] = field(default_factory=list)

    @property
    def key(self) -> str:
        return "::".join([self.source_key, self.relation_type, self.target_key])


@dataclass(frozen=True)
class ValidationMessage:
    level: str
    sheet: str
    row: int | None
    message: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "level": self.level,
            "sheet": self.sheet,
            "row": self.row,
            "message": self.message,
        }


@dataclass
class ParseResult:
    objects: list[ObjectCandidate] = field(default_factory=list)
    relations: list[RelationCandidate] = field(default_factory=list)
    validations: list[ValidationMessage] = field(default_factory=list)

    def extend(self, other: "ParseResult") -> None:
        self.objects.extend(other.objects)
        self.relations.extend(other.relations)
        self.validations.extend(other.validations)
