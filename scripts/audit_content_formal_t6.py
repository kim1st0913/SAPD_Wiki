#!/usr/bin/env python3
"""Audit the formal T6 databases through the stable 5173 runtime."""

from __future__ import annotations

import argparse
import hashlib
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
FORBIDDEN_TERMS = (
    "content_bytes",
    "raw_xml",
    "raw_svg",
    "metadata_json",
    "/Users/",
    "/private/",
    "\\Users\\",
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def json_get(
    base_url: str,
    path: str,
    *,
    session_token: str | None = None,
) -> dict[str, Any]:
    request = urllib.request.Request(base_url.rstrip("/") + path)
    if session_token:
        request.add_header("X-SAPD-Session-Token", session_token)
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read())


def ranged_get(
    base_url: str,
    path: str,
) -> tuple[int, dict[str, str], bytes]:
    request = urllib.request.Request(
        base_url.rstrip("/") + path,
        headers={"Range": "bytes=0-4095"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return response.status, dict(response.headers.items()), response.read()


def run(args: argparse.Namespace) -> dict[str, Any]:
    formal_query = args.formal_query.resolve(strict=True)
    formal_asset = args.formal_asset.resolve(strict=True)
    real_user = args.real_user.resolve(strict=True)
    apply_report = json.loads(
        args.apply_report.resolve(strict=True).read_text(encoding="utf-8")
    )
    release_state = (
        json.loads(
            args.release_state.resolve(strict=True).read_text(encoding="utf-8")
        )
        if args.release_state
        else None
    )
    mcp_five_tools = (
        json.loads(
            args.mcp_five_tools_evidence.resolve(strict=True).read_text(
                encoding="utf-8"
            )
        )
        if args.mcp_five_tools_evidence
        else None
    )
    before = {
        "formalQuery": sha256_file(formal_query),
        "formalAsset": sha256_file(formal_asset),
        "realUser": sha256_file(real_user),
    }
    health = json_get(args.base_url, "/api/v1/health")
    session_token = str(
        health.get("data", {}).get("auth", {}).get("session_token") or ""
    )
    search = json_get(
        args.base_url,
        "/api/v1/knowledge/search?"
        + urllib.parse.urlencode({"q": "价值链", "limit": 8}),
    )
    content_object = json_get(
        args.base_url,
        "/api/v1/knowledge/object?"
        + urllib.parse.urlencode(
            {
                "canonical_ref": (
                    "base:content_document:"
                    "security-architecture-design-method-v2.0"
                )
            }
        ),
    )
    version = json_get(args.base_url, "/api/v1/knowledge/version")
    mcp_panel = json_get(
        args.base_url,
        "/api/v1/mcp/control-panel",
        session_token=session_token,
    )

    cases = {
        "svg": (
            "base:content_document:sapd-security-architecture-model",
            "derived-preview",
            "image/svg+xml",
            b"<svg",
        ),
        "png": (
            "base:content_document:"
            "business-oriented-data-security-design-method-v2.1:page:001",
            "page-preview",
            "image/png",
            b"\x89PNG\r\n\x1a\n",
        ),
        "pdf": (
            "base:content_document:archimate-3.2-reference-poster-zh",
            "original",
            "application/pdf",
            b"%PDF-",
        ),
        "html": (
            "base:content_document:sapd-maturity-model-usage-guide",
            "original",
            "text/html",
            b"<!doctype",
        ),
    }
    assets: dict[str, Any] = {}
    for name, (owner_ref, role, mime_type, marker) in cases.items():
        path = (
            "/api/v1/content/assets/by-owner?"
            + urllib.parse.urlencode(
                {"owner_ref": owner_ref, "asset_role": role}
            )
        )
        status, headers, body = ranged_get(args.base_url, path)
        marker_found = marker.lower() in body.lower()
        assets[name] = {
            "status": status,
            "mimeType": headers.get("Content-Type"),
            "contentRange": headers.get("Content-Range"),
            "markerFound": marker_found,
            "pass": (
                status == 206
                and headers.get("Content-Type") == mime_type
                and marker_found
            ),
        }

    after = {
        "formalQuery": sha256_file(formal_query),
        "formalAsset": sha256_file(formal_asset),
        "realUser": sha256_file(real_user),
    }
    health_runtime = health.get("data", {}).get("runtime", {})
    serialized = json.dumps(
        [search, content_object, version, assets],
        ensure_ascii=False,
    )
    forbidden_hits = [
        term
        for term in FORBIDDEN_TERMS
        if term.casefold() in serialized.casefold()
    ]
    mcp_status = (
        mcp_panel.get("status")
        if isinstance(mcp_panel.get("status"), dict)
        else {}
    )
    mcp_clients = (
        mcp_panel.get("clients")
        if isinstance(mcp_panel.get("clients"), list)
        else []
    )
    mcp_state = mcp_status.get("service_state")
    issues: list[str] = []
    if before != after:
        issues.append("formal query, asset, or real user database changed during reads")
    expected_query_hash = (
        apply_report.get("after", {})
        .get("formal_query", {})
        .get("sha256")
        or apply_report.get("formal_query", {}).get("sha256")
    )
    expected_asset_hash = (
        apply_report.get("after", {})
        .get("formal_asset", {})
        .get("sha256")
        or apply_report.get("formal_asset", {}).get("sha256")
    )
    if before["formalQuery"] != expected_query_hash:
        issues.append("formal query hash differs from T6 apply report")
    if before["formalAsset"] != expected_asset_hash:
        issues.append("formal asset hash differs from T6 apply report")
    if not search.get("data", {}).get("items"):
        issues.append("formal search returned no representative result")
    if content_object.get("data", {}).get("format") != "pdf":
        issues.append("formal content object projection failed")
    if not all(item["pass"] for item in assets.values()):
        issues.append("formal representative asset streaming failed")
    if forbidden_hits:
        issues.append("formal API response contains a forbidden field or local path")
    if health_runtime.get("content_asset_database", {}).get("exists") is not True:
        issues.append("stable runtime does not expose the formal asset database")
    if mcp_state not in {"ready", "running", "started"}:
        issues.append(f"MCP stable runtime is not ready: {mcp_state!r}")
    if release_state:
        release_id = release_state.get("release_id")
        candidate = release_state.get("build", {}).get("candidate", {})
        expected_tools = {
            "search_knowledge",
            "get_knowledge_object",
            "get_related_knowledge",
            "get_source_evidence",
            "get_knowledge_version",
        }
        tool_results = (
            mcp_five_tools.get("tool_results", {})
            if isinstance(mcp_five_tools, dict)
            else {}
        )
        expected_runtime_id = (
            mcp_status.get("runtime_id")
            or health_runtime.get("runtime_id")
        )
        authorized_client_ids = {
            client.get("client_id")
            for client in mcp_clients
            if client.get("client_id")
            and client.get("status") not in {"disabled", "revoked"}
            and client.get("authorization_status")
            not in {"denied", "revoked", "disabled"}
        }
        try:
            observed_at = datetime.fromisoformat(
                str(mcp_five_tools.get("observed_at")).replace("Z", "+00:00")
            )
            release_updated_at = datetime.fromisoformat(
                str(release_state.get("updated_at")).replace("Z", "+00:00")
            )
            time_valid = (
                observed_at.tzinfo is not None
                and observed_at >= release_updated_at
                and observed_at <= datetime.now(timezone.utc)
            )
        except (TypeError, ValueError):
            time_valid = False
        if (
            release_state.get("status") not in {"applied", "accepted"}
            or apply_report.get("release_id") != release_id
            or apply_report.get("result") != "pass"
            or before["formalQuery"] != candidate.get("query_sha256")
            or before["formalAsset"] != candidate.get("asset_sha256")
        ):
            issues.append("release state, apply report, and formal databases disagree")
        if (
            not isinstance(mcp_five_tools, dict)
            or mcp_five_tools.get("schema_version")
            != "content-release-mcp-five-tools-v1"
            or mcp_five_tools.get("result") != "pass"
            or mcp_five_tools.get("release_id") != release_id
            or mcp_five_tools.get("query_sha256")
            != candidate.get("query_sha256")
            or mcp_five_tools.get("asset_sha256")
            != candidate.get("asset_sha256")
            or not mcp_five_tools.get("runtime_id")
            or not mcp_five_tools.get("client_id")
            or not mcp_five_tools.get("observed_at")
            or mcp_five_tools.get("runtime_id") != expected_runtime_id
            or mcp_five_tools.get("client_id") not in authorized_client_ids
            or not time_valid
            or set(tool_results) != expected_tools
            or any(
                not isinstance(result, dict)
                or result.get("result") != "pass"
                or not (
                    result.get("result_count") is not None
                    or result.get("digest")
                )
                for result in tool_results.values()
            )
        ):
            issues.append(
                "formal MCP five-tool evidence is missing or not release-bound"
            )

    report = {
        "schemaVersion": "base-content-unified-query-t6-runtime-audit-v1",
        "result": "pass" if not issues else "fail",
        "release_id": (
            release_state.get("release_id")
            if release_state
            else apply_report.get("release_id")
        ),
        "baseUrl": args.base_url,
        "databaseBoundary": {
            "before": before,
            "after": after,
            "unchanged": before == after,
        },
        "runtime": {
            "label": health_runtime.get("label"),
            "baseDatabase": health_runtime.get("base_database"),
            "contentQueryDatabase": health_runtime.get(
                "content_query_database"
            ),
            "contentAssetDatabase": health_runtime.get(
                "content_asset_database"
            ),
            "userDatabase": health_runtime.get("user_database"),
            "runtimeId": (
                mcp_status.get("runtime_id")
                or health_runtime.get("runtime_id")
            ),
        },
        "knowledge": {
            "searchItems": len(search.get("data", {}).get("items", [])),
            "objectRef": content_object.get("data", {}).get("canonical_ref"),
            "version": version.get("data"),
            "forbiddenOutputTerms": forbidden_hits,
        },
        "assets": assets,
        "mcp": {
            "state": mcp_state,
            "authorizationState": mcp_status.get("authorization_state"),
            "knowledgeState": mcp_status.get("knowledge_state"),
            "registeredClients": len(mcp_clients),
            "authorizedClientIds": sorted(
                client.get("client_id")
                for client in mcp_clients
                if client.get("client_id")
                and client.get("status") not in {"disabled", "revoked"}
                and client.get("authorization_status")
                not in {"denied", "revoked", "disabled"}
            ),
        },
        "mcpFiveTools": mcp_five_tools,
        "issues": issues,
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:5173",
    )
    parser.add_argument(
        "--formal-query",
        type=Path,
        default=ROOT / "data/database/sapd_wiki.sqlite3",
    )
    parser.add_argument(
        "--formal-asset",
        type=Path,
        default=ROOT / "data/database/sapd_content_assets.sqlite3",
    )
    parser.add_argument(
        "--real-user",
        type=Path,
        default=ROOT / "data/user/sapd_wiki_user.sqlite3",
    )
    parser.add_argument("--apply-report", type=Path, required=True)
    parser.add_argument("--release-state", type=Path)
    parser.add_argument("--mcp-five-tools-evidence", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    report = run(args)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["result"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
