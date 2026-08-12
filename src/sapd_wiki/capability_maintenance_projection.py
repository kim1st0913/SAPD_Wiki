"""SQLite-owned projections for capability and maintenance Batch 1 surfaces."""

from __future__ import annotations

import hashlib
import re
from collections import defaultdict
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from .local_mcp.base_query_service import BaseKnowledgeRepository
from .local_mcp.readonly_runtime import FormalBaseRuntimeContext
from .projection_contract import (
    UI_PROJECTION_SUITE_VERSION,
    ProjectionIdentity,
    SemanticDigestError,
    semantic_digest,
)


CAPABILITY_TYPES = (
    "capability_category",
    "capability_domain",
    "capability",
    "capability_focus",
)
MAINTENANCE_TYPES = (
    "scope_type",
    "security_technical_service",
    "security_technology_module",
    "security_technical_measure",
    "security_system",
    "product",
    "security_work",
    "process_domain",
    "process_group",
    "process_reference",
    "work_function_layer",
    "work_function_group",
    "work_function",
    "work_task",
    "gbt_42446_task_reference",
    "work_role_reference",
    "standard_framework",
    "standard_control",
    "lifecycle_process",
)
RELATION_TYPES = (
    "belongs_to",
    "belongs_to_layer",
    "supports_focus",
    "applies_to_scope",
    "no_service_in_scope",
    "implements_service",
    "maps_to_work",
    "maps_to_process",
    "stakeholder_by",
    "performs_task",
    "maps_to_gbt_task",
    "part_of_system",
    "maps_to_product",
    "uses_measure",
)
CAPABILITY_OBJECT_TYPE_ALIASES = {
    "category": "capability_category",
    "capability_category": "capability_category",
    "domain": "capability_domain",
    "capability_domain": "capability_domain",
    "capability": "capability",
    "focus": "capability_focus",
    "capability_focus": "capability_focus",
}
FOCUS_CODE_PATTERN = re.compile(r"\b[TGM]-[A-Z]{2}\.[A-Z]{2}-\d{2}\b")
SERVICE_CODE_PATTERN = re.compile(r"\b(?:ALL|I-[A-Z]{2})&[TGM]-[A-Z]{2}\.[A-Z]{2}-\d{2}\b")
SEMANTIC_RELATION_IDENTITY_FIELDS = (
    "relation_type",
    "source_ref",
    "target_ref",
    "relation_ref",
)


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _metadata(item: dict[str, Any]) -> dict[str, Any]:
    value = item.get("business_metadata")
    return value if isinstance(value, dict) else {}


def _stable_measure_id(item: dict[str, Any]) -> str:
    """Reuse the existing exporter identity formula without exposing DB UUID drift."""

    title = _text(item.get("display_name"))
    category = _text(item.get("category") or _metadata(item).get("category"))
    digest = hashlib.sha1(f"{title}\0{category}".encode("utf-8")).hexdigest()[:16]
    return f"security_technical_measure:{digest}"


def _projection_id(item: dict[str, Any]) -> str:
    if item.get("object_type") == "security_technical_measure":
        return _stable_measure_id(item)
    return _text(item.get("id"))


def _target_ref(item: dict[str, Any]) -> str:
    return f"{item['object_type']}:{_projection_id(item)}"


def _project_object(item: dict[str, Any]) -> dict[str, Any]:
    projected = {
        "id": _projection_id(item),
        "record_id": _text(item.get("id")),
        "canonical_ref": _text(item.get("canonical_ref")),
        "type": _text(item.get("object_type")),
        "object_type": _text(item.get("object_type")),
        "code": _text(item.get("code")),
        "title": _text(item.get("display_name")),
        "name": _text(item.get("display_name")),
        "description": _text(item.get("description")),
        "category": _text(item.get("category")),
        "status": _text(item.get("status")),
        "targetRef": _target_ref(item),
    }
    return projected


def _sort_order(item: dict[str, Any]) -> tuple[int, str, str]:
    raw = _metadata(item).get("tree_order")
    try:
        order = int(raw)
    except (TypeError, ValueError):
        order = 1_000_000
    return (order, _text(item.get("code")), _text(item.get("display_name")))


def _relation_triple(
    relation_type: str,
    source: dict[str, Any],
    target: dict[str, Any],
    *,
    confidence: str = "exact",
    owner: str = "knowledge_relations",
    derivation: str | None = None,
) -> dict[str, Any]:
    source_ref = _text(source.get("canonical_ref"))
    target_ref = _text(target.get("canonical_ref"))
    return {
        "relation_ref": f"projection:{relation_type}:{source_ref}->{target_ref}",
        "relation_type": relation_type,
        "source_ref": source_ref,
        "target_ref": target_ref,
        "source_id": _projection_id(source),
        "target_id": _projection_id(target),
        "source_type": _text(source.get("object_type")),
        "target_type": _text(target.get("object_type")),
        "confidence": confidence,
        "owner": owner,
        "derivation": derivation
        or (
            "metadata-derived"
            if owner.startswith("standard_control.metadata_json")
            else "physical"
        ),
    }


def _deduplicate_semantic_relations(
    relations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Preserve first occurrence while rejecting conflicting stable identities."""

    unique: list[dict[str, Any]] = []
    by_identity: dict[tuple[str, ...], dict[str, Any]] = {}
    for relation in relations:
        identity = tuple(
            _text(relation.get(field))
            for field in SEMANTIC_RELATION_IDENTITY_FIELDS
        )
        if identity not in by_identity:
            by_identity[identity] = relation
            unique.append(relation)
            continue
        if by_identity[identity] != relation:
            raise SemanticDigestError(
                "conflicting duplicate semantic relation identity: "
                + repr(identity)
            )
    return unique


class CapabilityMaintenanceProjectionService:
    """Lazy, process-cacheable projection over one immutable formal base DB."""

    def __init__(
        self,
        *,
        base_database: Path,
        identity: ProjectionIdentity,
    ) -> None:
        self._base_database = Path(base_database)
        self._identity = identity
        self._snapshot: dict[str, Any] | None = None

    def _load_snapshot(self) -> dict[str, Any]:
        if self._snapshot is not None:
            return self._snapshot
        with FormalBaseRuntimeContext(base_database=self._base_database) as runtime:
            repository = BaseKnowledgeRepository(runtime)
            items = repository.list_base_objects(
                object_types=CAPABILITY_TYPES + MAINTENANCE_TYPES,
            )
            relations = repository.list_base_relations(
                relation_types=RELATION_TYPES,
            )
            lcdt_sources = repository.controlled_lcdt_measure_sources()
        by_ref = {_text(item.get("canonical_ref")): item for item in items}
        by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)
        by_type_id: dict[tuple[str, str], dict[str, Any]] = {}
        by_type_code: dict[tuple[str, str], dict[str, Any]] = {}
        for item in items:
            object_type = _text(item.get("object_type"))
            by_type[object_type].append(item)
            by_type_id[(object_type, _projection_id(item))] = item
            by_type_id[(object_type, _text(item.get("id")))] = item
            if item.get("code"):
                by_type_code[(object_type, _text(item.get("code")))] = item
        outgoing: dict[str, list[dict[str, Any]]] = defaultdict(list)
        incoming: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for relation in relations:
            outgoing[_text(relation.get("source_ref"))].append(relation)
            incoming[_text(relation.get("target_ref"))].append(relation)
        self._snapshot = {
            "items": items,
            "by_ref": by_ref,
            "by_type": by_type,
            "by_type_id": by_type_id,
            "by_type_code": by_type_code,
            "relations": relations,
            "outgoing": outgoing,
            "incoming": incoming,
            "lcdt_sources": lcdt_sources,
        }
        return self._snapshot

    def _envelope(
        self,
        data: dict[str, Any],
        *,
        semantic_objects: list[dict[str, Any]],
        semantic_relations: list[dict[str, Any]],
        ordered_sequence: list[dict[str, Any]],
        counts: dict[str, int],
        target_ref: str = "",
    ) -> dict[str, Any]:
        semantic_payload = {
            "targetRef": target_ref,
            "objects": semantic_objects,
            "relations": semantic_relations,
            "ordered_sequence": ordered_sequence,
            "counts": counts,
        }
        return {
            "contract_version": UI_PROJECTION_SUITE_VERSION,
            "identity": self._identity.to_dict(),
            "data": data,
            "semantic_digest": semantic_digest(
                semantic_payload,
                unordered_collections={
                    "objects": ("canonical_ref",),
                    "relations": SEMANTIC_RELATION_IDENTITY_FIELDS,
                },
                ordered_collections={
                    "ordered_sequence": ("position", "canonical_ref"),
                },
            ),
        }

    @staticmethod
    def _node(item: dict[str, Any], children: list[dict[str, Any]]) -> dict[str, Any]:
        projected = _project_object(item)
        return {
            "id": projected["id"],
            "type": projected["type"],
            "code": projected["code"],
            "name": projected["title"],
            "title": projected["title"],
            "description": projected["description"],
            "targetRef": projected["targetRef"],
            "children": children,
        }

    def _capability_catalog_parts(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        snapshot = self._load_snapshot()
        by_ref = snapshot["by_ref"]
        parent_by_child: dict[str, str] = {}
        semantic_relations: list[dict[str, Any]] = []
        for relation in snapshot["relations"]:
            source = by_ref.get(relation.get("source_ref"))
            target = by_ref.get(relation.get("target_ref"))
            if (
                relation.get("relation_type") == "belongs_to"
                and source
                and target
                and source.get("object_type") in CAPABILITY_TYPES[1:]
                and target.get("object_type") in CAPABILITY_TYPES[:-1]
            ):
                parent_by_child[source["canonical_ref"]] = target["canonical_ref"]
                semantic_relations.append(
                    _relation_triple("belongs_to", source, target)
                )
        children_by_parent: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in snapshot["items"]:
            parent_ref = parent_by_child.get(item.get("canonical_ref"))
            if parent_ref:
                children_by_parent[parent_ref].append(item)

        def build(item: dict[str, Any]) -> dict[str, Any]:
            children = sorted(
                children_by_parent.get(item["canonical_ref"], []),
                key=_sort_order,
            )
            return self._node(item, [build(child) for child in children])

        categories = sorted(snapshot["by_type"]["capability_category"], key=_sort_order)
        tree = [build(category) for category in categories]
        objects = [
            _project_object(item)
            for object_type in CAPABILITY_TYPES
            for item in sorted(snapshot["by_type"][object_type], key=_sort_order)
        ]
        return tree, objects, semantic_relations

    def capability_catalog(self) -> dict[str, Any]:
        tree, objects, relations = self._capability_catalog_parts()
        actual = defaultdict(int)
        for item in objects:
            actual[item["type"]] += 1
        counts = {object_type: actual[object_type] for object_type in CAPABILITY_TYPES}
        ordered = [
            {"position": position, "canonical_ref": item["canonical_ref"]}
            for position, item in enumerate(objects, start=1)
        ]
        data = {
            "data_state": "ready",
            "meta": {"stats": counts},
            "page": {"route": "/capability-mapping", "title": "安全能力映射"},
            "navigator": {"tree": tree},
            "overview": {"object_type": "capability_object", "stats": counts},
            "relationshipGroups": [],
            "objects": objects,
            "relations": relations,
            "evidenceRefs": [],
            "selected": None,
            "compatibility": {
                "mode": "sqlite_projection",
                "warnings": [],
            },
            "technicalMappingRows": [],
            "managementMappingRows": [],
            "standardMappingRows": [],
            "localRelationMap": None,
            "localRelationMaps": [],
            "localRelationMapsByFocusId": {},
            "stats": counts,
        }
        return self._envelope(
            data,
            semantic_objects=objects,
            semantic_relations=relations,
            ordered_sequence=ordered,
            counts=counts,
        )

    def _resolve_capability(
        self,
        *,
        object_type: str,
        object_id: str,
        code: str = "",
    ) -> dict[str, Any]:
        snapshot = self._load_snapshot()
        normalized_type = CAPABILITY_OBJECT_TYPE_ALIASES.get(_text(object_type), "")
        if not normalized_type:
            raise ValueError("object_type is invalid")
        selected = snapshot["by_type_id"].get((normalized_type, _text(object_id)))
        if selected is None and code:
            selected = snapshot["by_type_code"].get((normalized_type, _text(code)))
        if selected is None:
            raise KeyError(f"{normalized_type}:{object_id or code}")
        if code and _text(selected.get("code")) != _text(code):
            raise KeyError(f"{normalized_type}:{object_id}:{code}")
        return selected

    def _descendant_focuses(self, selected: dict[str, Any]) -> list[dict[str, Any]]:
        snapshot = self._load_snapshot()
        if selected.get("object_type") == "capability_focus":
            return [selected]
        child_types = {
            "capability_category": "capability_domain",
            "capability_domain": "capability",
            "capability": "capability_focus",
        }
        current = [selected]
        while current and current[0].get("object_type") != "capability_focus":
            child_type = child_types[current[0]["object_type"]]
            parent_refs = {item["canonical_ref"] for item in current}
            child_refs = {
                relation["source_ref"]
                for relation in snapshot["relations"]
                if relation.get("relation_type") == "belongs_to"
                and relation.get("target_ref") in parent_refs
            }
            current = [
                snapshot["by_ref"][ref]
                for ref in child_refs
                if ref in snapshot["by_ref"]
                and snapshot["by_ref"][ref].get("object_type") == child_type
            ]
        return sorted(current, key=_sort_order)

    def _relation_targets(
        self,
        source: dict[str, Any],
        relation_type: str,
        target_type: str,
    ) -> list[dict[str, Any]]:
        snapshot = self._load_snapshot()
        result = []
        for relation in snapshot["outgoing"].get(source["canonical_ref"], []):
            if relation.get("relation_type") != relation_type:
                continue
            target = snapshot["by_ref"].get(relation.get("target_ref"))
            if target and target.get("object_type") == target_type:
                result.append(target)
        return sorted(result, key=lambda item: (_text(item.get("code")), _text(item.get("display_name"))))

    def _relation_sources(
        self,
        target: dict[str, Any],
        relation_type: str,
        source_type: str,
    ) -> list[dict[str, Any]]:
        snapshot = self._load_snapshot()
        result = []
        for relation in snapshot["incoming"].get(target["canonical_ref"], []):
            if relation.get("relation_type") != relation_type:
                continue
            source = snapshot["by_ref"].get(relation.get("source_ref"))
            if source and source.get("object_type") == source_type:
                result.append(source)
        return sorted(result, key=lambda item: (_text(item.get("code")), _text(item.get("display_name"))))

    def _measure_service_pairs(self) -> set[tuple[str, str]]:
        snapshot = self._load_snapshot()
        services = {item["id"]: item for item in snapshot["by_type"]["security_technical_service"]}
        measures = snapshot["by_type"]["security_technical_measure"]
        measure_by_title = {_text(item.get("display_name")): item for item in measures}
        pairs: set[tuple[str, str]] = set()
        for measure in measures:
            for service_id in _metadata(measure).get("related_service_ids") or []:
                service = services.get(_text(service_id))
                if service:
                    pairs.add((service["canonical_ref"], measure["canonical_ref"]))

        # LC-AP: the existing controlled rule reads exact services from the
        # lifecycle process metadata on a physical uses_measure relation.
        for relation in snapshot["relations"]:
            if relation.get("relation_type") != "uses_measure":
                continue
            process = snapshot["by_ref"].get(relation.get("source_ref"))
            measure = snapshot["by_ref"].get(relation.get("target_ref"))
            if not process or not measure:
                continue
            if process.get("object_type") == "security_technical_service":
                pairs.add((process["canonical_ref"], measure["canonical_ref"]))
                continue
            metadata = _metadata(process)
            if metadata.get("lifecycle_type") != "application_security_development":
                continue
            fields = metadata.get("original_business_fields") or {}
            for code in SERVICE_CODE_PATTERN.findall(_text(fields.get("安全技术服务"))):
                service = snapshot["by_type_code"].get(("security_technical_service", code))
                if service:
                    pairs.add((service["canonical_ref"], measure["canonical_ref"]))

        # LC-DT: preserve the existing single-service/single-measure row rule,
        # but read its cells from formal source_references instead of Excel.
        by_row: dict[int, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
        for row in snapshot["lcdt_sources"]:
            by_row[row["source_row"]][row["source_column"]].add(row["raw_value"])
        for values in by_row.values():
            service_codes = {
                code
                for value in values.get("安全技术服务", set())
                for code in SERVICE_CODE_PATTERN.findall(value)
            }
            measure_refs = {
                measure_by_title[value]["canonical_ref"]
                for value in values.get("安全技术模块", set())
                if value in measure_by_title
            }
            if len(service_codes) != 1 or len(measure_refs) != 1:
                continue
            service = snapshot["by_type_code"].get(
                ("security_technical_service", next(iter(service_codes)))
            )
            measure = snapshot["by_ref"][next(iter(measure_refs))]
            if service:
                pairs.add((service["canonical_ref"], measure["canonical_ref"]))
        return pairs

    def _standard_rows(self, focuses: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        snapshot = self._load_snapshot()
        focus_by_code = {_text(item.get("code")): item for item in focuses}
        frameworks = {
            _text(item.get("code")): item
            for item in snapshot["by_type"]["standard_framework"]
            if item.get("code")
        }
        controls_by_focus: dict[str, list[dict[str, Any]]] = defaultdict(list)
        semantic_relations: list[dict[str, Any]] = []
        for control in snapshot["by_type"]["standard_control"]:
            metadata = _metadata(control)
            for focus_code in dict.fromkeys(
                FOCUS_CODE_PATTERN.findall(
                    _text(metadata.get("related_capability_focus"))
                )
            ):
                focus = focus_by_code.get(focus_code)
                if not focus:
                    continue
                projected = _project_object(control)
                projected.update(
                    {
                        "frameworkCode": _text(metadata.get("framework_code")),
                        "frameworkTitle": _text(metadata.get("framework_title")),
                        "originalControlId": _text(metadata.get("original_control_id")),
                    }
                )
                controls_by_focus[focus_code].append(projected)
                semantic_relations.append(
                    _relation_triple(
                        "maps_to_standard",
                        focus,
                        control,
                        confidence="derived",
                        owner="standard_control.metadata_json.related_capability_focus",
                    )
                )
        rows: list[dict[str, Any]] = []
        for focus in focuses:
            focus_code = _text(focus.get("code"))
            controls = sorted(
                controls_by_focus.get(focus_code, []),
                key=lambda item: (item.get("frameworkCode", ""), item.get("code", "")),
            )
            framework_codes = dict.fromkeys(
                control["frameworkCode"] for control in controls if control["frameworkCode"]
            )
            standard_items = []
            for code in framework_codes:
                framework = frameworks.get(code)
                standard_items.append(
                    _project_object(framework)
                    if framework
                    else {"id": code, "code": code, "title": code, "name": code}
                )
            rows.append(
                {
                    "id": f"{_projection_id(focus)}:standard",
                    "focus": _project_object(focus),
                    "standards": standard_items,
                    "controls": controls,
                    "dataSource": "sqlite-metadata-projection",
                }
            )
        return rows, semantic_relations

    def capability_view(
        self,
        *,
        object_type: str,
        object_id: str,
        code: str = "",
    ) -> dict[str, Any]:
        snapshot = self._load_snapshot()
        selected = self._resolve_capability(
            object_type=object_type,
            object_id=object_id,
            code=code,
        )
        focuses = self._descendant_focuses(selected)
        focus_ids = {_projection_id(item) for item in focuses}
        measure_pairs = self._measure_service_pairs()
        technical_rows: list[dict[str, Any]] = []
        management_rows: list[dict[str, Any]] = []
        semantic_objects: dict[str, dict[str, Any]] = {
            item["canonical_ref"]: _project_object(item) for item in focuses
        }
        semantic_relations: list[dict[str, Any]] = []
        work_functions_by_focus: dict[str, list[dict[str, Any]]] = defaultdict(list)

        for focus in focuses:
            services = self._relation_sources(
                focus, "supports_focus", "security_technical_service"
            )
            service_scope_codes: set[str] = set()
            for service in services:
                scopes = self._relation_targets(service, "applies_to_scope", "scope_type")
                modules = self._relation_sources(
                    service, "implements_service", "security_technology_module"
                )
                measures = [
                    snapshot["by_ref"][measure_ref]
                    for service_ref, measure_ref in measure_pairs
                    if service_ref == service["canonical_ref"]
                ]
                for item in [service, *scopes, *modules, *measures]:
                    semantic_objects[item["canonical_ref"]] = _project_object(item)
                semantic_relations.append(_relation_triple("supports_focus", service, focus))
                for scope in scopes:
                    scope_code = _text(scope.get("code"))
                    if scope_code not in service_scope_codes:
                        semantic_relations.append(
                            _relation_triple(
                                "applies_to_scope",
                                focus,
                                scope,
                                confidence="derived",
                                owner="exports.authoritative_scope_id_for_service",
                                derivation="controlled-rule-derived",
                            )
                        )
                    service_scope_codes.add(scope_code)
                    semantic_relations.append(_relation_triple("applies_to_scope", service, scope))
                for module in modules:
                    semantic_relations.append(
                        _relation_triple("implemented_by_module", service, module)
                    )
                for measure in measures:
                    semantic_relations.append(
                        _relation_triple(
                            "has_measure",
                            service,
                            measure,
                            confidence="derived",
                            owner="controlled measure projection",
                        )
                    )
                for scope in scopes or [None]:
                    technical_rows.append(
                        {
                            "focus": _project_object(focus),
                            "scope": _project_object(scope) if scope else None,
                            "services": [_project_object(service)],
                            "candidateServices": [_project_object(service)],
                            "technologyModules": [_project_object(item) for item in modules],
                            "technicalMeasures": [_project_object(item) for item in measures],
                            "modules": [
                                *[_project_object(item) for item in modules],
                                *[_project_object(item) for item in measures],
                            ],
                            "serviceCount": 1,
                            "status": "covered",
                            "exceptionType": "",
                            "exceptionMessage": "",
                            "isExplicitNoService": False,
                        }
                    )
            no_service_scopes = self._relation_targets(
                focus, "no_service_in_scope", "scope_type"
            )
            for scope in no_service_scopes:
                if _text(scope.get("code")) in service_scope_codes:
                    continue
                semantic_objects[scope["canonical_ref"]] = _project_object(scope)
                semantic_relations.append(_relation_triple("applies_to_scope", focus, scope))
                technical_rows.append(
                    {
                        "focus": _project_object(focus),
                        "scope": _project_object(scope),
                        "services": [],
                        "candidateServices": [],
                        "technologyModules": [],
                        "technicalMeasures": [],
                        "modules": [],
                        "serviceCount": 0,
                        "status": "no_service",
                        "exceptionType": "",
                        "exceptionMessage": "",
                        "isExplicitNoService": True,
                    }
                )

            works = self._relation_targets(focus, "maps_to_work", "security_work")
            references = self._relation_targets(focus, "maps_to_process", "process_reference")
            process_groups: list[dict[str, Any]] = []
            stakeholders: list[dict[str, Any]] = []
            for reference in references:
                groups = self._relation_targets(reference, "belongs_to", "process_group")
                process_groups.extend(groups)
                functions = self._relation_targets(reference, "stakeholder_by", "work_function")
                for function in functions:
                    layer = _text(_metadata(function).get("stakeholder_layer"))
                    stakeholders.append({**_project_object(function), "layer": layer})
                    work_functions_by_focus[_projection_id(focus)].append(function)
                for item in [reference, *groups, *functions]:
                    semantic_objects[item["canonical_ref"]] = _project_object(item)
                semantic_relations.extend(
                    _relation_triple("maps_to_process", focus, reference)
                    for _once in (0,)
                )
                semantic_relations.extend(
                    _relation_triple("belongs_to", reference, group)
                    for group in groups
                )
                semantic_relations.extend(
                    _relation_triple("stakeholder_by", reference, function)
                    for function in functions
                )
            for work in works:
                semantic_objects[work["canonical_ref"]] = _project_object(work)
                semantic_relations.append(_relation_triple("maps_to_work", focus, work))
            management_rows.append(
                {
                    "focus": _project_object(focus),
                    "securityWorks": [_project_object(item) for item in works],
                    "stakeholders": stakeholders,
                    "processGroups": [_project_object(item) for item in process_groups],
                    "processReferences": [_project_object(item) for item in references],
                    "activities": [],
                    "activityStatusLabels": ["待补充"] if references else [],
                    "hasMissingActivity": bool(references),
                }
            )

        standard_rows, standard_relations = self._standard_rows(focuses)
        semantic_relations.extend(standard_relations)
        for row in standard_rows:
            for item in [*row["standards"], *row["controls"]]:
                if item.get("canonical_ref"):
                    semantic_objects[item["canonical_ref"]] = item
        semantic_relations = _deduplicate_semantic_relations(
            semantic_relations
        )

        selected_projection = _project_object(selected)
        target_ref = selected_projection["targetRef"]
        summary = {
            "focuses": len(focuses),
            "technical_rows": len(technical_rows),
            "management_rows": len(management_rows),
            "standard_controls": len(
                {item["id"] for row in standard_rows for item in row["controls"]}
            ),
            "standard_frameworks": len(
                {item["id"] for row in standard_rows for item in row["standards"]}
            ),
        }
        local_map = None
        if selected.get("object_type") == "capability_focus":
            focus_id = _projection_id(selected)
            selected_technical = [
                row for row in technical_rows if row["focus"]["id"] == focus_id
            ]
            selected_management = next(
                (row for row in management_rows if row["focus"]["id"] == focus_id),
                {},
            )
            layer_aliases = {
                "网络安全决策层": "decision",
                "决策层": "decision",
                "网络安全管理层": "management",
                "管理层": "management",
                "网络安全执行层": "execution",
                "执行层": "execution",
                "网络安全监督层": "supervision",
                "监督层": "supervision",
            }
            functions_by_layer = {
                "decision": [],
                "management": [],
                "execution": [],
                "supervision": [],
            }
            for stakeholder in selected_management.get("stakeholders", []):
                functions_by_layer[
                    layer_aliases.get(stakeholder.get("layer"), "execution")
                ].append(stakeholder)
            service_links: dict[str, dict[str, Any]] = {}
            for row in selected_technical:
                for service in row["services"]:
                    link = service_links.setdefault(
                        service["id"],
                        {
                            "serviceId": service["id"],
                            "serviceCode": service["code"],
                            "serviceName": service["title"],
                            "scopes": [],
                            "modules": [],
                            "measures": [],
                            "status": row["status"],
                        },
                    )
                    if row.get("scope"):
                        link["scopes"].append(row["scope"])
                    link["modules"].extend(row["technologyModules"])
                    link["measures"].extend(row["technicalMeasures"])
            local_map = {
                "focus": selected_projection,
                "technical": {
                    "scopeServicePairs": [
                        {
                            "focusId": row["focus"]["id"],
                            "scopeId": (row.get("scope") or {}).get("id", ""),
                            "scopeCode": (row.get("scope") or {}).get("code", ""),
                            "scopeName": (row.get("scope") or {}).get("title", ""),
                            "serviceId": (row.get("services") or [{}])[0].get("id", ""),
                            "serviceCode": (row.get("services") or [{}])[0].get("code", ""),
                            "serviceName": (row.get("services") or [{}])[0].get("title", ""),
                            "status": row["status"],
                        }
                        for row in selected_technical
                    ],
                    "serviceModuleMeasureLinks": list(service_links.values()),
                },
                "management": {
                    "securityWorks": selected_management.get("securityWorks", []),
                    "workFunctionsByLayer": functions_by_layer,
                    "processTree": [
                        {
                            "l2ProcessGroup": group,
                            "l3Processes": [
                                {
                                    **reference,
                                    "name": reference["title"],
                                    "activities": [],
                                }
                                for reference in selected_management.get("processReferences", [])
                            ],
                        }
                        for group in selected_management.get("processGroups", [])
                    ],
                },
                "standards": {
                    "frameworks": [item for row in standard_rows for item in row["standards"]],
                    "controls": [item for row in standard_rows for item in row["controls"]],
                },
                "sourceEvidence": [],
            }
        graph = {
            "center": {
                "id": selected_projection["id"],
                "type": selected_projection["type"],
                "code": selected_projection["code"],
                "name": selected_projection["title"],
                "label": selected_projection["title"],
                "group": "current",
                "weight": 10,
            },
            "nodes": [
                {
                    "id": selected_projection["id"],
                    "type": selected_projection["type"],
                    "code": selected_projection["code"],
                    "name": selected_projection["title"],
                    "label": selected_projection["title"],
                    "group": "current",
                    "weight": 10,
                }
            ],
            "edges": [],
            "limited": selected.get("object_type") != "capability_focus",
        }
        data = {
            "targetRef": target_ref,
            "contract": "capability-workspace-view",
            "viewModelKind": "capability_object_workspace_view",
            "selected": selected_projection,
            "graphScope": selected.get("object_type", "").replace("capability_", ""),
            "dataState": "ready",
            "data_state": "ready",
            "graph": graph,
            "summary": summary,
            "tabs": {
                "graph": {"dataState": "ready", "nodeCount": 1},
                "technical": {"rowCount": len(technical_rows)},
                "management": {"rowCount": len(management_rows)},
                "standards": {
                    "controlCount": summary["standard_controls"],
                    "frameworkCount": summary["standard_frameworks"],
                },
            },
            "sourceEvidence": [],
            "objects": list(semantic_objects.values()),
            "relations": semantic_relations,
            "technicalMappingRows": technical_rows,
            "managementMappingRows": management_rows,
            "standardMappingRows": standard_rows,
            "localRelationMap": local_map,
            "localRelationMaps": [local_map] if local_map else [],
            "localRelationMapsByFocusId": (
                {selected_projection["id"]: local_map, selected_projection["code"]: local_map}
                if local_map
                else {}
            ),
            "stats": {**summary, "local_relation_maps": 1 if local_map else 0},
        }
        ordered = [
            {"position": position, "canonical_ref": item["canonical_ref"]}
            for position, item in enumerate(focuses, start=1)
        ]
        counts = {
            **summary,
            "objects": len(semantic_objects),
            "relations": len(semantic_relations),
        }
        return self._envelope(
            data,
            semantic_objects=list(semantic_objects.values()),
            semantic_relations=semantic_relations,
            ordered_sequence=ordered,
            counts=counts,
            target_ref=target_ref,
        )

    def locate_capability(
        self,
        *,
        target_ref: str,
        object_type: str = "",
        object_id: str = "",
        code: str = "",
    ) -> dict[str, Any]:
        normalized_ref = _text(target_ref)
        resolved_type = _text(object_type)
        resolved_id = _text(object_id)
        resolved_code = _text(code)
        parts = normalized_ref.split(":")
        if normalized_ref.startswith("capability_relation:") and len(parts) >= 3:
            resolved_type, resolved_id = "capability_focus", unquote(parts[2])
        elif len(parts) >= 4 and parts[0] == "base" and parts[2] == "v2":
            decoded = [unquote(value) for value in parts[3:]]
            if len(decoded) >= 3 and decoded[1] == "capabilities":
                resolved_id = decoded[2]
        elif len(parts) >= 2 and parts[0] in CAPABILITY_OBJECT_TYPE_ALIASES:
            resolved_type, resolved_id = parts[0], unquote(parts[1])
        elif len(parts) >= 3 and parts[0] == "base" and parts[1] in CAPABILITY_OBJECT_TYPE_ALIASES:
            resolved_type, resolved_code = parts[1], unquote(parts[2])
        if not resolved_type:
            resolved_type = "capability_focus"
        selected = self._resolve_capability(
            object_type=resolved_type,
            object_id=resolved_id,
            code=resolved_code,
        )
        projected = _project_object(selected)
        data = {"targetRef": projected["targetRef"], "selected": projected}
        return self._envelope(
            data,
            semantic_objects=[projected],
            semantic_relations=[],
            ordered_sequence=[
                {"position": 1, "canonical_ref": projected["canonical_ref"]}
            ],
            counts={"objects": 1, "relations": 0},
            target_ref=projected["targetRef"],
        )

    def _shared_lookup_data(self) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
        snapshot = self._load_snapshot()
        measure_pairs = self._measure_service_pairs()
        entries = []
        relations: list[dict[str, Any]] = []
        objects: dict[str, dict[str, Any]] = {}
        for service in sorted(
            snapshot["by_type"]["security_technical_service"],
            key=lambda item: _text(item.get("code")),
        ):
            scopes = self._relation_targets(service, "applies_to_scope", "scope_type")
            modules = self._relation_sources(
                service, "implements_service", "security_technology_module"
            )
            measures = [
                snapshot["by_ref"][measure_ref]
                for service_ref, measure_ref in measure_pairs
                if service_ref == service["canonical_ref"]
            ]
            for item in [service, *scopes, *modules, *measures]:
                objects[item["canonical_ref"]] = _project_object(item)
            for scope in scopes:
                relations.append(_relation_triple("applies_to_scope", service, scope))
            for module in modules:
                relations.append(_relation_triple("implemented_by_module", service, module))
            for measure in measures:
                relations.append(
                    _relation_triple(
                        "has_measure",
                        service,
                        measure,
                        confidence="derived",
                        owner="controlled measure projection",
                    )
                )
            entries.append(
                {
                    "service": _project_object(service),
                    "scopes": [_project_object(item) for item in scopes],
                    "modules": [_project_object(item) for item in modules],
                    "measures": [_project_object(item) for item in measures],
                }
            )
        data = {
            "data_state": "ready",
            "stats": {"service_module_index": len(entries)},
            "service_module_index": entries,
        }
        return data, list(objects.values()), relations

    def shared_lookups(self) -> dict[str, Any]:
        data, objects, relations = self._shared_lookup_data()
        ordered = [
            {"position": position, "canonical_ref": row["service"]["canonical_ref"]}
            for position, row in enumerate(data["service_module_index"], start=1)
        ]
        return self._envelope(
            data,
            semantic_objects=objects,
            semantic_relations=relations,
            ordered_sequence=ordered,
            counts={
                "security_technical_services": len(data["service_module_index"]),
                "implemented_by_module": sum(
                    len(row["modules"]) for row in data["service_module_index"]
                ),
                "has_measure": sum(
                    len(row["measures"]) for row in data["service_module_index"]
                ),
            },
        )

    def _payload_semantics(
        self,
        payload: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        snapshot = self._load_snapshot()
        object_refs: dict[str, dict[str, Any]] = {}

        def visit(value: Any) -> None:
            if isinstance(value, dict):
                canonical_ref = _text(value.get("canonical_ref"))
                if canonical_ref and canonical_ref in snapshot["by_ref"]:
                    object_refs.setdefault(
                        canonical_ref,
                        snapshot["by_ref"][canonical_ref],
                    )
                for child in value.values():
                    visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)

        visit(payload)
        relations: list[dict[str, Any]] = []
        seen: set[tuple[str, str, str]] = set()
        for relation in snapshot["relations"]:
            source_ref = _text(relation.get("source_ref"))
            target_ref = _text(relation.get("target_ref"))
            relation_type = _text(relation.get("relation_type"))
            key = (relation_type, source_ref, target_ref)
            if (
                source_ref in object_refs
                and target_ref in object_refs
                and key not in seen
            ):
                seen.add(key)
                relations.append(
                    _relation_triple(
                        relation_type,
                        object_refs[source_ref],
                        object_refs[target_ref],
                    )
                )
        for service_ref, measure_ref in self._measure_service_pairs():
            key = ("has_measure", service_ref, measure_ref)
            if service_ref in object_refs and measure_ref in object_refs and key not in seen:
                seen.add(key)
                relations.append(
                    _relation_triple(
                        "has_measure",
                        object_refs[service_ref],
                        object_refs[measure_ref],
                        confidence="derived",
                        owner="controlled measure projection",
                    )
                )
        objects = [_project_object(item) for item in object_refs.values()]
        ordered = [
            {"position": position, "canonical_ref": canonical_ref}
            for position, canonical_ref in enumerate(object_refs, start=1)
        ]
        return objects, relations, ordered

    def _maintenance_payload(self) -> dict[str, Any]:
        snapshot = self._load_snapshot()
        lookup, _objects, _relations = self._shared_lookup_data()
        service_lookup = {
            row["service"]["id"]: row for row in lookup["service_module_index"]
        }
        focuses_by_work: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for work in snapshot["by_type"]["security_work"]:
            for focus in self._relation_sources(work, "maps_to_work", "capability_focus"):
                focuses_by_work[_projection_id(work)].append(_project_object(focus))
        works = [
            {
                **_project_object(work),
                "focuses": focuses_by_work[_projection_id(work)],
                "focus_count": len(focuses_by_work[_projection_id(work)]),
            }
            for work in snapshot["by_type"]["security_work"]
        ]
        scopes = []
        for scope in snapshot["by_type"]["scope_type"]:
            services = self._relation_sources(scope, "applies_to_scope", "security_technical_service")
            scopes.append({**_project_object(scope), "scenario": _text(_metadata(scope).get("scenario")), "services": [_project_object(item) for item in services]})
        services = []
        for service in snapshot["by_type"]["security_technical_service"]:
            row = service_lookup.get(_projection_id(service), {})
            services.append({**_project_object(service), "scopes": row.get("scopes", []), "modules": row.get("modules", []), "measures": row.get("measures", [])})
        modules = []
        for module in snapshot["by_type"]["security_technology_module"]:
            service_items = self._relation_targets(module, "implements_service", "security_technical_service")
            systems = self._relation_targets(module, "part_of_system", "security_system")
            products = self._relation_targets(module, "maps_to_product", "product")
            scopes_by_ref: dict[str, dict[str, Any]] = {}
            for service in service_items:
                for scope in self._relation_targets(service, "applies_to_scope", "scope_type"):
                    scopes_by_ref[scope["canonical_ref"]] = scope
            modules.append({**_project_object(module), "services": [_project_object(item) for item in service_items], "systems": [_project_object(item) for item in systems], "products": [_project_object(item) for item in products], "scopes": [_project_object(item) for item in scopes_by_ref.values()], "environments": []})
        measure_pairs = self._measure_service_pairs()
        measures = []
        for measure in snapshot["by_type"]["security_technical_measure"]:
            related_services = [snapshot["by_ref"][service_ref] for service_ref, measure_ref in measure_pairs if measure_ref == measure["canonical_ref"]]
            scope_by_ref: dict[str, dict[str, Any]] = {}
            focus_by_ref: dict[str, dict[str, Any]] = {}
            for service in related_services:
                for scope in self._relation_targets(service, "applies_to_scope", "scope_type"):
                    scope_by_ref[scope["canonical_ref"]] = scope
                for focus in self._relation_targets(service, "supports_focus", "capability_focus"):
                    focus_by_ref[focus["canonical_ref"]] = focus
            measures.append({**_project_object(measure), "related_service_ids": [_projection_id(item) for item in related_services], "related_service_names": [_text(item.get("display_name")) for item in related_services], "related_services": [_project_object(item) for item in related_services], "related_scope_ids": [_projection_id(item) for item in scope_by_ref.values()], "related_scope_names": [_text(item.get("display_name")) for item in scope_by_ref.values()], "applicable_scopes": [_project_object(item) for item in scope_by_ref.values()], "related_capability_focus_ids": [_projection_id(item) for item in focus_by_ref.values()], "related_capability_focus_names": [_text(item.get("display_name")) for item in focus_by_ref.values()], "related_focuses": [_project_object(item) for item in focus_by_ref.values()], "related_focus_count": len(focus_by_ref), "mapping_status_label": "正常"})

        groups_by_domain: dict[str, list[dict[str, Any]]] = defaultdict(list)
        refs_by_group: dict[str, list[dict[str, Any]]] = defaultdict(list)
        functions_by_ref: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for group in snapshot["by_type"]["process_group"]:
            domains = self._relation_targets(group, "belongs_to", "process_domain")
            if domains:
                groups_by_domain[domains[0]["canonical_ref"]].append(group)
        for reference in snapshot["by_type"]["process_reference"]:
            groups = self._relation_targets(reference, "belongs_to", "process_group")
            if groups:
                refs_by_group[groups[0]["canonical_ref"]].append(reference)
            functions_by_ref[reference["canonical_ref"]] = self._relation_targets(reference, "stakeholder_by", "work_function")
        processes = []
        for domain in snapshot["by_type"]["process_domain"]:
            groups = []
            for group in groups_by_domain.get(domain["canonical_ref"], []):
                references = []
                for reference in refs_by_group.get(group["canonical_ref"], []):
                    references.append({**_project_object(reference), "capability_focus_code": _text(_metadata(reference).get("capability_focus_code")), "activities": [], "activity_status": "missing", "activity_status_label": "待补充", "missing_activity": True, "stakeholders": [_project_object(item) for item in functions_by_ref[reference["canonical_ref"]]]})
                groups.append({**_project_object(group), "references": references})
            processes.append({**_project_object(domain), "groups": groups})

        groups_by_layer: dict[str, list[dict[str, Any]]] = defaultdict(list)
        functions_by_group: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for group in snapshot["by_type"]["work_function_group"]:
            layers = self._relation_targets(group, "belongs_to_layer", "work_function_layer")
            if layers:
                groups_by_layer[layers[0]["canonical_ref"]].append(group)
        for function in snapshot["by_type"]["work_function"]:
            groups = self._relation_targets(function, "belongs_to", "work_function_group")
            if groups:
                functions_by_group[groups[0]["canonical_ref"]].append(function)
        function_layers = []
        for layer in snapshot["by_type"]["work_function_layer"]:
            groups = []
            for group in groups_by_layer.get(layer["canonical_ref"], []):
                functions = []
                for function in functions_by_group.get(group["canonical_ref"], []):
                    tasks = self._relation_targets(function, "performs_task", "work_task")
                    refs = self._relation_targets(function, "maps_to_gbt_task", "gbt_42446_task_reference")
                    functions.append({**_project_object(function), "tasks": [_project_object(item) for item in tasks], "gbt_42446_refs": [_project_object(item) for item in refs]})
                groups.append({**_project_object(group), "functions": functions})
            function_layers.append({**_project_object(layer), "groups": groups})
        references = [_project_object(item) for item in snapshot["by_type"]["gbt_42446_task_reference"]]
        roles = [_project_object(item) for item in snapshot["by_type"]["work_role_reference"]]
        stats = {
            "scope_types": len(scopes),
            "security_works": len(works),
            "security_processes": len(processes),
            "work_function_layers": len(function_layers),
            "security_technical_services": len(services),
            "security_technology_modules": len(modules),
            "security_technical_measures": len(measures),
            "gbt_42446_references": len(references),
            "gartner_roles": len(roles),
            "work_functions": sum(len(group["functions"]) for layer in function_layers for group in layer["groups"]),
            "process_domains": len(processes),
            "process_groups": sum(len(domain["groups"]) for domain in processes),
            "process_references": sum(len(group["references"]) for domain in processes for group in domain["groups"]),
        }
        return {
            "data_state": "ready",
            "stats": stats,
            "section_counts": {
                "scopes": len(scopes),
                "services": len(services),
                "security-works": len(works),
                "processes": stats["process_references"],
                "work-functions": stats["work_functions"],
                "modules": len(modules),
                "measures": len(measures),
                "references-gbt": len(references),
                "references-gartner": len(roles),
            },
            "scope_types": scopes,
            "security_works": works,
            "security_processes": processes,
            "work_function_layers": function_layers,
            "security_technical_services": services,
            "security_technology_modules": modules,
            "security_technical_measures": measures,
            "gbt_42446_references": references,
            "gartner_roles": roles,
            "service_module_index": lookup["service_module_index"],
        }

    def maintenance_index(self) -> dict[str, Any]:
        payload = self._maintenance_payload()
        sections = [
            ("scopes", "作用域清单"),
            ("services", "安全技术服务清单"),
            ("processes", "流程清单"),
            ("work-functions", "职能清单"),
            ("security-works", "安全工作清单"),
            ("modules", "安全技术模块清单"),
            ("measures", "安全技术措施清单"),
            ("references", "岗位参考页面"),
        ]
        data = {
            "data_state": "ready",
            "package_type": "maintenance-index",
            "stats": payload["stats"],
            "section_counts": payload["section_counts"],
            "sections": [
                {"id": section_id, "label": label, "count": payload["section_counts"].get(section_id, 0)}
                for section_id, label in sections
            ],
            "compatibility": {"mode": "sqlite_projection", "warnings": []},
        }
        objects = [
            _project_object(item)
            for object_type in (
                "scope_type", "security_technical_service", "security_technology_module",
                "security_technical_measure", "security_work", "process_reference", "work_function",
            )
            for item in self._load_snapshot()["by_type"][object_type]
        ]
        ordered = [
            {"position": position, "canonical_ref": item["canonical_ref"]}
            for position, item in enumerate(objects, start=1)
        ]
        return self._envelope(
            data,
            semantic_objects=objects,
            semantic_relations=[],
            ordered_sequence=ordered,
            counts={key: int(value) for key, value in payload["stats"].items()},
        )

    def maintenance_knowledge(self) -> dict[str, Any]:
        """Return the complete Batch 1 maintenance payload from SQLite."""

        payload = self._maintenance_payload()
        objects, relations, ordered = self._payload_semantics(payload)
        return self._envelope(
            payload,
            semantic_objects=objects,
            semantic_relations=relations,
            ordered_sequence=ordered,
            counts={key: int(value) for key, value in payload["stats"].items()},
        )

    def maintenance_section(self, section: str) -> dict[str, Any]:
        payload = self._maintenance_payload()
        section_fields = {
            "scopes": ("scope_types",),
            "services": ("security_technical_services", "service_module_index"),
            "processes": ("security_processes",),
            "work-functions": ("work_function_layers",),
            "security-works": ("security_works",),
            "modules": ("security_technology_modules", "service_module_index"),
            "measures": ("security_technical_measures", "service_module_index"),
            "references": ("gbt_42446_references", "gartner_roles"),
        }
        if section not in section_fields:
            raise KeyError(section)
        data = {
            "data_state": "ready",
            "package_type": "maintenance-section",
            "section_id": section,
            "stats": payload["stats"],
            "section_counts": payload["section_counts"],
            "source_evidence_by_id": {},
        }
        for field in section_fields[section]:
            data[field] = payload[field]
        objects, relations, ordered = self._payload_semantics(data)
        return self._envelope(
            data,
            semantic_objects=objects,
            semantic_relations=relations,
            ordered_sequence=ordered,
            counts={
                "items": payload["section_counts"].get(section, sum(len(data[field]) for field in section_fields[section])),
            },
        )
