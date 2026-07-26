#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sqlite3
import unicodedata
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE_DB = ROOT / "data/database/sapd_wiki.sqlite3"
DEFAULT_USER_DB = ROOT / "data/user/sapd_wiki_user.sqlite3"
DEFAULT_WORKBENCH = ROOT / "frontend/capability-browser/public/data/environment-workbench.json"
DEFAULT_BASEMAP_SEMANTIC = (
    ROOT / "frontend/capability-browser/generated/environmentBasemap.semantic.json"
)
DEFAULT_CONTRACT = (
    ROOT
    / "docs/01-architecture/contracts/environment-master-data/v1/environment-master-data.contract.json"
)
DEFAULT_OUTPUT_ROOT = ROOT / "data/exports/worker-verify/plan-env-md"

MASTER_TYPES = (
    "information_environment",
    "environment_segment_type",
    "information_object",
)
CURRENT_TYPES = (
    "information_environment",
    "environment_segment",
    "information_object",
    "environment_segment_type",
)
CONTEXT_RELATION_TYPES = ("belongs_to", "instance_of")


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: datetime) -> str:
    return value.replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def connect_read_only(path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA query_only = ON")
    return connection


def normalize_title(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    return " ".join(text.replace("\n", " ").split()).strip()


def parse_json_object(value: Any) -> dict[str, Any]:
    if not value:
        return {}
    try:
        parsed = json.loads(str(value))
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def sql_placeholders(values: Iterable[Any]) -> str:
    return ",".join("?" for _ in values)


def csv_scalar(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (list, dict, tuple, set)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value)


def write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: csv_scalar(row.get(field)) for field in fieldnames})


def item_sources(connection: sqlite3.Connection, item_ids: set[str]) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = defaultdict(list)
    if not item_ids:
        return result
    values = sorted(item_ids)
    query = f"""
        SELECT id, target_id, source_file_id, source_sheet, source_row, source_column,
               source_cell, source_hash
        FROM source_references
        WHERE target_type = 'item' AND target_id IN ({sql_placeholders(values)})
        ORDER BY target_id, source_sheet, source_row, source_column, id
    """
    for row in connection.execute(query, values):
        result[str(row["target_id"])].append(
            {
                "evidence_ref": f"db-source-reference:{row['id']}",
                "source_file_id": row["source_file_id"],
                "source_sheet": row["source_sheet"],
                "source_row": row["source_row"],
                "source_column": row["source_column"],
                "source_cell": row["source_cell"],
                "source_hash": row["source_hash"],
            }
        )
    return result


def relation_sources(connection: sqlite3.Connection, relation_ids: set[str]) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = defaultdict(list)
    if not relation_ids:
        return result
    values = sorted(relation_ids)
    query = f"""
        SELECT id, target_id, source_file_id, source_sheet, source_row, source_column,
               source_cell, source_hash
        FROM source_references
        WHERE target_type = 'relation' AND target_id IN ({sql_placeholders(values)})
        ORDER BY target_id, source_sheet, source_row, source_column, id
    """
    for row in connection.execute(query, values):
        result[str(row["target_id"])].append(
            {
                "evidence_ref": f"db-source-reference:{row['id']}",
                "source_file_id": row["source_file_id"],
                "source_sheet": row["source_sheet"],
                "source_row": row["source_row"],
                "source_column": row["source_column"],
                "source_cell": row["source_cell"],
                "source_hash": row["source_hash"],
            }
        )
    return result


def load_base_inventory(connection: sqlite3.Connection) -> dict[str, Any]:
    item_rows = connection.execute(
        f"""
        SELECT id, type, code, title, description, category, status, source_file_id,
               source_hash, metadata_json, stable_key, stable_ref, public_id
        FROM knowledge_items
        WHERE type IN ({sql_placeholders(CURRENT_TYPES)})
        ORDER BY type, title, id
        """,
        CURRENT_TYPES,
    ).fetchall()
    items = []
    items_by_id: dict[str, dict[str, Any]] = {}
    for row in item_rows:
        item = {
            "id": str(row["id"]),
            "type": str(row["type"]),
            "code": str(row["code"] or ""),
            "title": str(row["title"] or ""),
            "description": str(row["description"] or ""),
            "category": str(row["category"] or ""),
            "status": str(row["status"] or ""),
            "source_file_id": row["source_file_id"],
            "source_hash": row["source_hash"],
            "stable_key": str(row["stable_key"] or ""),
            "stable_ref": str(row["stable_ref"] or ""),
            "public_id": str(row["public_id"] or ""),
            "metadata": parse_json_object(row["metadata_json"]),
        }
        items.append(item)
        items_by_id[item["id"]] = item

    relevant_ids = set(items_by_id)
    sources_by_item = item_sources(connection, relevant_ids)
    for item in items:
        sources = sources_by_item.get(item["id"], [])
        item["source_evidence_count"] = len(sources)
        item["source_sheets"] = sorted(
            {str(source["source_sheet"]) for source in sources if source.get("source_sheet")}
        )
        item["source_evidence_refs"] = [source["evidence_ref"] for source in sources]

    relation_rows = connection.execute(
        f"""
        SELECT r.id, r.source_item_id, r.target_item_id, r.relation_type,
               r.relation_label, r.confidence, r.source_file_id, r.import_job_id,
               r.metadata_json, r.stable_key, r.stable_ref, r.public_id,
               source.type AS source_type, source.title AS source_title,
               source.stable_ref AS source_stable_ref,
               target.type AS target_type, target.title AS target_title,
               target.stable_ref AS target_stable_ref
        FROM knowledge_relations r
        JOIN knowledge_items source ON source.id = r.source_item_id
        JOIN knowledge_items target ON target.id = r.target_item_id
        WHERE (
          source.type IN ({sql_placeholders(CURRENT_TYPES)})
          OR target.type IN ({sql_placeholders(CURRENT_TYPES)})
        )
        ORDER BY r.relation_type, source.type, source.title, target.type, target.title, r.id
        """,
        CURRENT_TYPES + CURRENT_TYPES,
    ).fetchall()
    relations = []
    for row in relation_rows:
        relations.append(
            {
                "id": str(row["id"]),
                "stable_key": str(row["stable_key"] or ""),
                "stable_ref": str(row["stable_ref"] or ""),
                "public_id": str(row["public_id"] or ""),
                "relation_type": str(row["relation_type"]),
                "relation_label": str(row["relation_label"] or ""),
                "confidence": str(row["confidence"] or ""),
                "source_item_id": str(row["source_item_id"]),
                "source_type": str(row["source_type"]),
                "source_title": str(row["source_title"]),
                "source_stable_ref": str(row["source_stable_ref"] or ""),
                "target_item_id": str(row["target_item_id"]),
                "target_type": str(row["target_type"]),
                "target_title": str(row["target_title"]),
                "target_stable_ref": str(row["target_stable_ref"] or ""),
                "source_file_id": row["source_file_id"],
                "import_job_id": row["import_job_id"],
                "metadata": parse_json_object(row["metadata_json"]),
            }
        )
    sources_by_relation = relation_sources(connection, {relation["id"] for relation in relations})
    for relation in relations:
        sources = sources_by_relation.get(relation["id"], [])
        relation["source_evidence_count"] = len(sources)
        relation["source_sheets"] = sorted(
            {str(source["source_sheet"]) for source in sources if source.get("source_sheet")}
        )
        relation["source_evidence_refs"] = [source["evidence_ref"] for source in sources]

    return {
        "items": items,
        "items_by_id": items_by_id,
        "relations": relations,
    }


def build_context_inventory(base: dict[str, Any]) -> dict[str, Any]:
    items_by_id = base["items_by_id"]
    relations = base["relations"]
    environment_ids = {
        item["id"] for item in base["items"] if item["type"] == "information_environment"
    }
    segment_ids = {item["id"] for item in base["items"] if item["type"] == "environment_segment"}
    object_ids = {item["id"] for item in base["items"] if item["type"] == "information_object"}

    segment_to_environments: dict[str, list[str]] = defaultdict(list)
    object_to_segments: dict[str, list[str]] = defaultdict(list)
    object_to_environments: dict[str, list[str]] = defaultdict(list)
    preserved_relations = []
    instance_of_relations = []

    for relation in relations:
        if relation["relation_type"] == "instance_of":
            instance_of_relations.append(relation)
        if relation["relation_type"] != "belongs_to":
            continue
        if relation["source_type"] == "environment_segment" and relation["target_type"] == "information_environment":
            segment_to_environments[relation["source_item_id"]].append(relation["target_item_id"])
            preserved_relations.append(relation)
        elif relation["source_type"] == "information_object" and relation["target_type"] == "environment_segment":
            object_to_segments[relation["source_item_id"]].append(relation["target_item_id"])
            preserved_relations.append(relation)
        elif relation["source_type"] == "information_object" and relation["target_type"] == "information_environment":
            object_to_environments[relation["source_item_id"]].append(relation["target_item_id"])
            preserved_relations.append(relation)

    contexts = []
    for object_id in sorted(object_ids):
        for segment_id in sorted(set(object_to_segments.get(object_id, []))):
            for environment_id in sorted(set(segment_to_environments.get(segment_id, []))):
                contexts.append(
                    {
                        "environment_id": environment_id,
                        "environment_title": items_by_id[environment_id]["title"],
                        "environment_stable_ref": items_by_id[environment_id]["stable_ref"],
                        "segment_id": segment_id,
                        "segment_title": items_by_id[segment_id]["title"],
                        "segment_stable_ref": items_by_id[segment_id]["stable_ref"],
                        "object_id": object_id,
                        "object_title": items_by_id[object_id]["title"],
                        "object_stable_ref": items_by_id[object_id]["stable_ref"],
                    }
                )
        for environment_id in sorted(set(object_to_environments.get(object_id, []))):
            contexts.append(
                {
                    "environment_id": environment_id,
                    "environment_title": items_by_id[environment_id]["title"],
                    "environment_stable_ref": items_by_id[environment_id]["stable_ref"],
                    "segment_id": None,
                    "segment_title": None,
                    "segment_stable_ref": None,
                    "object_id": object_id,
                    "object_title": items_by_id[object_id]["title"],
                    "object_stable_ref": items_by_id[object_id]["stable_ref"],
                }
            )

    orphan_segments = sorted(segment_ids - set(segment_to_environments))
    orphan_objects = sorted(object_ids - set(object_to_segments) - set(object_to_environments))
    multi_environment_segments = {
        segment_id: sorted(set(environment_ids_for_segment))
        for segment_id, environment_ids_for_segment in segment_to_environments.items()
        if len(set(environment_ids_for_segment)) != 1
    }
    invalid_relation_endpoints = [
        relation["id"]
        for relation in preserved_relations
        if relation["source_item_id"] not in items_by_id or relation["target_item_id"] not in items_by_id
    ]

    return {
        "environment_ids": environment_ids,
        "segment_ids": segment_ids,
        "object_ids": object_ids,
        "segment_to_environments": segment_to_environments,
        "object_to_segments": object_to_segments,
        "object_to_environments": object_to_environments,
        "contexts": contexts,
        "preserved_relations": preserved_relations,
        "instance_of_relations": instance_of_relations,
        "orphan_segments": orphan_segments,
        "orphan_objects": orphan_objects,
        "multi_environment_segments": multi_environment_segments,
        "invalid_relation_endpoints": invalid_relation_endpoints,
    }


def package_inventory(workbench: dict[str, Any]) -> dict[str, Any]:
    object_groups = workbench.get("objects") if isinstance(workbench.get("objects"), dict) else {}
    package_items: dict[str, dict[str, Any]] = {}
    package_ids_by_type: dict[str, set[str]] = {}
    for item_type in ("information_environment", "environment_segment", "information_object"):
        group = object_groups.get(item_type) if isinstance(object_groups.get(item_type), dict) else {}
        package_ids_by_type[item_type] = set(group)
        for item_id, item in group.items():
            if isinstance(item, dict):
                package_items[str(item_id)] = item

    package_contexts = []
    environment_tree = (
        workbench.get("environment_scope_tree")
        if isinstance(workbench.get("environment_scope_tree"), list)
        else []
    )
    for environment in environment_tree:
        if not isinstance(environment, dict):
            continue
        environment_id = str(environment.get("id") or "")
        for information_object in environment.get("objects") or []:
            if not isinstance(information_object, dict):
                continue
            object_id = str(information_object.get("id") or "")
            segments = [
                segment
                for segment in information_object.get("segments") or []
                if isinstance(segment, dict)
            ]
            if not segments:
                package_contexts.append((environment_id, None, object_id))
            for segment in segments:
                package_contexts.append(
                    (environment_id, str(segment.get("id") or ""), object_id)
                )

    evidence_rows = workbench.get("evidenceRefs")
    evidence_ids = {
        str(row.get("id"))
        for row in evidence_rows
        if isinstance(evidence_rows, list) and isinstance(row, dict) and row.get("id")
    }
    object_evidence_refs = set()
    for item in package_items.values():
        object_evidence_refs.update(
            str(value) for value in item.get("evidenceRefs") or [] if value
        )

    return {
        "items": package_items,
        "ids_by_type": package_ids_by_type,
        "contexts": package_contexts,
        "context_set": set(package_contexts),
        "environment_tree_count": len(environment_tree),
        "evidence_ids": evidence_ids,
        "object_evidence_refs": object_evidence_refs,
        "missing_object_evidence_refs": sorted(object_evidence_refs - evidence_ids),
    }


def parity_inventory(base: dict[str, Any], context: dict[str, Any], package: dict[str, Any]) -> dict[str, Any]:
    db_ids_by_type = {
        item_type: {
            item["id"] for item in base["items"] if item["type"] == item_type
        }
        for item_type in ("information_environment", "environment_segment", "information_object")
    }
    id_differences = {}
    title_mismatches = []
    for item_type, db_ids in db_ids_by_type.items():
        package_ids = package["ids_by_type"][item_type]
        id_differences[item_type] = {
            "missing_from_package": sorted(db_ids - package_ids),
            "extra_in_package": sorted(package_ids - db_ids),
        }
        for item_id in sorted(db_ids & package_ids):
            db_item = base["items_by_id"][item_id]
            package_item = package["items"][item_id]
            if normalize_title(db_item["title"]) != normalize_title(
                package_item.get("title") or package_item.get("name")
            ):
                title_mismatches.append(
                    {
                        "type": item_type,
                        "id": item_id,
                        "database_title": db_item["title"],
                        "package_title": package_item.get("title") or package_item.get("name"),
                    }
                )

    db_context_set = {
        (row["environment_id"], row["segment_id"], row["object_id"])
        for row in context["contexts"]
    }
    package_context_set = package["context_set"]
    return {
        "id_differences": id_differences,
        "title_mismatches": title_mismatches,
        "contexts_missing_from_package": sorted(
            db_context_set - package_context_set,
            key=lambda row: tuple("" if value is None else value for value in row),
        ),
        "contexts_extra_in_package": sorted(
            package_context_set - db_context_set,
            key=lambda row: tuple("" if value is None else value for value in row),
        ),
        "database_context_count": len(db_context_set),
        "package_context_count": len(package_context_set),
        "package_duplicate_context_count": len(package["contexts"]) - len(package_context_set),
        "missing_object_evidence_refs": package["missing_object_evidence_refs"],
    }


def candidate_groups(base: dict[str, Any], context: dict[str, Any]) -> list[dict[str, Any]]:
    segment_items = [
        item for item in base["items"] if item["type"] == "environment_segment"
    ]
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for segment in segment_items:
        groups[normalize_title(segment["title"])].append(segment)

    objects_by_segment: dict[str, list[str]] = defaultdict(list)
    for object_id, segment_ids in context["object_to_segments"].items():
        for segment_id in segment_ids:
            objects_by_segment[segment_id].append(object_id)

    result = []
    for normalized_title, segments in sorted(groups.items()):
        instances = []
        environment_refs = set()
        object_refs = set()
        exact_titles = set()
        evidence_refs = set()
        qualifier_mismatches = []
        for segment in sorted(segments, key=lambda item: item["stable_ref"]):
            exact_titles.add(segment["title"])
            environment_ids = sorted(
                set(context["segment_to_environments"].get(segment["id"], []))
            )
            environment_id = environment_ids[0] if len(environment_ids) == 1 else None
            environment = (
                base["items_by_id"].get(environment_id) if environment_id else None
            )
            object_ids = sorted(set(objects_by_segment.get(segment["id"], [])))
            object_rows = [base["items_by_id"][object_id] for object_id in object_ids]
            if environment:
                environment_refs.add(environment["stable_ref"])
            object_refs.update(row["stable_ref"] for row in object_rows)
            evidence_refs.update(segment["source_evidence_refs"])
            object_key = str(segment["metadata"].get("object_key") or "")
            qualifier = object_key.rsplit("::", 1)[-1] if "::" in object_key else ""
            qualifier_matches = bool(
                environment
                and normalize_title(qualifier) == normalize_title(environment["title"])
            )
            if not qualifier_matches:
                qualifier_mismatches.append(segment["stable_ref"])
            instances.append(
                {
                    "segment_id": segment["id"],
                    "segment_stable_ref": segment["stable_ref"],
                    "segment_public_id": segment["public_id"],
                    "segment_title": segment["title"],
                    "qualifier_from_object_key": qualifier,
                    "qualifier_matches_environment": qualifier_matches,
                    "environment_id": environment["id"] if environment else None,
                    "environment_stable_ref": (
                        environment["stable_ref"] if environment else None
                    ),
                    "environment_title": environment["title"] if environment else None,
                    "object_count": len(object_rows),
                    "object_stable_refs": [row["stable_ref"] for row in object_rows],
                    "object_titles": [row["title"] for row in object_rows],
                    "source_evidence_count": segment["source_evidence_count"],
                    "source_sheets": segment["source_sheets"],
                }
            )
        result.append(
            {
                "candidate_group_key": f"segment-title-group:{hashlib.sha256(normalized_title.encode('utf-8')).hexdigest()[:16]}",
                "normalized_title": normalized_title,
                "exact_titles": sorted(exact_titles),
                "context_instance_count": len(instances),
                "environment_count": len(environment_refs),
                "information_object_count": len(object_refs),
                "same_title_multi_context": len(instances) > 1,
                "normalization_collision": len(exact_titles) > 1,
                "qualifier_mismatch_count": len(qualifier_mismatches),
                "qualifier_mismatch_refs": qualifier_mismatches,
                "context_evidence_refs": sorted(evidence_refs),
                "decision": "hold",
                "decision_note": "P1只读同标题候选组；P2允许同名异义拆分或异名同义合并。",
                "instances": instances,
            }
        )
    return result


def user_reference_inventory(
    user_connection: sqlite3.Connection,
    base: dict[str, Any],
    basemap_semantic: dict[str, Any],
) -> dict[str, Any]:
    relevant_items = [
        item
        for item in base["items"]
        if item["type"]
        in ("information_environment", "environment_segment", "information_object")
    ]
    alias_to_item: dict[str, dict[str, Any]] = {}
    for item in relevant_items:
        aliases = {
            item["id"],
            item["stable_ref"],
            item["public_id"],
            f"{item['type']}:{item['id']}",
            f"{item['type']}:{item['stable_ref']}",
            f"{item['type']}:{item['public_id']}",
        }
        for alias in aliases:
            if alias:
                alias_to_item[alias] = item

    context_anchors = {}
    semantic_nodes = basemap_semantic.get("nodes")
    if isinstance(semantic_nodes, list):
        for node in semantic_nodes:
            if not isinstance(node, dict):
                continue
            object_id = str(node.get("objectId") or "")
            if not object_id.startswith("shadow:information_object_context:"):
                continue
            object_type = str(node.get("objectType") or "information_object")
            anchor = {
                "label": str(node.get("objectName") or node.get("label") or ""),
                "object_type": object_type,
                "context_labels": [
                    str(value)
                    for value in (node.get("contextLabels") or [])
                    if str(value).strip()
                ],
            }
            context_anchors[object_id] = anchor
            context_anchors[f"base:{object_type}:{object_id}"] = anchor

    applied_migration_history = {}
    migration_table_exists = user_connection.execute(
        """
        SELECT 1
        FROM sqlite_master
        WHERE type = 'table' AND name = 'user_target_ref_migrations'
        """
    ).fetchone()
    if migration_table_exists:
        for row in user_connection.execute(
            """
            SELECT old_target_ref, new_target_ref, redirect_type, status
            FROM user_target_ref_migrations
            WHERE status = 'applied'
            ORDER BY old_target_ref, new_target_ref
            """
        ):
            old_ref = str(row["old_target_ref"] or "")
            new_ref = str(row["new_target_ref"] or "")
            if old_ref and new_ref and (
                new_ref in alias_to_item or new_ref in context_anchors
            ):
                applied_migration_history[old_ref] = {
                    "new_reference": new_ref,
                    "redirect_type": str(row["redirect_type"] or ""),
                }

    tables = [
        str(row["name"])
        for row in user_connection.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        )
    ]
    scans = []
    relevant_matches = []
    resolved_context_anchors = []
    resolved_migration_history = []
    unresolved_domain_references = []
    domain_markers = (
        "information_environment",
        "environment_segment",
        "information_object",
    )
    for table in tables:
        columns = [
            str(row["name"])
            for row in user_connection.execute(f'PRAGMA table_info("{table}")')
        ]
        ref_columns = [
            column
            for column in columns
            if column == "target_ref"
            or column == "source_ref"
            or column.endswith("_target_ref")
            or column.endswith("_source_ref")
            or column in ("old_target_ref", "new_target_ref")
        ]
        for column in ref_columns:
            rows = user_connection.execute(
                f'''
                SELECT "{column}" AS ref_value, COUNT(*) AS occurrence_count
                FROM "{table}"
                WHERE "{column}" IS NOT NULL AND trim(CAST("{column}" AS TEXT)) != ''
                GROUP BY "{column}"
                ORDER BY "{column}"
                '''
            ).fetchall()
            scans.append(
                {
                    "table": table,
                    "column": column,
                    "distinct_value_count": len(rows),
                    "occurrence_count": sum(int(row["occurrence_count"]) for row in rows),
                }
            )
            for row in rows:
                value = str(row["ref_value"])
                count = int(row["occurrence_count"])
                matched = alias_to_item.get(value)
                if matched:
                    relevant_matches.append(
                        {
                            "table": table,
                            "column": column,
                            "reference": value,
                            "occurrence_count": count,
                            "matched_type": matched["type"],
                            "matched_stable_ref": matched["stable_ref"],
                            "match_kind": (
                                "stable_ref"
                                if value == matched["stable_ref"]
                                else "public_id"
                                if value == matched["public_id"]
                                else "legacy_or_typed_identity"
                            ),
                        }
                    )
                elif value in context_anchors:
                    anchor = context_anchors[value]
                    resolved_context_anchors.append(
                        {
                            "table": table,
                            "column": column,
                            "reference": value,
                            "occurrence_count": count,
                            "matched_type": "information_object_context",
                            "matched_label": anchor["label"],
                            "context_labels": anchor["context_labels"],
                            "match_kind": "current_basemap_context_anchor",
                        }
                    )
                elif (
                    table == "user_target_ref_migrations"
                    and column == "old_target_ref"
                    and value in applied_migration_history
                ):
                    migration = applied_migration_history[value]
                    resolved_migration_history.append(
                        {
                            "table": table,
                            "column": column,
                            "reference": value,
                            "occurrence_count": count,
                            "redirected_to": migration["new_reference"],
                            "redirect_type": migration["redirect_type"],
                            "match_kind": "applied_migration_history",
                        }
                    )
                elif any(marker in value for marker in domain_markers):
                    unresolved_domain_references.append(
                        {
                            "table": table,
                            "column": column,
                            "reference": value,
                            "occurrence_count": count,
                        }
                    )
    return {
        "scanned_reference_columns": scans,
        "relevant_matches": relevant_matches,
        "resolved_context_anchors": resolved_context_anchors,
        "resolved_migration_history": resolved_migration_history,
        "relevant_match_occurrences": sum(
            row["occurrence_count"]
            for row in (
                relevant_matches
                + resolved_context_anchors
                + resolved_migration_history
            )
        ),
        "unresolved_domain_references": unresolved_domain_references,
    }


def identity_inventory(base: dict[str, Any]) -> dict[str, Any]:
    relevant_items = [
        item
        for item in base["items"]
        if item["type"]
        in ("information_environment", "environment_segment", "information_object")
    ]
    missing = {
        field: [
            item["id"]
            for item in relevant_items
            if not str(item.get(field) or "").strip()
        ]
        for field in ("stable_key", "stable_ref", "public_id")
    }
    missing_codes = [
        item["id"] for item in relevant_items if not str(item.get("code") or "").strip()
    ]
    duplicates = {}
    for field in ("stable_key", "stable_ref", "public_id"):
        values = Counter(
            str(item.get(field) or "")
            for item in relevant_items
            if str(item.get(field) or "")
        )
        duplicates[field] = sorted(
            value for value, count in values.items() if count > 1
        )
    title_groups = defaultdict(list)
    for item in relevant_items:
        title_groups[(item["type"], normalize_title(item["title"]))].append(item["id"])
    duplicate_title_groups = [
        {
            "type": key[0],
            "normalized_title": key[1],
            "ids": sorted(ids),
            "count": len(ids),
        }
        for key, ids in sorted(title_groups.items())
        if len(ids) > 1
    ]
    zero_source_items = [
        item["stable_ref"]
        for item in relevant_items
        if item["source_evidence_count"] == 0
    ]
    return {
        "missing_identity_fields": missing,
        "missing_code_count": len(missing_codes),
        "missing_code_ids": missing_codes,
        "duplicate_identity_values": duplicates,
        "duplicate_title_groups": duplicate_title_groups,
        "zero_source_evidence_items": zero_source_items,
    }


def decision_manifest(
    base: dict[str, Any],
    groups: list[dict[str, Any]],
    generated_at: str,
    run_id: str,
    base_hash: str,
    workbench_hash: str,
) -> dict[str, Any]:
    entries = []
    for item in base["items"]:
        if item["type"] not in ("information_environment", "information_object"):
            continue
        entries.append(
            {
                "master_type": item["type"],
                "stable_ref": item["stable_ref"],
                "public_id": item["public_id"],
                "code": item["code"] or None,
                "canonical_title": item["title"],
                "aliases": [],
                "definition": item["description"] or None,
                "status": item["status"] or "active",
                "decision": "hold",
                "decision_note": "P1只读身份候选；P2确认复用并分配业务编号。",
                "context_evidence_refs": item["source_evidence_refs"],
            }
        )
    for group in groups:
        entries.append(
            {
                "master_type": "environment_segment_type",
                "stable_ref": None,
                "public_id": None,
                "code": None,
                "canonical_title": group["normalized_title"],
                "aliases": [],
                "definition": None,
                "status": "active",
                "decision": "hold",
                "decision_note": group["decision_note"],
                "context_evidence_refs": group["context_evidence_refs"],
            }
        )
    return {
        "schema_version": "environment-master-data-decision-manifest-v1",
        "run_id": run_id,
        "generated_at": generated_at,
        "source_baseline": {
            "database_sha256": base_hash,
            "environment_workbench_sha256": workbench_hash,
        },
        "entries": sorted(
            entries,
            key=lambda row: (row["master_type"], row["canonical_title"], row["stable_ref"] or ""),
        ),
    }


def build_markdown(report: dict[str, Any]) -> str:
    counts = report["counts"]
    blockers = report["gate"]["blockers"]
    warnings = report["gate"]["warnings"]
    groups = report["segment_title_groups"]
    lines = [
        "# PLAN-ENV-MD P1 只读盘点报告",
        "",
        f"- 运行ID：`{report['run_id']}`",
        f"- 生成时间：`{report['generated_at']}`",
        f"- 结论：`{report['gate']['result']}`",
        "- 写入边界：只生成本目录审计产物；基础库、用户库和正式前端包只读。",
        "",
        "## 基线数量",
        "",
        "| 粒度 | 数据库 | 环境包 | P0观察值 |",
        "|---|---:|---:|---:|",
        f"| 信息化环境 | {counts['database']['information_environments']} | {counts['package']['information_environments']} | 10 |",
        f"| 环境子类上下文 | {counts['database']['environment_segments']} | {counts['package']['environment_segments']} | 29 |",
        f"| 环境子类同标题候选组 | {counts['database']['segment_title_groups']} | — | 16 |",
        f"| 信息化对象 | {counts['database']['information_objects']} | {counts['package']['information_objects']} | 51 |",
        f"| 环境对象上下文 | {counts['database']['environment_object_contexts']} | {counts['package']['environment_object_contexts']} | 67 |",
        "",
        "## 身份、关系与证据",
        "",
        f"- stable key/ref/public id 缺失：`{report['identity']['missing_identity_total']}`。",
        f"- 业务编号空值：`{report['identity']['missing_code_count']}`，属于P2待分配项，不是P1数据丢失。",
        f"- segment → environment：`{counts['database']['segment_environment_relations']}`。",
        f"- object → segment/environment：`{counts['database']['object_context_relations']}`。",
        f"- 现有 `instance_of`：`{counts['database']['instance_of_relations']}`，P0/P1预期为0。",
        f"- 无来源证据对象：`{len(report['identity']['zero_source_evidence_items'])}`。",
        f"- 无来源证据上下文关系：`{report['relationships']['zero_source_evidence_relation_count']}`。",
        f"- 孤儿segment / 对象：`{len(report['relationships']['orphan_segments'])} / {len(report['relationships']['orphan_objects'])}`。",
        "",
        "## 环境子类同标题候选组",
        "",
        "| 候选标题 | 上下文 | 环境 | 对象 | P2动作 |",
        "|---|---:|---:|---:|---|",
    ]
    for group in groups:
        action = "逐上下文判断同名同义/异义"
        lines.append(
            f"| {group['normalized_title']} | {group['context_instance_count']} | "
            f"{group['environment_count']} | {group['information_object_count']} | {action} |"
        )
    lines.extend(
        [
            "",
            "说明：16是同标题候选组数，不是最终主数据数量或上限。P2允许同名异义拆分、异名同义合并，但29个现有segment上下文必须各自恰好归属一条类型。",
            "",
            "## 用户引用只读检查",
            "",
            f"- 扫描引用列：`{len(report['user_references']['scanned_reference_columns'])}`。",
            f"- 命中本域引用次数：`{report['user_references']['relevant_match_occurrences']}`。",
            f"- 当前环境基图上下文锚点：`{len(report['user_references']['resolved_context_anchors'])}`。",
            f"- 已应用迁移历史引用：`{len(report['user_references']['resolved_migration_history'])}`。",
            f"- 未解析本域引用：`{len(report['user_references']['unresolved_domain_references'])}`。",
            f"- 用户库哈希前后相同：`{str(report['input_integrity']['user_database_unchanged']).lower()}`。",
            "",
            "## 门禁",
            "",
        ]
    )
    if blockers:
        lines.append("### Blockers")
        lines.extend(f"- {item}" for item in blockers)
        lines.append("")
    else:
        lines.append("- Blockers：0")
        lines.append("")
    if warnings:
        lines.append("### Warnings / P2待决")
        lines.extend(f"- {item}" for item in warnings)
        lines.append("")
    lines.extend(
        [
            "## 下一步",
            "",
            "P1只读盘点完成后，仅可进入P2业务裁定与dry-run；不得直接写正式库或替换正式数据包。",
            "",
        ]
    )
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PLAN-ENV-MD P1 read-only inventory. Writes reports only."
    )
    parser.add_argument("--base-db", type=Path, default=DEFAULT_BASE_DB)
    parser.add_argument("--user-db", type=Path, default=DEFAULT_USER_DB)
    parser.add_argument("--workbench", type=Path, default=DEFAULT_WORKBENCH)
    parser.add_argument(
        "--environment-basemap-semantic",
        type=Path,
        default=DEFAULT_BASEMAP_SEMANTIC,
    )
    parser.add_argument("--contract", type=Path, default=DEFAULT_CONTRACT)
    parser.add_argument("--output-dir", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    started = utc_now()
    run_id = f"p1-{started.strftime('%Y%m%dT%H%M%SZ')}"
    output_dir = (
        args.output_dir.resolve()
        if args.output_dir
        else (DEFAULT_OUTPUT_ROOT / run_id).resolve()
    )
    output_dir.mkdir(parents=True, exist_ok=False)

    base_path = args.base_db.resolve()
    user_path = args.user_db.resolve()
    workbench_path = args.workbench.resolve()
    basemap_semantic_path = args.environment_basemap_semantic.resolve()
    contract_path = args.contract.resolve()
    for required in (
        base_path,
        user_path,
        workbench_path,
        basemap_semantic_path,
        contract_path,
    ):
        if not required.is_file():
            raise FileNotFoundError(required)

    input_hashes_before = {
        "base_database": sha256_file(base_path),
        "user_database": sha256_file(user_path),
        "environment_workbench": sha256_file(workbench_path),
        "environment_basemap_semantic": sha256_file(basemap_semantic_path),
        "p0_contract": sha256_file(contract_path),
    }
    contract = read_json(contract_path)
    workbench = read_json(workbench_path)
    basemap_semantic = read_json(basemap_semantic_path)

    with connect_read_only(base_path) as base_connection:
        base = load_base_inventory(base_connection)
        context = build_context_inventory(base)
    with connect_read_only(user_path) as user_connection:
        user_references = user_reference_inventory(
            user_connection,
            base,
            basemap_semantic,
        )

    package = package_inventory(workbench)
    parity = parity_inventory(base, context, package)
    groups = candidate_groups(base, context)
    identity = identity_inventory(base)

    counts_by_type = Counter(item["type"] for item in base["items"])
    package_counts = {
        item_type: len(package["ids_by_type"][item_type])
        for item_type in package["ids_by_type"]
    }
    segment_environment_relations = [
        relation
        for relation in context["preserved_relations"]
        if relation["source_type"] == "environment_segment"
    ]
    object_context_relations = [
        relation
        for relation in context["preserved_relations"]
        if relation["source_type"] == "information_object"
    ]
    zero_source_relations = [
        relation["stable_ref"] or relation["id"]
        for relation in context["preserved_relations"]
        if relation["source_evidence_count"] == 0
    ]

    blockers = []
    for item_type, differences in parity["id_differences"].items():
        if differences["missing_from_package"] or differences["extra_in_package"]:
            blockers.append(f"{item_type} 的数据库与环境包ID集合不一致")
    if parity["title_mismatches"]:
        blockers.append("数据库与环境包存在标题不一致")
    if parity["contexts_missing_from_package"] or parity["contexts_extra_in_package"]:
        blockers.append("数据库与环境包的环境对象上下文不一致")
    if parity["package_duplicate_context_count"]:
        blockers.append("环境包存在重复环境对象上下文")
    if parity["missing_object_evidence_refs"]:
        blockers.append("环境包对象引用了不存在的 evidenceRef")
    if context["orphan_segments"]:
        blockers.append("存在未归属信息化环境的segment")
    if context["orphan_objects"]:
        blockers.append("存在未归属segment/环境的信息化对象")
    if context["multi_environment_segments"]:
        blockers.append("存在未恰好归属一个环境的segment")
    if context["invalid_relation_endpoints"]:
        blockers.append("存在无法解析端点的保留关系")
    if any(identity["missing_identity_fields"].values()):
        blockers.append("现有环境主数据/上下文存在缺失stable identity")
    if any(identity["duplicate_identity_values"].values()):
        blockers.append("现有环境主数据/上下文存在重复stable identity")
    if identity["zero_source_evidence_items"]:
        blockers.append("存在没有来源证据的环境主数据/上下文")
    if zero_source_relations:
        blockers.append("存在没有来源证据的环境上下文关系")
    qualifier_mismatch_count = sum(
        group["qualifier_mismatch_count"] for group in groups
    )
    if qualifier_mismatch_count:
        blockers.append("segment object_key qualifier 与实际环境关系不一致")
    if user_references["unresolved_domain_references"]:
        blockers.append("用户库存在无法解析的信息化环境域引用")

    expected_counts = {
        "information_environment": 10,
        "environment_segment": 29,
        "information_object": 51,
        "environment_object_context": 67,
        "segment_title_groups": 16,
    }
    actual_counts = {
        "information_environment": counts_by_type["information_environment"],
        "environment_segment": counts_by_type["environment_segment"],
        "information_object": counts_by_type["information_object"],
        "environment_object_context": len(context["contexts"]),
        "segment_title_groups": len(groups),
    }
    if actual_counts != expected_counts:
        blockers.append(
            f"P0观察数量不一致：expected={expected_counts}, actual={actual_counts}"
        )
    if counts_by_type["environment_segment_type"] != 0:
        blockers.append("P1前正式库已存在environment_segment_type，超出已授权阶段")
    if context["instance_of_relations"]:
        blockers.append("P1前正式库已存在instance_of，超出已授权阶段")

    warnings = [
        f"{identity['missing_code_count']}条现有环境/segment/对象记录尚无业务编号，留待P2分配。",
        f"{len(groups)}个同标题候选组必须在P2逐条判断合并或拆分。",
        "P1不把同标题自动判为同一主数据，也不生成正式environment_segment_type身份。",
    ]
    if identity["duplicate_title_groups"]:
        warnings.append(
            f"现有上下文包含{len(identity['duplicate_title_groups'])}个重复标题组；这是候选证据，不是错误。"
        )

    input_hashes_after = {
        "base_database": sha256_file(base_path),
        "user_database": sha256_file(user_path),
        "environment_workbench": sha256_file(workbench_path),
        "environment_basemap_semantic": sha256_file(basemap_semantic_path),
        "p0_contract": sha256_file(contract_path),
    }
    if input_hashes_before != input_hashes_after:
        blockers.append("P1读取期间输入文件哈希发生变化，可能存在并发写者")

    generated_at = iso_utc(utc_now())
    report = {
        "schema_version": "environment-master-data-p1-inventory-v1",
        "run_id": run_id,
        "generated_at": generated_at,
        "p0_contract_id": contract.get("contract_id"),
        "input_integrity": {
            "hashes_before": input_hashes_before,
            "hashes_after": input_hashes_after,
            "base_database_unchanged": input_hashes_before["base_database"]
            == input_hashes_after["base_database"],
            "user_database_unchanged": input_hashes_before["user_database"]
            == input_hashes_after["user_database"],
            "environment_workbench_unchanged": input_hashes_before[
                "environment_workbench"
            ]
            == input_hashes_after["environment_workbench"],
            "environment_basemap_semantic_unchanged": input_hashes_before[
                "environment_basemap_semantic"
            ]
            == input_hashes_after["environment_basemap_semantic"],
        },
        "counts": {
            "database": {
                "information_environments": counts_by_type["information_environment"],
                "environment_segments": counts_by_type["environment_segment"],
                "segment_title_groups": len(groups),
                "information_objects": counts_by_type["information_object"],
                "environment_object_contexts": len(context["contexts"]),
                "segment_environment_relations": len(segment_environment_relations),
                "object_context_relations": len(object_context_relations),
                "environment_segment_types": counts_by_type[
                    "environment_segment_type"
                ],
                "instance_of_relations": len(context["instance_of_relations"]),
            },
            "package": {
                "information_environments": package_counts["information_environment"],
                "environment_segments": package_counts["environment_segment"],
                "information_objects": package_counts["information_object"],
                "environment_object_contexts": len(package["context_set"]),
            },
        },
        "identity": {
            **identity,
            "missing_identity_total": sum(
                len(values) for values in identity["missing_identity_fields"].values()
            ),
        },
        "relationships": {
            "orphan_segments": context["orphan_segments"],
            "orphan_objects": context["orphan_objects"],
            "multi_environment_segments": context["multi_environment_segments"],
            "invalid_relation_endpoints": context["invalid_relation_endpoints"],
            "zero_source_evidence_relations": zero_source_relations,
            "zero_source_evidence_relation_count": len(zero_source_relations),
            "qualifier_mismatch_count": qualifier_mismatch_count,
        },
        "package_parity": parity,
        "segment_title_groups": groups,
        "user_references": user_references,
        "gate": {
            "result": (
                "ready_for_p2_adjudication"
                if not blockers
                else "blocked_before_p2"
            ),
            "blockers": blockers,
            "warnings": warnings,
            "formal_apply_authorized": False,
        },
    }

    master_rows = []
    for item in base["items"]:
        if item["type"] not in (
            "information_environment",
            "environment_segment",
            "information_object",
        ):
            continue
        master_rows.append(
            {
                "type": item["type"],
                "id": item["id"],
                "stable_key": item["stable_key"],
                "stable_ref": item["stable_ref"],
                "public_id": item["public_id"],
                "code": item["code"],
                "title": item["title"],
                "status": item["status"],
                "source_evidence_count": item["source_evidence_count"],
                "source_sheets": item["source_sheets"],
                "object_key": item["metadata"].get("object_key"),
            }
        )
    relationship_rows = []
    for relation in context["preserved_relations"]:
        relationship_rows.append(
            {
                "relation_type": relation["relation_type"],
                "id": relation["id"],
                "stable_ref": relation["stable_ref"],
                "public_id": relation["public_id"],
                "source_type": relation["source_type"],
                "source_id": relation["source_item_id"],
                "source_stable_ref": relation["source_stable_ref"],
                "source_title": relation["source_title"],
                "target_type": relation["target_type"],
                "target_id": relation["target_item_id"],
                "target_stable_ref": relation["target_stable_ref"],
                "target_title": relation["target_title"],
                "source_evidence_count": relation["source_evidence_count"],
                "source_sheets": relation["source_sheets"],
            }
        )
    group_rows = []
    for group in groups:
        group_rows.append(
            {
                "candidate_group_key": group["candidate_group_key"],
                "normalized_title": group["normalized_title"],
                "exact_titles": group["exact_titles"],
                "context_instance_count": group["context_instance_count"],
                "environment_count": group["environment_count"],
                "information_object_count": group["information_object_count"],
                "same_title_multi_context": group["same_title_multi_context"],
                "normalization_collision": group["normalization_collision"],
                "qualifier_mismatch_count": group["qualifier_mismatch_count"],
                "environment_titles": sorted(
                    {
                        instance["environment_title"]
                        for instance in group["instances"]
                        if instance["environment_title"]
                    }
                ),
                "segment_stable_refs": [
                    instance["segment_stable_ref"] for instance in group["instances"]
                ],
                "decision": group["decision"],
                "decision_note": group["decision_note"],
            }
        )

    decision = decision_manifest(
        base,
        groups,
        generated_at,
        run_id,
        input_hashes_before["base_database"],
        input_hashes_before["environment_workbench"],
    )
    write_json(output_dir / "p1-inventory.json", report)
    (output_dir / "p1-inventory.md").write_text(
        build_markdown(report), encoding="utf-8"
    )
    write_json(output_dir / "user-reference-audit.json", user_references)
    write_json(
        output_dir / "master-data-decision-manifest.p1.json",
        decision,
    )
    write_csv(
        output_dir / "master-object-ledger.csv",
        [
            "type",
            "id",
            "stable_key",
            "stable_ref",
            "public_id",
            "code",
            "title",
            "status",
            "source_evidence_count",
            "source_sheets",
            "object_key",
        ],
        master_rows,
    )
    write_csv(
        output_dir / "relationship-ledger.csv",
        [
            "relation_type",
            "id",
            "stable_ref",
            "public_id",
            "source_type",
            "source_id",
            "source_stable_ref",
            "source_title",
            "target_type",
            "target_id",
            "target_stable_ref",
            "target_title",
            "source_evidence_count",
            "source_sheets",
        ],
        relationship_rows,
    )
    write_csv(
        output_dir / "environment-segment-title-groups.csv",
        [
            "candidate_group_key",
            "normalized_title",
            "exact_titles",
            "context_instance_count",
            "environment_count",
            "information_object_count",
            "same_title_multi_context",
            "normalization_collision",
            "qualifier_mismatch_count",
            "environment_titles",
            "segment_stable_refs",
            "decision",
            "decision_note",
        ],
        group_rows,
    )
    output_files = sorted(
        path.name for path in output_dir.iterdir() if path.is_file()
    )
    manifest = {
        "schema_version": "environment-master-data-p1-output-manifest-v1",
        "run_id": run_id,
        "generated_at": generated_at,
        "result": report["gate"]["result"],
        "formal_apply_authorized": False,
        "input_hashes": input_hashes_after,
        "output_files": output_files,
    }
    write_json(output_dir / "manifest.json", manifest)

    print(
        json.dumps(
            {
                "result": report["gate"]["result"],
                "run_id": run_id,
                "output_dir": str(output_dir),
                "counts": report["counts"],
                "blocker_count": len(blockers),
                "warning_count": len(warnings),
                "input_integrity": report["input_integrity"],
                "formal_apply_authorized": False,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0 if not blockers else 2


if __name__ == "__main__":
    raise SystemExit(main())
