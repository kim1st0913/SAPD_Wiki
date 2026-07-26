#!/usr/bin/env python3
"""Audit a T5 offline bundle without reading repository raw/generated data roots."""

from __future__ import annotations

import argparse
import hashlib
import json
import sqlite3
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

from check_bundle_runtime import check_bundle, sha256_file


ROOT = Path(__file__).resolve().parents[1]
RUNNER = ROOT / "scripts/run_bundle_with_forbidden_source_audit.py"
SERVER = ROOT / "scripts/run_local_server.py"
FORBIDDEN_OUTPUT_TERMS = (
    "content_bytes",
    "raw_xml",
    "raw_svg",
    "metadata_json",
    "/Users/",
    "/private/",
    "\\Users\\",
)


def json_get(base_url: str, path: str) -> dict[str, Any]:
    with urllib.request.urlopen(base_url + path, timeout=10) as response:
        return json.loads(response.read())


def ranged_get(base_url: str, path: str, end: int = 4095) -> tuple[int, dict[str, str], bytes]:
    request = urllib.request.Request(
        base_url + path,
        headers={"Range": f"bytes=0-{end}"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return response.status, dict(response.headers.items()), response.read()


def wait_for_state(process: subprocess.Popen[str], state_path: Path) -> dict[str, Any]:
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if process.poll() is not None:
            stdout, stderr = process.communicate(timeout=2)
            raise RuntimeError(
                f"bundle backend exited early: code={process.returncode}; "
                f"stdout={stdout[-2000:]}; stderr={stderr[-2000:]}"
            )
        if state_path.is_file():
            try:
                payload = json.loads(state_path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError):
                payload = {}
            if payload.get("url"):
                return payload
        time.sleep(0.05)
    raise TimeoutError("bundle backend did not publish runtime state")


def package_user_state(path: Path) -> dict[str, Any]:
    with sqlite3.connect(f"file:{path.resolve()}?mode=ro", uri=True) as connection:
        schema_row = connection.execute(
            "SELECT value FROM user_meta WHERE key='schema_version'"
        ).fetchone()
        result = {
            "schemaVersion": schema_row[0] if schema_row else None,
            "userNotes": connection.execute(
                "SELECT COUNT(*) FROM user_notes"
            ).fetchone()[0],
            "userFavorites": connection.execute(
                "SELECT COUNT(*) FROM user_favorites"
            ).fetchone()[0],
        }
        if {
            row[0]
            for row in connection.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )
        } >= {"user_workspaces", "user_data_baskets", "user_exports"}:
            result.update(
                {
                    "userWorkspaces": connection.execute(
                        "SELECT COUNT(*) FROM user_workspaces"
                    ).fetchone()[0],
                    "userDataBaskets": connection.execute(
                        "SELECT COUNT(*) FROM user_data_baskets"
                    ).fetchone()[0],
                    "userExports": connection.execute(
                        "SELECT COUNT(*) FROM user_exports"
                    ).fetchone()[0],
                }
            )
        return result


def mcp_core_reads(query_database: Path) -> dict[str, Any]:
    sys.path.insert(0, str(ROOT / "src"))
    try:
        from sapd_wiki.local_mcp.base_query_service import (
            SCOPE,
            BaseKnowledgeQueryService,
        )
        from sapd_wiki.local_mcp.models import RequestContext
    finally:
        sys.path.remove(str(ROOT / "src"))
    request = RequestContext(
        client_id="t5-offline-audit",
        grant_version="t5-offline-read-v1",
        scope=SCOPE,
        correlation_id="t5-offline-audit",
    )
    document_ref = "base:content_document:security-architecture-design-method-v2.0"
    with BaseKnowledgeQueryService.create(
        base_database=query_database,
        cursor_key=b"t5-offline-cursor-key-" + (b"x" * 32),
    ) as service:
        search = service.search_knowledge(
            "价值链",
            request=request,
            limit=8,
        ).to_dict()
        object_payload = service.get_knowledge_object(
            document_ref,
            request=request,
        ).to_dict()
        related = service.get_related_knowledge(
            document_ref,
            "outgoing",
            request=request,
            limit=15,
        ).to_dict()
        fragment_ref = related["data"]["items"][0]["target_ref"]
        evidence = service.get_source_evidence(
            fragment_ref,
            include_excerpt=False,
            request=request,
            limit=8,
        ).to_dict()
        version = service.get_knowledge_version(request=request).to_dict()
    return {
        "searchItems": len(search["data"]["items"]),
        "objectRef": object_payload["data"]["canonical_ref"],
        "relatedItems": len(related["data"]["items"]),
        "evidenceItems": len(evidence["data"]["items"]),
        "version": version["data"],
        "serialized": json.dumps(
            [search, object_payload, related, evidence, version],
            ensure_ascii=False,
        ),
    }


def inventory(bundle: Path, asset_database: Path) -> dict[str, Any]:
    files = sorted(path for path in bundle.rglob("*") if path.is_file())
    with sqlite3.connect(
        f"file:{asset_database.resolve()}?mode=ro",
        uri=True,
    ) as connection:
        original_hashes = {
            str(row[0]).lower()
            for row in connection.execute(
                """
                SELECT DISTINCT asset_hash
                FROM document_assets
                WHERE asset_role='original'
                """
            )
        }
    duplicate_originals = [
        {
            "path": path.relative_to(bundle).as_posix(),
            "sha256": digest,
        }
        for path in files
        if path != asset_database
        and (digest := sha256_file(path).lower()) in original_hashes
    ]
    outside_database_originals = [
        path.relative_to(bundle).as_posix()
        for path in files
        if path.suffix.casefold() in {".drawio", ".pptx"}
    ]
    return {
        "fileCount": len(files),
        "storedBytes": sum(path.stat().st_size for path in files),
        "topLevel": sorted(path.name for path in bundle.iterdir()),
        "outsideDatabaseOriginals": outside_database_originals,
        "originalDuplicatesOutsideDatabase": duplicate_originals,
        "repositoryRawDirectoryPresent": any(
            "data/raw-samples" in path.relative_to(bundle).as_posix()
            for path in files
        ),
    }


def run(args: argparse.Namespace) -> dict[str, Any]:
    bundle = args.bundle.resolve(strict=True)
    candidate_query = args.candidate_query.resolve(strict=True)
    candidate_asset = args.candidate_asset.resolve(strict=True)
    formal_database = args.formal_database.resolve(strict=True)
    real_user_database = args.real_user_database.resolve()
    manifest_path = bundle / "data/base/base-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    packaged_query = bundle / "data/base" / manifest["base_database"]["file"]
    packaged_asset = (
        bundle
        / "data/base"
        / manifest["content_asset_database"]["file"]
    )
    packaged_user = bundle / "data/user" / manifest["user_database"]["file"]
    tracked_before = {
        "formal": sha256_file(formal_database),
        "candidateQuery": sha256_file(candidate_query),
        "candidateAsset": sha256_file(candidate_asset),
        "packagedQuery": sha256_file(packaged_query),
        "packagedAsset": sha256_file(packaged_asset),
        "realUser": sha256_file(real_user_database)
        if real_user_database.is_file()
        else None,
    }
    check = check_bundle(bundle, create_user=False)
    user_before = package_user_state(packaged_user)
    mcp_reads = mcp_core_reads(packaged_query)

    state_path = bundle / "logs/runtime-state.json"
    state_path.unlink(missing_ok=True)
    command = [
        sys.executable,
        str(RUNNER),
        "--server-script",
        str(SERVER),
        "--bundle-root",
        str(bundle),
        "--deny-root",
        str(ROOT / "data/raw-samples"),
        "--deny-root",
        str(ROOT / "frontend/capability-browser/generated"),
    ]
    process = subprocess.Popen(
        command,
        cwd=bundle,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    server_completed_without_forbidden_read = False
    try:
        state = wait_for_state(process, state_path)
        base_url = str(state["url"]).rstrip("/")
        search = json_get(
            base_url,
            "/api/v1/knowledge/search?"
            + urllib.parse.urlencode({"q": "价值链", "limit": 8}),
        )
        document = json_get(
            base_url,
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
        version = json_get(base_url, "/api/v1/knowledge/version")
        asset_owners = {
            "svg": (
                "base:content_document:sapd-security-architecture-model",
                "derived-preview",
            ),
            "png": (
                "base:content_document:"
                "business-oriented-data-security-design-method-v2.1:page:001",
                "page-preview",
            ),
            "pdf": (
                "base:content_document:archimate-3.2-reference-poster-zh",
                "original",
            ),
            "html": (
                "base:content_document:sapd-maturity-model-usage-guide",
                "original",
            ),
        }
        expected = {
            "svg": ("image/svg+xml", b"<svg"),
            "png": ("image/png", b"\x89PNG\r\n\x1a\n"),
            "pdf": ("application/pdf", b"%PDF-"),
            "html": ("text/html", b"<!doctype"),
        }
        asset_reads: dict[str, Any] = {}
        for name, (owner_ref, asset_role) in asset_owners.items():
            metadata = json_get(
                base_url,
                "/api/v1/content/assets?"
                + urllib.parse.urlencode(
                    {
                        "owner_ref": owner_ref,
                        "asset_role": asset_role,
                    }
                ),
            )
            item = metadata["data"]["items"][0]
            stable_asset_path = (
                "/api/v1/content/assets/by-owner?"
                + urllib.parse.urlencode(
                    {
                        "owner_ref": owner_ref,
                        "asset_role": asset_role,
                    }
                )
            )
            status, headers, body = ranged_get(
                base_url,
                stable_asset_path,
            )
            mime, marker = expected[name]
            marker_found = marker.lower() in body.lower()
            asset_reads[name] = {
                "status": status,
                "mimeType": headers.get("Content-Type"),
                "contentRange": headers.get("Content-Range"),
                "logicalFileName": item["logical_file_name"],
                "assetHash": item["asset_hash"],
                "stableAssetUrl": stable_asset_path,
                "markerFound": marker_found,
                "pass": (
                    status == 206
                    and headers.get("Content-Type") == mime
                    and marker_found
                ),
            }
        serialized_http = json.dumps(
            [search, document, version, asset_reads],
            ensure_ascii=False,
        )
        server_completed_without_forbidden_read = True
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)

    tracked_after = {
        "formal": sha256_file(formal_database),
        "candidateQuery": sha256_file(candidate_query),
        "candidateAsset": sha256_file(candidate_asset),
        "packagedQuery": sha256_file(packaged_query),
        "packagedAsset": sha256_file(packaged_asset),
        "realUser": sha256_file(real_user_database)
        if real_user_database.is_file()
        else None,
    }
    user_after = package_user_state(packaged_user)
    forbidden_hits = [
        term
        for term in FORBIDDEN_OUTPUT_TERMS
        if term.casefold()
        in (serialized_http + mcp_reads["serialized"]).casefold()
    ]
    candidate_diff = {
        "querySha256Matches": (
            tracked_after["candidateQuery"] == tracked_after["packagedQuery"]
        ),
        "assetSha256Matches": (
            tracked_after["candidateAsset"] == tracked_after["packagedAsset"]
        ),
        "queryBytes": packaged_query.stat().st_size,
        "assetBytes": packaged_asset.stat().st_size,
    }
    package_inventory = inventory(bundle, packaged_asset)
    packaged_app_source = (
        bundle / "app/frontend-dist/app.js"
    ).read_text(encoding="utf-8")
    packaged_shell_source = (
        bundle / "app/frontend-dist/components/AppShell.js"
    ).read_text(encoding="utf-8")
    frontend_asset_routing = {
        "ownerApiReferences": (
            packaged_app_source.count("/api/v1/content/assets/by-owner?")
            + packaged_shell_source.count("/api/v1/content/assets/by-owner?")
        ),
        "staticGuideOriginalReferenceAbsent": (
            "assets/guides/maturity-model-usage.html"
            not in packaged_app_source + packaged_shell_source
        ),
        "staticPosterOriginalReferenceAbsent": (
            "${ARCHIMATE_POSTER_ASSET_BASE}/archimate-poster-v3.2-zh.pdf"
            not in packaged_app_source
            and "public/data/guides/archimate-poster/archimate-poster-v3.2-zh.pdf"
            not in packaged_app_source
        ),
    }
    issues: list[str] = []
    if not check["ok"]:
        issues.append("bundle runtime check failed")
    if not all(asset["pass"] for asset in asset_reads.values()):
        issues.append("representative asset streaming failed")
    if not candidate_diff["querySha256Matches"]:
        issues.append("packaged query database differs from candidate")
    if not candidate_diff["assetSha256Matches"]:
        issues.append("packaged asset database differs from candidate")
    if tracked_before != tracked_after:
        issues.append("a protected or read-only database changed")
    package_user_counts = {
        key: value
        for key, value in user_after.items()
        if key != "schemaVersion"
    }
    if (
        user_before != user_after
        or user_after.get("schemaVersion") != "user_schema_0.3"
        or any(int(value) != 0 for value in package_user_counts.values())
    ):
        issues.append("clean package user database is not empty")
    if forbidden_hits:
        issues.append("forbidden output fields or local paths detected")
    if package_inventory["outsideDatabaseOriginals"]:
        issues.append("drawio or pptx exists outside the asset database")
    if package_inventory["originalDuplicatesOutsideDatabase"]:
        issues.append("an original asset byte copy exists outside the asset database")
    if package_inventory["repositoryRawDirectoryPresent"]:
        issues.append("repository raw-samples directory leaked into bundle")
    if (
        frontend_asset_routing["ownerApiReferences"] < 3
        or not frontend_asset_routing["staticGuideOriginalReferenceAbsent"]
        or not frontend_asset_routing["staticPosterOriginalReferenceAbsent"]
    ):
        issues.append("packaged frontend does not exclusively route originals via asset API")
    if not mcp_reads["searchItems"] or not mcp_reads["evidenceItems"]:
        issues.append("packaged MCP core representative reads failed")

    report = {
        "schemaVersion": "content-offline-bundle-t5-report-v1",
        "result": "pass" if not issues else "fail",
        "bundleRoot": str(bundle.relative_to(ROOT)),
        "bundleCheck": {
            "pass": check["ok"],
            "checks": check["checks"],
        },
        "inventory": package_inventory,
        "frontendAssetRouting": frontend_asset_routing,
        "candidateDiff": candidate_diff,
        "packagedMcpCore": {
            key: value for key, value in mcp_reads.items() if key != "serialized"
        },
        "packagedAppHttp": {
            "searchItems": len(search["data"]["items"]),
            "objectRef": document["data"]["canonical_ref"],
            "version": version["data"],
            "assets": asset_reads,
            "forbiddenOutputTerms": forbidden_hits,
        },
        "sourceIsolation": {
            "deniedRoots": [
                "data/raw-samples",
                "frontend/capability-browser/generated",
            ],
            "serverCompletedWithoutForbiddenRead": (
                server_completed_without_forbidden_read
            ),
        },
        "databaseBoundary": {
            "before": tracked_before,
            "after": tracked_after,
            "unchanged": tracked_before == tracked_after,
            "packageUserBefore": user_before,
            "packageUserAfter": user_after,
            "realUserDatabaseAccess": "hash_only",
        },
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
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--candidate-query", type=Path, required=True)
    parser.add_argument("--candidate-asset", type=Path, required=True)
    parser.add_argument("--formal-database", type=Path, required=True)
    parser.add_argument("--real-user-database", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    args = parser.parse_args()
    report = run(args)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["result"] == "pass" else 1


if __name__ == "__main__":
    raise SystemExit(main())
