from __future__ import annotations

import argparse
import json
import shutil
import sys

from .db import connect, run_migrations
from .exports import (
    export_capability_workbench,
    export_capability_tree,
    export_content_views,
    export_environment_workbench,
    export_frontend_workbenches,
    export_import_summary,
    export_items,
    export_lifecycle_workbench,
    export_lifecycle_knowledge,
    export_maintenance_knowledge,
    export_relations,
    export_second_batch_summary,
    export_shared_lookups,
    export_standard_frameworks_data,
    latest_approved_import_job_id,
    write_import_result_report,
    write_warning_review,
)
from .excel_reader import inspect_workbook, workbook_summary_to_dict
from .loader import approve_import
from .candidates import ParseResult, ValidationMessage
from .parsers import (
    SECOND_BATCH_SHEETS,
    STANDARD_FRAMEWORK_SHEETS,
    THIRD_BATCH_SHEETS,
    parse_core_sheets,
    parse_second_batch_sheets,
    parse_standard_framework_sheets,
    parse_third_batch_sheets,
)
from .paths import DEFAULT_DB_PATH, PROJECT_ROOT, display_path, resolve_project_path
from .queries import item_counts_by_type, latest_import_jobs, list_items, relation_counts_by_type, table_counts
from .api_server import serve
from .source_files import (
    create_import_job,
    register_source_file,
    update_import_job_summary,
)
from .staging import write_staging


CORE_SHEETS = [
    "安全能力目录",
    "安全能力作用域目录",
    "信息化环境-信息化对象-安全作用域映射",
    "安全能力-安全技术服务",
    "安全技术模块清单",
    "作用域-安全技术服务-安全技术模块映射",
]

SHEET_ALIASES = {
    "all": CORE_SHEETS,
    "core": CORE_SHEETS,
    "capability": ["安全能力目录"],
    "second-batch": SECOND_BATCH_SHEETS,
    "third-batch": THIRD_BATCH_SHEETS,
    "standard-framework": STANDARD_FRAMEWORK_SHEETS,
}

BOOTSTRAP_IMPORT_PROFILES = {
    "core": ["core"],
    "full": ["core", "second-batch", "third-batch", "standard-framework"],
}

BOOTSTRAP_DEFAULT_WORKBOOK = PROJECT_ROOT / "data" / "raw-samples" / "wiki sample.xlsx"
FRONTEND_DATA_DIR = PROJECT_ROOT / "frontend" / "capability-browser" / "public" / "data"
BOOTSTRAP_OPTIONAL_INPUTS = [
    "data/raw-samples/wiki sample ppt.pptx",
    "data/raw-samples/drawio sample.drawio",
    "data/raw-samples/ds design/T00-面向业务的数据安全专项设计方法（V2.1）.pdf",
    "data/raw-samples/ds design/安全技术架构设计方法 V2.0.pdf",
]


def cmd_init_db(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    results = run_migrations(db_path)
    print(f"database: {display_path(db_path)}")
    for result in results:
        status = "applied" if result.applied else "skipped"
        print(f"{status}: {display_path(result.path)}")
    return 0


def cmd_inspect_excel(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)

    excel_path = resolve_project_path(args.excel_path)
    summary = inspect_workbook(excel_path)
    summary_dict = workbook_summary_to_dict(summary)

    with connect(db_path) as conn:
        source_file = register_source_file(
            conn,
            excel_path,
            usage_policy="import_source",
            sensitive_level=args.sensitive_level,
        )
        import_job_id = create_import_job(
            conn,
            source_file.id,
            job_type="initial_import",
            status="parsed",
        )
        payload = {
            "source_file": {
                "id": source_file.id,
                "file_name": source_file.file_name,
                "file_type": source_file.file_type,
                "file_path": source_file.file_path,
                "file_hash": source_file.file_hash,
                "file_size": source_file.file_size,
                "created": source_file.created,
            },
            "import_job_id": import_job_id,
            "workbook": summary_dict,
            "note": "Phase 4 stage 1 only inspects the workbook; business rows are not imported yet.",
        }
        update_import_job_summary(
            conn,
            import_job_id,
            status="parsed",
            summary_json=json.dumps(payload, ensure_ascii=False),
        )

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"database: {display_path(db_path)}")
        print(f"source_file_id: {source_file.id}")
        print(f"source_file_created: {source_file.created}")
        print(f"import_job_id: {import_job_id}")
        print(f"excel: {display_path(excel_path)}")
        print(f"sheet_count: {summary.sheet_count}")
        if summary.missing_core_sheets:
            print("missing_core_sheets:")
            for sheet in summary.missing_core_sheets:
                print(f"  - {sheet}")
        else:
            print("missing_core_sheets: none")
        print("core_sheets:")
        for sheet in summary.core_sheets:
            if not sheet.present:
                print(f"  - {sheet.name}: missing")
            else:
                header = " | ".join(sheet.header_preview or [])
                print(f"  - {sheet.name}: rows={sheet.rows}, columns={sheet.columns}, header={header}")
    return 0


def _selected_sheets(value: str) -> list[str]:
    if value in SHEET_ALIASES:
        return SHEET_ALIASES[value]
    return [part.strip() for part in value.split(",") if part.strip()]


def _parse_selected_excel(excel_path, selected_sheets: list[str]) -> ParseResult:
    result = ParseResult()
    core_selection = [sheet for sheet in selected_sheets if sheet in CORE_SHEETS]
    second_batch_selection = [sheet for sheet in selected_sheets if sheet in SECOND_BATCH_SHEETS]
    third_batch_selection = [sheet for sheet in selected_sheets if sheet in THIRD_BATCH_SHEETS]
    standard_framework_selection = [sheet for sheet in selected_sheets if sheet in STANDARD_FRAMEWORK_SHEETS]
    unknown_selection = [
        sheet for sheet in selected_sheets
        if (
            sheet not in CORE_SHEETS
            and sheet not in SECOND_BATCH_SHEETS
            and sheet not in THIRD_BATCH_SHEETS
            and sheet not in STANDARD_FRAMEWORK_SHEETS
        )
    ]
    if core_selection:
        result.extend(parse_core_sheets(excel_path, core_selection))
    if second_batch_selection:
        result.extend(parse_second_batch_sheets(excel_path, second_batch_selection))
    if third_batch_selection:
        result.extend(parse_third_batch_sheets(excel_path, third_batch_selection))
    if standard_framework_selection:
        result.extend(parse_standard_framework_sheets(excel_path, standard_framework_selection))
    for sheet_name in unknown_selection:
        result.validations.append(
            ValidationMessage("error", sheet_name, None, "暂未实现该 Sheet 的解析器")
        )
    return result


def cmd_stage_excel(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)

    excel_path = resolve_project_path(args.excel_path)
    selected_sheets = _selected_sheets(args.sheets)
    parse_result = _parse_selected_excel(excel_path, selected_sheets)

    with connect(db_path) as conn:
        source_file = register_source_file(
            conn,
            excel_path,
            usage_policy="import_source",
            sensitive_level=args.sensitive_level,
        )
        import_job_id = create_import_job(
            conn,
            source_file.id,
            job_type="initial_import",
            status="reviewing",
        )
        stage_summary = write_staging(conn, import_job_id, parse_result)
        payload = {
            "source_file": {
                "id": source_file.id,
                "file_name": source_file.file_name,
                "file_path": source_file.file_path,
                "file_hash": source_file.file_hash,
                "created": source_file.created,
            },
            "selected_sheets": selected_sheets,
            "stage_summary": stage_summary.to_dict(),
        }
        update_import_job_summary(
            conn,
            import_job_id,
            status="reviewing",
            summary_json=json.dumps(payload, ensure_ascii=False),
        )

    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print(f"database: {display_path(db_path)}")
        print(f"source_file_id: {source_file.id}")
        print(f"import_job_id: {import_job_id}")
        print(f"selected_sheets: {', '.join(selected_sheets)}")
        print(f"objects_total: {stage_summary.objects_total}")
        print(f"objects_staged: {stage_summary.objects_staged}")
        print(f"relations_total: {stage_summary.relations_total}")
        print(f"relations_staged: {stage_summary.relations_staged}")
        print("object_counts:")
        for key, value in stage_summary.object_counts.items():
            print(f"  - {key}: {value}")
        print("relation_counts:")
        for key, value in stage_summary.relation_counts.items():
            print(f"  - {key}: {value}")
        if stage_summary.validations:
            print("validations:")
            for validation in stage_summary.validations[:20]:
                print(f"  - [{validation['level']}] {validation['sheet']}:{validation['row']} {validation['message']}")
        else:
            print("validations: none")
    return 0


def cmd_approve_import(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        summary = approve_import(conn, args.import_job_id)
    if args.json:
        print(json.dumps(summary.to_dict(), ensure_ascii=False, indent=2))
    else:
        print(f"import_job_id: {summary.import_job_id}")
        print(f"items_created: {summary.items_created}")
        print(f"items_updated: {summary.items_updated}")
        print(f"items_deprecated: {summary.items_deprecated}")
        print(f"relations_created: {summary.relations_created}")
        print(f"relations_deleted: {summary.relations_deleted}")
        print(f"source_references_created: {summary.source_references_created}")
        if summary.warnings:
            print("warnings:")
            for warning in summary.warnings[:30]:
                print(f"  - {warning}")
        else:
            print("warnings: none")
    return 0


def cmd_summary(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        payload = {
            "tables": table_counts(conn),
            "items_by_type": item_counts_by_type(conn),
            "relations_by_type": relation_counts_by_type(conn),
        }
    if args.json:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    else:
        print("tables:")
        for key, value in payload["tables"].items():
            print(f"  - {key}: {value}")
        print("items_by_type:")
        for key, value in payload["items_by_type"].items():
            print(f"  - {key}: {value}")
        print("relations_by_type:")
        for key, value in payload["relations_by_type"].items():
            print(f"  - {key}: {value}")
    return 0


def cmd_list_items(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        rows = list_items(conn, args.type, args.limit)
    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        for row in rows:
            code = row["code"] or ""
            print(f"{row['type']}\t{code}\t{row['title']}\t{row['status']}")
    return 0


def cmd_imports(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        rows = latest_import_jobs(conn, args.limit)
    if args.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        for row in rows:
            print(f"{row['id']}\t{row['status']}\t{row['job_type']}\t{row['file_name']}\t{row['started_at']}")
    return 0


def _print_bootstrap_inputs(workbook_path) -> None:
    print("需要先放入的本地文件：")
    print(f"  必需: {display_path(workbook_path)}")
    print("  可选:")
    for item in BOOTSTRAP_OPTIONAL_INPUTS:
        print(f"    - {item}")
    print("\n这些文件只放在本机，受 .gitignore 保护，不提交 GitHub。")


def _ensure_bootstrap_dirs(db_path) -> None:
    for path in [
        PROJECT_ROOT / "data" / "raw-samples",
        db_path.parent,
        PROJECT_ROOT / "data" / "exports",
        FRONTEND_DATA_DIR,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def _reset_bootstrap_database(db_path) -> None:
    if not db_path.exists():
        return
    backup = db_path.with_suffix(".sqlite3.before-bootstrap.bak")
    if backup.exists():
        backup.unlink()
    shutil.move(db_path, backup)
    print(f"已备份旧数据库: {display_path(backup)}")


def _stage_and_approve_bootstrap_sheet_set(
    *,
    db_path,
    workbook_path,
    sheet_set: str,
    sensitive_level: str,
    allow_validation_errors: bool,
) -> str | None:
    selected_sheets = _selected_sheets(sheet_set)
    parse_result = _parse_selected_excel(workbook_path, selected_sheets)

    with connect(db_path) as conn:
        source_file = register_source_file(
            conn,
            workbook_path,
            usage_policy="import_source",
            sensitive_level=sensitive_level,
        )
        import_job_id = create_import_job(
            conn,
            source_file.id,
            job_type="initial_import",
            status="reviewing",
        )
        stage_summary = write_staging(conn, import_job_id, parse_result)
        payload = {
            "source_file": {
                "id": source_file.id,
                "file_name": source_file.file_name,
                "file_path": source_file.file_path,
                "file_hash": source_file.file_hash,
                "created": source_file.created,
            },
            "selected_sheets": selected_sheets,
            "stage_summary": stage_summary.to_dict(),
        }
        update_import_job_summary(
            conn,
            import_job_id,
            status="reviewing",
            summary_json=json.dumps(payload, ensure_ascii=False),
        )
        blocking = [
            item
            for item in payload["stage_summary"].get("validations", [])
            if item.get("level") in {"error", "blocking"}
        ]
        print(
            f"导入暂存: sheets={sheet_set}, import_job_id={import_job_id}, "
            f"validations={len(stage_summary.validations)}, blocking={len(blocking)}"
        )
        if blocking and not allow_validation_errors:
            for item in blocking[:10]:
                print(f"  - [{item.get('level')}] {item.get('sheet')}:{item.get('row')} {item.get('message')}")
            print("存在阻断级校验问题，已停止审批入库。可修正源文件后重跑。")
            return None

        approve_summary = approve_import(conn, import_job_id)
        print(
            "审批入库: "
            f"items_created={approve_summary.items_created}, "
            f"items_updated={approve_summary.items_updated}, "
            f"relations_created={approve_summary.relations_created}"
        )
    return import_job_id


def _export_bootstrap_outputs(db_path, latest_import_job_id: str | None) -> None:
    with connect(db_path) as conn:
        export_steps = [
            export_frontend_workbenches(conn, output_dir=str(FRONTEND_DATA_DIR)),
            export_maintenance_knowledge(conn, output_path="frontend/capability-browser/public/data/maintenance-knowledge.json"),
            export_shared_lookups(conn, output_path="frontend/capability-browser/public/data/shared-lookups.json"),
            export_lifecycle_knowledge(conn, output_path="frontend/capability-browser/public/data/lifecycle-knowledge.json"),
            export_standard_frameworks_data(conn, output_path="frontend/capability-browser/public/data/standards-index.json"),
            export_content_views(conn, output_path="frontend/capability-browser/public/data/content-views.json"),
            export_capability_tree(conn, output_path="frontend/capability-browser/public/data/capability-tree.json"),
            export_items(conn, fmt="all"),
            export_relations(conn, fmt="all"),
        ]
        if latest_import_job_id:
            export_steps.extend(
                [
                    write_import_result_report(conn, latest_import_job_id, sample_limit=20),
                    write_warning_review(conn, latest_import_job_id),
                    export_import_summary(conn, latest_import_job_id),
                ]
            )
    print("已生成本地数据库摘要、前端离线数据包和基础导出报告。")
    for result in export_steps:
        for file in result.get("files", []):
            print(f"  - {display_path(file)}")


def cmd_bootstrap_local_data(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    workbook_path = resolve_project_path(args.workbook)

    if args.print_inputs:
        _print_bootstrap_inputs(workbook_path)
        return 0

    _ensure_bootstrap_dirs(db_path)
    if not workbook_path.exists():
        _print_bootstrap_inputs(workbook_path)
        print(f"error: missing required workbook: {display_path(workbook_path)}", file=sys.stderr)
        return 1
    if db_path.exists() and not args.reset and not args.append:
        print(f"数据库已存在: {display_path(db_path)}")
        print("如果要重新初始化，请执行: python scripts/sapd_wiki.py bootstrap-local-data --reset")
        print("如果确认要追加导入，请执行: python scripts/sapd_wiki.py bootstrap-local-data --append")
        return 2
    if args.reset:
        _reset_bootstrap_database(db_path)

    run_migrations(db_path)
    imported_jobs: list[str] = []
    for sheet_set in BOOTSTRAP_IMPORT_PROFILES[args.profile]:
        import_job_id = _stage_and_approve_bootstrap_sheet_set(
            db_path=db_path,
            workbook_path=workbook_path,
            sheet_set=sheet_set,
            sensitive_level=args.sensitive_level,
            allow_validation_errors=args.allow_validation_errors,
        )
        if import_job_id is None:
            return 1
        imported_jobs.append(import_job_id)

    if not args.skip_frontend_export:
        _export_bootstrap_outputs(db_path, imported_jobs[-1] if imported_jobs else None)

    with connect(db_path) as conn:
        payload = {
            "tables": table_counts(conn),
            "items_by_type": item_counts_by_type(conn),
            "relations_by_type": relation_counts_by_type(conn),
        }
    print("\n本地初始化完成。")
    print(f"数据库: {display_path(db_path)}")
    print(f"前端数据包目录: {display_path(FRONTEND_DATA_DIR)}")
    print(f"导入任务: {', '.join(imported_jobs)}")
    print("tables:")
    for key, value in payload["tables"].items():
        print(f"  - {key}: {value}")
    print("上述数据库和生成数据包均为本地文件，不提交 GitHub。")
    return 0


def _target_import_job_id(conn, value: str | None) -> str:
    return value or latest_approved_import_job_id(conn)


def _print_export_result(result: dict) -> None:
    if "count" in result:
        print(f"count: {result['count']}")
    if "validation_count" in result:
        print(f"validation_count: {result['validation_count']}")
    print("files:")
    for file in result.get("files", []):
        print(f"  - {display_path(file)}")


def cmd_export_items(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_items(conn, output_dir=args.output_dir, item_type=args.type, fmt=args.format)
    _print_export_result(result)
    return 0


def cmd_export_relations(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_relations(
            conn,
            output_dir=args.output_dir,
            relation_type=args.type,
            fmt=args.format,
            include_deprecated=args.include_deprecated,
        )
    _print_export_result(result)
    return 0


def cmd_export_import_summary(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        import_job_id = _target_import_job_id(conn, args.import_job_id)
        result = export_import_summary(conn, import_job_id, output_dir=args.output_dir)
    print(f"import_job_id: {import_job_id}")
    _print_export_result(result)
    return 0


def cmd_export_report(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        import_job_id = _target_import_job_id(conn, args.import_job_id)
        report = write_import_result_report(
            conn,
            import_job_id,
            output_dir=args.output_dir,
            sample_limit=args.sample_limit,
        )
        warnings = write_warning_review(conn, import_job_id, output_dir=args.output_dir)
        summary = export_import_summary(conn, import_job_id, output_dir=args.output_dir)
    print(f"import_job_id: {import_job_id}")
    for result in [report, warnings, summary]:
        _print_export_result(result)
    return 0


def cmd_export_capability_tree(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_capability_tree(conn, output_path=args.output)
    _print_export_result(result)
    print("stats:")
    for key, value in result.get("stats", {}).items():
        print(f"  - {key}: {value}")
    return 0


def cmd_export_maintenance_knowledge(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_maintenance_knowledge(conn, output_path=args.output)
    _print_export_result(result)
    print("stats:")
    for key, value in result.get("stats", {}).items():
        print(f"  - {key}: {value}")
    return 0


def cmd_export_shared_lookups(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_shared_lookups(conn, output_path=args.output)
    _print_export_result(result)
    print("stats:")
    for key, value in result.get("stats", {}).items():
        print(f"  - {key}: {value}")
    return 0


def cmd_export_lifecycle_knowledge(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_lifecycle_knowledge(conn, output_path=args.output)
    _print_export_result(result)
    print("stats:")
    for key, value in result.get("stats", {}).items():
        print(f"  - {key}: {value}")
    return 0


def cmd_export_content_views(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_content_views(conn, output_path=args.output)
    _print_export_result(result)
    print("stats:")
    for key, value in result.get("stats", {}).items():
        print(f"  - {key}: {value}")
    return 0


def cmd_export_capability_workbench(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_capability_workbench(conn, output_path=args.output)
    _print_export_result(result)
    print("stats:")
    for key, value in result.get("stats", {}).items():
        print(f"  - {key}: {value}")
    return 0


def cmd_export_environment_workbench(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_environment_workbench(conn, output_path=args.output)
    _print_export_result(result)
    print("stats:")
    for key, value in result.get("stats", {}).items():
        print(f"  - {key}: {value}")
    return 0


def cmd_export_lifecycle_workbench(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_lifecycle_workbench(conn, output_path=args.output)
    _print_export_result(result)
    print("stats:")
    for key, value in result.get("stats", {}).items():
        print(f"  - {key}: {value}")
    return 0


def cmd_export_frontend_workbenches(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_frontend_workbenches(conn, output_dir=args.output_dir)
    _print_export_result(result)
    print("stats:")
    for key, value in result.get("stats", {}).items():
        print(f"  - {key}: {value}")
    return 0


def cmd_export_standard_frameworks_data(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_standard_frameworks_data(conn, output_path=args.output)
    _print_export_result(result)
    print("stats:")
    for key, value in result.get("stats", {}).items():
        print(f"  - {key}: {value}")
    return 0


def cmd_export_second_batch_summary(args: argparse.Namespace) -> int:
    db_path = resolve_project_path(args.db)
    run_migrations(db_path)
    with connect(db_path) as conn:
        result = export_second_batch_summary(
            conn,
            output_path=args.output,
            import_job_id=args.import_job_id,
        )
    _print_export_result(result)
    print("stats:")
    for key, value in result.get("stats", {}).items():
        print(f"  - {key}: {value}")
    return 0


def cmd_serve(args: argparse.Namespace) -> int:
    serve(args)
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="sapd-wiki")
    parser.add_argument(
        "--db",
        default=str(DEFAULT_DB_PATH),
        help="SQLite database path. Defaults to data/database/sapd_wiki.sqlite3.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_db = subparsers.add_parser("init-db", help="Run SQLite migrations.")
    init_db.set_defaults(func=cmd_init_db)

    inspect_excel = subparsers.add_parser(
        "inspect-excel",
        help="Register an Excel source file and inspect workbook/sheet structure.",
    )
    inspect_excel.add_argument("excel_path", help="Path to the Excel file.")
    inspect_excel.add_argument(
        "--sensitive-level",
        default="unknown",
        choices=["unknown", "internal", "public", "confidential"],
        help="Sensitivity label for the source file.",
    )
    inspect_excel.add_argument("--json", action="store_true", help="Print JSON summary.")
    inspect_excel.set_defaults(func=cmd_inspect_excel)

    stage_excel = subparsers.add_parser(
        "stage-excel",
        help="Parse Excel sheets into staging_items and staging_relations.",
    )
    stage_excel.add_argument("excel_path", help="Path to the Excel file.")
    stage_excel.add_argument(
        "--sheets",
        default="all",
        help="Sheet selection: all, capability, or comma-separated Sheet names.",
    )
    stage_excel.add_argument(
        "--sensitive-level",
        default="unknown",
        choices=["unknown", "internal", "public", "confidential"],
        help="Sensitivity label for the source file.",
    )
    stage_excel.add_argument("--json", action="store_true", help="Print JSON summary.")
    stage_excel.set_defaults(func=cmd_stage_excel)

    approve = subparsers.add_parser(
        "approve-import",
        help="Approve staged records for an import job and load them into formal tables.",
    )
    approve.add_argument("import_job_id", help="Import job id to approve.")
    approve.add_argument("--json", action="store_true", help="Print JSON summary.")
    approve.set_defaults(func=cmd_approve_import)

    summary = subparsers.add_parser("summary", help="Show table and object counts.")
    summary.add_argument("--json", action="store_true", help="Print JSON summary.")
    summary.set_defaults(func=cmd_summary)

    list_items_cmd = subparsers.add_parser("list-items", help="List knowledge items.")
    list_items_cmd.add_argument("--type", help="Filter by knowledge item type.")
    list_items_cmd.add_argument("--limit", type=int, default=20, help="Maximum number of rows.")
    list_items_cmd.add_argument("--json", action="store_true", help="Print JSON rows.")
    list_items_cmd.set_defaults(func=cmd_list_items)

    imports = subparsers.add_parser("imports", help="List recent import jobs.")
    imports.add_argument("--limit", type=int, default=10, help="Maximum number of rows.")
    imports.add_argument("--json", action="store_true", help="Print JSON rows.")
    imports.set_defaults(func=cmd_imports)

    bootstrap = subparsers.add_parser(
        "bootstrap-local-data",
        help="Initialize local SQLite and frontend data packages from local source files.",
    )
    bootstrap.add_argument(
        "--profile",
        choices=sorted(BOOTSTRAP_IMPORT_PROFILES),
        default="full",
        help="Import profile. full imports core, second-batch, third-batch and standard-framework sheets.",
    )
    bootstrap.add_argument(
        "--workbook",
        default=str(BOOTSTRAP_DEFAULT_WORKBOOK),
        help="Main Excel workbook path. Defaults to data/raw-samples/wiki sample.xlsx.",
    )
    bootstrap.add_argument(
        "--reset",
        action="store_true",
        help="Back up the existing local database before rebuilding.",
    )
    bootstrap.add_argument(
        "--append",
        action="store_true",
        help="Append imports to an existing database. Defaults to refusing when the database exists.",
    )
    bootstrap.add_argument(
        "--skip-frontend-export",
        action="store_true",
        help="Import SQLite only; do not generate frontend public/data packages.",
    )
    bootstrap.add_argument(
        "--allow-validation-errors",
        action="store_true",
        help="Continue approval even when error/blocking validations exist. Intended for investigation only.",
    )
    bootstrap.add_argument(
        "--sensitive-level",
        default="confidential",
        choices=["unknown", "internal", "public", "confidential"],
        help="Sensitivity label for the source file.",
    )
    bootstrap.add_argument(
        "--print-inputs",
        action="store_true",
        help="Print required and optional local input files without importing.",
    )
    bootstrap.set_defaults(func=cmd_bootstrap_local_data)

    export_items_cmd = subparsers.add_parser("export-items", help="Export knowledge items to CSV/JSON.")
    export_items_cmd.add_argument("--type", help="Filter by knowledge item type.")
    export_items_cmd.add_argument(
        "--format",
        choices=["csv", "json", "all"],
        default="all",
        help="Export format.",
    )
    export_items_cmd.add_argument("--output-dir", default=None, help="Output directory. Defaults to data/exports.")
    export_items_cmd.set_defaults(func=cmd_export_items)

    export_relations_cmd = subparsers.add_parser("export-relations", help="Export knowledge relations to CSV/JSON.")
    export_relations_cmd.add_argument("--type", help="Filter by relation type.")
    export_relations_cmd.add_argument(
        "--include-deprecated",
        action="store_true",
        help="Include relations whose source or target item is deprecated. Defaults to active endpoints only.",
    )
    export_relations_cmd.add_argument(
        "--format",
        choices=["csv", "json", "all"],
        default="all",
        help="Export format.",
    )
    export_relations_cmd.add_argument("--output-dir", default=None, help="Output directory. Defaults to data/exports.")
    export_relations_cmd.set_defaults(func=cmd_export_relations)

    export_summary = subparsers.add_parser("export-import-summary", help="Export import job summary JSON.")
    export_summary.add_argument("--import-job-id", help="Import job id. Defaults to latest approved job.")
    export_summary.add_argument("--output-dir", default=None, help="Output directory. Defaults to data/exports.")
    export_summary.set_defaults(func=cmd_export_import_summary)

    export_report = subparsers.add_parser("export-report", help="Export import result report and warning review files.")
    export_report.add_argument("--import-job-id", help="Import job id. Defaults to latest approved job.")
    export_report.add_argument("--sample-limit", type=int, default=20, help="Number of sample items in report.")
    export_report.add_argument("--output-dir", default=None, help="Output directory. Defaults to data/exports.")
    export_report.set_defaults(func=cmd_export_report)

    capability_tree = subparsers.add_parser(
        "export-capability-tree",
        help="Export frontend-ready capability tree JSON.",
    )
    capability_tree.add_argument(
        "--output",
        default="frontend/capability-browser/public/data/capability-tree.json",
        help="Output JSON path.",
    )
    capability_tree.set_defaults(func=cmd_export_capability_tree)

    maintenance_knowledge = subparsers.add_parser(
        "export-maintenance-knowledge",
        help="Export frontend-ready maintenance knowledge JSON.",
    )
    maintenance_knowledge.add_argument(
        "--output",
        default="frontend/capability-browser/public/data/maintenance-knowledge.json",
        help="Output JSON path.",
    )
    maintenance_knowledge.set_defaults(func=cmd_export_maintenance_knowledge)

    shared_lookups = subparsers.add_parser(
        "export-shared-lookups",
        help="Export frontend-ready shared lookup JSON.",
    )
    shared_lookups.add_argument(
        "--output",
        default="frontend/capability-browser/public/data/shared-lookups.json",
        help="Output JSON path.",
    )
    shared_lookups.set_defaults(func=cmd_export_shared_lookups)

    lifecycle_knowledge = subparsers.add_parser(
        "export-lifecycle-knowledge",
        help="Export frontend-ready lifecycle knowledge JSON.",
    )
    lifecycle_knowledge.add_argument(
        "--output",
        default="frontend/capability-browser/public/data/lifecycle-knowledge.json",
        help="Output JSON path.",
    )
    lifecycle_knowledge.set_defaults(func=cmd_export_lifecycle_knowledge)

    content_views = subparsers.add_parser(
        "export-content-views",
        help="Export frontend-ready content view stub JSON.",
    )
    content_views.add_argument(
        "--output",
        default="frontend/capability-browser/public/data/content-views.json",
        help="Output JSON path.",
    )
    content_views.set_defaults(func=cmd_export_content_views)

    capability_workbench = subparsers.add_parser(
        "export-capability-workbench",
        help="Export frontend data contract v1 capability workbench JSON.",
    )
    capability_workbench.add_argument(
        "--output",
        default="frontend/capability-browser/public/data/capability-workbench.json",
        help="Output JSON path.",
    )
    capability_workbench.set_defaults(func=cmd_export_capability_workbench)

    environment_workbench = subparsers.add_parser(
        "export-environment-workbench",
        help="Export frontend data contract v1 environment workbench JSON.",
    )
    environment_workbench.add_argument(
        "--output",
        default="frontend/capability-browser/public/data/environment-workbench.json",
        help="Output JSON path.",
    )
    environment_workbench.set_defaults(func=cmd_export_environment_workbench)

    lifecycle_workbench = subparsers.add_parser(
        "export-lifecycle-workbench",
        help="Export frontend data contract v1 lifecycle workbench JSON.",
    )
    lifecycle_workbench.add_argument(
        "--output",
        default="frontend/capability-browser/public/data/lifecycle-workbench.json",
        help="Output JSON path.",
    )
    lifecycle_workbench.set_defaults(func=cmd_export_lifecycle_workbench)

    frontend_workbenches = subparsers.add_parser(
        "export-frontend-workbenches",
        help="Export all frontend data contract v1 workbench JSON files.",
    )
    frontend_workbenches.add_argument(
        "--output-dir",
        default="frontend/capability-browser/public/data",
        help="Output directory for capability/environment/lifecycle workbench JSON files.",
    )
    frontend_workbenches.set_defaults(func=cmd_export_frontend_workbenches)

    standards_data = subparsers.add_parser(
        "export-standard-frameworks-data",
        help="Export frontend-ready standard framework control JSON.",
    )
    standards_data.add_argument(
        "--output",
        default="frontend/capability-browser/public/data/standards-index.json",
        help="Output index JSON path.",
    )
    standards_data.set_defaults(func=cmd_export_standard_frameworks_data)

    second_batch_summary = subparsers.add_parser(
        "export-second-batch-summary",
        help="Export second-batch verification summary JSON.",
    )
    second_batch_summary.add_argument("--import-job-id", help="Import job id. Defaults to latest import job.")
    second_batch_summary.add_argument(
        "--output",
        default="data/exports/second-batch-summary-latest/second-batch-summary.json",
        help="Output JSON path.",
    )
    second_batch_summary.set_defaults(func=cmd_export_second_batch_summary)

    serve_cmd = subparsers.add_parser(
        "serve",
        help="Run local frontend static server with /api/v1 backend endpoints.",
    )
    serve_cmd.add_argument("--host", default="127.0.0.1", help="Host to bind. Defaults to 127.0.0.1.")
    serve_cmd.add_argument("--port", type=int, default=5173, help="Port to bind. Defaults to 5173.")
    serve_cmd.add_argument(
        "--static-dir",
        default="frontend/capability-browser",
        help="Static frontend directory. Defaults to frontend/capability-browser.",
    )
    serve_cmd.set_defaults(func=cmd_serve)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except Exception as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
