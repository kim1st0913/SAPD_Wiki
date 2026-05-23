from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = PROJECT_ROOT / "data" / "database" / "sapd_wiki.sqlite3"
DEFAULT_WORKBOOK = PROJECT_ROOT / "data" / "raw-samples" / "wiki sample.xlsx"
FRONTEND_DATA_DIR = PROJECT_ROOT / "frontend" / "capability-browser" / "public" / "data"

IMPORT_PROFILES = {
    "core": ["core"],
    "full": ["core", "second-batch", "third-batch", "standard-framework"],
}

EXPORT_COMMANDS = [
    ["export-frontend-workbenches"],
    ["export-maintenance-knowledge"],
    ["export-shared-lookups"],
    ["export-lifecycle-knowledge"],
    ["export-standard-frameworks-data"],
    ["export-content-views"],
    ["export-capability-tree"],
    ["export-items", "--format", "all"],
    ["export-relations", "--format", "all"],
    ["export-report", "--sample-limit", "20"],
]

OPTIONAL_INPUTS = [
    "data/raw-samples/wiki sample ppt.pptx",
    "data/raw-samples/drawio sample.drawio",
    "data/raw-samples/ds design/T00-面向业务的数据安全专项设计方法（V2.1）.pdf",
    "data/raw-samples/ds design/安全技术架构设计方法 V2.0.pdf",
]


def display(path: Path) -> str:
    try:
        return path.relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return str(path)


def run_cli(args: list[str], *, capture_json: bool = False) -> dict[str, Any] | None:
    command = [
        sys.executable,
        str(PROJECT_ROOT / "scripts" / "sapd_wiki.py"),
        "--db",
        str(DEFAULT_DB),
        *args,
    ]
    label = " ".join(["python", "scripts/sapd_wiki.py", "--db", display(DEFAULT_DB), *args])
    print(f"\n$ {label}")
    completed = subprocess.run(
        command,
        cwd=PROJECT_ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if completed.stdout and not capture_json:
        print(completed.stdout.rstrip())
    if completed.stderr:
        print(completed.stderr.rstrip(), file=sys.stderr)
    if completed.returncode != 0:
        raise RuntimeError(f"command failed: {label}")
    if not capture_json:
        return None
    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        print(completed.stdout, file=sys.stderr)
        raise RuntimeError(f"command did not return JSON: {label}") from exc


def ensure_dirs() -> None:
    for path in [
        PROJECT_ROOT / "data" / "raw-samples",
        PROJECT_ROOT / "data" / "database",
        PROJECT_ROOT / "data" / "exports",
        FRONTEND_DATA_DIR,
    ]:
        path.mkdir(parents=True, exist_ok=True)


def print_input_guide() -> None:
    print("需要先放入的本地文件：")
    print(f"  必需: {display(DEFAULT_WORKBOOK)}")
    print("  可选:")
    for item in OPTIONAL_INPUTS:
        print(f"    - {item}")
    print("\n这些文件只放在本机，受 .gitignore 保护，不提交 GitHub。")


def check_inputs() -> None:
    ensure_dirs()
    if not DEFAULT_WORKBOOK.exists():
        print_input_guide()
        raise FileNotFoundError(f"missing required workbook: {display(DEFAULT_WORKBOOK)}")


def reset_database() -> None:
    if DEFAULT_DB.exists():
        backup = DEFAULT_DB.with_suffix(".sqlite3.before-bootstrap.bak")
        if backup.exists():
            backup.unlink()
        shutil.move(DEFAULT_DB, backup)
        print(f"已备份旧数据库: {display(backup)}")


def run_import_step(sheet_set: str, *, sensitive_level: str, allow_validation_errors: bool) -> str:
    payload = run_cli(
        [
            "stage-excel",
            str(DEFAULT_WORKBOOK),
            "--sheets",
            sheet_set,
            "--sensitive-level",
            sensitive_level,
            "--json",
        ],
        capture_json=True,
    )
    assert payload is not None
    import_job_id = payload["import_job_id"]
    validations = payload.get("stage_summary", {}).get("validations", [])
    blocking = [item for item in validations if item.get("level") in {"error", "blocking"}]
    print(
        f"导入暂存: sheets={sheet_set}, import_job_id={import_job_id}, "
        f"validations={len(validations)}, blocking={len(blocking)}"
    )
    if blocking and not allow_validation_errors:
        for item in blocking[:10]:
            print(f"  - [{item.get('level')}] {item.get('sheet')}:{item.get('row')} {item.get('message')}")
        raise RuntimeError("存在阻断级校验问题，已停止审批入库。可修正源文件后重跑。")

    approve_payload = run_cli(["approve-import", import_job_id, "--json"], capture_json=True)
    assert approve_payload is not None
    print(
        "审批入库: "
        f"items_created={approve_payload.get('items_created', 0)}, "
        f"items_updated={approve_payload.get('items_updated', 0)}, "
        f"relations_created={approve_payload.get('relations_created', 0)}"
    )
    return import_job_id


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="从本地原始文件一键初始化 SAPD Wiki 开发数据库和前端离线数据包。",
    )
    parser.add_argument(
        "--profile",
        choices=sorted(IMPORT_PROFILES),
        default="full",
        help="导入范围。full 会导入当前已实现 parser 的核心、第二批、第三批和标准框架 Sheet。",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="如果本地数据库已存在，先备份旧库再重建。首次初始化建议使用。",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="允许在已有数据库上追加导入。默认不允许，避免重复导入。",
    )
    parser.add_argument(
        "--skip-frontend-export",
        action="store_true",
        help="只导入 SQLite，不生成前端 public/data 离线数据包。",
    )
    parser.add_argument(
        "--allow-validation-errors",
        action="store_true",
        help="存在 error/blocking 校验时仍继续审批。仅用于排查，不建议日常使用。",
    )
    parser.add_argument(
        "--sensitive-level",
        default="confidential",
        choices=["unknown", "internal", "public", "confidential"],
        help="登记来源文件时写入的敏感级别。",
    )
    parser.add_argument(
        "--print-inputs",
        action="store_true",
        help="只打印需要放入本地的文件清单，不执行导入。",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.print_inputs:
        print_input_guide()
        return 0

    check_inputs()
    if DEFAULT_DB.exists() and not args.reset and not args.append:
        print(f"数据库已存在: {display(DEFAULT_DB)}")
        print("如果要重新初始化，请执行: python scripts/bootstrap_local_data.py --reset")
        print("如果确认要追加导入，请执行: python scripts/bootstrap_local_data.py --append")
        return 2

    if args.reset:
        reset_database()

    run_cli(["init-db"])
    imported_jobs = []
    for sheet_set in IMPORT_PROFILES[args.profile]:
        imported_jobs.append(
            run_import_step(
                sheet_set,
                sensitive_level=args.sensitive_level,
                allow_validation_errors=args.allow_validation_errors,
            )
        )

    if not args.skip_frontend_export:
        for command in EXPORT_COMMANDS:
            run_cli(command)

    run_cli(["summary"])
    print("\n本地初始化完成。")
    print(f"数据库: {display(DEFAULT_DB)}")
    print(f"前端数据包目录: {display(FRONTEND_DATA_DIR)}")
    print(f"导入任务: {', '.join(imported_jobs)}")
    print("上述数据库和生成数据包均为本地文件，不提交 GitHub。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
