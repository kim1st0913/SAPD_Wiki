from __future__ import annotations

import hashlib
import html as html_lib
import json
from copy import deepcopy
from collections import Counter, defaultdict
from datetime import UTC, datetime
from typing import Any


MATURITY_LEVELS = (
    {"id": "L1", "name": "非正式执行", "index": 1},
    {"id": "L2", "name": "计划跟踪", "index": 2},
    {"id": "L3", "name": "充分定义", "index": 3},
    {"id": "L4", "name": "量化控制", "index": 4},
    {"id": "L5", "name": "持续优化", "index": 5},
)

EVIDENCE_LEVELS = (
    {"id": "E0", "name": "无证据"},
    {"id": "E1", "name": "文档证据"},
    {"id": "E2", "name": "配置证据"},
    {"id": "E3", "name": "运行证据"},
    {"id": "E4", "name": "审计证据"},
    {"id": "E5", "name": "持续证据"},
)

PROJECT_STATUS_LABELS = {
    "draft": "草稿",
    "template_configuring": "模板配置中",
    "scoring": "评分中",
    "score_review": "待复核",
    "completed": "评估完成",
    "reported": "已生成报告",
    "archived": "已归档",
}

ASSESSMENT_ITEM_TYPES = {"SERVICE", "FOCUS"}
SERVICE_ROLES = {"ASSESSMENT_POINT", "PLATFORM_EVIDENCE_REFERENCE"}
ALGORITHM_VERSION = "sapd-maturity-v2.1.0"
SCORE_EXCHANGE_SCHEMA = "maturity-score-exchange-v2.1"
TEMPLATE_EXCHANGE_SCHEMA = "maturity-template-exchange-v2.1"
ELEMENT_KEYS = ("organization", "process", "tool", "data")
ELEMENT_LABELS = {
    "organization": "组织与角色",
    "process": "制度与流程",
    "tool": "平台与工具",
    "data": "数据与信息",
}
RUBRIC_VERSION = "sapd-maturity-generic-rubric-v2.1-2026-07-13"
GENERIC_DIMENSION_RUBRIC = (
    {
        "dimensionCode": "organization",
        "levels": {
            "L1": "没有明确分配责任和职责，安全工作主要依赖临时指派人员，缺乏稳定团队结构和清晰职责定位。",
            "L2": "有人员主动承担部分安全职责，但未正式明确；问题发生时责任边界仍可能不清晰。",
            "L3": "职责和责任已正式分配，各角色定义清楚，流程所有者和责任人明确。",
            "L4": "通过自动化流程促使责任人主动履职并积极参与，形成有效激励和持续参与机制。",
            "L5": "能根据战略变化灵活调整角色责任，责任人自我激励、自驱管理，团队成员高度自主。",
        },
    },
    {
        "dimensionCode": "process",
        "levels": {
            "L1": "流程依靠个人经验，缺乏文档化和标准化；安全要求没有统一明确规定，主要口头传达。",
            "L2": "基于经验形成初步流程或制度，但尚未标准化，执行不严格且覆盖有限。",
            "L3": "已形成标准化运营流程，安全制度正式发布并执行，能够在组织范围内贯彻实施。",
            "L4": "流程健全完整，内嵌内部最佳实践并逐步实现自动化；操作有记录且可重复执行。",
            "L5": "流程、政策和程序高度标准化与自动化，能够随环境变化和威胁发展持续优化改进。",
        },
    },
    {
        "dimensionCode": "tool",
        "levels": {
            "L1": "安全技术工具使用非常有限，覆盖范围窄、功能不完整，主要依靠个别人员手工操作。",
            "L2": "具备基础安全技术措施和工具，但能力有限，尚未覆盖全部关键环节。",
            "L3": "配备完整、专业的安全技术措施，覆盖关键环节和业务流程，并具备必要集成能力。",
            "L4": "各安全技术措施相互融合，实现主要领域的自动化管理和监控，并具备实时响应和调整能力。",
            "L5": "技术措施深度融合，利用人工智能、机器学习等实现高效威胁检测和自适应响应，并与业务高度协同。",
        },
    },
    {
        "dimensionCode": "data",
        "levels": {
            "L1": "安全业务数据没有系统记录和收集，数据分散，无法进行系统分析和利用。",
            "L2": "开始记录和收集部分安全业务数据，但质量和覆盖率有限，难以形成全面、系统的信息支撑。",
            "L3": "全面记录和收集安全业务数据，能够通过技术手段分析处理，形成初步风险事件预警和情报支持。",
            "L4": "安全信息收集系统化，实时支撑安全管理决策和考核，形成闭环管理，并使用分析模型提高决策效率和准确性。",
            "L5": "安全管理决策与考核指标动态调整，能够实时响应安全战略和计划变化，提供前瞻性安全保障。",
        },
    },
)


def _list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def _dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _float(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return number if number == number and abs(number) != float("inf") else default


def _round(value: float | None, digits: int = 2) -> float | None:
    return None if value is None else round(float(value), digits)


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _stable_hash(value: Any, length: int = 16) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()[:length]


LEVEL_INDEX = {item["id"]: float(item["index"]) for item in MATURITY_LEVELS}
LEVEL_NAME = {item["id"]: item["name"] for item in MATURITY_LEVELS}


def _rubric_entries_for_item(item_id: str) -> list[dict[str, Any]]:
    return [
        {
            "scoreItemId": item_id,
            "dimensionCode": dimension["dimensionCode"],
            "level": level["id"],
            "levelName": level["name"],
            "criteria": dimension["levels"][level["id"]],
            "sourceType": "GENERIC_FALLBACK",
            "sourceVersion": RUBRIC_VERSION,
        }
        for dimension in GENERIC_DIMENSION_RUBRIC
        for level in MATURITY_LEVELS
    ]


def maturity_level_index(value: Any) -> float | None:
    raw = _text(value).upper()
    if raw in LEVEL_INDEX:
        return LEVEL_INDEX[raw]
    numeric = _float(value, -1.0)
    if 1.0 <= numeric <= 5.0:
        return numeric
    return None


def maturity_level_from_index(value: float | None) -> str:
    if value is None:
        return "Not Scored"
    if value < 1.5:
        return "L1"
    if value < 2.5:
        return "L2"
    if value < 3.5:
        return "L3"
    if value < 4.5:
        return "L4"
    return "L5"


def _weighted_average(rows: list[tuple[float | None, float]]) -> float | None:
    usable = [(value, weight) for value, weight in rows if value is not None and weight > 0]
    if not usable:
        return None
    denominator = sum(weight for _, weight in usable)
    return sum(float(value) * weight for value, weight in usable) / denominator if denominator else None


def _target_achievement_rate(current_index: float | None, target_index: float | None) -> float | None:
    if current_index is None or target_index is None or target_index <= 0:
        return None
    return min(100.0, 100.0 * float(current_index) / float(target_index))


def _object_map(workbench: dict[str, Any], object_type: str) -> dict[str, dict[str, Any]]:
    return {
        _text(key): value
        for key, value in _dict(_dict(workbench.get("objects")).get(object_type)).items()
        if isinstance(value, dict)
    }


def _scope_code_for_service(service: dict[str, Any]) -> str:
    category = _text(service.get("category"))
    if category:
        return category
    code = _text(service.get("code"))
    return code.split("&", 1)[0] if "&" in code else "ALL"


def build_maturity_base_template(capability_workbench: dict[str, Any]) -> dict[str, Any]:
    navigator = _list(_dict(capability_workbench.get("navigator")).get("tree"))
    focus_objects = _object_map(capability_workbench, "capability_focus")
    service_objects = _object_map(capability_workbench, "security_technical_service")
    scope_objects = _object_map(capability_workbench, "scope_type")
    scope_by_code = {_text(item.get("code")): item for item in scope_objects.values()}

    service_ids_by_focus: dict[str, list[str]] = defaultdict(list)
    for relation in _list(capability_workbench.get("relations")):
        if not isinstance(relation, dict) or relation.get("type") != "supports_focus":
            continue
        if relation.get("sourceType") != "security_technical_service" or relation.get("targetType") != "capability_focus":
            continue
        service_id = _text(relation.get("sourceId"))
        focus_id = _text(relation.get("targetId"))
        if service_id and focus_id and service_id not in service_ids_by_focus[focus_id]:
            service_ids_by_focus[focus_id].append(service_id)

    categories: list[dict[str, Any]] = []
    capabilities: list[dict[str, Any]] = []
    focuses: list[dict[str, Any]] = []
    services: dict[str, dict[str, Any]] = {}
    focus_service_mappings: list[dict[str, Any]] = []
    score_items: list[dict[str, Any]] = []

    for top_order, top in enumerate(navigator):
        if not isinstance(top, dict):
            continue
        top_source_id = _text(top.get("id"))
        top_id = f"category:{top_source_id}"
        categories.append(
            {
                "id": top_id,
                "code": _text(top.get("code")) or _text(top.get("name")).rsplit(" ", 1)[-1],
                "name": _text(top.get("name")) or "未命名能力分类",
                "description": "",
                "level": 1,
                "capabilityLevel": "L0",
                "parentId": None,
                "weight": 1,
                "sortOrder": top_order,
                "includedInOverall": True,
                "dictionaryRef": top_source_id,
                "sourceType": "DICTIONARY",
                "sourceSnapshotObjectId": top_source_id,
                "changeAction": "UNCHANGED",
                "originalParentId": None,
                "currentParentId": None,
                "sourceContentHash": _stable_hash(top),
            }
        )
        for domain_order, domain in enumerate(_list(top.get("children"))):
            if not isinstance(domain, dict):
                continue
            domain_source_id = _text(domain.get("id"))
            domain_id = f"domain:{domain_source_id}"
            categories.append(
                {
                    "id": domain_id,
                    "code": _text(domain.get("code")),
                    "name": _text(domain.get("name")) or "未命名能力域",
                    "description": "",
                    "level": 2,
                    "capabilityLevel": "L1",
                    "parentId": top_id,
                    "weight": 1,
                    "sortOrder": domain_order,
                    "includedInOverall": True,
                    "dictionaryRef": domain_source_id,
                    "sourceType": "DICTIONARY",
                    "sourceSnapshotObjectId": domain_source_id,
                    "changeAction": "UNCHANGED",
                    "originalParentId": top_id,
                    "currentParentId": top_id,
                    "sourceContentHash": _stable_hash(domain),
                }
            )
            for capability_order, capability in enumerate(_list(domain.get("children"))):
                if not isinstance(capability, dict):
                    continue
                capability_source_id = _text(capability.get("id"))
                capability_id = f"capability:{capability_source_id}"
                capability_record = {
                    "id": capability_id,
                    "code": _text(capability.get("code")),
                    "name": _text(capability.get("name")) or "未命名安全能力",
                    "description": "",
                    "capabilityLevel": "L2",
                    "categoryId": domain_id,
                    "topCategoryId": top_id,
                    "weight": 1,
                    "sortOrder": capability_order,
                    "included": True,
                    "isCustom": False,
                    "isCritical": False,
                    "businessImportance": 3,
                    "riskUrgency": 3,
                    "targetLevel": "L3",
                    "dictionaryRef": capability_source_id,
                    "sourceType": "DICTIONARY",
                    "sourceSnapshotObjectId": capability_source_id,
                    "changeAction": "UNCHANGED",
                    "originalParentId": domain_id,
                    "currentParentId": domain_id,
                    "sourceContentHash": _stable_hash(capability),
                    "focusIds": [],
                }
                capability_kind = _text(top.get("code")) or _text(top.get("name")).rsplit(" ", 1)[-1]
                for focus_order, focus in enumerate(_list(capability.get("children"))):
                    if not isinstance(focus, dict):
                        continue
                    focus_source_id = _text(focus.get("id"))
                    focus_id = f"focus:{focus_source_id}"
                    focus_object = focus_objects.get(focus_source_id, {})
                    service_source_ids = sorted(
                        service_ids_by_focus.get(focus_source_id, []),
                        key=lambda item_id: (
                            _scope_code_for_service(service_objects.get(item_id, {})),
                            _text(service_objects.get(item_id, {}).get("code")),
                            _text(service_objects.get(item_id, {}).get("name")),
                        ),
                    )
                    item_type = "SERVICE" if capability_kind == "T" and service_source_ids else "FOCUS"
                    focus_record = {
                        "id": focus_id,
                        "code": _text(focus.get("code")),
                        "name": _text(focus.get("name")) or _text(focus_object.get("name")) or "未命名关注点",
                        "description": _text(focus_object.get("description")),
                        "capabilityId": capability_id,
                        "weight": 1,
                        "sortOrder": focus_order,
                        "included": True,
                        "isCustom": False,
                        "isCritical": False,
                        "itemType": item_type,
                        "targetLevel": "L3",
                        "dictionaryRef": focus_source_id,
                        "sourceType": "DICTIONARY",
                        "sourceSnapshotObjectId": focus_source_id,
                        "changeAction": "UNCHANGED",
                        "originalParentId": capability_id,
                        "currentParentId": capability_id,
                        "sourceContentHash": _stable_hash(focus_object or focus),
                        "serviceMappingIds": [],
                        "platformEvidenceServiceIds": [],
                        "scoreItemIds": [],
                    }
                    for service_order, service_source_id in enumerate(service_source_ids):
                        service = service_objects.get(service_source_id, {})
                        service_id = f"service:{service_source_id}"
                        scope_code = _scope_code_for_service(service)
                        scope = scope_by_code.get(scope_code, {})
                        role = "ASSESSMENT_POINT" if capability_kind == "T" else "PLATFORM_EVIDENCE_REFERENCE"
                        services[service_id] = {
                            "id": service_id,
                            "code": _text(service.get("code")),
                            "name": _text(service.get("name")) or "未命名安全技术服务",
                            "scopeCode": scope_code,
                            "scopeName": _text(scope.get("name")) or scope_code,
                            "dictionaryRef": service_source_id,
                            "sourceType": "DICTIONARY",
                            "sourceSnapshotObjectId": service_source_id,
                            "changeAction": "UNCHANGED",
                            "sourceContentHash": _stable_hash(service),
                            "isCustom": False,
                        }
                        mapping_id = f"mapping:{focus_source_id}:{scope_code}:{service_source_id}"
                        focus_service_mappings.append(
                            {
                                "id": mapping_id,
                                "focusId": focus_id,
                                "scopeCode": scope_code,
                                "scopeName": _text(scope.get("name")) or scope_code,
                                "serviceId": service_id,
                                "serviceRole": role,
                                "weight": 1,
                                "sortOrder": service_order,
                                "sourceType": "DICTIONARY",
                                "sourceSnapshotObjectId": service_source_id,
                                "changeAction": "UNCHANGED",
                                "originalParentId": focus_id,
                                "currentParentId": focus_id,
                                "sourceContentHash": _stable_hash((focus_source_id, scope_code, service_source_id)),
                            }
                        )
                        focus_record["serviceMappingIds"].append(mapping_id)
                        if role == "PLATFORM_EVIDENCE_REFERENCE":
                            focus_record["platformEvidenceServiceIds"].append(service_id)
                    if item_type == "SERVICE":
                        for service_order, service_source_id in enumerate(service_source_ids):
                            service = service_objects.get(service_source_id, {})
                            service_id = f"service:{service_source_id}"
                            scope_code = _scope_code_for_service(service)
                            scope = scope_by_code.get(scope_code, {})
                            item_id = f"score:{focus_source_id}:{service_source_id}"
                            score_items.append(
                                {
                                    "id": item_id,
                                    "itemType": "SERVICE",
                                    "capabilityId": capability_id,
                                    "focusId": focus_id,
                                    "serviceId": service_id,
                                    "scopeCode": scope_code,
                                    "scopeName": _text(scope.get("name")) or scope_code,
                                    "weight": 1,
                                    "sortOrder": service_order,
                                    "required": True,
                                    "elementWeights": {key: 0.25 for key in ELEMENT_KEYS},
                                    "rubricEntries": _rubric_entries_for_item(item_id),
                                    "sourceType": "DICTIONARY",
                                    "serviceRole": "ASSESSMENT_POINT",
                                    "sourceMappingId": f"mapping:{focus_source_id}:{scope_code}:{service_source_id}",
                                }
                            )
                            focus_record["scoreItemIds"].append(item_id)
                    else:
                        item_id = f"score:{focus_source_id}:overall"
                        score_items.append(
                            {
                                "id": item_id,
                                "itemType": "FOCUS",
                                "capabilityId": capability_id,
                                "focusId": focus_id,
                                "serviceId": None,
                                "scopeCode": None,
                                "scopeName": None,
                                "weight": 1,
                                "sortOrder": 0,
                                "required": True,
                                "elementWeights": {key: 0.25 for key in ELEMENT_KEYS},
                                "rubricEntries": _rubric_entries_for_item(item_id),
                                "sourceType": "DICTIONARY",
                                "serviceRole": None,
                                "platformEvidenceServiceIds": list(focus_record["platformEvidenceServiceIds"]),
                            }
                        )
                        focus_record["scoreItemIds"].append(item_id)
                    focuses.append(focus_record)
                    capability_record["focusIds"].append(focus_id)
                capabilities.append(capability_record)

    snapshot_basis = {
        "categories": [(item["code"], item["name"], item["parentId"]) for item in categories],
        "capabilities": [(item["code"], item["name"], item["categoryId"]) for item in capabilities],
        "focuses": [(item["code"], item["name"], item["capabilityId"]) for item in focuses],
        "focusServiceMappings": [(item["focusId"], item["scopeCode"], item["serviceId"], item["serviceRole"]) for item in focus_service_mappings],
        "scoreItems": [(item["itemType"], item["focusId"], item["serviceId"], item["scopeCode"]) for item in score_items],
        "rubricVersion": RUBRIC_VERSION,
    }
    snapshot_id = f"maturity-template-{_stable_hash(snapshot_basis)}"
    return {
        "id": "sapd-maturity-base-stable-v2.1",
        "snapshotId": snapshot_id,
        "name": "SAPD标准能力成熟度模板",
        "version": "V2.1",
        "type": "base",
        "status": "validated",
        "readOnly": True,
        "structureMutable": False,
        "weightMutable": False,
        "description": "基于当前稳定能力、关注点、安全技术服务和作用域关系生成的只读评估模板。",
        "rubricVersion": RUBRIC_VERSION,
        "categories": categories,
        "capabilities": capabilities,
        "focuses": focuses,
        "services": list(services.values()),
        "focusServiceMappings": focus_service_mappings,
        "scopes": [
            {
                "id": f"scope:{code}",
                "code": code,
                "name": _text(scope_by_code.get(code, {}).get("name")) or ("全部作用域" if code == "ALL" else code),
                "sourceType": "dictionary",
                "isCustom": False,
            }
            for code in ("ALL", "I-AP", "I-DI", "I-HD", "I-NT", "I-OS", "I-PE", "I-US")
        ],
        "scoreItems": score_items,
        "criticalRules": [],
        "elementWeights": {key: 0.25 for key in ELEMENT_KEYS},
        "stats": {
            "topCategories": sum(1 for item in categories if item["level"] == 1),
            "domains": sum(1 for item in categories if item["level"] == 2),
            "capabilities": len(capabilities),
            "focuses": len(focuses),
            "services": len(services),
            "serviceMappings": len(focus_service_mappings),
            "platformEvidenceReferences": sum(1 for item in focus_service_mappings if item["serviceRole"] == "PLATFORM_EVIDENCE_REFERENCE"),
            "serviceItems": sum(1 for item in score_items if item["itemType"] == "SERVICE"),
            "focusItems": sum(1 for item in score_items if item["itemType"] == "FOCUS"),
            "scoreItems": len(score_items),
        },
    }


def validate_maturity_template(template: dict[str, Any]) -> dict[str, Any]:
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    categories = [item for item in _list(template.get("categories")) if isinstance(item, dict)]
    capabilities = [item for item in _list(template.get("capabilities")) if isinstance(item, dict)]
    focuses = [item for item in _list(template.get("focuses")) if isinstance(item, dict)]
    services = [item for item in _list(template.get("services")) if isinstance(item, dict)]
    scopes = [item for item in _list(template.get("scopes")) if isinstance(item, dict)]
    focus_service_mappings = [item for item in _list(template.get("focusServiceMappings")) if isinstance(item, dict)]
    score_items = [item for item in _list(template.get("scoreItems")) if isinstance(item, dict)]

    def duplicate_ids(rows: list[dict[str, Any]]) -> set[str]:
        values = [_text(row.get("id")) for row in rows if _text(row.get("id"))]
        return {value for value, count in Counter(values).items() if count > 1}

    for object_type, rows in (
        ("category", categories),
        ("capability", capabilities),
        ("focus", focuses),
        ("service", services),
        ("scope", scopes),
        ("focus_service_mapping", focus_service_mappings),
        ("score_item", score_items),
    ):
        for duplicate_id in sorted(duplicate_ids(rows)):
            errors.append({"code": "duplicate_id", "objectId": duplicate_id, "message": f"{object_type} 存在重复 ID。"})

    category_by_id = {_text(item.get("id")): item for item in categories if _text(item.get("id"))}
    capability_by_id = {_text(item.get("id")): item for item in capabilities if _text(item.get("id"))}
    focus_by_id = {_text(item.get("id")): item for item in focuses if _text(item.get("id"))}
    service_by_id = {_text(item.get("id")): item for item in services if _text(item.get("id"))}
    scope_codes = {_text(item.get("code")) for item in scopes if _text(item.get("code"))}

    if template.get("type") == "base":
        if template.get("readOnly") is not True or template.get("structureMutable") is not False or template.get("weightMutable") is not False:
            errors.append({"code": "fixed_template_not_read_only", "objectId": _text(template.get("id")), "message": "固定知识库模板必须锁定结构和权重。"})

    for category in categories:
        category_id = _text(category.get("id"))
        if not category_id or not _text(category.get("name")):
            errors.append({"code": "category_incomplete", "objectId": category_id, "message": "分类必须有 ID 和名称。"})
        parent_id = _text(category.get("parentId"))
        if parent_id and parent_id not in category_by_id:
            errors.append({"code": "category_parent_missing", "objectId": category_id, "message": "分类引用的上级分类不存在。"})
        capability_level = _text(category.get("capabilityLevel")) or ("L0" if int(_float(category.get("level"), 1)) == 1 else "L1")
        if capability_level not in {"L0", "L1"}:
            errors.append({"code": "category_capability_level_invalid", "objectId": category_id, "message": "模板分类只能表达能力 L0 或能力 L1。"})
        if capability_level == "L0" and parent_id:
            errors.append({"code": "l0_parent_forbidden", "objectId": category_id, "message": "能力 L0 不得存在上级节点。"})
        if capability_level == "L1" and parent_id:
            parent_level = _text(category_by_id.get(parent_id, {}).get("capabilityLevel")) or "L0"
            if parent_level != "L0":
                errors.append({"code": "l1_parent_invalid", "objectId": category_id, "message": "能力 L1 只能归属能力 L0，或在无 L0 时成为顶级。"})

    focus_ids_by_capability: dict[str, list[str]] = defaultdict(list)
    for focus in focuses:
        focus_id = _text(focus.get("id"))
        capability_id = _text(focus.get("capabilityId"))
        if not focus_id or not _text(focus.get("name")):
            errors.append({"code": "focus_incomplete", "objectId": focus_id, "message": "关注点必须有 ID 和名称。"})
        if capability_id not in capability_by_id:
            errors.append({"code": "focus_capability_missing", "objectId": focus_id, "message": "关注点引用的能力不存在。"})
        focus_ids_by_capability[capability_id].append(focus_id)

    for capability in capabilities:
        capability_id = _text(capability.get("id"))
        if capability.get("included") is False:
            continue
        if not capability_id or not _text(capability.get("name")):
            errors.append({"code": "capability_incomplete", "objectId": capability_id, "message": "纳入评估的能力必须有 ID 和名称。"})
        if _text(capability.get("categoryId")) not in category_by_id:
            errors.append({"code": "capability_category_missing", "objectId": capability_id, "message": "纳入评估的能力必须归属有效分类。"})
        if not focus_ids_by_capability.get(capability_id):
            errors.append({"code": "capability_focus_missing", "objectId": capability_id, "message": "纳入评估的能力至少需要一个关注点。"})

    l1_categories = [item for item in categories if (_text(item.get("capabilityLevel")) or ("L0" if int(_float(item.get("level"), 1)) == 1 else "L1")) == "L1"]
    if not l1_categories:
        errors.append({"code": "template_l1_empty", "objectId": _text(template.get("id")), "message": "模板至少需要一个能力 L1。"})
    for category in l1_categories:
        if not any(_text(capability.get("categoryId")) == _text(category.get("id")) and capability.get("included") is not False for capability in capabilities):
            errors.append({"code": "l1_capability_missing", "objectId": _text(category.get("id")), "message": "每个能力 L1 至少需要一个有效能力 L2。"})

    mapping_by_id: dict[str, dict[str, Any]] = {}
    mapping_keys: set[tuple[str, str, str, str]] = set()
    for mapping in focus_service_mappings:
        mapping_id = _text(mapping.get("id"))
        focus_id = _text(mapping.get("focusId"))
        service_id = _text(mapping.get("serviceId"))
        scope_code = _text(mapping.get("scopeCode"))
        service_role = _text(mapping.get("serviceRole"))
        mapping_by_id[mapping_id] = mapping
        if focus_id not in focus_by_id or service_id not in service_by_id or scope_code not in scope_codes:
            errors.append({"code": "focus_service_mapping_reference_invalid", "objectId": mapping_id, "message": "关注点服务映射必须引用有效关注点、作用域和服务。"})
        if service_role not in SERVICE_ROLES:
            errors.append({"code": "service_role_invalid", "objectId": mapping_id, "message": "服务角色必须为 ASSESSMENT_POINT 或 PLATFORM_EVIDENCE_REFERENCE。"})
        mapping_key = (focus_id, scope_code, service_id, service_role)
        if mapping_key in mapping_keys:
            errors.append({"code": "focus_service_mapping_duplicate", "objectId": mapping_id, "message": "关注点、作用域、服务和服务角色组合必须唯一。"})
        mapping_keys.add(mapping_key)

    item_ids_by_focus: dict[str, list[str]] = defaultdict(list)
    item_types_by_focus: dict[str, set[str]] = defaultdict(set)
    item_keys: set[tuple[str, str, str, str]] = set()
    for item in score_items:
        item_id = _text(item.get("id"))
        focus_id = _text(item.get("focusId"))
        item_type = _text(item.get("itemType"))
        if not item_id or focus_id not in focus_by_id:
            errors.append({"code": "score_item_focus_missing", "objectId": item_id, "message": "评估点必须引用有效关注点。"})
        if item_type not in ASSESSMENT_ITEM_TYPES:
            errors.append({"code": "score_item_type_invalid", "objectId": item_id, "message": "评估点类型必须为 SERVICE 或 FOCUS。"})
        if item_type == "SERVICE" and (not _text(item.get("serviceId")) or not _text(item.get("scopeCode"))):
            errors.append({"code": "score_item_service_missing", "objectId": item_id, "message": "服务评估点必须引用安全技术服务和作用域。"})
        if item_type == "SERVICE" and _text(item.get("serviceId")) not in service_by_id:
            errors.append({"code": "score_item_service_reference_invalid", "objectId": item_id, "message": "服务评估点引用的安全技术服务不存在。"})
        if item_type == "SERVICE" and _text(item.get("scopeCode")) not in scope_codes:
            errors.append({"code": "score_item_scope_reference_invalid", "objectId": item_id, "message": "服务评估点引用的作用域不存在。"})
        if item_type == "FOCUS" and _text(item.get("serviceId")):
            errors.append({"code": "focus_item_service_conflict", "objectId": item_id, "message": "关注点评估点不得引用安全技术服务。"})
        source_mapping_id = _text(item.get("sourceMappingId"))
        if item_type == "SERVICE" and source_mapping_id:
            source_mapping = mapping_by_id.get(source_mapping_id, {})
            if _text(source_mapping.get("serviceRole")) != "ASSESSMENT_POINT":
                errors.append({"code": "score_item_mapping_role_invalid", "objectId": item_id, "message": "服务评估点只能来自 ASSESSMENT_POINT 映射。"})
        if _float(item.get("weight"), 1.0) <= 0:
            errors.append({"code": "score_item_weight_invalid", "objectId": item_id, "message": "评估点权重必须大于 0。"})
        element_weights = {**{key: 0.25 for key in ELEMENT_KEYS}, **_dict(item.get("elementWeights"))}
        if any(_float(element_weights.get(key), -1) < 0 for key in ELEMENT_KEYS) or abs(sum(_float(element_weights.get(key), 0) for key in ELEMENT_KEYS) - 1.0) > 0.000001:
            errors.append({"code": "dimension_weight_invalid", "objectId": item_id, "message": "评估点四维权重必须非负且合计为 1。"})
        rubric_entries = [entry for entry in _list(item.get("rubricEntries")) if isinstance(entry, dict)]
        rubric_keys = {
            (_text(entry.get("dimensionCode")), _text(entry.get("level")))
            for entry in rubric_entries
            if _text(entry.get("criteria")) and _text(entry.get("sourceType")) and _text(entry.get("sourceVersion"))
        }
        expected_rubric_keys = {(dimension, level["id"]) for dimension in ELEMENT_KEYS for level in MATURITY_LEVELS}
        if rubric_keys != expected_rubric_keys:
            errors.append({"code": "rubric_missing", "objectId": item_id, "message": "评估点必须具备四个维度各 L1—L5 的完整评分标准。"})
        item_key = (focus_id, item_type, _text(item.get("scopeCode")), _text(item.get("serviceId")))
        if item_key in item_keys:
            errors.append({"code": "score_item_duplicate_mapping", "objectId": item_id, "message": "关注点、作用域、服务和评估点类型组合必须唯一。"})
        item_keys.add(item_key)
        item_ids_by_focus[focus_id].append(item_id)
        item_types_by_focus[focus_id].add(item_type)

    for focus in focuses:
        focus_id = _text(focus.get("id"))
        if focus.get("included") is False:
            continue
        if not item_ids_by_focus.get(focus_id):
            errors.append({"code": "focus_score_item_missing", "objectId": focus_id, "message": "纳入评估的关注点至少需要一个评估点。"})
        if len(item_types_by_focus.get(focus_id, set())) > 1:
            errors.append({"code": "focus_scoring_mode_conflict", "objectId": focus_id, "message": "同一关注点不能同时生成 SERVICE 和 FOCUS 评估点。"})
        assessment_mappings = [item for item in focus_service_mappings if _text(item.get("focusId")) == focus_id and _text(item.get("serviceRole")) == "ASSESSMENT_POINT"]
        item_types = item_types_by_focus.get(focus_id, set())
        if assessment_mappings and item_types != {"SERVICE"}:
            errors.append({"code": "assessment_mapping_requires_service_items", "objectId": focus_id, "message": "存在 ASSESSMENT_POINT 映射时必须只生成 SERVICE 评估点。"})
        if not assessment_mappings and item_types != {"FOCUS"}:
            errors.append({"code": "focus_item_required_without_assessment_mapping", "objectId": focus_id, "message": "不存在 ASSESSMENT_POINT 映射时必须生成 FOCUS 评估点。"})

    if not categories:
        errors.append({"code": "template_category_empty", "objectId": _text(template.get("id")), "message": "模板至少需要一个分类。"})
    if not capabilities:
        errors.append({"code": "template_capability_empty", "objectId": _text(template.get("id")), "message": "模板至少需要一个能力。"})
    if not score_items:
        errors.append({"code": "template_score_item_empty", "objectId": _text(template.get("id")), "message": "模板至少需要一个评估点。"})

    if template.get("type") == "custom" and not any(item.get("isCustom") for item in capabilities):
        warnings.append({"code": "custom_template_without_custom_capability", "objectId": _text(template.get("id")), "message": "当前自定义模板尚未新增模板内能力，仅调整了基础模板。"})

    validation_basis = {
        "categories": [
            (_text(item.get("id")), _text(item.get("name")), _text(item.get("parentId")), _float(item.get("weight"), 1.0))
            for item in categories
        ],
        "capabilities": [
            (_text(item.get("id")), _text(item.get("name")), _text(item.get("categoryId")), item.get("included") is not False)
            for item in capabilities
        ],
        "focuses": [
            (_text(item.get("id")), _text(item.get("name")), _text(item.get("capabilityId")), _text(item.get("itemType")))
            for item in focuses
        ],
        "focusServiceMappings": [
            (_text(item.get("id")), _text(item.get("focusId")), _text(item.get("scopeCode")), _text(item.get("serviceId")), _text(item.get("serviceRole")))
            for item in focus_service_mappings
        ],
        "scoreItems": [
            (_text(item.get("id")), _text(item.get("itemType")), _text(item.get("focusId")), _text(item.get("scopeCode")), _text(item.get("serviceId")), _float(item.get("weight"), 1.0), _dict(item.get("elementWeights")), _text(template.get("rubricVersion")))
            for item in score_items
        ],
    }
    return {
        "valid": not errors,
        "errors": errors,
        "warnings": warnings,
        "snapshotId": f"maturity-template-{_stable_hash(validation_basis)}" if not errors else None,
        "stats": {
            "categories": len(categories),
            "capabilities": sum(1 for item in capabilities if item.get("included") is not False),
            "focuses": sum(1 for item in focuses if item.get("included") is not False),
            "scoreItems": len(score_items),
        },
    }


def _entry_dimensions(entry: dict[str, Any]) -> dict[str, float | None]:
    self_values = _dict(entry.get("elements"))
    review_values = _dict(entry.get("reviewElements"))
    return {
        key: maturity_level_index(review_values.get(key) or self_values.get(key))
        for key in ELEMENT_KEYS
    }


def _entry_index(item: dict[str, Any], entry: dict[str, Any], template: dict[str, Any]) -> float | None:
    element_values = _entry_dimensions(entry)
    if any(element_values.get(key) is None for key in ELEMENT_KEYS):
        return None
    configured_weights = {
        **{key: 0.25 for key in ELEMENT_KEYS},
        **_dict(template.get("elementWeights")),
        **_dict(item.get("elementWeights")),
    }
    rows = [
        (element_values.get(key), _float(configured_weights.get(key), 0.25))
        for key in ELEMENT_KEYS
    ]
    return _weighted_average(rows)


def _result_record(
    *,
    object_id: str,
    code: str,
    name: str,
    current_index: float | None,
    target_index: float | None,
    completion_rate: float,
    evidence_coverage: float,
    weight: float = 1.0,
    status: str = "draft",
    **extra: Any,
) -> dict[str, Any]:
    current_level = maturity_level_from_index(current_index)
    target_level = maturity_level_from_index(target_index)
    gap_index = max(0.0, float(target_index) - float(current_index)) if current_index is not None and target_index is not None else None
    target_achievement_rate = _target_achievement_rate(current_index, target_index)
    return {
        "id": object_id,
        "code": code,
        "name": name,
        "currentIndex": _round(current_index),
        "currentLevel": current_level,
        "currentLevelName": LEVEL_NAME.get(current_level, "未评分"),
        "currentPercent": _round(current_index * 20, 1) if current_index is not None else 0,
        "targetIndex": _round(target_index),
        "targetLevel": target_level,
        "targetAchievementRate": _round(target_achievement_rate, 1),
        "gapIndex": _round(gap_index),
        "gapPercent": _round(gap_index * 20, 1) if gap_index is not None else None,
        "completionRate": _round(completion_rate, 1),
        "evidenceCoverage": _round(evidence_coverage, 1),
        "weight": weight,
        "status": status,
        **extra,
    }


def calculate_maturity_assessment(payload: dict[str, Any]) -> dict[str, Any]:
    template = _dict(payload.get("template"))
    project = _dict(payload.get("project"))
    validation = validate_maturity_template(template)
    if not validation["valid"]:
        return {
            "ok": False,
            "dataState": "invalid_template",
            "validation": validation,
            "summary": {},
            "categoryResults": [],
            "capabilityResults": [],
            "focusResults": [],
            "gapItems": [],
        }

    categories = [item for item in _list(template.get("categories")) if isinstance(item, dict)]
    capabilities = [item for item in _list(template.get("capabilities")) if isinstance(item, dict) and item.get("included") is not False]
    focuses = [item for item in _list(template.get("focuses")) if isinstance(item, dict) and item.get("included") is not False]
    score_items = [item for item in _list(template.get("scoreItems")) if isinstance(item, dict)]
    services = {_text(item.get("id")): item for item in _list(template.get("services")) if isinstance(item, dict)}
    entries = {
        _text(item.get("scoreItemId")): item
        for item in _list(payload.get("scoreEntries"))
        if isinstance(item, dict) and _text(item.get("scoreItemId"))
    }
    category_by_id = {_text(item.get("id")): item for item in categories}
    capability_by_id = {_text(item.get("id")): item for item in capabilities}
    focus_by_id = {_text(item.get("id")): item for item in focuses}
    included_capability_ids = set(capability_by_id)
    included_focus_ids = {item_id for item_id, item in focus_by_id.items() if _text(item.get("capabilityId")) in included_capability_ids}
    item_results: list[dict[str, Any]] = []
    evidence_counts = Counter({item["id"]: 0 for item in EVIDENCE_LEVELS})
    score_status_counts = Counter()
    four_element_rows: list[dict[str, Any]] = []
    enforce_target_floor = _text(project.get("status")) not in {"completed", "reported", "archived"}

    for item in score_items:
        focus_id = _text(item.get("focusId"))
        if focus_id not in included_focus_ids:
            continue
        entry = entries.get(_text(item.get("id")), {})
        is_applicable = entry.get("isApplicable") is not False
        status = "not_applicable" if not is_applicable else "not_scored"
        current_index = None if not is_applicable else _entry_index(item, entry, template)
        dimension_results = _entry_dimensions(entry) if is_applicable else {key: None for key in ELEMENT_KEYS}
        target_index = maturity_level_index(entry.get("targetLevel")) if is_applicable else None
        current_level = maturity_level_from_index(current_index)
        minimum_target_index = maturity_level_index(current_level) if current_index is not None else None
        target_below_current = bool(
            enforce_target_floor
            and is_applicable
            and target_index is not None
            and minimum_target_index is not None
            and target_index < minimum_target_index
        )
        target_reason = _text(entry.get("targetReason"))
        na_reason = _text(entry.get("naReason"))
        is_complete = True if not is_applicable else current_index is not None and target_index is not None and not target_below_current
        if is_applicable and current_index is not None:
            has_review = all(maturity_level_index(_dict(entry.get("reviewElements")).get(key)) is not None for key in ELEMENT_KEYS)
            status = "invalid_target" if target_below_current else "confirmed" if has_review or entry.get("status") == "confirmed" else "scored" if is_complete else "incomplete"
        elif is_applicable:
            status = "incomplete"
        evidence_level = _text(entry.get("evidenceLevel") or "E0").upper()
        if evidence_level not in {item["id"] for item in EVIDENCE_LEVELS}:
            evidence_level = "E0"
        if current_index is not None:
            evidence_counts[evidence_level] += 1
        score_status_counts[status] += 1
        item_type = _text(item.get("itemType"))
        service = services.get(_text(item.get("serviceId")), {})
        result = {
            "id": _text(item.get("id")),
            "itemType": item_type,
            "capabilityId": _text(item.get("capabilityId")),
            "focusId": focus_id,
            "serviceId": _text(item.get("serviceId")) or None,
            "serviceCode": _text(service.get("code")),
            "serviceName": _text(service.get("name")),
            "scopeCode": _text(item.get("scopeCode")),
            "scopeName": _text(item.get("scopeName")),
            "currentIndex": current_index,
            "currentLevel": current_level,
            "minimumTargetLevel": current_level if current_index is not None else None,
            "currentPercent": _round(current_index * 20, 1) if current_index is not None else 0,
            "dimensionResults": {key: _round(dimension_results.get(key)) for key in ELEMENT_KEYS},
            "targetIndex": target_index,
            "targetLevel": maturity_level_from_index(target_index),
            "targetAchievementRate": _round(_target_achievement_rate(current_index, target_index), 1),
            "targetReason": target_reason,
            "targetConfirmed": bool(target_index is not None),
            "weight": max(_float(item.get("weight"), 1.0), 0.0001),
            "isApplicable": is_applicable,
            "evidenceLevel": evidence_level,
            "hasEvidence": evidence_level != "E0" or bool(_text(entry.get("evidenceSummary"))),
            "status": status,
            "isComplete": is_complete,
            "targetBelowCurrent": target_below_current,
            "naReason": na_reason,
            "note": _text(entry.get("note")),
        }
        item_results.append(result)
        if current_index is not None:
            four_element_rows.append(
                {
                    "focusId": focus_id,
                    **dimension_results,
                }
            )

    item_results_by_focus: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for result in item_results:
        item_results_by_focus[result["focusId"]].append(result)

    focus_results: list[dict[str, Any]] = []
    for focus in focuses:
        focus_id = _text(focus.get("id"))
        if focus_id not in included_focus_ids:
            continue
        rows = item_results_by_focus.get(focus_id, [])
        applicable = [row for row in rows if row["isApplicable"]]
        scored = [row for row in applicable if row["currentIndex"] is not None]
        current_index = _weighted_average([(row["currentIndex"], row["weight"]) for row in scored])
        target_index = _weighted_average([(row["targetIndex"], row["weight"]) for row in applicable if row["targetIndex"] is not None])
        dimension_results = {
            key: _weighted_average([(row["dimensionResults"].get(key), row["weight"]) for row in scored])
            for key in ELEMENT_KEYS
        }
        completed = [row for row in applicable if row["isComplete"]]
        completion_rate = 100.0 * len(completed) / len(applicable) if applicable else 0.0
        evidence_coverage = 100.0 * sum(1 for row in scored if row["hasEvidence"]) / len(scored) if scored else 0.0
        result_status = "not_applicable" if rows and not applicable else "ready" if len(completed) == len(applicable) and applicable else "partial"
        focus_results.append(
            _result_record(
                object_id=focus_id,
                code=_text(focus.get("code")),
                name=_text(focus.get("name")),
                current_index=current_index,
                target_index=target_index,
                completion_rate=completion_rate,
                evidence_coverage=evidence_coverage,
                weight=max(_float(focus.get("weight"), 1.0), 0.0001),
                status=result_status,
                capabilityId=_text(focus.get("capabilityId")),
                itemType=_text(focus.get("itemType")),
                dimensionResults={key: _round(value) for key, value in dimension_results.items()},
                scoreItemCount=len(rows),
                applicableItemCount=len(applicable),
                scoredItemCount=len(scored),
                completedItemCount=len(completed),
                notApplicableItemCount=len(rows) - len(applicable),
                evidenceItemCount=sum(1 for row in scored if row["hasEvidence"]),
            )
        )

    focus_results_by_capability: dict[str, list[dict[str, Any]]] = defaultdict(list)
    focus_result_by_id = {item["id"]: item for item in focus_results}
    for result in focus_results:
        focus_results_by_capability[result["capabilityId"]].append(result)

    capability_results: list[dict[str, Any]] = []
    for capability in capabilities:
        capability_id = _text(capability.get("id"))
        rows = focus_results_by_capability.get(capability_id, [])
        applicable_rows = [row for row in rows if row["status"] != "not_applicable"]
        scored = [row for row in rows if row["currentIndex"] is not None]
        target_rows = [row for row in rows if row["targetIndex"] is not None and row["status"] != "not_applicable"]
        current_index = _weighted_average([(row["currentIndex"], row["weight"]) for row in scored])
        target_index = _weighted_average([(row["targetIndex"], row["weight"]) for row in target_rows])
        applicable_item_count = sum(int(row.get("applicableItemCount", 0)) for row in applicable_rows)
        completed_item_count = sum(int(row.get("completedItemCount", 0)) for row in applicable_rows)
        not_applicable_item_count = sum(int(row.get("notApplicableItemCount", 0)) for row in rows)
        completion_rate = 100.0 * completed_item_count / applicable_item_count if applicable_item_count else 0.0
        evidence_coverage = sum(row["evidenceCoverage"] for row in scored) / len(scored) if scored else 0.0
        dimension_results = {
            key: _weighted_average([(row.get("dimensionResults", {}).get(key), row["weight"]) for row in scored])
            for key in ELEMENT_KEYS
        }
        applied_rules: list[dict[str, Any]] = []
        for rule in _list(template.get("criticalRules")):
            if not isinstance(rule, dict) or _text(rule.get("capabilityId")) != capability_id:
                continue
            trigger = focus_result_by_id.get(_text(rule.get("triggerFocusId")))
            threshold = maturity_level_index(rule.get("thresholdLevel"))
            cap_index = maturity_level_index(rule.get("capLevel"))
            if trigger and trigger["currentIndex"] is not None and threshold is not None and cap_index is not None and trigger["currentIndex"] < threshold:
                before = current_index
                current_index = min(current_index, cap_index) if current_index is not None else current_index
                applied_rules.append(
                    {
                        "id": _text(rule.get("id")),
                        "name": _text(rule.get("name")) or "关键项上限",
                        "triggerFocusId": trigger["id"],
                        "capLevel": maturity_level_from_index(cap_index),
                        "beforeIndex": _round(before),
                        "afterIndex": _round(current_index),
                    }
                )
        capability_results.append(
            _result_record(
                object_id=capability_id,
                code=_text(capability.get("code")),
                name=_text(capability.get("name")),
                current_index=current_index,
                target_index=target_index,
                completion_rate=completion_rate,
                evidence_coverage=evidence_coverage,
                weight=max(_float(capability.get("weight"), 1.0), 0.0001),
                status="not_applicable" if rows and not applicable_rows else "ready" if completion_rate >= 100 and applicable_item_count else "partial",
                categoryId=_text(capability.get("categoryId")),
                topCategoryId=_text(capability.get("topCategoryId")),
                focusCount=len(rows),
                applicableFocusCount=len(applicable_rows),
                applicableItemCount=applicable_item_count,
                completedItemCount=completed_item_count,
                notApplicableItemCount=not_applicable_item_count,
                dimensionResults={key: _round(value) for key, value in dimension_results.items()},
                appliedCriticalRules=applied_rules,
                businessImportance=max(0.0, min(5.0, _float(capability.get("businessImportance"), 3.0))),
                riskUrgency=max(0.0, min(5.0, _float(capability.get("riskUrgency"), 3.0))),
            )
        )

    capability_results_by_category: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for result in capability_results:
        capability_results_by_category[result["categoryId"]].append(result)

    def aggregate_category(category: dict[str, Any], rows: list[dict[str, Any]], *, child_count: int = 0) -> dict[str, Any]:
        scored = [row for row in rows if row["currentIndex"] is not None]
        applicable_rows = [row for row in rows if row["status"] != "not_applicable"]
        targeted = [row for row in applicable_rows if row["targetIndex"] is not None]
        current_index = _weighted_average([(row["currentIndex"], row["weight"]) for row in scored])
        target_index = _weighted_average([(row["targetIndex"], row["weight"]) for row in targeted])
        applicable_item_count = sum(int(row.get("applicableItemCount", 0)) for row in applicable_rows)
        completed_item_count = sum(int(row.get("completedItemCount", 0)) for row in applicable_rows)
        not_applicable_item_count = sum(int(row.get("notApplicableItemCount", 0)) for row in rows)
        completion_rate = 100.0 * completed_item_count / applicable_item_count if applicable_item_count else 0.0
        evidence_coverage = sum(row["evidenceCoverage"] for row in scored) / len(scored) if scored else 0.0
        dimension_results = {
            key: _weighted_average([(row.get("dimensionResults", {}).get(key), row["weight"]) for row in scored])
            for key in ELEMENT_KEYS
        }
        return _result_record(
            object_id=_text(category.get("id")),
            code=_text(category.get("code")),
            name=_text(category.get("name")),
            current_index=current_index,
            target_index=target_index,
            completion_rate=completion_rate,
            evidence_coverage=evidence_coverage,
            weight=max(_float(category.get("weight"), 1.0), 0.0001),
            status="not_applicable" if rows and not applicable_rows else "ready" if completion_rate >= 100 and applicable_item_count else "partial",
            parentId=_text(category.get("parentId")) or None,
            level=int(_float(category.get("level"), 1)),
            capabilityCount=sum(int(row.get("capabilityCount", 1)) for row in rows),
            childCategoryCount=child_count,
            applicableItemCount=applicable_item_count,
            completedItemCount=completed_item_count,
            notApplicableItemCount=not_applicable_item_count,
            dimensionResults={key: _round(value) for key, value in dimension_results.items()},
        )

    def category_capability_level(category: dict[str, Any]) -> str:
        return _text(category.get("capabilityLevel")) or ("L0" if int(_float(category.get("level"), 1)) == 1 else "L1")

    leaf_category_results: list[dict[str, Any]] = []
    for category in categories:
        category_id = _text(category.get("id"))
        if category_capability_level(category) != "L1":
            continue
        leaf_category_results.append(aggregate_category(category, capability_results_by_category.get(category_id, [])))

    leaf_by_parent: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for result in leaf_category_results:
        leaf_by_parent[_text(result.get("parentId"))].append(result)

    top_category_results: list[dict[str, Any]] = []
    l0_ids = {_text(category.get("id")) for category in categories if category_capability_level(category) == "L0"}
    for category in categories:
        if category_capability_level(category) != "L0":
            continue
        category_id = _text(category.get("id"))
        child_rows = leaf_by_parent.get(category_id, [])
        direct_rows = capability_results_by_category.get(category_id, [])
        aggregate_rows = child_rows + direct_rows
        top_category_results.append(aggregate_category(category, aggregate_rows, child_count=len(child_rows)))
    top_category_results.extend(
        result
        for result in leaf_category_results
        if not _text(result.get("parentId")) or _text(result.get("parentId")) not in l0_ids
    )

    top_for_overall = [
        result
        for result in top_category_results
        if category_by_id.get(result["id"], {}).get("includedInOverall") is not False
    ]
    scored_top = [row for row in top_for_overall if row["currentIndex"] is not None]
    target_top = [row for row in top_for_overall if row["targetIndex"] is not None]
    overall_index = _weighted_average([(row["currentIndex"], row["weight"]) for row in scored_top])
    overall_target = _weighted_average([(row["targetIndex"], row["weight"]) for row in target_top])
    overall_dimensions = {
        key: _weighted_average([(row.get("dimensionResults", {}).get(key), row["weight"]) for row in scored_top])
        for key in ELEMENT_KEYS
    }
    applicable_item_count = sum(1 for row in item_results if row["isApplicable"])
    scored_item_count = sum(1 for row in item_results if row["isApplicable"] and row["isComplete"])
    evidence_item_count = sum(1 for row in item_results if row["currentIndex"] is not None and row["hasEvidence"])
    completion_rate = 100.0 * scored_item_count / applicable_item_count if applicable_item_count else 0.0
    evidence_coverage = 100.0 * evidence_item_count / scored_item_count if scored_item_count else 0.0
    invalid_na_reason_count = sum(1 for row in item_results if not row["isApplicable"] and not row["naReason"])
    target_below_current_count = score_status_counts["invalid_target"]
    statistics_ready = bool(
        applicable_item_count
        and scored_item_count == applicable_item_count
        and target_below_current_count == 0
    )
    result_status = "reviewed" if project.get("status") in {"completed", "reported", "archived"} else "draft"
    summary = _result_record(
        object_id=_text(project.get("id")) or "assessment-project",
        code="",
        name=_text(project.get("name")) or "成熟度评估项目",
        current_index=overall_index,
        target_index=overall_target,
        completion_rate=completion_rate,
        evidence_coverage=evidence_coverage,
        status=result_status,
        scoreItemCount=len(item_results),
        capabilityCount=len(capability_results),
        applicableCapabilityCount=sum(1 for row in capability_results if row["status"] != "not_applicable"),
        completedCapabilityCount=sum(1 for row in capability_results if row["status"] == "ready"),
        focusCount=len(focus_results),
        applicableFocusCount=sum(1 for row in focus_results if row["status"] != "not_applicable"),
        completedFocusCount=sum(1 for row in focus_results if row["status"] == "ready"),
        applicableItemCount=applicable_item_count,
        scoredItemCount=scored_item_count,
        evidenceItemCount=evidence_item_count,
        notApplicableCount=score_status_counts["not_applicable"],
        notScoredCount=score_status_counts["not_scored"] + score_status_counts["incomplete"] + target_below_current_count,
        missingTargetCount=sum(1 for row in item_results if row["isApplicable"] and row["targetIndex"] is None),
        missingTargetReasonCount=sum(1 for row in item_results if row["isApplicable"] and not row["targetReason"]),
        invalidNaReasonCount=invalid_na_reason_count,
        targetBelowCurrentCount=target_below_current_count,
        statisticsReady=statistics_ready,
        resultAvailability="ready" if statistics_ready else "incomplete",
        confirmedCount=score_status_counts["confirmed"],
        templateSnapshotId=_text(template.get("snapshotId")),
        knowledgeSnapshotId=_text(project.get("knowledgeSnapshotId") or template.get("knowledgeSnapshotId") or template.get("snapshotId")),
        algorithmVersion=ALGORITHM_VERSION,
        assessmentObjectType="ENTERPRISE_ORGANIZATION",
        customerProfileSnapshot=_dict(project.get("customerContextSnapshot")) or {
            "organization": _text(project.get("organization")),
            "industry": _text(project.get("industry")),
            "companySize": _text(project.get("companySize")),
            "customerCharacteristics": _text(project.get("customerCharacteristics")),
            "constraints": _text(project.get("constraints")),
        },
        dimensionResults={key: _round(value) for key, value in overall_dimensions.items()},
    )

    gap_items: list[dict[str, Any]] = []
    for capability in capability_results:
        if capability["gapIndex"] is None or capability["gapIndex"] <= 0:
            continue
        gap_norm = capability["gapIndex"] / 4.0
        business_norm = capability["businessImportance"] / 5.0
        risk_norm = capability["riskUrgency"] / 5.0
        priority_score = 100.0 * (0.50 * gap_norm + 0.25 * business_norm + 0.25 * risk_norm)
        priority = "高" if priority_score >= 70 else "中" if priority_score >= 40 else "低"
        category = category_by_id.get(capability["categoryId"], {})
        related_focus_ids = [item["id"] for item in focus_results_by_capability.get(capability["id"], []) if item["gapIndex"] and item["gapIndex"] > 0]
        related_services = []
        for item in item_results:
            if item["focusId"] not in related_focus_ids or not item["serviceId"]:
                continue
            service_label = " ".join(part for part in (item["serviceCode"], item["serviceName"]) if part)
            if service_label and service_label not in related_services:
                related_services.append(service_label)
        gap_items.append(
            {
                "id": f"gap:{capability['id']}",
                "categoryId": capability["categoryId"],
                "categoryName": _text(category.get("name")),
                "capabilityId": capability["id"],
                "capabilityCode": capability["code"],
                "capabilityName": capability["name"],
                "currentIndex": capability["currentIndex"],
                "currentLevel": capability["currentLevel"],
                "targetIndex": capability["targetIndex"],
                "targetLevel": capability["targetLevel"],
                "gapIndex": capability["gapIndex"],
                "gapPercent": capability["gapPercent"],
                "priorityScore": _round(priority_score, 1),
                "priority": priority,
                "evidenceCoverage": capability["evidenceCoverage"],
                "relatedServices": related_services[:6],
                "recommendationStatus": "candidate",
                "recommendations": [
                    {"type": "组织与角色", "text": "明确责任部门、岗位职责、流程所有者和协同关系。"},
                    {"type": "制度与流程", "text": "建立或完善制度、流程、审批、复核和例外管理。"},
                    {"type": "平台与工具", "text": "结合关注点、作用域和已关联安全技术服务确认建设范围。"},
                    {"type": "数据与信息", "text": "补充日志、工单、指标、报告、审计和持续监测证据。"},
                ],
            }
        )
    gap_items.sort(key=lambda item: (-float(item["priorityScore"]), -float(item["gapIndex"]), item["capabilityCode"]))

    maturity_distribution = Counter({item["id"]: 0 for item in MATURITY_LEVELS})
    for capability in capability_results:
        if capability["currentLevel"] in LEVEL_INDEX:
            maturity_distribution[capability["currentLevel"]] += 1

    service_distribution = Counter({item["id"]: 0 for item in MATURITY_LEVELS})
    service_distribution.update({"N/A": 0, "Not Scored": 0})
    for item in item_results:
        if item["itemType"] != "SERVICE":
            continue
        if not item["isApplicable"]:
            service_distribution["N/A"] += 1
        elif item["currentLevel"] in LEVEL_INDEX:
            service_distribution[item["currentLevel"]] += 1
        else:
            service_distribution["Not Scored"] += 1

    four_element_summary = []
    for key in ELEMENT_KEYS:
        average = _weighted_average([(row.get(key), 1.0) for row in four_element_rows])
        four_element_summary.append(
            {
                "id": key,
                "name": ELEMENT_LABELS[key],
                "currentIndex": _round(average),
                "currentLevel": maturity_level_from_index(average),
                "currentPercent": _round(average * 20, 1) if average is not None else 0,
            }
        )

    input_basis = {
        "projectId": project.get("id"),
        "templateSnapshotId": template.get("snapshotId"),
        "knowledgeSnapshotId": summary.get("knowledgeSnapshotId"),
        "algorithmVersion": ALGORITHM_VERSION,
        "entries": _list(payload.get("scoreEntries")),
    }
    response = {
        "ok": True,
        "dataState": "ready",
        "mode": "controlled_demo",
        "calculatedAt": _now(),
        "validation": validation,
        "summary": summary,
        "categoryResults": top_category_results,
        "subCategoryResults": leaf_category_results,
        "capabilityResults": capability_results,
        "focusResults": focus_results,
        "scoreItemResults": item_results,
        "gapItems": gap_items,
        "maturityDistribution": [
            {"level": item["id"], "name": item["name"], "count": maturity_distribution[item["id"]]}
            for item in MATURITY_LEVELS
        ],
        "serviceDistribution": [
            {"level": level, "count": service_distribution[level]}
            for level in ("L1", "L2", "L3", "L4", "L5", "N/A", "Not Scored")
        ],
        "evidenceDistribution": [
            {"level": item["id"], "name": item["name"], "count": evidence_counts[item["id"]]}
            for item in EVIDENCE_LEVELS
        ],
        "fourElementResults": four_element_summary,
    }
    response["calculationRun"] = {
        "id": f"maturity-calc-{_stable_hash(input_basis, 20)}",
        "algorithmVersion": ALGORITHM_VERSION,
        "templateSnapshotId": _text(template.get("snapshotId")),
        "knowledgeSnapshotId": _text(summary.get("knowledgeSnapshotId")),
        "inputHash": _stable_hash(input_basis, 32),
        "resultHash": _stable_hash({key: response[key] for key in ("summary", "categoryResults", "capabilityResults", "gapItems")}, 32),
        "status": "formal" if summary.get("completionRate") == 100 and project.get("status") in {"completed", "reported", "archived"} else "draft",
    }
    return response


def _demo_score_entries(
    template: dict[str, Any],
    *,
    variant: int,
    complete: bool,
    reviewed: bool,
    target_conflict_count: int | None = None,
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    remaining_target_conflicts = max(0, int(target_conflict_count or 0))
    for index, item in enumerate(_list(template.get("scoreItems"))):
        item_id = _text(item.get("id"))
        digest = int(hashlib.sha1(f"{variant}:{item_id}".encode("utf-8")).hexdigest()[:8], 16)
        is_applicable = digest % 37 != 0
        is_unscored = not complete and digest % 11 == 0
        level_number = 2 + digest % 3
        evidence_number = 1 + digest % 4
        elements = {
            key: None if is_unscored or not is_applicable else f"L{max(1, min(5, level_number + ((digest >> offset) % 3) - 1))}"
            for offset, key in enumerate(ELEMENT_KEYS)
        }
        target_level = "L4" if digest % 7 else "L3"
        if target_conflict_count is not None and is_applicable and not is_unscored:
            current_index = _entry_index(item, {"elements": elements}, template)
            current_level = maturity_level_from_index(current_index)
            current_level_index = int(maturity_level_index(current_level) or 1)
            if remaining_target_conflicts and current_level_index > 1:
                target_level = f"L{current_level_index - 1}"
                remaining_target_conflicts -= 1
            elif (maturity_level_index(target_level) or 0) < current_level_index:
                target_level = current_level
        entry = {
            "scoreItemId": item_id,
            "isApplicable": is_applicable,
            "elements": elements,
            "reviewElements": elements if reviewed and is_applicable and not is_unscored else {},
            "targetLevel": target_level,
            "targetReason": "结合业务重要性、风险与实施可行性建议目标等级。" if is_applicable and not is_unscored else "",
            "targetConfirmed": bool(is_applicable and not is_unscored),
            "evidenceLevel": "E0" if is_unscored or not is_applicable else f"E{evidence_number}",
            "evidenceSummary": "" if is_unscored or not is_applicable else "当前评估证据说明，用于记录工作流判断依据。",
            "note": "" if index % 5 else "当前项目仍为本地草稿，未经复核不代表正式客户结论。",
            "naReason": "当前评估范围不适用。" if not is_applicable else "",
            "status": "not_applicable" if not is_applicable else "incomplete" if is_unscored else "confirmed" if reviewed else "scored",
        }
        entries.append(entry)
    if target_conflict_count is not None and remaining_target_conflicts:
        raise ValueError(f"受控 demo 无法生成约定的 {target_conflict_count} 个目标等级冲突。")
    return entries


def _project_detail(
    template: dict[str, Any],
    *,
    project_id: str,
    name: str,
    organization: str,
    status: str,
    variant: int,
    complete: bool,
    reviewed: bool,
    industry: str,
    company_size: str,
    target_conflict_count: int | None = None,
) -> dict[str, Any]:
    template = deepcopy(template)
    project = {
        "id": project_id,
        "name": name,
        "organization": organization,
        "assessmentObjectType": "ENTERPRISE_ORGANIZATION",
        "industry": industry,
        "companySize": company_size,
        "customerCharacteristics": "当前企业组织的评估背景与目标范围。",
        "constraints": "当前项目约束不改变已记录的事实评分。",
        "plannedStartDate": "2026-07-01",
        "plannedEndDate": "2026-07-31",
        "owner": "项目负责人",
        "assessors": ["评估人员"],
        "status": status,
        "statusLabel": PROJECT_STATUS_LABELS.get(status, status),
        "templateId": template["id"],
        "templateName": template["name"],
        "templateType": template["type"],
        "templateSnapshotId": template["snapshotId"],
        "knowledgeSnapshotId": template["snapshotId"],
        "algorithmVersion": ALGORITHM_VERSION,
        "customerContextSnapshot": {
            "organization": organization,
            "industry": industry,
            "companySize": company_size,
            "customerCharacteristics": "当前企业组织的评估背景与目标范围。",
            "constraints": "当前项目约束不改变已记录的事实评分。",
        },
        "updatedAt": f"2026-07-{10 - variant:02d} {9 + variant:02d}:20",
        "mode": "controlled_demo",
        "readOnly": status in {"completed", "reported", "archived"},
    }
    if target_conflict_count is not None:
        project["controlledDemoRevision"] = f"target-conflicts-{target_conflict_count}-20260716"
    entries = _demo_score_entries(
        template,
        variant=variant,
        complete=complete,
        reviewed=reviewed,
        target_conflict_count=target_conflict_count,
    )
    result = calculate_maturity_assessment({"project": project, "template": template, "scoreEntries": entries})
    return {"project": project, "template": template, "scoreEntries": entries, "result": result}


def build_maturity_workspace(capability_workbench: dict[str, Any]) -> dict[str, Any]:
    template = build_maturity_base_template(capability_workbench)
    project_details = {
        "demo-project-001": _project_detail(
            template,
            project_id="demo-project-001",
            name="某集团网络安全成熟度评估",
            organization="某集团",
            status="scoring",
            variant=1,
            complete=False,
            reviewed=False,
            industry="综合集团",
            company_size="大型企业",
            target_conflict_count=3,
        ),
        "demo-project-002": _project_detail(
            template,
            project_id="demo-project-002",
            name="某金融企业成熟度评估",
            organization="某金融企业",
            status="completed",
            variant=2,
            complete=True,
            reviewed=True,
            industry="金融",
            company_size="大型企业",
        ),
        "demo-project-003": _project_detail(
            template,
            project_id="demo-project-003",
            name="某科技企业成熟度评估",
            organization="某科技企业",
            status="reported",
            variant=3,
            complete=True,
            reviewed=True,
            industry="科技",
            company_size="中型企业",
        ),
    }
    projects = []
    for detail in project_details.values():
        project = detail["project"]
        summary = _dict(detail["result"].get("summary"))
        projects.append(
            {
                **project,
                "currentIndex": summary.get("currentIndex"),
                "currentLevel": summary.get("currentLevel"),
                "currentPercent": summary.get("currentPercent"),
                "completionRate": summary.get("completionRate"),
                "evidenceCoverage": summary.get("evidenceCoverage"),
                "notScoredCount": summary.get("notScoredCount"),
            }
        )
    return {
        "dataState": "ready",
        "mode": "controlled_demo",
        "persistence": "browser_local_only",
        "notice": "项目草稿保存在当前浏览器，不写正式 SQLite、正式 JSON 或用户库。",
        "levels": list(MATURITY_LEVELS),
        "evidenceLevels": list(EVIDENCE_LEVELS),
        "projectStatuses": [{"id": key, "name": value} for key, value in PROJECT_STATUS_LABELS.items()],
        "template": template,
        "projects": projects,
        "projectDetails": project_details,
        "dictionarySnapshot": {
            "id": template["snapshotId"],
            "label": "当前稳定能力字典快照",
            "scopePolicy": "dictionary_mappings_only",
            "scopeCodes": ["ALL", "I-AP", "I-DI", "I-HD", "I-NT", "I-OS", "I-PE", "I-US"],
            "stats": template["stats"],
        },
    }


def _template_structure_basis(template: dict[str, Any]) -> dict[str, Any]:
    return {
        "templateId": _text(template.get("id")),
        "templateVersion": _text(template.get("version")),
        "templateSnapshotId": _text(template.get("snapshotId")),
        "categories": [
            (_text(item.get("id")), _text(item.get("capabilityLevel")), _text(item.get("parentId")), _text(item.get("name")))
            for item in _list(template.get("categories"))
            if isinstance(item, dict)
        ],
        "capabilities": [
            (_text(item.get("id")), _text(item.get("categoryId")), _text(item.get("name")), item.get("included") is not False)
            for item in _list(template.get("capabilities"))
            if isinstance(item, dict)
        ],
        "focuses": [
            (_text(item.get("id")), _text(item.get("capabilityId")), _text(item.get("name")), item.get("included") is not False)
            for item in _list(template.get("focuses"))
            if isinstance(item, dict)
        ],
        "focusServiceMappings": [
            (_text(item.get("id")), _text(item.get("focusId")), _text(item.get("scopeCode")), _text(item.get("serviceId")), _text(item.get("serviceRole")))
            for item in _list(template.get("focusServiceMappings"))
            if isinstance(item, dict)
        ],
        "scoreItems": [
            (_text(item.get("id")), _text(item.get("itemType")), _text(item.get("focusId")), _text(item.get("scopeCode")), _text(item.get("serviceId")), _float(item.get("weight"), 1.0), _dict(item.get("elementWeights")))
            for item in _list(template.get("scoreItems"))
            if isinstance(item, dict)
        ],
    }


def _template_structure_hash(template: dict[str, Any]) -> str:
    return _stable_hash(_template_structure_basis(template), 32)


def export_maturity_score_exchange(payload: dict[str, Any]) -> dict[str, Any]:
    project = _dict(payload.get("project"))
    template = _dict(payload.get("template"))
    validation = validate_maturity_template(template)
    if not validation["valid"]:
        return {"ok": False, "dataState": "invalid_template", "validation": validation}

    entry_by_id = {
        _text(item.get("scoreItemId")): item
        for item in _list(payload.get("scoreEntries"))
        if isinstance(item, dict) and _text(item.get("scoreItemId"))
    }
    capability_by_id = {_text(item.get("id")): item for item in _list(template.get("capabilities")) if isinstance(item, dict)}
    focus_by_id = {_text(item.get("id")): item for item in _list(template.get("focuses")) if isinstance(item, dict)}
    service_by_id = {_text(item.get("id")): item for item in _list(template.get("services")) if isinstance(item, dict)}
    assessment_items = []
    score_input = []
    for item in _list(template.get("scoreItems")):
        if not isinstance(item, dict):
            continue
        item_id = _text(item.get("id"))
        focus = focus_by_id.get(_text(item.get("focusId")), {})
        capability = capability_by_id.get(_text(focus.get("capabilityId")), {})
        service = service_by_id.get(_text(item.get("serviceId")), {})
        assessment_items.append(
            {
                "itemInstanceId": item_id,
                "templateItemId": item_id,
                "capabilityL2Code": _text(capability.get("code")),
                "capabilityL2Name": _text(capability.get("name")),
                "focusCode": _text(focus.get("code")),
                "focusName": _text(focus.get("name")),
                "itemType": _text(item.get("itemType")),
                "scopeCode": _text(item.get("scopeCode")) or None,
                "serviceCode": _text(service.get("code")) or None,
                "serviceName": _text(service.get("name")) or None,
                "sortOrder": item.get("sortOrder"),
            }
        )
        entry = entry_by_id.get(item_id, {})
        score_input.append(
            {
                "itemInstanceId": item_id,
                "isApplicable": entry.get("isApplicable") is not False,
                "organizationLevel": _dict(entry.get("elements")).get("organization"),
                "processLevel": _dict(entry.get("elements")).get("process"),
                "toolLevel": _dict(entry.get("elements")).get("tool"),
                "dataLevel": _dict(entry.get("elements")).get("data"),
                "targetLevel": entry.get("targetLevel"),
                "targetReason": _text(entry.get("targetReason")),
                "note": _text(entry.get("note")),
                "evidenceLevel": _text(entry.get("evidenceLevel") or "E0"),
                "evidenceSummary": _text(entry.get("evidenceSummary")),
                "naReason": _text(entry.get("naReason")),
            }
        )

    structure_hash = _template_structure_hash(template)
    assessment_items_hash = _stable_hash(assessment_items, 32)
    package = {
        "schemaVersion": SCORE_EXCHANGE_SCHEMA,
        "fileInfo": {
            "projectId": _text(project.get("id")),
            "templateId": _text(template.get("id")),
            "templateVersion": _text(template.get("version")),
            "templateSnapshotId": _text(template.get("snapshotId")),
            "knowledgeSnapshotId": _text(project.get("knowledgeSnapshotId") or template.get("knowledgeSnapshotId") or template.get("snapshotId")),
            "structureHash": structure_hash,
            "assessmentItemsHash": assessment_items_hash,
            "exportedAt": _now(),
        },
        "assessmentItems": assessment_items,
        "scoreInput": score_input,
        "rubricReference": {
            "version": _text(template.get("rubricVersion") or RUBRIC_VERSION),
            "dimensions": [
                {
                    "dimensionCode": dimension["dimensionCode"],
                    "dimensionName": ELEMENT_LABELS[dimension["dimensionCode"]],
                    "levels": [
                        {
                            "level": level["id"],
                            "levelName": level["name"],
                            "criteria": dimension["levels"][level["id"]],
                        }
                        for level in MATURITY_LEVELS
                    ],
                }
                for dimension in GENERIC_DIMENSION_RUBRIC
            ],
        },
    }
    batch_id = f"maturity-export-{_stable_hash(package, 20)}"
    return {
        "ok": True,
        "dataState": "ready",
        "batch": {"id": batch_id, "direction": "EXPORT", "exchangeType": "SCORE_DATA", "status": "success", "rowCount": len(score_input)},
        "fileName": f"{_text(project.get('id')) or 'maturity-project'}-score-exchange-v2.1.json",
        "package": package,
    }


def import_maturity_score_exchange(payload: dict[str, Any]) -> dict[str, Any]:
    project = _dict(payload.get("project"))
    template = _dict(payload.get("template"))
    exchange = _dict(payload.get("exchange"))
    existing_entries = {
        _text(item.get("scoreItemId")): deepcopy(item)
        for item in _list(payload.get("scoreEntries"))
        if isinstance(item, dict) and _text(item.get("scoreItemId"))
    }
    row_errors: list[dict[str, Any]] = []
    batch_id = f"maturity-import-{_stable_hash({'project': project.get('id'), 'exchange': exchange}, 20)}"

    if _text(exchange.get("schemaVersion")) != SCORE_EXCHANGE_SCHEMA:
        return {"ok": False, "dataState": "invalid_file", "batch": {"id": batch_id, "status": "failed", "successCount": 0, "failureCount": 1}, "rowErrors": [{"row": 0, "code": "schema_version_invalid", "message": "评分文件版本不受支持。"}]}
    file_info = _dict(exchange.get("fileInfo"))
    if _text(file_info.get("projectId")) != _text(project.get("id")):
        row_errors.append({"row": 0, "code": "project_mismatch", "message": "评分文件不属于当前项目。"})
    if _text(file_info.get("templateSnapshotId")) != _text(template.get("snapshotId")):
        row_errors.append({"row": 0, "code": "template_snapshot_mismatch", "message": "评分文件模板版本与当前项目不一致。"})
    if _text(file_info.get("structureHash")) != _template_structure_hash(template):
        row_errors.append({"row": 0, "code": "structure_hash_mismatch", "message": "评分文件结构与当前模板不一致。"})
    if _text(file_info.get("assessmentItemsHash")) != _stable_hash(_list(exchange.get("assessmentItems")), 32):
        row_errors.append({"row": 0, "code": "assessment_items_changed", "message": "只读评估项结构已被修改。"})
    if row_errors:
        return {"ok": False, "dataState": "invalid_structure", "batch": {"id": batch_id, "status": "failed", "successCount": 0, "failureCount": len(row_errors)}, "rowErrors": row_errors}

    valid_item_by_id = {
        _text(item.get("id")): item
        for item in _list(template.get("scoreItems"))
        if isinstance(item, dict) and _text(item.get("id"))
    }
    valid_item_ids = set(valid_item_by_id)
    imported_entries: list[dict[str, Any]] = []
    seen: set[str] = set()
    for row_number, row in enumerate(_list(exchange.get("scoreInput")), start=2):
        if not isinstance(row, dict):
            row_errors.append({"row": row_number, "code": "row_invalid", "message": "评分行格式无效。"})
            continue
        item_id = _text(row.get("itemInstanceId"))
        if not item_id or item_id not in valid_item_ids:
            row_errors.append({"row": row_number, "itemInstanceId": item_id, "code": "item_not_found", "message": "评估点 ID 不存在。"})
            continue
        if item_id in seen:
            row_errors.append({"row": row_number, "itemInstanceId": item_id, "code": "item_duplicate", "message": "评分文件包含重复评估点。"})
            continue
        seen.add(item_id)
        is_applicable = row.get("isApplicable") is not False
        elements = {
            "organization": row.get("organizationLevel"),
            "process": row.get("processLevel"),
            "tool": row.get("toolLevel"),
            "data": row.get("dataLevel"),
        }
        if is_applicable and any(maturity_level_index(value) is None for value in elements.values()):
            row_errors.append({"row": row_number, "itemInstanceId": item_id, "code": "dimension_level_invalid", "message": "适用项必须填写四个有效成熟度等级。"})
            continue
        if is_applicable and maturity_level_index(row.get("targetLevel")) is None:
            row_errors.append({"row": row_number, "itemInstanceId": item_id, "code": "target_incomplete", "message": "适用项必须填写目标等级；评估说明为可选。"})
            continue
        current_index = _entry_index(valid_item_by_id[item_id], {"elements": elements}, template) if is_applicable else None
        minimum_target_level = maturity_level_from_index(current_index) if current_index is not None else None
        minimum_target_index = maturity_level_index(minimum_target_level)
        target_index = maturity_level_index(row.get("targetLevel")) if is_applicable else None
        if is_applicable and target_index is not None and minimum_target_index is not None and target_index < minimum_target_index:
            row_errors.append({"row": row_number, "itemInstanceId": item_id, "code": "target_below_current", "message": f"目标等级不能低于当前评分计算等级 {minimum_target_level}。"})
            continue
        entry = existing_entries.get(item_id, {"scoreItemId": item_id, "reviewElements": {}})
        entry.update(
            {
                "scoreItemId": item_id,
                "isApplicable": is_applicable,
                "elements": elements if is_applicable else {},
                "targetLevel": row.get("targetLevel") if is_applicable else None,
                "targetReason": _text(row.get("targetReason")) if is_applicable else "",
                "targetConfirmed": bool(is_applicable),
                "note": _text(row.get("note")),
                "evidenceLevel": _text(row.get("evidenceLevel") or "E0"),
                "evidenceSummary": _text(row.get("evidenceSummary")),
                "naReason": _text(row.get("naReason")) if not is_applicable else "",
                "status": "scored" if is_applicable else "not_applicable",
            }
        )
        imported_entries.append(entry)

    status = "success" if not row_errors else "partial_success" if imported_entries else "failed"
    merged_entries = {**existing_entries, **{item["scoreItemId"]: item for item in imported_entries}}
    return {
        "ok": bool(imported_entries) or not row_errors,
        "dataState": "ready" if status != "failed" else "invalid_rows",
        "batch": {
            "id": batch_id,
            "direction": "IMPORT",
            "exchangeType": "SCORE_DATA",
            "status": status,
            "rowCount": len(_list(exchange.get("scoreInput"))),
            "successCount": len(imported_entries),
            "failureCount": len(row_errors),
            "structureHash": _template_structure_hash(template),
        },
        "rowErrors": row_errors,
        "scoreEntries": list(merged_entries.values()),
    }


def export_maturity_template_exchange(payload: dict[str, Any]) -> dict[str, Any]:
    template = _dict(payload.get("template") or payload)
    validation = validate_maturity_template(template)
    if template.get("type") not in {"base", "custom"} or not validation["valid"]:
        return {"ok": False, "dataState": "invalid_template", "validation": validation, "message": "只有校验通过的默认或自定义模板可以导出结构文件。"}
    package = {
        "schemaVersion": TEMPLATE_EXCHANGE_SCHEMA,
        "fileInfo": {"templateId": _text(template.get("id")), "templateSnapshotId": _text(template.get("snapshotId")), "templateType": _text(template.get("type")), "structureHash": _template_structure_hash(template), "exportedAt": _now()},
        "template": template,
    }
    return {"ok": True, "dataState": "ready", "batch": {"id": f"maturity-template-export-{_stable_hash(package, 20)}", "status": "success", "direction": "EXPORT", "exchangeType": "TEMPLATE_STRUCTURE", "sourceTemplateType": template.get("type")}, "fileName": f"{_text(template.get('id')) or 'maturity-template'}-structure-v2.1.json", "package": package}


def import_maturity_template_exchange(payload: dict[str, Any]) -> dict[str, Any]:
    exchange = _dict(payload.get("exchange") or payload)
    batch_id = f"maturity-template-import-{_stable_hash(exchange, 20)}"
    if _text(exchange.get("schemaVersion")) != TEMPLATE_EXCHANGE_SCHEMA:
        return {"ok": False, "dataState": "invalid_file", "batch": {"id": batch_id, "status": "failed"}, "rowErrors": [{"row": 0, "code": "schema_version_invalid", "message": "模板结构文件版本不受支持。"}]}
    template = _dict(exchange.get("template"))
    file_info = _dict(exchange.get("fileInfo"))
    source_template_type = _text(template.get("type"))
    if source_template_type not in {"base", "custom"} or _text(file_info.get("structureHash")) != _template_structure_hash(template):
        return {"ok": False, "dataState": "invalid_structure", "batch": {"id": batch_id, "status": "failed"}, "rowErrors": [{"row": 0, "code": "structure_hash_mismatch", "message": "默认或自定义模板结构哈希不一致。"}]}
    validation = validate_maturity_template(template)
    imported_template = deepcopy(template)
    if validation["valid"]:
        source_template_id = _text(template.get("id"))
        source_snapshot_id = _text(template.get("snapshotId"))
        imported_template.update(
            {
                "id": f"custom-template-import-{_stable_hash({'batch': batch_id, 'source': source_template_id}, 16)}",
                "snapshotId": f"custom-template-snapshot-{_stable_hash({'batch': batch_id, 'structure': file_info.get('structureHash')}, 20)}",
                "name": f"{_text(template.get('name')) or '成熟度模板'}（导入副本）",
                "type": "custom",
                "status": "validated",
                "readOnly": False,
                "structureMutable": True,
                "weightMutable": True,
                "sourceTemplateId": source_template_id,
                "sourceTemplateSnapshotId": source_snapshot_id,
                "importSourceTemplateType": source_template_type,
            }
        )
    return {
        "ok": validation["valid"],
        "dataState": "ready" if validation["valid"] else "invalid_template",
        "batch": {"id": batch_id, "status": "success" if validation["valid"] else "failed", "direction": "IMPORT", "exchangeType": "TEMPLATE_STRUCTURE", "sourceTemplateType": source_template_type, "successCount": 1 if validation["valid"] else 0, "failureCount": len(validation["errors"])},
        "rowErrors": validation["errors"],
        "template": imported_template if validation["valid"] else None,
        "sourceTemplateType": source_template_type,
        "validation": validation,
    }


def create_maturity_report_snapshot(payload: dict[str, Any]) -> dict[str, Any]:
    project = _dict(payload.get("project"))
    template = _dict(payload.get("template"))
    score_entries = _list(payload.get("scoreEntries"))
    narrative = _dict(payload.get("narrative"))
    result = calculate_maturity_assessment({"project": project, "template": template, "scoreEntries": score_entries})
    if not result.get("ok"):
        return {"ok": False, "dataState": result.get("dataState", "invalid"), "validation": result.get("validation", {})}

    summary = _dict(result.get("summary"))
    snapshot_basis = {
        "projectId": project.get("id"),
        "templateSnapshotId": template.get("snapshotId"),
        "summary": summary,
        "entries": score_entries,
        "narrative": narrative,
    }
    snapshot_id = f"maturity-report-{_stable_hash(snapshot_basis, 20)}"
    generated_at = _now()
    is_formal = (
        project.get("status") in {"completed", "reported", "archived"}
        and summary.get("statisticsReady") is True
        and summary.get("completionRate") == 100
    )
    report_status = "snapshot" if is_formal else "draft_preview"
    conclusion_heading = "总体结论" if is_formal else "当前试算结论"
    report_notice = "正式报告快照；全部适用评估点已完成，不适用与无证据作为信息口径保留。" if is_formal else f"草稿报告预览；仍有 {summary.get('notScoredCount')} 条适用项待评分，当前等级仅基于已评分项，不是正式评估结论。"
    project_name = _text(project.get("name")) or "成熟度评估项目"
    organization = _text(project.get("organization")) or "未填写"
    top_gaps = _list(result.get("gapItems"))[:10]
    capability_results = _list(result.get("capabilityResults"))
    dimension_labels = {"organization": "组织与角色", "process": "制度与流程", "tool": "平台与工具", "data": "数据与信息"}
    dimension_results = _dict(summary.get("dimensionResults"))
    no_evidence_count = next((int(_float(item.get("count"), 0.0)) for item in _list(result.get("evidenceDistribution")) if _text(item.get("level")) == "E0"), 0)

    def narrative_value(key: str, placeholder: str) -> str:
        return _text(narrative.get(key)) or f"[待填写：{placeholder}]"

    executive_summary = narrative_value("executiveSummary", "管理层摘要")
    key_findings = narrative_value("keyFindings", "关键发现")
    management_recommendations = narrative_value("managementRecommendations", "管理建议")
    next_steps = narrative_value("nextSteps", "下一步计划与复评安排")

    category_lines = [
        f"| {item.get('code') or '-'} | {item.get('name')} | {item.get('currentIndex') or '-'} | {item.get('currentLevel')} | {item.get('targetLevel')} | {item.get('gapIndex') if item.get('gapIndex') is not None else '-'} |"
        for item in _list(result.get("categoryResults"))
    ]
    gap_lines = [
        f"| {item.get('priority')} | {item.get('capabilityCode') or '-'} | {item.get('capabilityName')} | {item.get('currentLevel')} | {item.get('targetLevel')} | {item.get('priorityScore')} |"
        for item in top_gaps
    ]
    capability_lines = [
        f"| {item.get('code') or '-'} | {item.get('name')} | {item.get('currentIndex') if item.get('currentIndex') is not None else '-'} | {item.get('currentLevel')} | {item.get('targetIndex') if item.get('targetIndex') is not None else '-'} | {item.get('targetLevel')} | {item.get('gapIndex') if item.get('gapIndex') is not None else '-'} | {item.get('targetAchievementRate') if item.get('targetAchievementRate') is not None else '-'}% | {item.get('evidenceCoverage')}% |"
        for item in capability_results
    ]
    dimension_lines = [
        f"| {label} | {dimension_results.get(key) if dimension_results.get(key) is not None else '-'} |"
        for key, label in dimension_labels.items()
    ]
    markdown = "\n".join(
        [
            f"# {project_name}",
            "",
            f"> 报告状态：{report_notice}",
            "",
            "## 项目信息",
            "",
            f"- 客户或组织：{organization}",
            "- 评估对象：企业组织",
            f"- 所属行业：{_text(project.get('industry')) or '未填写'}",
            f"- 企业规模：{_text(project.get('companySize')) or '未填写'}",
            f"- 模板：{_text(template.get('name'))} { _text(template.get('version'))}",
            f"- 报告快照：{snapshot_id}",
            "",
            "## 管理层摘要",
            "",
            executive_summary,
            "",
            f"## {conclusion_heading}",
            "",
            f"- 成熟度指数：{summary.get('currentIndex')}",
            f"- 成熟度等级：{summary.get('currentLevel')}",
            f"- 百分制得分：{summary.get('currentPercent')}",
            f"- 目标等级：{summary.get('targetLevel')}",
            f"- 目标达成率：{summary.get('targetAchievementRate') if summary.get('targetAchievementRate') is not None else '-'}%",
            f"- 评分完成度：{summary.get('completionRate')}%",
            f"- 证据覆盖率：{summary.get('evidenceCoverage')}%",
            "",
            "## 四维成熟度",
            "",
            "| 维度 | 当前指数 |",
            "|---|---:|",
            *dimension_lines,
            "",
            "## 能力类别评分",
            "",
            "| 编码 | 分类 | 当前指数 | 当前等级 | 目标等级 | 差距 |",
            "|---|---|---:|:---:|:---:|---:|",
            *category_lines,
            "",
            "## L2 安全能力结果",
            "",
            "| 编码 | L2 安全能力 | 当前指数 | 当前等级 | 目标指数 | 目标等级 | 差距 | 目标达成率 | 证据覆盖 |",
            "|---|---|---:|:---:|---:|:---:|---:|---:|---:|",
            *capability_lines,
            "",
            "## 高优先级差距",
            "",
            "| 优先级 | 能力编码 | 能力 | 当前 | 目标 | 优先级分数 |",
            "|:---:|---|---|:---:|:---:|---:|",
            *(gap_lines or ["| - | - | 当前没有已计算差距 | - | - | - |"]),
            "",
            "## 关键发现",
            "",
            key_findings,
            "",
            "## 管理建议",
            "",
            management_recommendations,
            "",
            "## 下一步计划",
            "",
            next_steps,
            "",
            "## 证据与限制",
            "",
            f"- 待评分项：{summary.get('notScoredCount')}。",
            f"- N/A 项：{summary.get('notApplicableCount')}。",
            f"- 无证据项：{no_evidence_count}；证据材料为可选补充，不阻塞完成评估。",
            "- 客户主结果最细展示到 L2 安全能力；关注点、服务、四维原始评分和证据保留在内部明细及附录。",
            "- 改进建议为结构化候选，需要评估人员确认后再进入正式报告。",
            "- 当前本地草稿不写入正式数据库、正式数据包或用户库。",
        ]
    )

    gap_rows_html = "".join(
        f"<tr><td>{html_lib.escape(_text(item.get('priority')))}</td><td>{html_lib.escape(_text(item.get('capabilityCode')))}</td><td>{html_lib.escape(_text(item.get('capabilityName')))}</td><td>{html_lib.escape(_text(item.get('currentLevel')))}</td><td>{html_lib.escape(_text(item.get('targetLevel')))}</td><td>{item.get('priorityScore')}</td></tr>"
        for item in top_gaps
    )
    capability_rows_html = "".join(
        f"<tr><td>{html_lib.escape(_text(item.get('code')))}</td><td>{html_lib.escape(_text(item.get('name')))}</td><td>{item.get('currentIndex') if item.get('currentIndex') is not None else '-'}</td><td>{html_lib.escape(_text(item.get('currentLevel')))}</td><td>{item.get('targetIndex') if item.get('targetIndex') is not None else '-'}</td><td>{html_lib.escape(_text(item.get('targetLevel')))}</td><td>{item.get('gapIndex') if item.get('gapIndex') is not None else '-'}</td><td>{item.get('targetAchievementRate') if item.get('targetAchievementRate') is not None else '-'}%</td><td>{item.get('evidenceCoverage')}%</td></tr>"
        for item in capability_results
    )
    dimension_bars_html = "".join(
        f"<div class='bar-row'><span>{html_lib.escape(label)}</span><i><b style='width:{max(0.0, min(100.0, _float(dimension_results.get(key), 0.0) * 20.0)):.1f}%'></b></i><strong>{dimension_results.get(key) if dimension_results.get(key) is not None else '-'}</strong></div>"
        for key, label in dimension_labels.items()
    )
    tgm_bars_html = "".join(
        f"<div class='bar-row is-{html_lib.escape(_text(item.get('code')).lower())}'><span>{html_lib.escape(_text(item.get('code')))} {html_lib.escape(_text(item.get('name')))}</span><i><b style='width:{max(0.0, min(100.0, _float(item.get('currentIndex'), 0.0) * 20.0)):.1f}%'></b><em style='left:{max(0.0, min(100.0, _float(item.get('targetIndex'), 0.0) * 20.0)):.1f}%'></em></i><strong>{item.get('currentIndex') if item.get('currentIndex') is not None else '-'} / {item.get('targetIndex') if item.get('targetIndex') is not None else '-'}</strong></div>"
        for item in _list(result.get("categoryResults"))[:3]
    )

    def editable_html(value: str) -> str:
        return html_lib.escape(value).replace("\n", "<br />")

    html_report = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{html_lib.escape(project_name)}</title>
  <style>
    :root{{--ink:#24384b;--muted:#667b8e;--line:#d8e2ea;--blue:#2479be;--gold:#a87934;--paper:#fff}}
    *{{box-sizing:border-box}} body{{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;color:var(--ink);background:#eef3f7;line-height:1.55}}
    main{{max-width:1120px;margin:0 auto;background:var(--paper);box-shadow:0 12px 36px rgba(31,52,72,.12)}}
    .cover{{min-height:340px;display:grid;align-content:end;padding:56px;background:linear-gradient(145deg,#eaf4fb 0%,#fff 58%,#f7f0e5 100%);border-bottom:1px solid var(--line)}}
    .eyebrow{{color:var(--blue);font-size:12px;font-weight:750;letter-spacing:.08em}} h1{{max-width:760px;font-size:36px;line-height:1.2;margin:12px 0}} h2{{font-size:21px;margin:0 0 16px}} h3{{font-size:15px;margin:0 0 10px}}
    .meta{{color:var(--muted);font-size:13px}} .content{{padding:42px 56px 64px}} .notice{{border-left:3px solid var(--blue);background:#f1f7fb;padding:12px 14px;color:#4b6479}}
    .summary{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));margin:28px 0;border:1px solid var(--line)}} .metric{{padding:18px;border-right:1px solid var(--line)}} .metric:last-child{{border:0}} .metric span{{display:block;color:var(--muted);font-size:11px}} .metric strong{{display:block;margin-top:6px;font-size:26px;letter-spacing:-.02em}}
    .section{{margin-top:38px;break-inside:avoid}} .section-head{{display:flex;align-items:end;justify-content:space-between;gap:16px;border-bottom:1px solid var(--line);margin-bottom:16px}} .section-head p{{margin:0 0 10px;color:var(--muted);font-size:11px}}
    .editable{{min-height:104px;padding:16px;border:1px dashed #aebfcd;background:#fbfcfd;white-space:normal}} .editable:focus{{outline:2px solid rgba(36,121,190,.24)}}
    .profile-grid{{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:28px}} .bar-list{{display:grid;gap:11px}} .bar-row{{display:grid;grid-template-columns:120px minmax(120px,1fr) 70px;align-items:center;gap:10px;font-size:12px}} .bar-row i{{position:relative;height:8px;background:#e6edf2}} .bar-row i b{{display:block;height:100%;background:var(--blue)}} .bar-row i em{{position:absolute;top:-3px;width:2px;height:14px;background:var(--gold)}} .bar-row strong{{text-align:right;font-variant-numeric:tabular-nums}}
    table{{width:100%;border-collapse:collapse;font-size:11px}} th,td{{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}} th{{background:#eef3f7;color:#516a7e}} tbody tr:nth-child(even){{background:#fafcfd}}
    .limits{{color:var(--muted);font-size:11px}}
    @media(max-width:760px){{.cover{{padding:32px;min-height:280px}}.content{{padding:28px 24px 44px}}.summary{{grid-template-columns:repeat(2,minmax(0,1fr))}}.metric:nth-child(2){{border-right:0}}.profile-grid{{grid-template-columns:1fr}}.bar-row{{grid-template-columns:100px minmax(100px,1fr) 62px}}}}
    @media print{{body{{background:#fff}}main{{box-shadow:none}}.editable{{border-color:#cbd5de}}.section{{break-inside:avoid}}}}
  </style>
</head>
<body><main><header class="cover"><span class="eyebrow">SAPD 成熟度评估报告</span><h1>{html_lib.escape(project_name)}</h1><p class="meta">{html_lib.escape(organization)} · {html_lib.escape(_text(template.get('name')))} · {html_lib.escape(generated_at[:10])}</p></header><div class="content">
  <p class="notice">{html_lib.escape(report_notice)}</p>
  <section class="section"><div class="section-head"><h2>管理层摘要</h2><p>可直接在导出的 HTML 中继续编辑</p></div><div class="editable" contenteditable="true">{editable_html(executive_summary)}</div></section>
  <section class="summary"><div class="metric"><span>当前成熟度</span><strong>{html_lib.escape(_text(summary.get('currentLevel')))}</strong></div><div class="metric"><span>成熟度指数 / 5.00</span><strong>{summary.get('currentIndex')}</strong></div><div class="metric"><span>目标成熟度</span><strong>{html_lib.escape(_text(summary.get('targetLevel')))}</strong></div><div class="metric"><span>目标达成率</span><strong>{summary.get('targetAchievementRate') if summary.get('targetAchievementRate') is not None else '-'}%</strong></div></section>
  <section class="section"><div class="section-head"><h2>成熟度轮廓</h2><p>实色为当前指数；金色标记为目标指数</p></div><div class="profile-grid"><div><h3>四维成熟度</h3><div class="bar-list">{dimension_bars_html}</div></div><div><h3>能力类别评分</h3><div class="bar-list">{tgm_bars_html}</div></div></div></section>
  <section class="section"><div class="section-head"><h2>主要差距</h2><p>优先级与分数沿用后端结果</p></div><table><thead><tr><th>优先级</th><th>能力编码</th><th>能力</th><th>当前</th><th>目标</th><th>优先级分数</th></tr></thead><tbody>{gap_rows_html or '<tr><td colspan="6">当前没有已计算差距。</td></tr>'}</tbody></table></section>
  <section class="section"><div class="section-head"><h2>关键发现</h2></div><div class="editable" contenteditable="true">{editable_html(key_findings)}</div></section>
  <section class="section"><div class="section-head"><h2>管理建议</h2></div><div class="editable" contenteditable="true">{editable_html(management_recommendations)}</div></section>
  <section class="section"><div class="section-head"><h2>下一步计划</h2></div><div class="editable" contenteditable="true">{editable_html(next_steps)}</div></section>
  <section class="section"><div class="section-head"><h2>L2 安全能力结果</h2><p>{len(capability_results)} 项能力</p></div><table><thead><tr><th>编码</th><th>L2 安全能力</th><th>当前指数</th><th>当前等级</th><th>目标指数</th><th>目标等级</th><th>差距</th><th>达成率</th><th>证据覆盖</th></tr></thead><tbody>{capability_rows_html}</tbody></table></section>
  <section class="section limits"><div class="section-head"><h2>口径与限制</h2></div><p>适用项完成度 {summary.get('completionRate')}%；不适用项 {summary.get('notApplicableCount')}；无证据项 {no_evidence_count}。不适用和无证据为信息口径，不阻塞完成评估。</p><p>客户主结果最细到 L2；关注点、服务、四维原始评分和证据保留在内部明细。快照编号：{html_lib.escape(snapshot_id)}</p></section>
</div></main></body></html>"""

    return {
        "ok": True,
        "dataState": "ready",
        "id": snapshot_id,
        "status": report_status,
        "generatedAt": generated_at,
        "formal": is_formal,
        "summary": summary,
        "markdown": markdown,
        "html": html_report,
        "fileNames": {
            "markdown": f"{snapshot_id}.md",
            "html": f"{snapshot_id}.html",
        },
    }
