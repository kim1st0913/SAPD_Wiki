from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .assets import extract_excel_sheet_images
from .candidates import ObjectCandidate, ParseResult, RelationCandidate, SourceRef, ValidationMessage, item_key, normalize_text
from .excel_reader import _load_openpyxl
from .paths import resolve_project_path
from .transformers import (
    is_blank_or_placeholder,
    normalize_service_title,
    service_parts,
    split_code_title,
    split_multivalue_text,
    split_scope_values,
)


def _source(sheet: str, row: int, column: str | None, cell: str | None, raw_value: object) -> SourceRef:
    return SourceRef(
        sheet=sheet,
        row=row,
        column=column,
        cell=cell,
        raw_value=normalize_text(raw_value),
    )


def _coord(cell: object) -> str | None:
    return getattr(cell, "coordinate", None)


def _is_numeric_summary_value(value: object) -> bool:
    text = normalize_text(value)
    return bool(re.fullmatch(r"\d+(?:\.\d+)?", text))


def _is_scene_module_fill(cell: object) -> bool:
    """G 列浅蓝底代表安全技术模块；其他底色不再伪造成模块。"""
    fill_color = getattr(getattr(cell, "fill", None), "fgColor", None)
    try:
        return (
            fill_color.type == "theme"
            and int(fill_color.theme) == 8
            and abs(float(fill_color.tint) - 0.7999816888943144) < 0.0001
        )
    except (TypeError, ValueError):
        return False


def _is_lcap_development_type_fill(cell: object) -> bool:
    """LC-AP 软件开发模式列黄色底色代表适用。"""
    fill_color = getattr(getattr(cell, "fill", None), "fgColor", None)
    try:
        return fill_color.type == "theme" and int(fill_color.theme) == 7
    except (TypeError, ValueError):
        return False


LCAP_TECHNICAL_MEASURE_TITLES = {
    "应用程序威胁建模",
    "制品安全加固",
    "IaC代码安全测试",
}


def _lcap_authoritative_module_title(value: str, authoritative_module_titles: set[str]) -> str | None:
    """Resolve LC-AP module aliases to the existing security technology module master data."""
    title = normalize_text(value)
    if title in authoritative_module_titles:
        return title
    if title.startswith("软件成分分析") and "软件成分分析（SCA）" in authoritative_module_titles:
        return "软件成分分析（SCA）"
    if title.startswith("应用程序静态安全测试") and "应用程序静态安全测试" in authoritative_module_titles:
        return "应用程序静态安全测试"
    return None


def _object(
    item_type: str,
    title: str,
    *,
    code: str | None = None,
    description: str | None = None,
    category: str | None = None,
    qualifier: str | None = None,
    metadata: dict[str, Any] | None = None,
    source: SourceRef | None = None,
) -> ObjectCandidate:
    sources = [source] if source else []
    return ObjectCandidate(
        type=item_type,
        code=normalize_text(code) or None,
        title=normalize_text(title),
        description=normalize_text(description) or None,
        category=normalize_text(category) or None,
        qualifier=normalize_text(qualifier) or None,
        metadata=metadata or {},
        sources=sources,
    )


def _relation(
    source_key: str,
    relation_type: str,
    target_key: str,
    label: str,
    *,
    source: SourceRef | None = None,
    metadata: dict[str, Any] | None = None,
) -> RelationCandidate:
    sources = [source] if source else []
    return RelationCandidate(
        source_key=source_key,
        target_key=target_key,
        relation_type=relation_type,
        relation_label=label,
        metadata=metadata or {},
        sources=sources,
    )


def _load_workbook(path: str | Path):
    load_workbook = _load_openpyxl()
    return load_workbook(resolve_project_path(path), read_only=True, data_only=True)


def parse_capability_sheet(workbook) -> ParseResult:
    sheet_name = "安全能力目录"
    ws = workbook[sheet_name]
    result = ParseResult()
    last_category: tuple[str | None, str] | None = None
    last_domain: tuple[str | None, str] | None = None
    last_capability: tuple[str | None, str, str | None] | None = None

    for row_index, row in enumerate(ws.iter_rows(min_row=4), start=4):
        category_value = row[1].value
        domain_value = row[2].value
        capability_value = row[3].value
        definition_value = row[4].value
        focus_code = normalize_text(row[5].value)
        focus_title = normalize_text(row[6].value)
        focus_description = normalize_text(row[7].value)

        if not any(normalize_text(cell.value) for cell in row):
            continue

        if normalize_text(category_value):
            last_category = split_code_title(category_value)
        if normalize_text(domain_value):
            last_domain = split_code_title(domain_value)
        if normalize_text(capability_value):
            cap_code, cap_title = split_code_title(capability_value)
            last_capability = (cap_code, cap_title, normalize_text(definition_value) or None)
        elif last_capability and normalize_text(definition_value):
            last_capability = (last_capability[0], last_capability[1], normalize_text(definition_value))

        if not focus_code and not focus_title:
            continue
        if not focus_code:
            result.validations.append(ValidationMessage("error", sheet_name, row_index, "能力关注点缺少序号"))
            continue
        if not focus_title:
            result.validations.append(ValidationMessage("error", sheet_name, row_index, f"能力关注点 {focus_code} 缺少标题"))
            continue
        if not (last_category and last_domain and last_capability):
            result.validations.append(ValidationMessage("error", sheet_name, row_index, f"能力关注点 {focus_code} 缺少上级能力层级"))
            continue

        category_code, category_title = last_category
        domain_code, domain_title = last_domain
        capability_code, capability_title, capability_description = last_capability

        category = _object(
            "capability_category",
            category_title,
            code=category_code,
            metadata={"tree_order": row_index},
            source=_source(sheet_name, row_index, "安全能力分类", _coord(row[1]), category_value),
        )
        domain = _object(
            "capability_domain",
            domain_title,
            code=domain_code,
            metadata={"tree_order": row_index},
            source=_source(sheet_name, row_index, "L1 高阶战略能力", _coord(row[2]), domain_value or domain_title),
        )
        capability = _object(
            "capability",
            capability_title,
            code=capability_code,
            description=capability_description,
            metadata={"tree_order": row_index},
            source=_source(sheet_name, row_index, "L2安全能力", _coord(row[3]), capability_value or capability_title),
        )
        focus = _object(
            "capability_focus",
            focus_title,
            code=focus_code,
            description=focus_description,
            metadata={"tree_order": row_index},
            source=_source(sheet_name, row_index, "序号", _coord(row[5]), row[5].value),
        )
        result.objects.extend([category, domain, capability, focus])
        result.relations.extend(
            [
                _relation(domain.key, "belongs_to", category.key, "属于", source=domain.sources[0]),
                _relation(capability.key, "belongs_to", domain.key, "属于", source=capability.sources[0]),
                _relation(focus.key, "belongs_to", capability.key, "属于", source=focus.sources[0]),
            ]
        )
    return result


def parse_scope_sheet(workbook) -> ParseResult:
    sheet_name = "安全能力作用域目录"
    ws = workbook[sheet_name]
    result = ParseResult()
    scenario = ""
    for row_index, row in enumerate(ws.iter_rows(min_row=3), start=3):
        if normalize_text(row[1].value):
            scenario = normalize_text(row[1].value)
        scope_raw = row[2].value
        description = normalize_text(row[3].value)
        if not normalize_text(scope_raw):
            continue
        code, title = split_code_title(scope_raw)
        if not code:
            result.validations.append(ValidationMessage("warning", sheet_name, row_index, f"作用域缺少编码：{normalize_text(scope_raw)}"))
        scope = _object(
            "scope_type",
            title,
            code=code,
            description=description,
            category=scenario,
            metadata={"scenario": scenario},
            source=_source(sheet_name, row_index, "作用域类型", _coord(row[2]), scope_raw),
        )
        result.objects.append(scope)
    return result


def parse_service_sheet(workbook) -> ParseResult:
    sheet_name = "安全能力-安全技术服务"
    ws = workbook[sheet_name]
    result = ParseResult()
    scope_headers: dict[int, tuple[str | None, str]] = {}
    for col in range(7, 14):
        raw_header = ws.cell(row=3, column=col).value
        scope_headers[col] = split_code_title(raw_header)

    last_category: tuple[str | None, str] | None = None
    last_domain: tuple[str | None, str] | None = None
    last_capability: tuple[str | None, str] | None = None

    for row_index, row in enumerate(ws.iter_rows(min_row=4), start=4):
        if normalize_text(row[1].value):
            last_category = split_code_title(row[1].value)
        if normalize_text(row[2].value):
            last_domain = split_code_title(row[2].value)
        if normalize_text(row[3].value):
            last_capability = split_code_title(row[3].value)

        focus_code = normalize_text(row[4].value)
        focus_title = normalize_text(row[5].value)
        if not focus_code:
            continue
        focus = _object(
            "capability_focus",
            focus_title or focus_code,
            code=focus_code,
            source=_source(sheet_name, row_index, "序号", _coord(row[4]), row[4].value),
        )
        result.objects.append(focus)
        for col in range(7, 14):
            cell = row[col - 1]
            header_code, header_title = scope_headers[col]
            cell_text = normalize_text(cell.value)
            if cell_text == "/" and header_code:
                scope = _object(
                    "scope_type",
                    header_title or header_code,
                    code=header_code,
                    source=_source(sheet_name, 3, f"作用域列{col}", _coord(ws.cell(row=3, column=col)), ws.cell(row=3, column=col).value),
                )
                result.objects.append(scope)
                result.relations.append(
                    _relation(
                        focus.key,
                        "no_service_in_scope",
                        scope.key,
                        "该作用域无安全技术服务",
                        source=_source(sheet_name, row_index, f"作用域列{col}", _coord(cell), cell.value),
                        metadata={
                            "status": "no_service",
                            "scope_code": header_code,
                            "capability_focus_code": focus_code,
                        },
                    )
                )
                continue
            if is_blank_or_placeholder(cell.value):
                continue
            parts = service_parts(cell.value, fallback_scope_code=header_code, fallback_focus_code=focus_code)
            service_code = parts["code"]
            service_title = normalize_service_title(parts["title"] or normalize_text(cell.value))
            scope_code = parts["scope_code"] or header_code
            scope_title = "全部作用域" if scope_code == "ALL" else (header_title or scope_code or "")
            if not service_code:
                result.validations.append(ValidationMessage("warning", sheet_name, row_index, f"安全技术服务缺少编码：{normalize_text(cell.value)}"))
            if parts["capability_focus_code"] and parts["capability_focus_code"] != focus_code:
                result.validations.append(ValidationMessage("warning", sheet_name, row_index, f"服务编码关注点与当前行不一致：{normalize_text(cell.value)}"))

            service = _object(
                "security_technical_service",
                service_title,
                code=service_code,
                category=scope_code,
                metadata={
                    "scope_code": scope_code,
                    "capability_focus_code": focus_code,
                    "capability_category": last_category[1] if last_category else None,
                    "capability_domain": last_domain[1] if last_domain else None,
                    "capability": last_capability[1] if last_capability else None,
                },
                source=_source(sheet_name, row_index, f"作用域列{col}", _coord(cell), cell.value),
            )
            result.objects.append(service)
            result.relations.append(_relation(service.key, "supports_focus", focus.key, "支撑关注点", source=service.sources[0]))
            if scope_code and scope_title:
                scope = _object(
                    "scope_type",
                    scope_title,
                    code=scope_code,
                    source=_source(sheet_name, 3, f"作用域列{col}", _coord(ws.cell(row=3, column=col)), ws.cell(row=3, column=col).value),
                )
                result.objects.append(scope)
                result.relations.append(_relation(service.key, "applies_to_scope", scope.key, "适用于作用域", source=service.sources[0]))
    return result


def _build_authoritative_service_titles(workbook) -> dict[str, str]:
    sheet_name = "安全能力-安全技术服务"
    if sheet_name not in workbook.sheetnames:
        return {}
    ws = workbook[sheet_name]
    titles: dict[str, str] = {}
    scope_headers: dict[int, tuple[str | None, str]] = {}
    for col in range(7, 14):
        scope_headers[col] = split_code_title(ws.cell(row=3, column=col).value)

    for row_index, row in enumerate(ws.iter_rows(min_row=4), start=4):
        focus_code = normalize_text(row[4].value)
        if not focus_code:
            continue
        for col in range(7, 14):
            cell = row[col - 1]
            if is_blank_or_placeholder(cell.value):
                continue
            header_code, _header_title = scope_headers[col]
            parts = service_parts(cell.value, fallback_scope_code=header_code, fallback_focus_code=focus_code)
            service_code = parts["code"]
            if not service_code:
                continue
            titles[service_code] = normalize_service_title(parts["title"] or normalize_text(cell.value))
    return titles


def _build_authoritative_module_titles(workbook) -> set[str]:
    sheet_name = "安全技术模块清单"
    if sheet_name not in workbook.sheetnames:
        return set()
    ws = workbook[sheet_name]
    titles: set[str] = set()
    last_module = ""
    for row in ws.iter_rows(min_row=3):
        if _is_numeric_summary_value(row[3].value):
            continue
        if normalize_text(row[3].value):
            last_module = normalize_text(row[3].value)
        if last_module:
            titles.add(last_module)
    return titles


def _service_title(
    parts: dict[str, str | None],
    raw_value: object,
    authoritative_service_titles: dict[str, str] | None = None,
) -> str:
    code = parts.get("code")
    if code and authoritative_service_titles and code in authoritative_service_titles:
        return authoritative_service_titles[code]
    return normalize_service_title(parts.get("title") or normalize_text(raw_value))


def parse_module_sheet(workbook, authoritative_service_titles: dict[str, str] | None = None) -> ParseResult:
    sheet_name = "安全技术模块清单"
    ws = workbook[sheet_name]
    result = ParseResult()
    last_category = ""
    last_system = ""
    last_module = ""
    last_definition = ""
    last_product = ""
    for row_index, row in enumerate(ws.iter_rows(min_row=3), start=3):
        if _is_numeric_summary_value(row[2].value) or _is_numeric_summary_value(row[3].value):
            continue
        if normalize_text(row[1].value):
            last_category = normalize_text(row[1].value)
        if normalize_text(row[2].value):
            last_system = normalize_text(row[2].value)
        if normalize_text(row[3].value):
            last_module = normalize_text(row[3].value)
        if normalize_text(row[4].value):
            last_definition = normalize_text(row[4].value)
        if normalize_text(row[6].value):
            last_product = normalize_text(row[6].value)
        service_raw = row[5].value
        if not last_module:
            continue
        system = _object("security_system", last_system, category=last_category, source=_source(sheet_name, row_index, "安全系统", _coord(row[2]), last_system))
        module = _object(
            "security_technology_module",
            last_module,
            description=last_definition,
            category=last_category,
            metadata={"security_system": last_system, "product": last_product},
            source=_source(sheet_name, row_index, "安全技术模块", _coord(row[3]), last_module),
        )
        result.objects.extend([system, module])
        if last_system:
            result.relations.append(_relation(module.key, "part_of_system", system.key, "属于安全系统", source=module.sources[0]))
        if last_product:
            product = _object("product", last_product, source=_source(sheet_name, row_index, "对应我司产品", _coord(row[6]), last_product))
            result.objects.append(product)
            result.relations.append(_relation(module.key, "maps_to_product", product.key, "对应产品", source=product.sources[0]))
        if not is_blank_or_placeholder(service_raw):
            parts = service_parts(service_raw)
            service = _object(
                "security_technical_service",
                _service_title(parts, service_raw, authoritative_service_titles),
                code=parts["code"],
                category=parts["scope_code"],
                metadata={"scope_code": parts["scope_code"], "capability_focus_code": parts["capability_focus_code"]},
                source=_source(sheet_name, row_index, "安全技术服务映射", _coord(row[5]), service_raw),
            )
            result.objects.append(service)
            result.relations.append(_relation(module.key, "implements_service", service.key, "实现技术服务", source=service.sources[0]))
    return result


def parse_scene_sheet(workbook, authoritative_service_titles: dict[str, str] | None = None) -> ParseResult:
    sheet_name = "作用域-安全技术服务-安全技术模块映射"
    ws = workbook[sheet_name]
    result = ParseResult()
    last_environment = ""
    last_segment = ""
    last_object = ""
    last_scopes = ""
    last_system = ""
    for row_index, row in enumerate(ws.iter_rows(min_row=3), start=3):
        if normalize_text(row[1].value):
            last_environment = normalize_text(row[1].value)
        if normalize_text(row[2].value):
            last_segment = normalize_text(row[2].value)
        if normalize_text(row[3].value):
            last_object = normalize_text(row[3].value)
        if normalize_text(row[4].value):
            last_scopes = normalize_text(row[4].value)
        if normalize_text(row[7].value):
            last_system = normalize_text(row[7].value)
        service_raw = row[5].value
        module_raw = row[6].value
        if not last_environment or not last_object:
            continue

        env = _object("information_environment", last_environment, source=_source(sheet_name, row_index, "信息化环境", _coord(row[1]), last_environment))
        segment = _object("environment_segment", last_segment, qualifier=last_environment, source=_source(sheet_name, row_index, "environment_segment", _coord(row[2]), last_segment)) if last_segment else None
        info_obj = _object(
            "information_object",
            last_object,
            metadata={"source_role": "information_object"},
            source=_source(sheet_name, row_index, "信息化对象", _coord(row[3]), last_object),
        )
        result.objects.append(env)
        if segment:
            result.objects.append(segment)
            result.relations.append(_relation(segment.key, "belongs_to", env.key, "属于", source=segment.sources[0]))
            result.relations.append(_relation(info_obj.key, "belongs_to", segment.key, "属于", source=info_obj.sources[0]))
        else:
            result.relations.append(_relation(info_obj.key, "belongs_to", env.key, "属于", source=info_obj.sources[0]))
        result.objects.append(info_obj)

        scope_objects: list[ObjectCandidate] = []
        for scope_code, scope_title in split_scope_values(last_scopes):
            if not scope_title and not scope_code:
                continue
            scope = _object("scope_type", scope_title or scope_code or "", code=scope_code, source=_source(sheet_name, row_index, "作用域", _coord(row[4]), last_scopes))
            result.objects.append(scope)
            scope_objects.append(scope)
            result.relations.append(_relation(info_obj.key, "applies_to_scope", scope.key, "适用于作用域", source=scope.sources[0]))

        service = None
        if not is_blank_or_placeholder(service_raw):
            parts = service_parts(service_raw)
            service = _object(
                "security_technical_service",
                _service_title(parts, service_raw, authoritative_service_titles),
                code=parts["code"],
                category=parts["scope_code"],
                metadata={"scope_code": parts["scope_code"], "capability_focus_code": parts["capability_focus_code"]},
                source=_source(sheet_name, row_index, "安全技术服务", _coord(row[5]), service_raw),
            )
            result.objects.append(service)
            result.relations.append(_relation(service.key, "protects_object", info_obj.key, "作用于信息化对象", source=service.sources[0]))
            for scope in scope_objects:
                result.relations.append(_relation(service.key, "applies_to_scope", scope.key, "适用于作用域", source=service.sources[0]))

        module = None
        if not is_blank_or_placeholder(module_raw) and _is_scene_module_fill(row[6]):
            module = _object("security_technology_module", normalize_text(module_raw), source=_source(sheet_name, row_index, "安全技术模块/措施", _coord(row[6]), module_raw))
            result.objects.append(module)
            result.relations.append(_relation(module.key, "deployed_in_environment", env.key, "部署/适用于环境", source=module.sources[0]))
            if service:
                result.relations.append(_relation(module.key, "implements_service", service.key, "实现技术服务", source=module.sources[0]))
        if module and last_system:
            system = _object("security_system", last_system, source=_source(sheet_name, row_index, "安全系统", _coord(row[7]), last_system))
            result.objects.append(system)
            result.relations.append(_relation(module.key, "part_of_system", system.key, "属于安全系统", source=module.sources[0]))
    return result


def parse_environment_scope_sheet(workbook, authoritative_service_titles: dict[str, str] | None = None) -> ParseResult:
    sheet_name = "信息化环境-信息化对象-安全作用域映射"
    ws = workbook[sheet_name]
    result = ParseResult()
    last_environment = ""
    last_segment = ""
    last_object = ""
    last_scopes = ""
    for row_index, row in enumerate(ws.iter_rows(min_row=3), start=3):
        if _cell_text(row, 1):
            last_environment = _cell_text(row, 1)
        if _cell_text(row, 2):
            last_segment = _cell_text(row, 2)
        if _cell_text(row, 3):
            last_object = _cell_text(row, 3)
        if _cell_text(row, 4):
            last_scopes = _cell_raw(row, 4)
        service_raw = _cell_raw(row, 5)
        if not last_object:
            continue
        if not last_environment:
            result.validations.append(ValidationMessage("error", sheet_name, row_index, f"信息化对象缺少信息化环境：{last_object}"))
            continue
        environment = _object(
            "information_environment",
            last_environment,
            metadata={"display_order": row_index},
            source=_source(sheet_name, row_index, "信息化环境", _coord(row[1]), _cell_raw(row, 1) or last_environment),
        )
        segment = None
        if last_segment:
            segment = _object(
                "environment_segment",
                last_segment,
                qualifier=last_environment,
                metadata={"information_environment": last_environment, "display_order": row_index},
                source=_source(sheet_name, row_index, "环境分段", _coord(row[2]), _cell_raw(row, 2) or last_segment),
            )
        information_object = _object(
            "information_object",
            last_object,
            metadata={"source_role": "information_object", "display_order": row_index},
            source=_source(sheet_name, row_index, "信息化对象", _coord(row[3]), _cell_raw(row, 3) or last_object),
        )
        result.objects.extend([environment, information_object])
        if segment:
            result.objects.append(segment)
            result.relations.append(_relation(segment.key, "belongs_to", environment.key, "属于信息化环境", source=segment.sources[0]))
            result.relations.append(_relation(information_object.key, "belongs_to", segment.key, "属于环境分段", source=information_object.sources[0]))
        else:
            result.relations.append(_relation(information_object.key, "belongs_to", environment.key, "属于信息化环境", source=information_object.sources[0]))

        scope_objects: list[ObjectCandidate] = []
        for scope_code, scope_title in split_scope_values(last_scopes):
            if not scope_code and not scope_title:
                continue
            scope = _object(
                "scope_type",
                scope_title or scope_code or "",
                code=scope_code,
                metadata={"display_order": row_index},
                source=_source(sheet_name, row_index, "安全能力作用域", _coord(row[4]), last_scopes),
            )
            result.objects.append(scope)
            scope_objects.append(scope)
            result.relations.append(_relation(information_object.key, "applies_to_scope", scope.key, "适用于作用域", source=scope.sources[0]))

        if not is_blank_or_placeholder(service_raw):
            parts = service_parts(service_raw)
            service = _object(
                "security_technical_service",
                _service_title(parts, service_raw, authoritative_service_titles),
                code=parts["code"],
                category=parts["scope_code"],
                metadata={"scope_code": parts["scope_code"], "capability_focus_code": parts["capability_focus_code"]},
                source=_source(sheet_name, row_index, "安全技术服务", _coord(row[5]), service_raw),
            )
            result.objects.append(service)
            result.relations.append(_relation(service.key, "protects_object", information_object.key, "作用于信息化对象", source=service.sources[0]))
            for scope in scope_objects:
                result.relations.append(_relation(service.key, "applies_to_scope", scope.key, "适用于作用域", source=service.sources[0]))
    return result


SECOND_BATCH_SHEETS = [
    "安全能力-安全工作",
    "安全能力-安全管理元素（high level）",
    "安全职能流程清单（完善L4）",
    "安全工作职能清单",
    "gartner工作岗位参考",
]


THIRD_BATCH_SHEETS = [
    "LC-DT 数据生命周期",
    "LC-DT 数据生命周期场景目录",
    "LC-AP 应用安全开发生命周期",
    "LC-AP 应用安全开发生命周期元素目录",
]


def _cell_text(row: tuple[Any, ...], index: int) -> str:
    if index >= len(row):
        return ""
    return normalize_text(row[index].value)


def _cell_raw(row: tuple[Any, ...], index: int) -> object:
    if index >= len(row):
        return None
    return row[index].value


def _make_focus(code: str, title: str, sheet_name: str, row_index: int, cell: object) -> ObjectCandidate:
    return _object(
        "capability_focus",
        title or code,
        code=code,
        source=_source(sheet_name, row_index, "序号", _coord(cell), _cell_raw((cell,), 0)),
    )


def _function_code(value: object) -> str | None:
    text = normalize_text(value)
    if not text:
        return None
    if text.endswith(".0"):
        text = text[:-2]
    return text


def _gbt_category_from_title(title: str, fallback: str = "") -> str:
    if "-" in title:
        return normalize_text(title.split("-", 1)[0])
    return fallback


def _lifecycle_process_code(prefix: str, order: object) -> str | None:
    text = normalize_text(order)
    if not text:
        return None
    try:
        number = int(float(text))
    except ValueError:
        return f"{prefix}-{text}"
    return f"{prefix}-{number:02d}"


def _split_lines(value: object) -> list[str]:
    return split_multivalue_text(value, split_on_ideographic_comma=False)


def _split_numbered_items(value: object) -> list[tuple[str, str]]:
    text = str(value or "").replace("\xa0", " ").strip()
    if is_blank_or_placeholder(text):
        return []
    matches = list(re.finditer(r"(?m)^\s*(\d+)(?:[.．、]|\s+)\s*", text))
    if not matches:
        normalized = normalize_text(text)
        return [("1", normalized)] if normalized else []

    items: list[tuple[str, str]] = []
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        item_text = normalize_text(text[start:end])
        if item_text and not is_blank_or_placeholder(item_text):
            items.append((match.group(1), item_text))
    return items


def _split_lcap_services_by_separator(value: object) -> list[tuple[str, str]]:
    text = str(value or "").replace("\xa0", " ").strip()
    if is_blank_or_placeholder(text):
        return []
    current_category = "开发类"
    services: list[tuple[str, str]] = []
    for raw_line in text.splitlines():
        line = normalize_text(raw_line)
        if not line:
            continue
        if re.fullmatch(r"[—\-－―_]{3,}", line):
            current_category = "网络空间类"
            continue
        if is_blank_or_placeholder(line):
            continue
        services.append((line, current_category))
    return services


def _append_lcap_service(
    result: ParseResult,
    *,
    sheet_name: str,
    row_index: int,
    cell: object,
    raw_value: object,
    process: ObjectCandidate,
    service_title: str,
    service_category: str,
    authoritative_service_titles: dict[str, str],
) -> ObjectCandidate:
    parts = service_parts(service_title)
    service = _object(
        "security_technical_service",
        _service_title(parts, service_title, authoritative_service_titles),
        code=parts["code"],
        category=parts["scope_code"],
        metadata={
            "lifecycle_type": "application_security_development",
            "service_category": service_category,
            "scope_code": parts["scope_code"],
            "capability_focus_code": parts["capability_focus_code"],
        },
        source=_source(sheet_name, row_index, "关联安全技术服务", _coord(cell), raw_value),
    )
    result.objects.append(service)
    result.relations.append(
        _relation(
            process.key,
            "uses_service",
            service.key,
            "关联安全技术服务",
            source=service.sources[0],
            metadata={"service_category": service_category},
        )
    )
    return service


def _build_work_function_lookup(workbook) -> dict[str, dict[str, str | None]]:
    sheet_name = "安全工作职能清单"
    if sheet_name not in workbook.sheetnames:
        return {}
    ws = workbook[sheet_name]
    lookup: dict[str, dict[str, str | None]] = {}
    last_layer = ""
    last_group = ""
    for row in ws.iter_rows(min_row=3):
        if _cell_text(row, 1):
            last_layer = _cell_text(row, 1)
        if _cell_text(row, 2):
            last_group = _cell_text(row, 2)
        code = _function_code(_cell_raw(row, 3))
        title = _cell_text(row, 4)
        if not title:
            continue
        lookup[title] = {"code": code, "layer": last_layer or None, "group": last_group or None}
    return lookup


STAKEHOLDER_FUNCTION_ALIASES = {
    "安全实施职能（咨询规划）": "安全实施职能（规划咨询、方案设计、技术实施、项目管理）",
    "安全实施职能（规划咨询、方案设计、技术实施、项目管理）、技术实施）": "安全实施职能（规划咨询、方案设计、技术实施、项目管理）",
}


def parse_security_work_sheet(workbook) -> ParseResult:
    sheet_name = "安全能力-安全工作"
    ws = workbook[sheet_name]
    result = ParseResult()
    last_category: tuple[str | None, str] | None = None
    last_domain: tuple[str | None, str] | None = None
    last_capability: tuple[str | None, str] | None = None
    last_focus_code = ""
    last_focus_title = ""

    for row_index, row in enumerate(ws.iter_rows(min_row=4), start=4):
        if _cell_text(row, 1):
            last_category = split_code_title(_cell_raw(row, 1))
        if _cell_text(row, 2):
            last_domain = split_code_title(_cell_raw(row, 2))
        if _cell_text(row, 3):
            last_capability = split_code_title(_cell_raw(row, 3))
        if _cell_text(row, 4):
            last_focus_code = _cell_text(row, 4)
        if _cell_text(row, 5):
            last_focus_title = _cell_text(row, 5)

        work_title = _cell_text(row, 6)
        if not work_title:
            continue
        if not last_focus_code:
            result.validations.append(ValidationMessage("warning", sheet_name, row_index, f"安全工作缺少能力关注点：{work_title}"))
            continue

        focus = _object(
            "capability_focus",
            last_focus_title or last_focus_code,
            code=last_focus_code,
            source=_source(sheet_name, row_index, "序号", _coord(row[4]), last_focus_code),
        )
        work = _object(
            "security_work",
            work_title,
            qualifier=last_focus_code,
            metadata={
                "capability_focus_code": last_focus_code,
                "capability_category": last_category[1] if last_category else None,
                "capability_domain": last_domain[1] if last_domain else None,
                "capability": last_capability[1] if last_capability else None,
            },
            source=_source(sheet_name, row_index, "安全工作", _coord(row[6]), _cell_raw(row, 6)),
        )
        result.objects.extend([focus, work])
        result.relations.append(_relation(focus.key, "maps_to_work", work.key, "映射安全工作", source=work.sources[0]))
    return result


def parse_process_sheet(workbook) -> ParseResult:
    sheet_name = "安全职能流程清单（完善L4）"
    ws = workbook[sheet_name]
    result = ParseResult()
    last_category = ""
    last_domain_raw = ""
    last_group = ""
    last_reference = ""

    for row_index, row in enumerate(ws.iter_rows(min_row=4), start=4):
        if _cell_text(row, 1):
            last_category = _cell_text(row, 1)
        if _cell_text(row, 2):
            last_domain_raw = _cell_text(row, 2)
        if _cell_text(row, 3):
            last_group = _cell_text(row, 3)
        if _cell_text(row, 4):
            last_reference = _cell_text(row, 4)
        activity_title = _cell_text(row, 5)

        if not last_group or not last_reference:
            continue
        domain_code, domain_title = split_code_title(last_domain_raw)
        domain = _object(
            "process_domain",
            domain_title or last_domain_raw or last_category,
            code=domain_code,
            category=last_category,
            metadata={"process_category": last_category},
            source=_source(sheet_name, row_index, "L1 流程域", _coord(row[2]), last_domain_raw),
        )
        group = _object(
            "process_group",
            last_group,
            category=last_category,
            metadata={"process_domain": domain.title, "process_category": last_category},
            source=_source(sheet_name, row_index, "L2流程组", _coord(row[3]), last_group),
        )
        reference = _object(
            "process_reference",
            last_reference,
            qualifier=last_group,
            metadata={"process_group": last_group, "process_domain": domain.title, "process_category": last_category},
            source=_source(sheet_name, row_index, "L3流程参考", _coord(row[4]), last_reference),
        )
        result.objects.extend([domain, group, reference])
        result.relations.append(_relation(group.key, "belongs_to", domain.key, "属于流程域", source=group.sources[0]))
        result.relations.append(_relation(reference.key, "belongs_to", group.key, "属于流程组", source=reference.sources[0]))

        if activity_title:
            activity = _object(
                "process_activity",
                activity_title,
                qualifier=last_reference,
                metadata={"process_reference": last_reference, "process_group": last_group},
                source=_source(sheet_name, row_index, "L4关键活动", _coord(row[5]), _cell_raw(row, 5)),
            )
            result.objects.append(activity)
            result.relations.append(_relation(reference.key, "has_activity", activity.key, "包含关键活动", source=activity.sources[0]))
    return result


def parse_management_high_level_sheet(workbook, work_function_lookup: dict[str, dict[str, str | None]] | None = None) -> ParseResult:
    sheet_name = "安全能力-安全管理元素（high level）"
    ws = workbook[sheet_name]
    result = ParseResult()
    lookup = work_function_lookup or {}
    last_capability: tuple[str | None, str] | None = None
    last_focus_code = ""
    last_focus_title = ""
    last_process_group = ""
    last_stakeholders = {"决策层": [], "管理层": [], "执行层": [], "监督层": []}
    stakeholder_columns = [(8, "决策层"), (9, "管理层"), (10, "执行层"), (11, "监督层")]

    for row_index, row in enumerate(ws.iter_rows(min_row=4), start=4):
        if _cell_text(row, 3):
            last_capability = split_code_title(_cell_raw(row, 3))
        if _cell_text(row, 4):
            last_focus_code = _cell_text(row, 4)
        if _cell_text(row, 5):
            last_focus_title = _cell_text(row, 5)
        if _cell_text(row, 6):
            last_process_group = _cell_text(row, 6)

        for column_index, layer in stakeholder_columns:
            values = split_multivalue_text(_cell_raw(row, column_index), split_on_ideographic_comma=False)
            if values:
                last_stakeholders[layer] = values

        process_refs = split_multivalue_text(_cell_raw(row, 7))
        if not process_refs and _cell_text(row, 7):
            process_refs = [_cell_text(row, 7)]
        if not last_focus_code:
            continue

        focus = _object(
            "capability_focus",
            last_focus_title or last_focus_code,
            code=last_focus_code,
            source=_source(sheet_name, row_index, "序号", _coord(row[4]), last_focus_code),
        )
        result.objects.append(focus)

        capability = None
        if last_capability and last_capability[1]:
            capability = _object(
                "capability",
                last_capability[1],
                code=last_capability[0],
                source=_source(sheet_name, row_index, "L2安全能力", _coord(row[3]), _cell_raw(row, 3) or last_capability[1]),
            )
            result.objects.append(capability)

        process_group = None
        if last_process_group:
            process_group = _object(
                "process_group",
                last_process_group,
                source=_source(sheet_name, row_index, "L2流程组", _coord(row[6]), last_process_group),
            )
            result.objects.append(process_group)
            if capability:
                result.relations.append(_relation(capability.key, "maps_to_process", process_group.key, "映射流程组", source=process_group.sources[0]))

        process_reference_objects: list[ObjectCandidate] = []
        for process_ref_title in process_refs:
            process_reference = _object(
                "process_reference",
                process_ref_title,
                qualifier=last_process_group or None,
                metadata={"process_group": last_process_group or None, "capability_focus_code": last_focus_code},
                source=_source(sheet_name, row_index, "L3流程参考（结合信息化对象）", _coord(row[7]), _cell_raw(row, 7)),
            )
            result.objects.append(process_reference)
            process_reference_objects.append(process_reference)
            result.relations.append(_relation(focus.key, "maps_to_process", process_reference.key, "映射流程参考", source=process_reference.sources[0]))
            if process_group:
                result.relations.append(_relation(process_reference.key, "belongs_to", process_group.key, "属于流程组", source=process_reference.sources[0]))

        for layer, function_titles in last_stakeholders.items():
            layer_obj = _object(
                "work_function_layer",
                f"网络安全{layer}" if not layer.startswith("网络安全") else layer,
                source=_source(sheet_name, row_index, layer, None, layer),
            )
            result.objects.append(layer_obj)
            for function_title in function_titles:
                function_title = STAKEHOLDER_FUNCTION_ALIASES.get(function_title, function_title)
                function_info = lookup.get(function_title, {})
                function = _object(
                    "work_function",
                    function_title,
                    code=function_info.get("code"),
                    qualifier=function_info.get("layer") or layer,
                    metadata={
                        "stakeholder_layer": layer,
                        "work_function_layer": function_info.get("layer") or layer_obj.title,
                        "work_function_group": function_info.get("group"),
                        "matched_from_work_function_sheet": function_title in lookup,
                    },
                    source=_source(sheet_name, row_index, layer, None, function_title),
                )
                result.objects.append(function)
                result.relations.append(_relation(function.key, "belongs_to_layer", layer_obj.key, "属于职能层级", source=function.sources[0]))
                result.relations.append(
                    _relation(
                        focus.key,
                        "stakeholder_by",
                        function.key,
                        "相关组织职能",
                        source=function.sources[0],
                        metadata={"stakeholder_layer": layer},
                    )
                )
                for process_reference in process_reference_objects:
                    result.relations.append(
                        _relation(
                            process_reference.key,
                            "stakeholder_by",
                            function.key,
                            "流程相关组织职能",
                            source=function.sources[0],
                            metadata={"stakeholder_layer": layer, "capability_focus_code": last_focus_code},
                        )
                    )
    return result


def parse_work_function_sheet(workbook, workbook_path: str | Path | None = None) -> ParseResult:
    sheet_name = "安全工作职能清单"
    ws = workbook[sheet_name]
    result = ParseResult()
    last_layer = ""
    last_group = ""
    last_ref_category = ""

    for row_index, row in enumerate(ws.iter_rows(min_row=3), start=3):
        if _cell_text(row, 1):
            last_layer = _cell_text(row, 1)
        if _cell_text(row, 2):
            last_group = _cell_text(row, 2)
        code = _function_code(_cell_raw(row, 3))
        function_title = _cell_text(row, 4)
        description = _cell_text(row, 5)
        mapping_values = split_multivalue_text(_cell_raw(row, 6)) + split_multivalue_text(_cell_raw(row, 7))
        if _cell_text(row, 8):
            last_ref_category = _cell_text(row, 8)
        ref_task_title = _cell_text(row, 9)

        if last_ref_category and ref_task_title:
            gbt_reference = _object(
                "gbt_42446_task_reference",
                ref_task_title,
                category=last_ref_category,
                qualifier=last_ref_category,
                metadata={"standard": "GB/T 42446-2023", "reference_category": last_ref_category},
                source=_source(sheet_name, row_index, "承担的工作任务", _coord(row[9]), _cell_raw(row, 9)),
            )
            result.objects.append(gbt_reference)

        if not function_title:
            continue
        if not last_layer:
            result.validations.append(ValidationMessage("warning", sheet_name, row_index, f"工作职能缺少职能类：{function_title}"))
        layer = _object(
            "work_function_layer",
            last_layer,
            source=_source(sheet_name, row_index, "职能类", _coord(row[1]), last_layer),
        )
        group = _object(
            "work_function_group",
            last_group or "未分组",
            qualifier=last_layer,
            metadata={"work_function_layer": last_layer},
            source=_source(sheet_name, row_index, "职能组", _coord(row[2]), last_group),
        )
        function = _object(
            "work_function",
            function_title,
            code=code,
            description=description,
            qualifier=last_layer,
            metadata={"work_function_layer": last_layer, "work_function_group": last_group},
            source=_source(sheet_name, row_index, "工作职能", _coord(row[4]), _cell_raw(row, 4)),
        )
        result.objects.extend([layer, group, function])
        result.relations.append(_relation(group.key, "belongs_to_layer", layer.key, "属于职能层级", source=group.sources[0]))
        result.relations.append(_relation(function.key, "belongs_to_layer", layer.key, "属于职能层级", source=function.sources[0]))
        result.relations.append(_relation(function.key, "belongs_to", group.key, "属于职能组", source=function.sources[0]))

        for mapped_task in mapping_values:
            category = _gbt_category_from_title(mapped_task)
            gbt_reference = _object(
                "gbt_42446_task_reference",
                mapped_task,
                category=category,
                qualifier=category,
                metadata={"standard": "GB/T 42446-2023", "source_area": "GB_T 42446-2023 对应"},
                source=_source(sheet_name, row_index, "GB_T 42446-2023 对应", _coord(row[6]), _cell_raw(row, 6)),
            )
            work_task = _object(
                "work_task",
                mapped_task,
                qualifier=function.key,
                metadata={"work_function": function_title, "reference_standard": "GB/T 42446-2023"},
                source=_source(sheet_name, row_index, "GB_T 42446-2023 对应", _coord(row[6]), _cell_raw(row, 6)),
            )
            result.objects.extend([gbt_reference, work_task])
            result.relations.append(_relation(function.key, "maps_to_gbt_task", gbt_reference.key, "映射 GB/T 工作任务", source=gbt_reference.sources[0]))
            result.relations.append(_relation(function.key, "performs_task", work_task.key, "承担工作任务", source=work_task.sources[0]))

    if workbook_path:
        try:
            for asset_info in extract_excel_sheet_images(workbook_path, sheet_name):
                asset = _object(
                    "asset",
                    asset_info["title"],
                    qualifier=f"{asset_info.get('source_sheet')}::{asset_info.get('anchor')}::{asset_info.get('file_name')}",
                    metadata={
                        "asset_type": "image",
                        "source_sheet": asset_info.get("source_sheet"),
                        "source_row": asset_info.get("source_row"),
                        "source_column": asset_info.get("source_column"),
                        "anchor": asset_info.get("anchor"),
                        "file_name": asset_info.get("file_name"),
                        "path": asset_info.get("path"),
                        "format": asset_info.get("format"),
                    },
                    source=SourceRef(sheet=sheet_name, row=asset_info.get("source_row") or 0, column="嵌入图片", cell=asset_info.get("anchor"), raw_value=asset_info.get("file_name")),
                )
                result.objects.append(asset)
        except Exception as exc:  # pragma: no cover - defensive parser validation
            result.validations.append(ValidationMessage("warning", sheet_name, None, f"嵌入图片提取失败：{exc}"))
    return result


def parse_gartner_role_reference_sheet(workbook) -> ParseResult:
    sheet_name = "gartner工作岗位参考"
    ws = workbook[sheet_name]
    result = ParseResult()
    last_category = ""
    for row_index, row in enumerate(ws.iter_rows(min_row=3), start=3):
        if _cell_text(row, 1):
            last_category = _cell_text(row, 1)
        title = _cell_text(row, 2)
        description = _cell_text(row, 3)
        if not title:
            continue
        role = _object(
            "work_role_reference",
            title,
            description=description,
            category=last_category,
            qualifier=last_category,
            metadata={"reference_source": "Gartner", "role_category": last_category},
            source=_source(sheet_name, row_index, "角色", _coord(row[2]), _cell_raw(row, 2)),
        )
        result.objects.append(role)
    return result


def parse_data_lifecycle_sheet(workbook, authoritative_service_titles: dict[str, str] | None = None) -> ParseResult:
    sheet_name = "LC-DT 数据生命周期"
    ws = workbook[sheet_name]
    result = ParseResult()
    for row_index, row in enumerate(ws.iter_rows(min_row=3), start=3):
        order = _cell_raw(row, 1)
        process_title = _cell_text(row, 2)
        if not process_title:
            continue
        process = _object(
            "lifecycle_process",
            process_title,
            code=_lifecycle_process_code("DT", order),
            qualifier="data",
            metadata={"lifecycle_type": "data", "order": order},
            source=_source(sheet_name, row_index, "过程", _coord(row[2]), _cell_raw(row, 2)),
        )
        result.objects.append(process)

        for service_raw in _split_lines(_cell_raw(row, 3)):
            parts = service_parts(service_raw)
            service = _object(
                "security_technical_service",
                _service_title(parts, service_raw, authoritative_service_titles),
                code=parts["code"],
                category=parts["scope_code"],
                metadata={
                    "scope_code": parts["scope_code"],
                    "capability_focus_code": parts["capability_focus_code"],
                    "lifecycle_type": "data",
                },
                source=_source(sheet_name, row_index, "安全技术服务设计", _coord(row[3]), service_raw),
            )
            result.objects.append(service)
            result.relations.append(_relation(service.key, "maps_to_lifecycle", process.key, "映射到生命周期", source=service.sources[0]))

        for module_raw in _split_lines(_cell_raw(row, 4)):
            module = _object(
                "security_technology_module",
                module_raw,
                metadata={"lifecycle_type": "data"},
                source=_source(sheet_name, row_index, "安全技术模块设计", _coord(row[4]), module_raw),
            )
            result.objects.append(module)
            result.relations.append(_relation(module.key, "maps_to_lifecycle", process.key, "映射到生命周期", source=module.sources[0]))
    return result


def parse_data_lifecycle_scene_sheet(workbook) -> ParseResult:
    sheet_name = "LC-DT 数据生命周期场景目录"
    ws = workbook[sheet_name]
    result = ParseResult()
    last_order: object = None
    last_process_title = ""
    last_process_description = ""
    for row_index, row in enumerate(ws.iter_rows(min_row=3), start=3):
        if _cell_text(row, 1):
            last_order = _cell_raw(row, 1)
        if _cell_text(row, 2):
            last_process_title = _cell_text(row, 2)
        if _cell_text(row, 3):
            last_process_description = _cell_text(row, 3)
        scene_code = normalize_text(_cell_raw(row, 4))
        scene_title = _cell_text(row, 5)
        if not scene_code and not scene_title:
            continue
        if not last_process_title:
            result.validations.append(ValidationMessage("error", sheet_name, row_index, "生命周期场景缺少上级过程"))
            continue
        if not scene_title:
            result.validations.append(ValidationMessage("error", sheet_name, row_index, f"生命周期场景 {scene_code} 缺少标题"))
            continue
        process = _object(
            "lifecycle_process",
            last_process_title,
            code=_lifecycle_process_code("DT", last_order),
            description=last_process_description,
            qualifier="data",
            metadata={"lifecycle_type": "data", "order": last_order},
            source=_source(sheet_name, row_index, "过程", _coord(row[2]), _cell_raw(row, 2) or last_process_title),
        )
        scene = _object(
            "lifecycle_scene",
            scene_title,
            code=scene_code,
            qualifier="data",
            metadata={"lifecycle_type": "data", "process_title": last_process_title},
            source=_source(sheet_name, row_index, "场景划分", _coord(row[5]), _cell_raw(row, 5)),
        )
        result.objects.extend([process, scene])
        result.relations.append(_relation(process.key, "has_scene", scene.key, "包含场景", source=scene.sources[0]))
    return result


def parse_application_security_lifecycle_sheet(
    workbook,
    authoritative_service_titles: dict[str, str] | None = None,
    authoritative_module_titles: set[str] | None = None,
) -> ParseResult:
    sheet_name = "LC-AP 应用安全开发生命周期"
    ws = workbook[sheet_name]
    result = ParseResult()
    authoritative_service_titles = authoritative_service_titles or {}
    authoritative_module_titles = authoritative_module_titles or set()
    development_types = ["自研应用", "定制应用", "外购应用", "SaaS应用"]
    for order, (row_index, row) in enumerate(enumerate(ws.iter_rows(min_row=4), start=4), start=1):
        process_title = _cell_text(row, 1)
        if not process_title:
            continue
        goal = _cell_text(row, 2)
        main_activities = _split_lines(_cell_raw(row, 3))
        lifecycle_ref = _cell_text(row, 4)
        activity_definition = _cell_text(row, 5)
        policy_raw = _cell_raw(row, 6)
        policy_ref = _cell_text(row, 7)
        process = _object(
            "lifecycle_process",
            process_title,
            code=_lifecycle_process_code("AP", order),
            description=goal,
            qualifier="application_security_development",
            metadata={
                "lifecycle_type": "application_security_development",
                "order": order,
                "goal": goal,
                "main_activities": main_activities,
                "reference_source": lifecycle_ref,
            },
            source=_source(sheet_name, row_index, "阶段（L3流程）", _coord(row[1]), _cell_raw(row, 1)),
        )
        result.objects.append(process)

        for activity_order, activity_title in enumerate(main_activities, start=1):
            lifecycle_activity = _object(
                "lifecycle_activity",
                activity_title,
                qualifier=process_title,
                metadata={
                    "lifecycle_type": "application_security_development",
                    "process_title": process_title,
                    "order": activity_order,
                },
                source=_source(sheet_name, row_index, "阶段主要活动（L4流程活动）", _coord(row[3]), activity_title),
            )
            result.objects.append(lifecycle_activity)
            result.relations.append(_relation(process.key, "has_main_activity", lifecycle_activity.key, "包含阶段主要活动", source=lifecycle_activity.sources[0]))

        policy_relation_source_key = process.key
        if activity_definition and not is_blank_or_placeholder(activity_definition):
            activity = _object(
                "security_activity",
                f"{process_title}安全活动",
                description=activity_definition,
                qualifier=process_title,
                metadata={"lifecycle_type": "application_security_development", "process_title": process_title, "reference_source": policy_ref},
                source=_source(sheet_name, row_index, "安全活动定义", _coord(row[5]), _cell_raw(row, 5)),
            )
            result.objects.append(activity)
            result.relations.append(_relation(process.key, "has_activity", activity.key, "包含活动", source=activity.sources[0]))
            policy_relation_source_key = activity.key

        for sequence, policy_text in _split_numbered_items(policy_raw):
            policy = _object(
                "security_policy_requirement",
                policy_text[:80],
                code=f"AP-{order:02d}-{int(sequence):02d}" if sequence.isdigit() else f"AP-{order:02d}-{sequence}",
                description=policy_text,
                qualifier=process_title,
                metadata={
                    "lifecycle_type": "application_security_development",
                    "process_title": process_title,
                    "sequence": sequence,
                    "reference_source": policy_ref,
                    "source_type": "LC-AP",
                },
                source=_source(sheet_name, row_index, "安全活动对应安全策略", _coord(row[6]), policy_text),
            )
            result.objects.append(policy)
            result.relations.append(_relation(policy_relation_source_key, "requires_policy", policy.key, "要求策略", source=policy.sources[0]))

        for offset, development_type in enumerate(development_types, start=8):
            if not _is_lcap_development_type_fill(row[offset]):
                continue
            dev_type = _object(
                "software_development_type",
                development_type,
                source=_source(sheet_name, row_index, "软件开发模式", _coord(row[offset]), _cell_raw(row, offset)),
            )
            result.objects.append(dev_type)
            result.relations.append(_relation(process.key, "applies_to_development_type", dev_type.key, "适用于开发类型", source=dev_type.sources[0]))

        for service_title in _split_lines(_cell_raw(row, 12)):
            _append_lcap_service(
                result,
                sheet_name=sheet_name,
                row_index=row_index,
                cell=row[12],
                raw_value=service_title,
                process=process,
                service_title=service_title,
                service_category="开发类",
                authoritative_service_titles=authoritative_service_titles,
            )

        for service_title in _split_lines(_cell_raw(row, 16)):
            _append_lcap_service(
                result,
                sheet_name=sheet_name,
                row_index=row_index,
                cell=row[16],
                raw_value=service_title,
                process=process,
                service_title=service_title,
                service_category="管理类",
                authoritative_service_titles=authoritative_service_titles,
            )

        for service_title, service_category in _split_lcap_services_by_separator(_cell_raw(row, 17)):
            _append_lcap_service(
                result,
                sheet_name=sheet_name,
                row_index=row_index,
                cell=row[17],
                raw_value=service_title,
                process=process,
                service_title=service_title,
                service_category=service_category,
                authoritative_service_titles=authoritative_service_titles,
            )

        for module_title in _split_lines(_cell_raw(row, 18)):
            normalized_module = normalize_text(module_title)
            authoritative_module = _lcap_authoritative_module_title(normalized_module, authoritative_module_titles)
            if authoritative_module:
                module = _object(
                    "security_technology_module",
                    authoritative_module,
                    source=_source(sheet_name, row_index, "安全技术模块", _coord(row[18]), module_title),
                )
                result.objects.append(module)
                result.relations.append(_relation(process.key, "uses_module", module.key, "关联安全技术模块", source=module.sources[0]))
                continue
            if normalized_module in LCAP_TECHNICAL_MEASURE_TITLES:
                measure = _object(
                    "security_technical_measure",
                    normalized_module,
                    category="安全技术措施",
                    metadata={"lifecycle_type": "application_security_development", "process_title": process_title},
                    source=_source(sheet_name, row_index, "安全技术模块", _coord(row[18]), module_title),
                )
                result.objects.append(measure)
                result.relations.append(
                    _relation(process.key, "uses_measure", measure.key, "关联安全技术措施", source=measure.sources[0])
                )
                continue
            if normalized_module not in authoritative_module_titles:
                result.validations.append(
                    ValidationMessage(
                        "warning",
                        sheet_name,
                        row_index,
                        f"LC-AP 安全技术模块未匹配安全技术模块清单：{normalized_module}（阶段：{process_title}）",
                    )
                )
                continue

        for product_title in _split_lines(_cell_raw(row, 13)):
            product_component = _object(
                "development_product_component",
                product_title,
                category="开发类产品组件",
                metadata={"lifecycle_type": "application_security_development", "process_title": process_title},
                source=_source(sheet_name, row_index, "实际产品示例", _coord(row[13]), product_title),
            )
            result.objects.append(product_component)
            result.relations.append(
                _relation(process.key, "uses_development_product_component", product_component.key, "使用开发类产品组件", source=product_component.sources[0])
            )
    return result


def parse_application_lifecycle_element_sheet(workbook) -> ParseResult:
    sheet_name = "LC-AP 应用安全开发生命周期元素目录"
    ws = workbook[sheet_name]
    result = ParseResult()

    for row_index, row in enumerate(ws.iter_rows(min_row=4, max_row=7), start=4):
        title = _cell_text(row, 1)
        description = _cell_text(row, 2)
        if not title:
            continue
        result.objects.append(
            _object(
                "software_development_type",
                title,
                description=description,
                source=_source(sheet_name, row_index, "类型", _coord(row[1]), _cell_raw(row, 1)),
            )
        )

    last_system_type: ObjectCandidate | None = None
    for row_index, row in enumerate(ws.iter_rows(min_row=13), start=13):
        system_title = _cell_text(row, 1)
        system_description = _cell_text(row, 2)
        component_title = _cell_text(row, 3)
        if system_title:
            last_system_type = _object(
                "application_system_type",
                system_title,
                description=system_description,
                source=_source(sheet_name, row_index, "应用系统", _coord(row[1]), _cell_raw(row, 1)),
            )
            result.objects.append(last_system_type)
        if component_title and last_system_type:
            component = _object(
                "application_component",
                component_title,
                qualifier=last_system_type.title,
                metadata={"application_system_type": last_system_type.title},
                source=_source(sheet_name, row_index, "应用组件", _coord(row[3]), _cell_raw(row, 3)),
            )
            result.objects.append(component)
            result.relations.append(_relation(last_system_type.key, "has_component", component.key, "包含组件", source=component.sources[0]))
    return result


def parse_second_batch_sheets(path: str | Path, sheets: list[str] | None = None) -> ParseResult:
    selected = sheets or SECOND_BATCH_SHEETS
    workbook = _load_workbook(path)
    try:
        result = ParseResult()
        work_function_lookup = _build_work_function_lookup(workbook)
        parsers = {
            "安全能力-安全工作": lambda wb: parse_security_work_sheet(wb),
            "安全能力-安全管理元素（high level）": lambda wb: parse_management_high_level_sheet(wb, work_function_lookup),
            "安全职能流程清单（完善L4）": lambda wb: parse_process_sheet(wb),
            "安全工作职能清单": lambda wb: parse_work_function_sheet(wb, path),
            "gartner工作岗位参考": lambda wb: parse_gartner_role_reference_sheet(wb),
        }
        for sheet_name in selected:
            if sheet_name not in workbook.sheetnames:
                result.validations.append(ValidationMessage("error", sheet_name, None, "缺少第二批 Sheet"))
                continue
            result.extend(parsers[sheet_name](workbook))
        return result
    finally:
        workbook.close()


def parse_third_batch_sheets(path: str | Path, sheets: list[str] | None = None) -> ParseResult:
    selected = sheets or THIRD_BATCH_SHEETS
    workbook = _load_workbook(path)
    try:
        result = ParseResult()
        authoritative_service_titles = _build_authoritative_service_titles(workbook)
        authoritative_module_titles = _build_authoritative_module_titles(workbook)
        parsers = {
            "LC-DT 数据生命周期": lambda wb: parse_data_lifecycle_sheet(wb, authoritative_service_titles),
            "LC-DT 数据生命周期场景目录": parse_data_lifecycle_scene_sheet,
            "LC-AP 应用安全开发生命周期": lambda wb: parse_application_security_lifecycle_sheet(wb, authoritative_service_titles, authoritative_module_titles),
            "LC-AP 应用安全开发生命周期元素目录": parse_application_lifecycle_element_sheet,
        }
        for sheet_name in selected:
            if sheet_name not in workbook.sheetnames:
                result.validations.append(ValidationMessage("error", sheet_name, None, "缺少第三批 Sheet"))
                continue
            result.extend(parsers[sheet_name](workbook))
        return result
    finally:
        workbook.close()


def parse_core_sheets(path: str | Path, sheets: list[str] | None = None) -> ParseResult:
    selected = sheets or [
        "安全能力目录",
        "安全能力作用域目录",
        "信息化环境-信息化对象-安全作用域映射",
        "安全能力-安全技术服务",
        "安全技术模块清单",
        "作用域-安全技术服务-安全技术模块映射",
    ]
    parsers = {
        "安全能力目录": parse_capability_sheet,
        "安全能力作用域目录": parse_scope_sheet,
        "信息化环境-信息化对象-安全作用域映射": None,
        "安全能力-安全技术服务": parse_service_sheet,
        "安全技术模块清单": None,
        "作用域-安全技术服务-安全技术模块映射": None,
    }
    workbook = _load_workbook(path)
    try:
        result = ParseResult()
        authoritative_service_titles = _build_authoritative_service_titles(workbook)
        parsers["信息化环境-信息化对象-安全作用域映射"] = (
            lambda wb: parse_environment_scope_sheet(wb, authoritative_service_titles)
        )
        parsers["安全技术模块清单"] = lambda wb: parse_module_sheet(wb, authoritative_service_titles)
        parsers["作用域-安全技术服务-安全技术模块映射"] = lambda wb: parse_scene_sheet(wb, authoritative_service_titles)
        for sheet_name in selected:
            if sheet_name not in workbook.sheetnames:
                result.validations.append(ValidationMessage("error", sheet_name, None, "缺少核心 Sheet"))
                continue
            parser = parsers[sheet_name]
            if parser is None:
                result.validations.append(ValidationMessage("error", sheet_name, None, "缺少核心 Sheet 解析器"))
                continue
            result.extend(parser(workbook))
        return result
    finally:
        workbook.close()
