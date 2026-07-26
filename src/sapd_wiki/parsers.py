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


def _security_module_titles_from_catalog_alias(value: object, authoritative_module_titles: set[str]) -> list[str]:
    """Resolve free-text module cells to security technology module catalog titles."""
    title = normalize_text(value)
    if not title or title == "\\":
        return []
    if title in authoritative_module_titles:
        return [title]
    rules: list[tuple[bool, list[str]]] = [
        ("API安全防护" in title, ["API安全防护"]),
        ("主机安全管理" in title or "主机系统安全管理" in title or title == "应用程序控制", ["主机安全管理"]),
        ("容器镜像安全" in title, ["容器镜像安全"]),
        ("文件完整性监控" in title or title == "主机入侵防御", ["主机入侵防御（HIPS）"]),
        ("终端安全检测与响应" in title, ["终端安全检测与响应（EDR）"]),
        ("终端恶意代码防护" in title, ["终端恶意代码防护(EPP)"]),
        ("终端数据防泄露" in title, ["终端数据防泄露（EDLP）"]),
        ("移动安全管理" in title, ["移动安全管理(MTD)"]),
        ("Web应用防火墙" in title, ["Web应用防火墙（WAF）"]),
        ("运行时应用自防护" in title, ["运行时应用自防护（RASP）"]),
        ("安全接入网关" in title, ["安全接入网关（VPN）"]),
        ("网络准入控制" in title, ["网络准入控制（NAC）"]),
        ("数据加密" in title, ["数据加密和令牌化"]),
        ("数据安全网关" in title, ["数据安全网关"]),
        ("数据水印溯源" in title, ["数据水印溯源"]),
        ("数据脱敏" in title, ["数据脱敏(去标识化)"]),
        ("零信任访问代理" in title and "零信任访问控制台" in title, ["零信任访问代理", "零信任访问控制台"]),
        ("零信任访问控制台" in title, ["零信任访问控制台"]),
        ("单向光闸" in title and "双向网闸" in title, ["单向光闸", "双向网闸"]),
        ("虚拟主机部署" in title and "容器环境部署" in title, ["主机安全管理", "容器镜像安全"]),
        (title == "安全工作区", ["终端安全工作区"]),
    ]
    for matched, candidates in rules:
        if matched:
            return [candidate for candidate in candidates if candidate in authoritative_module_titles]
    return []


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
    return load_workbook(resolve_project_path(path), read_only=False, data_only=True)


def _merged_cell_values(ws) -> dict[str, object]:
    merged = getattr(ws, "merged_cells", None)
    ranges = getattr(merged, "ranges", []) if merged else []
    values: dict[str, object] = {}
    for merged_range in ranges:
        anchor_value = ws.cell(merged_range.min_row, merged_range.min_col).value
        for row_index in range(merged_range.min_row, merged_range.max_row + 1):
            for column_index in range(merged_range.min_col, merged_range.max_col + 1):
                values[ws.cell(row_index, column_index).coordinate] = anchor_value
    return values


def _cell_raw_with_merged(row: tuple[object, ...], column_index: int, merged_values: dict[str, object]) -> object:
    cell = row[column_index]
    coord = _coord(cell)
    if coord and coord in merged_values:
        return merged_values[coord]
    return _cell_raw(row, column_index)


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
                scope_source = service.sources[0] if scope_code == "ALL" else _source(
                    sheet_name,
                    3,
                    f"作用域列{col}",
                    _coord(ws.cell(row=3, column=col)),
                    ws.cell(row=3, column=col).value,
                )
                scope = _object(
                    "scope_type",
                    scope_title,
                    code=scope_code,
                    source=scope_source,
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
    for row_idx, row in enumerate(ws.iter_rows(min_row=3), start=3):
        if _is_numeric_summary_value(row[3].value):
            continue
        if normalize_text(row[3].value):
            last_module = normalize_text(row[3].value)
        if last_module:
            titles.add(last_module)
    return titles


def _build_authoritative_scope_titles(workbook) -> dict[str, str]:
    sheet_name = "安全能力作用域目录"
    if sheet_name not in workbook.sheetnames:
        return {}
    ws = workbook[sheet_name]
    titles: dict[str, str] = {}
    for row in ws.iter_rows(min_row=3):
        code, title = split_code_title(row[2].value)
        if code:
            titles[code] = title or code
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


def _validate_service_reference(
    result: ParseResult,
    sheet_name: str,
    row_index: int,
    service_raw: object,
    parts: dict[str, str | None],
    authoritative_service_titles: dict[str, str] | None = None,
) -> None:
    if authoritative_service_titles is None:
        return
    code = parts.get("code")
    if not code:
        return
    expected_title = authoritative_service_titles.get(code)
    raw_title = normalize_service_title(parts.get("title") or normalize_text(service_raw))
    normalized_raw = normalize_text(service_raw)
    if expected_title is None:
        result.validations.append(
            ValidationMessage("warning", sheet_name, row_index, f"安全技术服务未匹配安全技术服务清单：{normalized_raw}")
        )
        return
    if raw_title and raw_title != expected_title:
        result.validations.append(
            ValidationMessage(
                "warning",
                sheet_name,
                row_index,
                f"安全技术服务名称与安全技术服务清单不一致：{normalized_raw}（清单：{code} {expected_title}）",
            )
        )


def _canonical_service_parts_by_authority(
    parts: dict[str, str | None],
    authoritative_service_titles: dict[str, str] | None = None,
) -> dict[str, str | None]:
    if authoritative_service_titles is None:
        return parts
    code = parts.get("code")
    if code and code in authoritative_service_titles:
        return parts

    raw_title = normalize_service_title(parts.get("title") or "")
    if not raw_title:
        return parts
    matches = [
        (service_code, service_title)
        for service_code, service_title in authoritative_service_titles.items()
        if normalize_service_title(service_title) == raw_title
    ]
    if len(matches) != 1:
        return parts

    canonical_code, canonical_title = matches[0]
    return service_parts(
        f"{canonical_code} {canonical_title}",
        fallback_scope_code=parts.get("scope_code"),
        fallback_focus_code=parts.get("capability_focus_code"),
    )


def _is_authoritative_service_reference(
    authoritative_service_titles: dict[str, str] | None,
    parts: dict[str, str | None],
) -> bool:
    if authoritative_service_titles is None:
        return True
    code = parts.get("code")
    return bool(code and code in authoritative_service_titles)


def parse_module_sheet(workbook, authoritative_service_titles: dict[str, str] | None = None) -> ParseResult:
    sheet_name = "安全技术模块清单"
    ws = workbook[sheet_name]
    result = ParseResult()
    merged_values = _merged_cell_values(ws)
    last_category = ""
    last_system = ""
    last_module = ""
    last_definition = ""
    last_product = ""
    for row_index, row in enumerate(ws.iter_rows(min_row=3), start=3):
        category_raw = normalize_text(_cell_raw_with_merged(row, 1, merged_values))
        system_raw = normalize_text(_cell_raw_with_merged(row, 2, merged_values))
        module_raw = normalize_text(_cell_raw_with_merged(row, 3, merged_values))
        definition_raw = normalize_text(_cell_raw_with_merged(row, 4, merged_values))
        product_raw = normalize_text(_cell_raw_with_merged(row, 6, merged_values))
        service_raw = _cell_raw_with_merged(row, 5, merged_values)
        explicit_module_anchor = bool(normalize_text(row[3].value))
        if _is_numeric_summary_value(system_raw) or _is_numeric_summary_value(module_raw):
            continue
        if category_raw:
            last_category = category_raw
        if explicit_module_anchor:
            last_system = system_raw
            last_module = module_raw
            last_definition = definition_raw
            last_product = product_raw
        else:
            if system_raw:
                last_system = system_raw
            if module_raw:
                last_module = module_raw
            if definition_raw:
                last_definition = definition_raw
            if product_raw:
                last_product = product_raw
        if not last_module:
            continue
        system = _object(
            "security_system",
            last_system,
            category=last_category,
            metadata={"category": last_category, "display_order": row_index},
            source=_source(sheet_name, row_index, "安全系统", _coord(row[2]), last_system),
        )
        module = _object(
            "security_technology_module",
            last_module,
            description=last_definition,
            category=last_category,
            metadata={"category": last_category, "security_system": last_system, "product": last_product, "display_order": row_index},
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
            raw_parts = service_parts(service_raw)
            _validate_service_reference(result, sheet_name, row_index, service_raw, raw_parts, authoritative_service_titles)
            parts = _canonical_service_parts_by_authority(raw_parts, authoritative_service_titles)
            if not _is_authoritative_service_reference(authoritative_service_titles, parts):
                continue
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


def parse_scene_sheet(
    workbook,
    authoritative_service_titles: dict[str, str] | None = None,
    authoritative_module_titles: set[str] | None = None,
    authoritative_scope_titles: dict[str, str] | None = None,
) -> ParseResult:
    sheet_name = "作用域-安全技术服务-安全技术模块映射"
    ws = workbook[sheet_name]
    result = ParseResult()
    merged_values = _merged_cell_values(ws)
    authoritative_module_titles = authoritative_module_titles or set()
    authoritative_scope_titles = authoritative_scope_titles or {}
    last_environment = ""
    last_segment = ""
    last_object = ""
    last_scopes = ""
    last_system = ""
    last_system_cell: str | None = None
    last_service_raw: object = ""
    last_service_cell: str | None = None
    last_module_raw: object = ""
    last_module_cell: str | None = None
    last_module_is_scene_module = False
    for row_index, row in enumerate(ws.iter_rows(min_row=3), start=3):
        environment_raw = normalize_text(_cell_raw_with_merged(row, 1, merged_values))
        segment_raw = normalize_text(_cell_raw_with_merged(row, 2, merged_values))
        object_raw = normalize_text(_cell_raw_with_merged(row, 3, merged_values))
        scope_raw = normalize_text(_cell_raw_with_merged(row, 4, merged_values))
        system_raw = normalize_text(_cell_raw_with_merged(row, 7, merged_values))
        if environment_raw and last_environment and environment_raw != last_environment:
            last_segment = ""
            last_object = ""
            last_scopes = ""
            last_system = ""
            last_system_cell = None
            last_service_raw = ""
            last_service_cell = None
            last_module_raw = ""
            last_module_cell = None
            last_module_is_scene_module = False
        if environment_raw:
            last_environment = environment_raw
        if segment_raw:
            last_segment = segment_raw
        if normalize_text(row[3].value):
            last_object = object_raw
            last_service_raw = ""
            last_service_cell = None
            last_module_raw = ""
            last_module_cell = None
            last_module_is_scene_module = False
            last_system = ""
            last_system_cell = None
        if scope_raw:
            last_scopes = scope_raw
        if system_raw:
            last_system = system_raw
            last_system_cell = _coord(row[7])
        module_raw = row[6].value
        module_cell = _coord(row[6])
        module_is_scene_module = not is_blank_or_placeholder(module_raw) and _is_scene_module_fill(row[6])
        service_raw = row[5].value
        service_cell = _coord(row[5])
        if not is_blank_or_placeholder(module_raw):
            last_module_raw = module_raw
            last_module_cell = module_cell
            last_module_is_scene_module = module_is_scene_module
        if not is_blank_or_placeholder(service_raw):
            last_service_raw = service_raw
            last_service_cell = service_cell
            if is_blank_or_placeholder(module_raw) and last_module_raw:
                module_raw = last_module_raw
                module_cell = last_module_cell
                module_is_scene_module = last_module_is_scene_module
        elif not is_blank_or_placeholder(module_raw) and last_service_raw:
            service_raw = last_service_raw
            service_cell = last_service_cell
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
        service_scope_objects: list[ObjectCandidate] = []
        if not is_blank_or_placeholder(service_raw):
            raw_parts = service_parts(service_raw)
            _validate_service_reference(result, sheet_name, row_index, service_raw, raw_parts, authoritative_service_titles)
            parts = _canonical_service_parts_by_authority(raw_parts, authoritative_service_titles)
            service_scope_code = normalize_text(parts.get("scope_code"))
            if service_scope_code:
                service_scope = next((scope for scope in scope_objects if scope.code == service_scope_code), None)
                if service_scope is None:
                    service_scope = _object(
                        "scope_type",
                        authoritative_scope_titles.get(service_scope_code) or service_scope_code,
                        code=service_scope_code,
                        metadata={"derived_from_service_code": True},
                        source=_source(sheet_name, row_index, "安全技术服务派生作用域", service_cell, service_raw),
                    )
                    result.objects.append(service_scope)
                    scope_objects.append(service_scope)
                    result.relations.append(_relation(info_obj.key, "applies_to_scope", service_scope.key, "适用于作用域", source=service_scope.sources[0]))
                service_scope_objects = [service_scope]
            if _is_authoritative_service_reference(authoritative_service_titles, parts):
                service = _object(
                    "security_technical_service",
                    _service_title(parts, service_raw, authoritative_service_titles),
                    code=parts["code"],
                    category=parts["scope_code"],
                    metadata={"scope_code": parts["scope_code"], "capability_focus_code": parts["capability_focus_code"]},
                    source=_source(sheet_name, row_index, "安全技术服务", service_cell, service_raw),
                )
                result.objects.append(service)
                result.relations.append(_relation(service.key, "protects_object", info_obj.key, "作用于信息化对象", source=service.sources[0]))
                for scope in service_scope_objects or scope_objects:
                    result.relations.append(_relation(service.key, "applies_to_scope", scope.key, "适用于作用域", source=service.sources[0]))

        module = None
        if not is_blank_or_placeholder(module_raw) and module_is_scene_module:
            module_titles = _security_module_titles_from_catalog_alias(module_raw, authoritative_module_titles)
            if not module_titles:
                result.validations.append(ValidationMessage("warning", sheet_name, row_index, f"安全技术模块未匹配安全技术模块清单：{normalize_text(module_raw)}"))
            for module_title in module_titles:
                module = _object("security_technology_module", module_title, source=_source(sheet_name, row_index, "安全技术模块/措施", module_cell, module_raw))
                result.objects.append(module)
                result.relations.append(_relation(module.key, "deployed_in_environment", env.key, "部署/适用于环境", source=module.sources[0]))
                if service:
                    result.relations.append(_relation(module.key, "implements_service", service.key, "实现技术服务", source=module.sources[0]))
                if last_system:
                    system = _object("security_system", last_system, source=_source(sheet_name, row_index, "安全系统", last_system_cell, last_system))
                    result.objects.append(system)
                    result.relations.append(_relation(module.key, "part_of_system", system.key, "属于安全系统", source=module.sources[0]))
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
    "LC-DT 安全技术服务、模块、策略映射表",
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


def _cell_display_text(row: tuple[Any, ...], index: int) -> str:
    value = _cell_raw(row, index)
    if value is None:
        return ""
    return str(value).replace("\r\n", "\n").replace("\r", "\n").strip()


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


def _data_lifecycle_stage_title(value: object) -> str:
    text = normalize_text(value)
    if not text:
        return ""
    first_line = text.splitlines()[0].strip()
    return re.sub(r"\s*[（(][^)）]+[)）]\s*$", "", first_line).strip()


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
    service_category: str | None = None,
    authoritative_service_titles: dict[str, str],
) -> ObjectCandidate | None:
    raw_parts = service_parts(service_title)
    _validate_service_reference(result, sheet_name, row_index, service_title, raw_parts, authoritative_service_titles)
    parts = _canonical_service_parts_by_authority(raw_parts, authoritative_service_titles)
    if not _is_authoritative_service_reference(authoritative_service_titles, parts):
        return None
    metadata = {
        "lifecycle_type": "application_security_development",
        "scope_code": parts["scope_code"],
        "capability_focus_code": parts["capability_focus_code"],
    }
    relation_metadata: dict[str, str] = {}
    if service_category:
        metadata["service_category"] = service_category
        relation_metadata["service_category"] = service_category
    service = _object(
        "security_technical_service",
        _service_title(parts, service_title, authoritative_service_titles),
        code=parts["code"],
        category=parts["scope_code"],
        metadata=metadata,
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
            metadata=relation_metadata,
        )
    )
    return service


def _append_lcap_module_or_measure(
    result: ParseResult,
    *,
    sheet_name: str,
    row_index: int,
    cell: object,
    raw_value: object,
    process: ObjectCandidate,
    process_title: str,
    module_title: str,
    authoritative_module_titles: set[str],
) -> None:
    normalized_module = normalize_text(module_title)
    if not normalized_module or normalized_module == "\\":
        return
    authoritative_module = _lcap_authoritative_module_title(normalized_module, authoritative_module_titles)
    if authoritative_module:
        module = _object(
            "security_technology_module",
            authoritative_module,
            source=_source(sheet_name, row_index, "安全技术模块", _coord(cell), module_title),
        )
        result.objects.append(module)
        result.relations.append(_relation(process.key, "uses_module", module.key, "关联安全技术模块", source=module.sources[0]))
        return
    measure = _object(
        "security_technical_measure",
        normalized_module,
        category="安全技术措施",
        metadata={"lifecycle_type": "application_security_development", "process_title": process_title},
        source=_source(sheet_name, row_index, "安全技术模块", _coord(cell), module_title),
    )
    result.objects.append(measure)
    result.relations.append(_relation(process.key, "uses_measure", measure.key, "关联安全技术措施", source=measure.sources[0]))


def _build_work_function_lookup(workbook) -> dict[str, dict[str, str | None]]:
    sheet_name = "安全工作职能清单"
    if sheet_name not in workbook.sheetnames:
        return {}
    ws = workbook[sheet_name]
    lookup: dict[str, dict[str, str | None]] = {}
    last_layer = ""
    last_group = ""
    for row_idx, row in enumerate(ws.iter_rows(min_row=3), start=3):
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
    merged_values = _merged_cell_values(ws)
    last_category: tuple[str | None, str] | None = None
    last_domain: tuple[str | None, str] | None = None
    last_capability: tuple[str | None, str] | None = None
    last_focus_code = ""
    last_focus_title = ""

    for row_index, row in enumerate(ws.iter_rows(min_row=4), start=4):
        category_raw = _cell_raw_with_merged(row, 1, merged_values)
        domain_raw = _cell_raw_with_merged(row, 2, merged_values)
        capability_raw = _cell_raw_with_merged(row, 3, merged_values)
        focus_code_raw = _cell_raw_with_merged(row, 4, merged_values)
        focus_title_raw = _cell_raw_with_merged(row, 5, merged_values)
        work_raw = _cell_raw_with_merged(row, 6, merged_values)
        if normalize_text(category_raw):
            last_category = split_code_title(category_raw)
        if normalize_text(domain_raw):
            last_domain = split_code_title(domain_raw)
        if normalize_text(capability_raw):
            last_capability = split_code_title(capability_raw)
        if normalize_text(focus_code_raw):
            last_focus_code = normalize_text(focus_code_raw)
        if normalize_text(focus_title_raw):
            last_focus_title = normalize_text(focus_title_raw)

        work_title = normalize_text(work_raw)
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
            metadata={
                "source_grain": "security_work_master",
            },
            source=_source(sheet_name, row_index, "安全工作", _coord(row[6]), work_raw),
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
    merged_values = _merged_cell_values(ws)
    last_capability: tuple[str | None, str] | None = None
    last_focus_code = ""
    last_focus_title = ""
    last_process_group = ""
    last_stakeholders = {"决策层": [], "管理层": [], "执行层": [], "监督层": []}
    stakeholder_columns = [(8, "决策层"), (9, "管理层"), (10, "执行层"), (11, "监督层")]

    for row_index, row in enumerate(ws.iter_rows(min_row=4), start=4):
        capability_raw = _cell_raw_with_merged(row, 3, merged_values)
        process_group_raw = _cell_raw_with_merged(row, 6, merged_values)
        process_reference_raw = _cell_raw_with_merged(row, 7, merged_values)
        if normalize_text(capability_raw):
            last_capability = split_code_title(capability_raw)
        if _cell_text(row, 4):
            last_focus_code = _cell_text(row, 4)
        if _cell_text(row, 5):
            last_focus_title = _cell_text(row, 5)
        if normalize_text(process_group_raw):
            last_process_group = normalize_text(process_group_raw)

        for column_index, layer in stakeholder_columns:
            raw_stakeholder_value = _cell_raw_with_merged(row, column_index, merged_values)
            values = split_multivalue_text(raw_stakeholder_value, split_on_ideographic_comma=False)
            if values:
                last_stakeholders[layer] = values
            elif is_blank_or_placeholder(raw_stakeholder_value) and normalize_text(raw_stakeholder_value):
                last_stakeholders[layer] = []

        process_refs = split_multivalue_text(process_reference_raw, split_on_ideographic_comma=False)
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


def parse_data_lifecycle_sheet(
    workbook,
    authoritative_service_titles: dict[str, str] | None = None,
    authoritative_module_titles: set[str] | None = None,
) -> ParseResult:
    sheet_name = "LC-DT 数据生命周期"
    ws = workbook[sheet_name]
    result = ParseResult()
    authoritative_module_titles = authoritative_module_titles or set()
    last_order: object = None
    last_process_title = ""
    last_process_description = ""
    for row_index, row in enumerate(ws.iter_rows(min_row=4), start=4):
        if _cell_text(row, 1):
            last_order = _cell_raw(row, 1)
        if _cell_text(row, 2):
            last_process_title = _cell_text(row, 2)
        if _cell_text(row, 3):
            last_process_description = _cell_text(row, 3)
        if not last_process_title:
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
        result.objects.append(process)

        scene_code = normalize_text(_cell_raw(row, 4))
        scene_title = _cell_text(row, 5)
        scene_description = _cell_text(row, 6)
        if scene_code or scene_title:
            if not scene_title:
                result.validations.append(ValidationMessage("error", sheet_name, row_index, f"生命周期场景 {scene_code} 缺少标题"))
            else:
                scene = _object(
                    "lifecycle_scene",
                    scene_title,
                    code=scene_code,
                    description=scene_description,
                    qualifier="data",
                    metadata={"lifecycle_type": "data", "process_title": last_process_title},
                    source=_source(sheet_name, row_index, "处理子场景", _coord(row[5]), _cell_raw(row, 5)),
                )
                result.objects.append(scene)
                result.relations.append(_relation(process.key, "has_scene", scene.key, "包含场景", source=scene.sources[0]))

        for service_raw in _split_lines(_cell_raw(row, 7)):
            raw_parts = service_parts(service_raw)
            _validate_service_reference(result, sheet_name, row_index, service_raw, raw_parts, authoritative_service_titles)
            parts = _canonical_service_parts_by_authority(raw_parts, authoritative_service_titles)
            service_code = parts["code"]
            if not _is_authoritative_service_reference(authoritative_service_titles, parts):
                continue
            service = _object(
                "security_technical_service",
                _service_title(parts, service_raw, authoritative_service_titles),
                code=service_code,
                category=parts["scope_code"],
                metadata={
                    "scope_code": parts["scope_code"],
                    "capability_focus_code": parts["capability_focus_code"],
                    "lifecycle_type": "data",
                },
                source=_source(sheet_name, row_index, "安全技术服务", _coord(row[7]), service_raw),
            )
            result.objects.append(service)
            result.relations.append(_relation(service.key, "maps_to_lifecycle", process.key, "映射到生命周期", source=service.sources[0]))

        for module_raw in _split_lines(_cell_raw(row, 8)):
            module_title = normalize_text(module_raw)
            if module_title == "\\":
                continue
            module_titles = _security_module_titles_from_catalog_alias(module_raw, authoritative_module_titles)
            if not module_titles:
                measure = _object(
                    "security_technical_measure",
                    module_title,
                    metadata={"lifecycle_type": "data"},
                    source=_source(sheet_name, row_index, "安全技术模块", _coord(row[8]), module_raw),
                )
                result.objects.append(measure)
                result.relations.append(_relation(measure.key, "maps_to_lifecycle", process.key, "映射到生命周期", source=measure.sources[0]))
                continue
            for catalog_module_title in module_titles:
                module = _object(
                    "security_technology_module",
                    catalog_module_title,
                    metadata={"lifecycle_type": "data"},
                    source=_source(sheet_name, row_index, "安全技术模块", _coord(row[8]), module_raw),
                )
                result.objects.append(module)
                result.relations.append(_relation(module.key, "maps_to_lifecycle", process.key, "映射到生命周期", source=module.sources[0]))
    return result


def _data_lifecycle_process_lookup(workbook) -> dict[str, tuple[object, str]]:
    sheet_name = "LC-DT 数据生命周期"
    if sheet_name not in workbook.sheetnames:
        return {}
    ws = workbook[sheet_name]
    lookup: dict[str, tuple[object, str]] = {}
    last_order: object = None
    last_title = ""
    for row in ws.iter_rows(min_row=4):
        if _cell_text(row, 1):
            last_order = _cell_raw(row, 1)
        if _cell_text(row, 2):
            last_title = _cell_text(row, 2)
        if last_title:
            lookup.setdefault(last_title, (last_order, last_title))
    return lookup


def parse_data_lifecycle_mapping_sheet(
    workbook,
    authoritative_service_titles: dict[str, str] | None = None,
    authoritative_module_titles: set[str] | None = None,
) -> ParseResult:
    sheet_name = "LC-DT 安全技术服务、模块、策略映射表"
    ws = workbook[sheet_name]
    result = ParseResult()
    authoritative_module_titles = authoritative_module_titles or set()
    process_lookup = _data_lifecycle_process_lookup(workbook)
    last_stage_title = ""
    last_category = ""
    for row_index, row in enumerate(ws.iter_rows(min_row=6), start=6):
        stage_title = _data_lifecycle_stage_title(_cell_raw(row, 1))
        if stage_title:
            last_stage_title = stage_title
        if _cell_text(row, 2):
            last_category = _cell_text(row, 2)
        if not last_stage_title:
            continue
        order, process_title = process_lookup.get(last_stage_title, (None, last_stage_title))
        process = _object(
            "lifecycle_process",
            process_title,
            code=_lifecycle_process_code("DT", order),
            qualifier="data",
            metadata={"lifecycle_type": "data", "order": order},
            source=_source(sheet_name, row_index, "阶段", _coord(row[1]), _cell_raw(row, 1) or process_title),
        )
        result.objects.append(process)

        relation_metadata = {
            "lifecycle_type": "data",
            "strategy_category": last_category,
            "policy_sequence": normalize_text(_cell_raw(row, 3)) or None,
        }
        for service_raw in _split_lines(_cell_raw(row, 12)):
            raw_parts = service_parts(service_raw)
            _validate_service_reference(result, sheet_name, row_index, service_raw, raw_parts, authoritative_service_titles)
            parts = _canonical_service_parts_by_authority(raw_parts, authoritative_service_titles)
            service_code = parts["code"]
            if not _is_authoritative_service_reference(authoritative_service_titles, parts):
                continue
            service = _object(
                "security_technical_service",
                _service_title(parts, service_raw, authoritative_service_titles),
                code=service_code,
                category=parts["scope_code"],
                metadata={
                    "scope_code": parts["scope_code"],
                    "capability_focus_code": parts["capability_focus_code"],
                    "lifecycle_type": "data",
                    "strategy_category": last_category,
                },
                source=_source(sheet_name, row_index, "安全技术服务", _coord(row[12]), service_raw),
            )
            result.objects.append(service)
            result.relations.append(
                _relation(service.key, "maps_to_lifecycle", process.key, "映射到生命周期", source=service.sources[0], metadata=relation_metadata)
            )

        for module_raw in _split_lines(_cell_raw(row, 13)):
            module_title = normalize_text(module_raw)
            if module_title == "\\":
                continue
            module_titles = _security_module_titles_from_catalog_alias(module_raw, authoritative_module_titles)
            if not module_titles:
                measure = _object(
                    "security_technical_measure",
                    module_title,
                    metadata={"lifecycle_type": "data", "strategy_category": last_category},
                    source=_source(sheet_name, row_index, "安全技术模块", _coord(row[13]), module_raw),
                )
                result.objects.append(measure)
                result.relations.append(
                    _relation(measure.key, "maps_to_lifecycle", process.key, "映射到生命周期", source=measure.sources[0], metadata=relation_metadata)
                )
                continue
            for catalog_module_title in module_titles:
                module = _object(
                    "security_technology_module",
                    catalog_module_title,
                    metadata={"lifecycle_type": "data", "strategy_category": last_category},
                    source=_source(sheet_name, row_index, "安全技术模块", _coord(row[13]), module_raw),
                )
                result.objects.append(module)
                result.relations.append(
                    _relation(module.key, "maps_to_lifecycle", process.key, "映射到生命周期", source=module.sources[0], metadata=relation_metadata)
                )
    return result


def parse_data_lifecycle_scene_sheet(workbook) -> ParseResult:
    sheet_name = "LC-DT 数据生命周期场景目录"
    ws = workbook[sheet_name]
    result = ParseResult()
    last_order: object = None
    last_process_title = ""
    last_process_description = ""
    for row_index, row in enumerate(ws.iter_rows(min_row=4), start=4):
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
        selected_development_types = [
            development_type
            for offset, development_type in enumerate(development_types, start=8)
            if _is_lcap_development_type_fill(row[offset])
        ]
        original_business_fields = {
            "阶段（L3流程）": _cell_display_text(row, 1),
            "阶段目标": _cell_display_text(row, 2),
            "阶段主要活动（L4流程活动）": _cell_display_text(row, 3),
            "阶段主要活动参考来源": _cell_display_text(row, 4),
            "安全活动定义": _cell_display_text(row, 5),
            "安全活动对应安全策略": _cell_display_text(row, 6),
            "安全活动参考来源": _cell_display_text(row, 7),
            "软件开发模式": "\n".join(selected_development_types),
            "开发技术服务": _cell_display_text(row, 12),
            "实际产品示例": _cell_display_text(row, 13),
            "潜在安全威胁场景": _cell_display_text(row, 14),
            "补充安全策略": _cell_display_text(row, 15),
            "安全技术服务": _cell_display_text(row, 16),
            "安全技术模块": _cell_display_text(row, 17),
        }
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
                "original_business_fields": original_business_fields,
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
            if development_type not in selected_development_types:
                continue
            dev_type = _object(
                "software_development_type",
                development_type,
                source=_source(sheet_name, row_index, "软件开发模式", _coord(row[offset]), _cell_raw(row, offset)),
            )
            result.objects.append(dev_type)
            result.relations.append(_relation(process.key, "applies_to_development_type", dev_type.key, "适用于开发类型", source=dev_type.sources[0]))

        for development_service_title in _split_lines(_cell_raw(row, 12)):
            development_service = _object(
                "development_technical_service",
                development_service_title,
                category="开发技术服务",
                metadata={"lifecycle_type": "application_security_development", "process_title": process_title},
                source=_source(sheet_name, row_index, "开发技术服务", _coord(row[12]), development_service_title),
            )
            result.objects.append(development_service)
            result.relations.append(
                _relation(
                    process.key,
                    "uses_development_technical_service",
                    development_service.key,
                    "使用开发技术服务",
                    source=development_service.sources[0],
                )
            )

        for development_module_title in _split_lines(_cell_raw(row, 13)):
            development_module = _object(
                "development_technical_module",
                development_module_title,
                category="开发技术模块",
                metadata={"lifecycle_type": "application_security_development", "process_title": process_title},
                source=_source(sheet_name, row_index, "实际产品示例", _coord(row[13]), development_module_title),
            )
            result.objects.append(development_module)
            result.relations.append(
                _relation(
                    process.key,
                    "uses_development_technical_module",
                    development_module.key,
                    "使用开发技术模块",
                    source=development_module.sources[0],
                )
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
                authoritative_service_titles=authoritative_service_titles,
            )

        for module_title in _split_lines(_cell_raw(row, 17)):
            _append_lcap_module_or_measure(
                result,
                sheet_name=sheet_name,
                row_index=row_index,
                cell=row[17],
                raw_value=module_title,
                process=process,
                process_title=process_title,
                module_title=module_title,
                authoritative_module_titles=authoritative_module_titles,
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


STANDARD_FRAMEWORK_SHEETS = [
    "等保三级测评清单",
    "CIS CSC V8.1.2",
    "CSF2.0",
    "27001-2022",
    "DSP策略清单（2026）",
    "CRF Safeguards Core 2026",
    "CRF Maturity Model 2026",
    "NIST 800-53rev5",
]

STANDARD_FRAMEWORK_SHEET_ALIASES = {
    "CIS CSC V8": "CIS CSC V8.1.2",
}


def _framework_object(title: str, *, code: str, standard_family: str, source: SourceRef) -> ObjectCandidate:
    return _object(
        "standard_framework",
        title,
        code=code,
        category=standard_family,
        metadata={
            "standard_family": standard_family,
            "object_key": item_key("standard_framework", code, title),
        },
        source=source,
    )


def _standard_control_key(code: str, title: str) -> str:
    return item_key("standard_control", code, title)


def _parse_requirement_heading(value: object) -> tuple[str | None, str, str]:
    text = normalize_text(value)
    match = re.match(r"^(\d+(?:\.\d+)+)\s*([^\d，。；:：,;]+?)(本项要求包括[:：]?|应|当|$)", text)
    if not match:
        return None, text[:40], text
    control_id = match.group(1)
    title = normalize_text(match.group(2))
    return control_id, title, text


def parse_debao_level3_sheet(workbook) -> ParseResult:
    sheet_name = "等保三级测评清单"
    ws = workbook[sheet_name]
    result = ParseResult()
    framework_code = "GB-T-22239-2019-L3"
    framework_title = "GB/T 22239-2019 网络安全等级保护基本要求 第三级"
    framework_source = _source(sheet_name, 2, "B:E", "B2:E2", "等保三级测评清单")
    framework = _framework_object(
        framework_title,
        code=framework_code,
        standard_family="GB/T 22239-2019",
        source=framework_source,
    )
    result.objects.append(framework)

    for row_idx, row in enumerate(ws.iter_rows(min_row=3), start=3):
        level = normalize_text(row[1].value)
        requirement_group = normalize_text(row[2].value)
        control_group = normalize_text(row[3].value)
        requirement_text = normalize_text(row[4].value)
        related_capability = normalize_text(row[6].value) if len(row) > 6 else ""
        if not requirement_text:
            continue
        control_id, title, description = _parse_requirement_heading(requirement_text)
        if not control_id:
            result.validations.append(ValidationMessage("warning", sheet_name, row_idx, "未能从等保三级控制要求中解析条款编号"))
            continue
        code = f"{framework_code}-{control_id}"
        source = _source(sheet_name, row_idx, "E", _coord(row[4]), requirement_text)
        control = _object(
            "standard_control",
            title,
            code=code,
            description=description,
            category="等保三级",
            metadata={
                "standard_family": "GB/T 22239-2019",
                "framework_code": framework_code,
                "framework_title": framework_title,
                "original_control_id": control_id,
                "level": level,
                "requirement_group": requirement_group,
                "control_group": control_group,
                "related_capability_focus": related_capability,
                "ignored_source_columns": ["F:DSP安全策略项"],
            },
            source=source,
        )
        result.objects.append(control)
        result.relations.append(
            _relation(
                control.key,
                "belongs_to_framework",
                framework.key,
                "属于标准框架",
                source=source,
                metadata={"framework_code": framework_code},
            )
        )
    return result


def parse_cis_csc_v8_sheet(workbook) -> ParseResult:
    sheet_name = "CIS CSC V8.1.2" if "CIS CSC V8.1.2" in workbook.sheetnames else "CIS CSC V8"
    ws = workbook[sheet_name]
    result = ParseResult()
    framework_code = "CIS-CSC-V8.1.2"
    framework_title = "CIS Controls v8.1.2"
    framework_source = _source(sheet_name, 2, "B:J", "B2:J2", sheet_name)
    framework = _framework_object(
        framework_title,
        code=framework_code,
        standard_family="CIS Controls",
        source=framework_source,
    )
    result.objects.append(framework)

    current_control_id = ""
    current_control_name = ""
    current_control_description = ""
    for row_idx, row in enumerate(ws.iter_rows(min_row=3), start=3):
        control_id = normalize_text(row[1].value)
        control_name = normalize_text(row[2].value)
        control_description = normalize_text(row[3].value)
        safeguard_id = normalize_text(row[4].value)
        safeguard_name = normalize_text(row[5].value)
        asset_type = normalize_text(row[6].value)
        implementation_group = normalize_text(row[7].value)
        security_function = normalize_text(row[8].value)
        description = normalize_text(row[9].value)
        related_capability = normalize_text(row[10].value) if len(row) > 10 else ""

        if control_id:
            current_control_id = control_id
        if control_name:
            current_control_name = control_name
        if control_description:
            current_control_description = control_description
        if not safeguard_id or not safeguard_name:
            continue

        code = f"{framework_code}-{safeguard_id}"
        title = f"{safeguard_id} {safeguard_name}"
        source = _source(sheet_name, row_idx, "E:J", f"{_coord(row[4])}:{_coord(row[9])}", safeguard_name)
        control = _object(
            "standard_control",
            title,
            code=code,
            description=description,
            category="CIS Controls",
            metadata={
                "standard_family": "CIS Controls",
                "framework_code": framework_code,
                "framework_title": framework_title,
                "original_control_id": safeguard_id,
                "cis_control_id": current_control_id,
                "cis_control_name": current_control_name,
                "cis_control_description": current_control_description,
                "asset_type": asset_type,
                "implementation_group": implementation_group,
                "security_function": security_function,
                "related_capability_focus": related_capability,
            },
            source=source,
        )
        result.objects.append(control)
        result.relations.append(
            _relation(
                control.key,
                "belongs_to_framework",
                framework.key,
                "属于标准框架",
                source=source,
                metadata={"framework_code": framework_code},
            )
        )
    return result


def _parse_csf_subcategory(value: object) -> tuple[str | None, str]:
    text = normalize_text(value)
    match = re.match(r"^([A-Z]{2}\.[A-Z]{2}-\d{2})[:：]\s*(.+)$", text)
    if not match:
        return None, text
    return match.group(1), normalize_text(match.group(2))


def parse_csf_2_sheet(workbook) -> ParseResult:
    sheet_name = "CSF2.0"
    ws = workbook[sheet_name]
    result = ParseResult()
    framework_code = "NIST-CSF-2.0"
    framework_title = "NIST Cybersecurity Framework 2.0"
    framework_source = _source(sheet_name, 2, "B:F", "B2:F2", "CSF2.0 Core")
    framework = _framework_object(
        framework_title,
        code=framework_code,
        standard_family="NIST CSF",
        source=framework_source,
    )
    result.objects.append(framework)

    current_function = ""
    current_category = ""
    current_category_id = ""
    for row_idx in range(3, 109):
        function = normalize_text(ws.cell(row_idx, 2).value)
        category = normalize_text(ws.cell(row_idx, 3).value)
        category_id = normalize_text(ws.cell(row_idx, 4).value)
        subcategory_text = normalize_text(ws.cell(row_idx, 5).value)
        related_capability = normalize_text(ws.cell(row_idx, 6).value)
        if function:
            current_function = function
        if category:
            current_category = category
        if category_id:
            current_category_id = category_id
        if not subcategory_text:
            continue
        subcategory_id, description = _parse_csf_subcategory(subcategory_text)
        if not subcategory_id:
            result.validations.append(ValidationMessage("warning", sheet_name, row_idx, "未能从 CSF Core 中解析 Subcategory 编号"))
            continue
        code = f"{framework_code}-{subcategory_id}"
        source = _source(sheet_name, row_idx, "E:F", f"E{row_idx}:F{row_idx}", subcategory_text)
        control = _object(
            "standard_control",
            description,
            code=code,
            description=subcategory_text,
            category="NIST CSF Core",
            metadata={
                "standard_family": "NIST CSF",
                "framework_code": framework_code,
                "framework_title": framework_title,
                "standard_section": "core",
                "original_control_id": subcategory_id,
                "function": current_function,
                "category": current_category,
                "category_id": current_category_id,
                "related_capability_focus": related_capability,
                "display_order": row_idx,
            },
            source=source,
        )
        result.objects.append(control)
        result.relations.append(
            _relation(
                control.key,
                "belongs_to_framework",
                framework.key,
                "属于标准框架",
                source=source,
                metadata={"framework_code": framework_code, "standard_section": "core"},
            )
        )

    tier_header = _source(sheet_name, 111, "B:D", "B111:D111", "CSF2.0 Tiers")
    for row_idx in range(112, 116):
        tier = normalize_text(ws.cell(row_idx, 2).value)
        governance = normalize_text(ws.cell(row_idx, 3).value)
        management = normalize_text(ws.cell(row_idx, 4).value)
        if not tier:
            continue
        tier_match = re.match(r"^第?([一二三四])层", tier)
        tier_number_map = {"一": "1", "二": "2", "三": "3", "四": "4"}
        tier_number = tier_number_map.get(tier_match.group(1), "") if tier_match else ""
        original_id = f"Tier {tier_number}" if tier_number else tier
        source = _source(sheet_name, row_idx, "B:D", f"B{row_idx}:D{row_idx}", tier)
        tier_item = _object(
            "standard_tier",
            tier,
            code=f"{framework_code}-{original_id}",
            description="\n".join(value for value in [governance, management] if value),
            category="NIST CSF Tiers",
            metadata={
                "standard_family": "NIST CSF",
                "framework_code": framework_code,
                "framework_title": framework_title,
                "standard_section": "tiers",
                "original_tier_id": original_id,
                "tier": tier,
                "cybersecurity_risk_governance": governance,
                "cybersecurity_risk_management": management,
                "display_order": row_idx,
            },
            source=source,
        )
        tier_item.sources.insert(0, tier_header)
        result.objects.append(tier_item)
        result.relations.append(
            _relation(
                tier_item.key,
                "belongs_to_framework",
                framework.key,
                "属于标准框架",
                source=source,
                metadata={"framework_code": framework_code, "standard_section": "tiers"},
            )
        )
    return result


def parse_iso_27001_2022_sheet(workbook) -> ParseResult:
    sheet_name = "27001-2022"
    ws = workbook[sheet_name]
    result = ParseResult()
    framework_code = "ISO-IEC-27001-2022"
    framework_title = "ISO/IEC 27001:2022"
    framework_source = _source(sheet_name, 2, "B:J", "B2:J3", "27001-2022")
    framework = _framework_object(
        framework_title,
        code=framework_code,
        standard_family="ISO/IEC 27001",
        source=framework_source,
    )
    result.objects.append(framework)

    current_control_category = ""
    for row_idx, row in enumerate(ws.iter_rows(min_row=4), start=4):
        control_category = normalize_text(row[1].value)
        control_id = normalize_text(row[2].value)
        control_name = normalize_text(row[3].value)
        control_description = normalize_text(row[4].value)
        control_type = normalize_text(row[5].value)
        security_properties = normalize_text(row[6].value)
        cybersecurity_concepts = normalize_text(row[7].value)
        operational_capabilities = normalize_text(row[8].value)
        security_domains = normalize_text(row[9].value)
        related_capability = normalize_text(row[10].value) if len(row) > 10 else ""
        if control_category:
            current_control_category = control_category
        if not control_id or not control_name:
            continue

        code = f"{framework_code}-{control_id}"
        title = f"{control_id} {control_name}"
        source = _source(sheet_name, row_idx, "C:J", f"{_coord(row[2])}:{_coord(row[9])}", control_name)
        control = _object(
            "standard_control",
            title,
            code=code,
            description=control_description,
            category="ISO/IEC 27001:2022",
            metadata={
                "standard_family": "ISO/IEC 27001",
                "framework_code": framework_code,
                "framework_title": framework_title,
                "original_control_id": control_id,
                "control_category": current_control_category,
                "control_name": control_name,
                "control_type": control_type,
                "information_security_properties": security_properties,
                "cybersecurity_concepts": cybersecurity_concepts,
                "operational_capabilities": operational_capabilities,
                "security_domains": security_domains,
                "related_capability_focus": related_capability,
            },
            source=source,
        )
        result.objects.append(control)
        result.relations.append(
            _relation(
                control.key,
                "belongs_to_framework",
                framework.key,
                "属于标准框架",
                source=source,
                metadata={"framework_code": framework_code},
            )
        )
    return result


def _parse_crf_level_number(value: str) -> str:
    match = re.search(r"Level\s*(\d+)", value or "", flags=re.IGNORECASE)
    return match.group(1) if match else ""


def parse_crf_safeguards_core_2026_sheet(workbook) -> ParseResult:
    sheet_name = "CRF Safeguards Core 2026"
    ws = workbook[sheet_name]
    result = ParseResult()
    framework_code = "CRF-SAFEGUARDS-CORE-2026"
    framework_title = "CRF Safeguards Core Edition v2026"
    framework_source = _source(sheet_name, 1, "A:G", "A1:G1", framework_title)
    framework = _framework_object(
        framework_title,
        code=framework_code,
        standard_family="CRF",
        source=framework_source,
    )
    result.objects.append(framework)

    for row_idx, row in enumerate(ws.iter_rows(min_row=2), start=2):
        safeguard_category = normalize_text(row[0].value)
        safeguard_domain = normalize_text(row[1].value)
        maturity_level = normalize_text(row[2].value)
        safeguard_id = normalize_text(row[3].value)
        description = normalize_text(row[4].value)
        safeguard_system = normalize_text(row[5].value)
        related_capability = normalize_text(row[6].value)
        if not safeguard_id or not description:
            continue

        code = f"{framework_code}-{safeguard_id}"
        source = _source(sheet_name, row_idx, "A:G", f"A{row_idx}:G{row_idx}", safeguard_id)
        control = _object(
            "standard_control",
            f"{safeguard_id} {description[:40]}",
            code=code,
            description=description,
            category="CRF Safeguards Core 2026",
            metadata={
                "standard_family": "CRF",
                "framework_code": framework_code,
                "framework_title": framework_title,
                "standard_section": "safeguards_core",
                "source_edition": "v2026",
                "original_control_id": safeguard_id,
                "safeguard_id": safeguard_id,
                "safeguard_category": safeguard_category,
                "safeguard_domain": safeguard_domain,
                "maturity_level": maturity_level,
                "maturity_level_number": _parse_crf_level_number(maturity_level),
                "safeguard_system": safeguard_system,
                "related_capability_focus": related_capability,
                "display_order": row_idx,
            },
            source=source,
        )
        result.objects.append(control)
        result.relations.append(
            _relation(
                control.key,
                "belongs_to_framework",
                framework.key,
                "属于标准框架",
                source=source,
                metadata={"framework_code": framework_code, "standard_section": "safeguards_core"},
            )
        )
    return result


def parse_crf_maturity_model_2026_sheet(workbook) -> ParseResult:
    sheet_name = "CRF Maturity Model 2026"
    ws = workbook[sheet_name]
    result = ParseResult()
    framework_code = "CRF-MATURITY-MODEL-2026"
    framework_title = "CRF Maturity Model v2026"
    framework_source = _source(sheet_name, 1, "A:F", "A1:F1", framework_title)
    framework = _framework_object(
        framework_title,
        code=framework_code,
        standard_family="CRF",
        source=framework_source,
    )
    result.objects.append(framework)

    for row_idx, row in enumerate(ws.iter_rows(min_row=2), start=2):
        level_id = normalize_text(row[0].value)
        level_name = normalize_text(row[1].value)
        english_level = normalize_text(row[2].value)
        definition = normalize_text(row[3].value)
        characteristics = normalize_text(row[4].value)
        boundary = normalize_text(row[5].value)
        if not level_id or not level_name:
            continue

        code = f"{framework_code}-{level_id.replace(' ', '-')}"
        source = _source(sheet_name, row_idx, "A:F", f"A{row_idx}:F{row_idx}", level_id)
        tier_item = _object(
            "standard_tier",
            f"{level_id} {level_name}",
            code=code,
            description=definition,
            category="CRF Maturity Model 2026",
            metadata={
                "standard_family": "CRF",
                "framework_code": framework_code,
                "framework_title": framework_title,
                "standard_section": "maturity_model",
                "source_edition": "v2026",
                "original_tier_id": level_id,
                "level_id": level_id,
                "level_name": level_name,
                "english_level": english_level,
                "definition": definition,
                "characteristics": characteristics,
                "boundary": boundary,
                "display_order": row_idx,
            },
            source=source,
        )
        result.objects.append(tier_item)
        result.relations.append(
            _relation(
                tier_item.key,
                "belongs_to_framework",
                framework.key,
                "属于标准框架",
                source=source,
                metadata={"framework_code": framework_code, "standard_section": "maturity_model"},
            )
        )
    return result


def parse_dsp_scf_2026_sheet(workbook) -> ParseResult:
    sheet_name = "DSP策略清单（2026）"
    ws = workbook[sheet_name]
    result = ParseResult()
    framework_code = "DSP-SCF-2026"
    framework_title = "DSP Secure Controls Framework (SCF) - 2026"
    framework_source = _source(sheet_name, 2, "B:O", "B2:O2", framework_title)
    framework = _framework_object(
        framework_title,
        code=framework_code,
        standard_family="Secure Controls Framework",
        source=framework_source,
    )
    result.objects.append(framework)

    current_domain = ""
    current_principle = ""
    current_intent = ""
    maturity_columns = [
        (10, "scr_cmm_level_0", "SCR-CMM 0级 未执行"),
        (11, "scr_cmm_level_1", "SCR-CMM 1级 非正式执行"),
        (12, "scr_cmm_level_2", "SCR-CMM 2级 已计划并跟踪"),
        (13, "scr_cmm_level_3", "SCR-CMM 3级 定义良好"),
        (14, "scr_cmm_level_4", "SCR-CMM 4级 量化控制"),
        (15, "scr_cmm_level_5", "SCR-CMM 5级 持续改进"),
    ]
    for row_idx, row in enumerate(ws.iter_rows(min_row=3, max_col=15), start=3):
        domain = normalize_text(row[1].value)
        principle = normalize_text(row[2].value)
        intent = normalize_text(row[3].value)
        control_id = normalize_text(row[4].value)
        control_name = normalize_text(row[5].value)
        control_description = normalize_text(row[6].value)
        security_policy_item = normalize_text(row[7].value)
        csf_function_grouping = normalize_text(row[8].value)
        if domain:
            current_domain = domain
        if principle:
            current_principle = principle
        if intent:
            current_intent = intent
        if not control_id or not control_name:
            continue

        metadata = {
            "standard_family": "Secure Controls Framework",
            "framework_code": framework_code,
            "framework_title": framework_title,
            "standard_section": "scf_controls",
            "source_edition": "2026",
            "original_control_id": control_id,
            "scf_domain": current_domain,
            "policy_principle": current_principle,
            "policy_intent": current_intent,
            "control_name": control_name,
            "security_policy_item": security_policy_item,
            "nist_csf_function_grouping": csf_function_grouping,
            "related_capability_focus": "",
            "display_order": row_idx,
        }
        for col_idx, key, _label in maturity_columns:
            metadata[key] = normalize_text(row[col_idx - 1].value)

        code = f"{framework_code}-{control_id}"
        source = _source(sheet_name, row_idx, "B:O", f"B{row_idx}:O{row_idx}", control_id)
        control = _object(
            "standard_control",
            f"{control_id} {control_name}",
            code=code,
            description=control_description,
            category="DSP Secure Controls Framework (SCF) - 2026",
            metadata=metadata,
            source=source,
        )
        result.objects.append(control)
        result.relations.append(
            _relation(
                control.key,
                "belongs_to_framework",
                framework.key,
                "属于标准框架",
                source=source,
                metadata={"framework_code": framework_code, "standard_section": "scf_controls"},
            )
        )
    return result


def _parse_nist_800_53_family(value: object) -> tuple[str, str]:
    lines = [normalize_text(part) for part in str(value or "").splitlines()]
    lines = [line for line in lines if line]
    if len(lines) >= 2:
        return lines[0], lines[1]
    text = normalize_text(value)
    match = re.match(r"^([A-Z]{2})\s+(.+)$", text)
    if match:
        return match.group(1), normalize_text(match.group(2))
    return text[:2], text


def _nist_base_control_id(control_id: str) -> str:
    return re.sub(r"\(\d+\)$", "", control_id or "")


def parse_nist_800_53_rev5_sheet(workbook) -> ParseResult:
    sheet_name = "NIST 800-53rev5"
    ws = workbook[sheet_name]
    result = ParseResult()
    framework_code = "NIST-800-53-REV5"
    framework_title = "NIST SP 800-53 Rev.5"
    framework_source = _source(sheet_name, 4, "B:H", "B4:H4", framework_title)
    framework = _framework_object(
        framework_title,
        code=framework_code,
        standard_family="NIST SP 800-53",
        source=framework_source,
    )
    result.objects.append(framework)

    current_family_code = ""
    current_family_name = ""
    base_control_names: dict[str, str] = {}
    for row_idx, row in enumerate(ws.iter_rows(min_row=5), start=5):
        family_value = normalize_text(row[1].value)
        control_id = normalize_text(row[2].value)
        english_name = normalize_text(row[3].value)
        baseline_level = normalize_text(row[4].value)
        security_type = normalize_text(row[5].value)
        chinese_name = normalize_text(row[6].value)
        description = normalize_text(row[7].value)
        related_capability = normalize_text(row[8].value) if len(row) > 8 else ""
        if family_value:
            current_family_code, current_family_name = _parse_nist_800_53_family(row[1].value)
        if not control_id or not english_name:
            continue

        base_control_id = _nist_base_control_id(control_id)
        if control_id == base_control_id:
            base_control_names[base_control_id] = chinese_name or english_name
        base_control_name = base_control_names.get(base_control_id, "")
        if not base_control_name:
            base_control_name = chinese_name or english_name

        code = f"{framework_code}-{control_id}"
        source = _source(sheet_name, row_idx, "C:H", f"{_coord(row[2])}:{_coord(row[7])}", control_id)
        control = _object(
            "standard_control",
            f"{control_id} {english_name}",
            code=code,
            description=description,
            category="NIST SP 800-53 Rev.5",
            metadata={
                "standard_family": "NIST SP 800-53",
                "framework_code": framework_code,
                "framework_title": framework_title,
                "original_control_id": control_id,
                "control_family_code": current_family_code,
                "control_family_name": current_family_name,
                "control_family": f"{current_family_code} {current_family_name}".strip(),
                "base_control_id": base_control_id,
                "base_control_name": base_control_name,
                "english_name": english_name,
                "baseline_level": baseline_level,
                "security_type": security_type,
                "chinese_name": chinese_name,
                "related_capability_focus": related_capability,
                "display_order": row_idx,
            },
            source=source,
        )
        result.objects.append(control)
        result.relations.append(
            _relation(
                control.key,
                "belongs_to_framework",
                framework.key,
                "属于标准框架",
                source=source,
                metadata={"framework_code": framework_code},
            )
        )
    return result


def parse_standard_framework_sheets(path: str | Path, sheets: list[str] | None = None) -> ParseResult:
    selected = sheets or STANDARD_FRAMEWORK_SHEETS
    workbook = _load_workbook(path)
    try:
        result = ParseResult()
        parsers = {
            "等保三级测评清单": parse_debao_level3_sheet,
            "CIS CSC V8.1.2": parse_cis_csc_v8_sheet,
            "CIS CSC V8": parse_cis_csc_v8_sheet,
            "CSF2.0": parse_csf_2_sheet,
            "27001-2022": parse_iso_27001_2022_sheet,
            "DSP策略清单（2026）": parse_dsp_scf_2026_sheet,
            "CRF Safeguards Core 2026": parse_crf_safeguards_core_2026_sheet,
            "CRF Maturity Model 2026": parse_crf_maturity_model_2026_sheet,
            "NIST 800-53rev5": parse_nist_800_53_rev5_sheet,
        }
        for sheet_name in selected:
            canonical_sheet_name = STANDARD_FRAMEWORK_SHEET_ALIASES.get(sheet_name, sheet_name)
            actual_sheet_name = canonical_sheet_name if canonical_sheet_name in workbook.sheetnames else sheet_name
            if actual_sheet_name not in workbook.sheetnames:
                result.validations.append(ValidationMessage("error", sheet_name, None, "缺少标准框架 Sheet"))
                continue
            parser = parsers.get(canonical_sheet_name) or parsers.get(sheet_name)
            if parser is None:
                result.validations.append(ValidationMessage("error", sheet_name, None, "缺少标准框架 Sheet 解析器"))
                continue
            result.extend(parser(workbook))
        return result
    finally:
        workbook.close()


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
            "LC-DT 数据生命周期": lambda wb: parse_data_lifecycle_sheet(wb, authoritative_service_titles, authoritative_module_titles),
            "LC-DT 数据生命周期场景目录": parse_data_lifecycle_scene_sheet,
            "LC-DT 安全技术服务、模块、策略映射表": lambda wb: parse_data_lifecycle_mapping_sheet(wb, authoritative_service_titles, authoritative_module_titles),
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
        "安全能力-安全技术服务",
        "安全技术模块清单",
        "作用域-安全技术服务-安全技术模块映射",
    ]
    parsers = {
        "安全能力目录": parse_capability_sheet,
        "安全能力作用域目录": parse_scope_sheet,
        "安全能力-安全技术服务": parse_service_sheet,
        "安全技术模块清单": None,
        "作用域-安全技术服务-安全技术模块映射": None,
    }
    workbook = _load_workbook(path)
    try:
        result = ParseResult()
        authoritative_service_titles = _build_authoritative_service_titles(workbook)
        authoritative_module_titles = _build_authoritative_module_titles(workbook)
        authoritative_scope_titles = _build_authoritative_scope_titles(workbook)
        parsers["安全技术模块清单"] = lambda wb: parse_module_sheet(wb, authoritative_service_titles)
        parsers["作用域-安全技术服务-安全技术模块映射"] = lambda wb: parse_scene_sheet(wb, authoritative_service_titles, authoritative_module_titles, authoritative_scope_titles)
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
