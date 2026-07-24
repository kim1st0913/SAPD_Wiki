#!/usr/bin/env python3
"""Audit the user-visible import/export and internal Runtime directory contract."""

from __future__ import annotations

import base64
import sys
import tempfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = PROJECT_ROOT / "src"
if str(SOURCE_ROOT) not in sys.path:
    sys.path.insert(0, str(SOURCE_ROOT))

from sapd_wiki import api_server  # noqa: E402


def require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def main() -> int:
    swift_source = (PROJECT_ROOT / "apps/macos/SAPDWiki/Sources/SAPDWiki/main.swift").read_text(encoding="utf-8")
    data_client_source = (PROJECT_ROOT / "frontend/capability-browser/dataClient.js").read_text(encoding="utf-8")
    runtime_source = (PROJECT_ROOT / "scripts/run_local_server.py").read_text(encoding="utf-8")
    diagnostics_source = (PROJECT_ROOT / "scripts/export_diagnostics.py").read_text(encoding="utf-8")

    for expected in (
        'defaultImportDirectory(for: dataRoot)',
        '"maturity-templates"',
        '"maturity-scores"',
        '"maturity-reports"',
        '"issues"',
        '"diagnostics"',
        'title: "文件上传路径"',
        'title: "文件下载路径"',
        'title: "Runtime"',
        'runOpenPanelWith parameters',
        'object["import_dir"]',
        'object["download_dir"]',
    ):
        require(expected in swift_source, f"macOS App 缺少目录契约：{expected}")
    require('maturityReportExport: "/api/v1/maturity/report/export"' in data_client_source, "前端缺少评估报告分类导出 API")
    require("saveToConfiguredDirectory" in data_client_source, "评分表和模板未接入配置导出目录")
    require('export_dir=runtime.export_dir.resolve()' in runtime_source, "Runtime 未把配置导出根目录传给共享 API")
    require('export_root.resolve() / "diagnostics"' in diagnostics_source, "诊断包未写入 export/diagnostics")

    original_user_db = api_server.USER_DB_PATH
    original_export_dir = api_server.USER_EXPORT_DIR
    try:
        with tempfile.TemporaryDirectory(prefix="sapd-local-directory-contract-") as temporary:
            root = Path(temporary) / "SAPDWiki"
            user_db = root / "Runtime/data/user/sapd_wiki_user.sqlite3"
            export_dir = root / "export"
            api_server.configure_runtime_paths(user_db=user_db, export_dir=export_dir)

            issue = api_server.save_markdown_export(
                {
                    "category": "issues",
                    "filename": "2026-07-20_SAPD-Wiki_Issue清单.md",
                    "content": "# Issue\n",
                }
            )
            export_dir = export_dir.resolve()
            require(Path(issue["output_path"]).parent == export_dir / "issues", "Issue 未写入 export/issues")

            workbook_result = {
                "ok": True,
                "package": {"workbookBase64": base64.b64encode(b"PK\x03\x04contract").decode("ascii")},
            }
            project = {"id": "demo-project-002", "name": "某科技企业成熟度评估"}
            score = api_server._persist_maturity_workbook_export(
                workbook_result,
                category="maturity-scores",
                project=project,
                business_name=project["name"],
                suffix_label="评分表",
            )
            require("maturity-scores" in Path(score["output_path"]).parts, "评分表未写入 export/maturity-scores")
            require("demo-project-002" in Path(score["output_path"]).parent.name, "评分表目录缺少稳定项目标识")

            template = api_server._persist_maturity_workbook_export(
                workbook_result,
                category="maturity-templates",
                project=None,
                business_name="SAPD标准能力成熟度模板",
                suffix_label="业务模板",
            )
            require(Path(template["output_path"]).parent == export_dir / "maturity-templates", "模板未写入 export/maturity-templates")

            report = api_server.persist_maturity_report_artifact(
                {
                    "ok": True,
                    "formal": True,
                    "id": "report-contract-test",
                    "generatedAt": "2026-07-20T12:00:00Z",
                    "html": "<!doctype html><title>评估报告</title>",
                    "markdown": "# 评估报告\n",
                    "reportModel": {
                        "project": project,
                        "resultSnapshot": {"calculationRun": {"inputHash": "input-contract", "resultHash": "result-contract"}},
                        "resultVersion": {"resultHash": "result-contract"},
                    },
                },
                {"project": project, "operation": "create"},
            )
            artifact_id = report["persistence"]["artifactId"]
            internal_report = user_db.parent / report["persistence"]["relativePath"] / "report.html"
            require(internal_report.is_file(), "报告历史未保存在 Runtime/data/user/maturity-reports")
            exported_report = api_server.export_maturity_report_file(
                {
                    "project": project,
                    "artifactId": artifact_id,
                    "inputHash": "input-contract",
                    "resultHash": "result-contract",
                    "format": "html",
                }
            )
            report_path = Path(exported_report["output_path"])
            require("maturity-reports" in report_path.parts, "评估报告未写入 export/maturity-reports")
            require(report_path.name.endswith("_评估报告.html"), "用户报告文件名未使用业务名称")
            require(artifact_id not in report_path.as_posix(), "用户导出路径泄露内部 artifactId")
    finally:
        api_server.configure_runtime_paths(user_db=original_user_db, export_dir=original_export_dir)

    print("本地目录契约审计通过：Runtime 历史与 import/export 用户目录已分离。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
