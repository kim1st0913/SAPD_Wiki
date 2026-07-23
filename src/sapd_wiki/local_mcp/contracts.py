"""Load the four frozen local MCP contracts with stdlib-only validation."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Any, Mapping

from .errors import ContractError


REQUIRED_CONTRACT_IDS = frozenset(
    {
        "MCP-AUTH-v1",
        "MCP-DATA-POLICY-v1",
        "MCP-RUNTIME-STATE-v1",
        "MCP-PROTOCOL-TOOLS-v1",
    }
)
EXPECTED_SCHEMA_DRAFT = "https://json-schema.org/draft/2020-12/schema"


def _digest(path: Path) -> str:
    return f"sha256:{hashlib.sha256(path.read_bytes()).hexdigest()}"


def _load_json(path: Path) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ContractError(f"contract file cannot be loaded: {path.name}") from exc
    if not isinstance(payload, dict):
        raise ContractError(f"contract file is not an object: {path.name}")
    return payload


@dataclass(frozen=True)
class ContractBundle:
    root: Path
    set_version: str
    profiles: Mapping[str, Mapping[str, Any]]
    digests: Mapping[str, str]

    @property
    def auth(self) -> Mapping[str, Any]:
        return self.profiles["MCP-AUTH-v1"]

    @property
    def data_policy(self) -> Mapping[str, Any]:
        return self.profiles["MCP-DATA-POLICY-v1"]

    @property
    def runtime_state(self) -> Mapping[str, Any]:
        return self.profiles["MCP-RUNTIME-STATE-v1"]

    @property
    def protocol_tools(self) -> Mapping[str, Any]:
        return self.profiles["MCP-PROTOCOL-TOOLS-v1"]

    @property
    def scope(self) -> str:
        scope = self.auth.get("scope")
        if not isinstance(scope, str) or not scope:
            raise ContractError("authorization scope is missing")
        return scope

    @property
    def response_bytes(self) -> int:
        limits = self.protocol_tools.get("limits")
        value = limits.get("response_bytes") if isinstance(limits, dict) else None
        if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
            raise ContractError("response byte limit is invalid")
        return value

    @property
    def cursor_bindings(self) -> tuple[str, ...]:
        cursor = self.protocol_tools.get("cursor")
        values = cursor.get("bindings") if isinstance(cursor, dict) else None
        if not isinstance(values, list) or not all(isinstance(item, str) for item in values):
            raise ContractError("cursor bindings are invalid")
        return tuple(values)

    def tool(self, name: str) -> Mapping[str, Any]:
        tools = self.protocol_tools.get("tools")
        if not isinstance(tools, list):
            raise ContractError("tool definitions are invalid")
        for tool in tools:
            if isinstance(tool, dict) and tool.get("name") == name:
                return tool
        raise ContractError(f"unknown contracted tool: {name}")


def _default_contract_root() -> Path:
    return (
        Path(__file__).resolve().parents[3]
        / "docs"
        / "01-architecture"
        / "contracts"
        / "mcp"
        / "v1"
    )


def load_contracts(root: Path | None = None) -> ContractBundle:
    contract_root = (root or _default_contract_root()).resolve(strict=True)
    if not contract_root.is_dir():
        raise ContractError("contract root is not a directory")
    contract_set = _load_json(contract_root / "contract-set.json")
    if contract_set.get("schema_draft") != EXPECTED_SCHEMA_DRAFT:
        raise ContractError("contract set uses an unsupported schema draft")
    entries = contract_set.get("profiles")
    if not isinstance(entries, list) or len(entries) != len(REQUIRED_CONTRACT_IDS):
        raise ContractError("exactly four contract profiles are required")

    profiles: dict[str, Mapping[str, Any]] = {}
    digests: dict[str, str] = {}
    for entry in entries:
        if not isinstance(entry, dict):
            raise ContractError("contract profile entry is invalid")
        contract_id = entry.get("contract_id")
        if contract_id not in REQUIRED_CONTRACT_IDS or contract_id in profiles:
            raise ContractError("contract profile ids are incomplete or duplicated")
        relative = entry.get("profile")
        if not isinstance(relative, str):
            raise ContractError(f"{contract_id}: profile path is invalid")
        profile_path = (contract_root / relative).resolve(strict=True)
        if contract_root not in profile_path.parents:
            raise ContractError(f"{contract_id}: profile escapes contract root")
        actual_digest = _digest(profile_path)
        if actual_digest != entry.get("digest"):
            raise ContractError(f"{contract_id}: digest mismatch")
        profile = _load_json(profile_path)
        if profile.get("contract_id") != contract_id:
            raise ContractError(f"{contract_id}: profile id mismatch")
        if profile.get("contract_version") != entry.get("contract_version"):
            raise ContractError(f"{contract_id}: profile version mismatch")
        references = profile.get("references")
        if not isinstance(references, dict) or set(references.values()) != REQUIRED_CONTRACT_IDS - {contract_id}:
            raise ContractError(f"{contract_id}: cross-contract references are incomplete")
        profiles[contract_id] = MappingProxyType(profile)
        digests[contract_id] = actual_digest

    if set(profiles) != REQUIRED_CONTRACT_IDS:
        raise ContractError("required contract profiles are missing")
    scopes = {
        profile.get("scope")
        for profile in profiles.values()
        if "scope" in profile
    }
    if scopes != {"sapd.base.public.summary.read"}:
        raise ContractError("contract scopes are inconsistent")
    bundle = ContractBundle(
        root=contract_root,
        set_version=str(contract_set.get("contract_set_version") or ""),
        profiles=MappingProxyType(profiles),
        digests=MappingProxyType(digests),
    )
    required_cursor_bindings = {
        "tool",
        "normalized_parameters",
        "client",
        "grant",
        "scope",
        "policy_version",
        "knowledge_version",
        "identity_version",
        "sort_version",
        "last_sort_key",
        "issued_at",
    }
    if set(bundle.cursor_bindings) != required_cursor_bindings:
        raise ContractError("cursor binding contract is incomplete")
    return bundle
