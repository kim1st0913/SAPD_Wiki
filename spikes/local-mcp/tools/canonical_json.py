from __future__ import annotations

import copy
import hashlib
import unicodedata
from pathlib import Path
from typing import Any

import rfc8785


JS_SAFE_INTEGER = 9_007_199_254_740_991


class CanonicalJsonError(ValueError):
    pass


def assert_t0_json_value(value: Any, path: str = "$") -> None:
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, int):
        if not -JS_SAFE_INTEGER <= value <= JS_SAFE_INTEGER:
            raise CanonicalJsonError(f"{path}: integer is outside JavaScript safe range")
        return
    if isinstance(value, float):
        raise CanonicalJsonError(f"{path}: floats are forbidden")
    if isinstance(value, str):
        if unicodedata.normalize("NFC", value) != value:
            raise CanonicalJsonError(f"{path}: string is not Unicode NFC")
        return
    if isinstance(value, list):
        for index, item in enumerate(value):
            assert_t0_json_value(item, f"{path}[{index}]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise CanonicalJsonError(f"{path}: object key is not a string")
            if unicodedata.normalize("NFC", key) != key:
                raise CanonicalJsonError(f"{path}: object key is not Unicode NFC")
            assert_t0_json_value(item, f"{path}.{key}")
        return
    raise CanonicalJsonError(f"{path}: unsupported JSON value {type(value).__name__}")


def canonical_bytes(value: Any) -> bytes:
    assert_t0_json_value(value)
    return rfc8785.dumps(value)


def sha256_prefixed(value: bytes) -> str:
    return f"sha256:{hashlib.sha256(value).hexdigest()}"


def digest_file(path: Path) -> str:
    return sha256_prefixed(path.read_bytes())


def compute_fixture_hash(fixture: dict[str, Any]) -> str:
    if "generated_at" in fixture:
        raise CanonicalJsonError("$.generated_at: volatile field is forbidden")
    payload = copy.deepcopy(fixture)
    payload.pop("fixture_hash", None)
    return sha256_prefixed(canonical_bytes(payload))


def compute_fixture_set_hash(
    contract_digests: dict[str, str],
    fixtures: list[dict[str, Any]],
) -> str:
    entries = [
        {
            "fixture_id": fixture["fixture_id"],
            "fixture_revision": fixture["fixture_revision"],
            "fixture_hash": fixture["fixture_hash"],
        }
        for fixture in sorted(fixtures, key=lambda item: item["fixture_id"])
    ]
    payload = {
        "contract_digests": dict(sorted(contract_digests.items())),
        "fixtures": entries,
    }
    return sha256_prefixed(canonical_bytes(payload))
