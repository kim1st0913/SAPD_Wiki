#!/usr/bin/env python3
"""Assemble a controlled SAPD Wiki desktop Runtime directory.

It expects caller-provided frontend assets, a platform-native backend binary,
and approved read-only databases. It does not run ETL. ZIP output remains
available for compatibility, but production packaging consumes the directory.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import sqlite3
import sys
import time
import zipfile
from pathlib import Path
from urllib.parse import quote

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
SRC_ROOT = REPO_ROOT / "src"
for import_root in (SCRIPT_DIR, SRC_ROOT):
    import_value = str(import_root)
    if import_value in sys.path:
        sys.path.remove(import_value)
    sys.path.insert(0, import_value)

from check_bundle_runtime import sha256_file
from create_user_db import initialize_user_db
from sapd_wiki.projection_contract import build_release_projection_identity


WINDOWS_CHANGELOG = REPO_ROOT / "apps" / "electron" / "CHANGELOG.md"
SUPPORTED_PLATFORMS = {"win-x64", "mac-arm64", "mac-x64"}
DEFAULT_BUNDLE_ROOT = Path(
    os.environ.get("SAPD_WIKI_BUNDLE_ROOT", str(REPO_ROOT / "dist" / "runtime-work"))
)
DEFAULT_OUTPUT_DIR = Path(os.environ.get("SAPD_WIKI_BUNDLE_OUTPUT_DIR", str(DEFAULT_BUNDLE_ROOT / "package-work")))
FRONTEND_SOURCE_ARTIFACT_SUFFIXES = {".drawio", ".pptx"}


def copy_tree(source: Path, target: Path) -> None:
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)


def reject_symbolic_links(root: Path) -> None:
    if root.is_symlink():
        raise ValueError(f"frontend-dist must not be a symbolic link: {root}")
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError(
                "frontend-dist must not contain symbolic links: "
                f"{path.relative_to(root).as_posix()}"
            )


def tree_sha256(root: Path, *, excluded_suffixes: set[str] | None = None) -> tuple[str, int]:
    reject_symbolic_links(root)
    excluded = {suffix.casefold() for suffix in (excluded_suffixes or set())}
    digest = hashlib.sha256()
    files = [
        path
        for path in root.rglob("*")
        if path.is_file() and path.suffix.casefold() not in excluded
    ]
    for path in sorted(files, key=lambda item: item.relative_to(root).as_posix()):
        relative = path.relative_to(root).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest(), len(files)


def exclude_frontend_source_artifacts(frontend_root: Path) -> list[str]:
    """Remove editable source artifacts that must be served from the asset DB."""

    excluded: list[str] = []
    for path in sorted(frontend_root.rglob("*")):
        if not path.is_file() or path.suffix.casefold() not in FRONTEND_SOURCE_ARTIFACT_SUFFIXES:
            continue
        excluded.append(path.relative_to(frontend_root).as_posix())
        path.unlink()
    return excluded


def content_asset_owner_url(owner_ref: str) -> str:
    return (
        "/api/v1/content/assets/by-owner?"
        f"owner_ref={quote(owner_ref, safe='')}&asset_role=original"
    )


def prepare_frontend_asset_runtime(
    frontend_root: Path,
    content_asset_db: Path,
) -> list[str]:
    """Route packaged originals through the asset DB and remove byte-identical copies."""

    maturity_url = content_asset_owner_url(
        "base:content_document:sapd-maturity-model-usage-guide"
    )
    poster_url = content_asset_owner_url(
        "base:content_document:archimate-3.2-reference-poster-zh"
    )
    rewrites = {
        frontend_root / "app.js": (
            (
                '"/assets/guides/maturity-model-usage.html?embed=1&',
                f'"{maturity_url}&embed=1&',
            ),
            (
                "const ARCHIMATE_POSTER_PDF_PATH = "
                "`${ARCHIMATE_POSTER_ASSET_BASE}/archimate-poster-v3.2-zh.pdf`;",
                f'const ARCHIMATE_POSTER_PDF_PATH = "{poster_url}";',
            ),
        ),
        frontend_root / "components" / "AppShell.js": (
            (
                'href: "./assets/guides/maturity-model-usage.html"',
                f'href: "{maturity_url}"',
            ),
        ),
    }
    for path, replacements in rewrites.items():
        if not path.is_file():
            raise FileNotFoundError(f"required frontend asset rewrite owner is missing: {path}")
        content = path.read_text(encoding="utf-8")
        for old, new in replacements:
            match_count = content.count(old)
            if match_count != 1:
                raise ValueError(
                    f"frontend asset rewrite expected one match in {path}: "
                    f"found {match_count} for {old!r}"
                )
            content = content.replace(old, new, 1)
        path.write_text(content, encoding="utf-8")

    with sqlite3.connect(
        f"file:{content_asset_db.resolve()}?mode=ro",
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
    removed: list[str] = []
    for path in sorted(frontend_root.rglob("*")):
        if not path.is_file():
            continue
        if sha256_file(path).lower() in original_hashes:
            removed.append(path.relative_to(frontend_root).as_posix())
            path.unlink()
    combined_runtime_source = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (
            frontend_root / "app.js",
            frontend_root / "components" / "AppShell.js",
        )
        if path.is_file()
    )
    if any(path.endswith("maturity-model-usage.html") for path in removed):
        if maturity_url not in combined_runtime_source:
            raise ValueError(
                "packaged maturity guide original was removed without an asset API route"
            )
    if any(path.endswith("archimate-poster-v3.2-zh.pdf") for path in removed):
        if poster_url not in combined_runtime_source:
            raise ValueError(
                "packaged ArchiMate poster original was removed without an asset API route"
            )
    return removed


def _validated_maturity_report_seed_artifact(
    source: Path,
    project_source: Path,
    project_id: str,
    artifact_id: str,
) -> tuple[dict[str, object], dict[str, object], Path]:
    selection = f"{project_id}={artifact_id}"
    manifest_path = project_source / "manifest.json"
    artifact_source = project_source / "artifacts" / artifact_id
    for candidate in (source, project_source, project_source / "artifacts", artifact_source, manifest_path):
        if candidate.is_symlink():
            raise ValueError(f"maturity report seed path must not be a symbolic link: {candidate}")
        try:
            candidate.resolve().relative_to(source.resolve())
        except ValueError as error:
            raise ValueError(f"maturity report seed path escapes source root: {candidate}") from error
    if not manifest_path.is_file() or not artifact_source.is_dir():
        raise ValueError(f"maturity report seed artifact does not exist: {selection}")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if (
        not isinstance(manifest, dict)
        or manifest.get("schemaVersion") != "sapd-maturity-report-artifact-v1"
        or manifest.get("projectId") != project_id
        or not isinstance(manifest.get("artifacts"), list)
    ):
        raise ValueError(f"maturity report seed manifest identity is invalid: {selection}")
    artifacts = [
        item
        for item in manifest["artifacts"]
        if isinstance(item, dict) and str(item.get("artifactId") or "") == artifact_id
    ]
    if len(artifacts) != 1:
        raise ValueError(f"maturity report seed manifest does not identify exactly one artifact: {selection}")
    entry = artifacts[0]
    report_id = str(entry.get("reportId") or "")
    relative_parts = Path(str(entry.get("relativePath") or "")).parts
    if (
        entry.get("schemaVersion") != "sapd-maturity-report-artifact-v1"
        or entry.get("projectId") != project_id
        or not report_id
        or len(relative_parts) < 3
        or relative_parts[-3:] != (project_source.name, "artifacts", artifact_id)
    ):
        raise ValueError(f"maturity report seed manifest artifact identity is invalid: {selection}")
    report_files = [artifact_source / name for name in ("report.json", "report.html", "report.md")]
    for report_file in report_files:
        if report_file.is_symlink():
            raise ValueError(f"maturity report seed path must not be a symbolic link: {report_file}")
        if not report_file.is_file():
            raise ValueError(f"maturity report seed artifact is incomplete: {selection}")
    report = json.loads(report_files[0].read_text(encoding="utf-8"))
    persistence = report.get("persistence") if isinstance(report, dict) and isinstance(report.get("persistence"), dict) else {}
    if (
        report.get("id") != report_id
        or persistence.get("schemaVersion") != "sapd-maturity-report-artifact-v1"
        or persistence.get("projectId") != project_id
        or persistence.get("reportId") != report_id
        or persistence.get("artifactId") != artifact_id
        or persistence.get("relativePath") != entry.get("relativePath")
    ):
        raise ValueError(f"maturity report seed report identity is invalid: {selection}")
    return manifest, entry, artifact_source


def copy_maturity_report_seed(source: Path, target: Path, selections: list[str]) -> None:
    """Copy either the whole seed or an explicit project/artifact allow-list."""

    if source.is_symlink() or any(path.is_symlink() for path in source.rglob("*")):
        raise ValueError(f"maturity report seed must not contain symbolic links: {source}")
    if not selections:
        for project_source in (path for path in source.iterdir() if path.is_dir()):
            manifest_path = project_source / "manifest.json"
            if not manifest_path.is_file():
                raise ValueError(f"maturity report seed project manifest is missing: {project_source}")
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            project_id = str(manifest.get("projectId") or "") if isinstance(manifest, dict) else ""
            artifacts = manifest.get("artifacts") if isinstance(manifest, dict) else None
            if not project_id or not isinstance(artifacts, list):
                raise ValueError(f"maturity report seed manifest identity is invalid: {manifest_path}")
            for entry in artifacts:
                artifact_id = str(entry.get("artifactId") or "") if isinstance(entry, dict) else ""
                if not artifact_id:
                    raise ValueError(f"maturity report seed manifest artifact identity is invalid: {manifest_path}")
                _validated_maturity_report_seed_artifact(source, project_source, project_id, artifact_id)
        copy_tree(source, target)
        return
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    for selection in selections:
        project_id, separator, artifact_id = str(selection or "").partition("=")
        project_id = project_id.strip()
        artifact_id = artifact_id.strip()
        if not separator or not project_id or not artifact_id:
            raise ValueError("--maturity-report-seed-artifact must use PROJECT_ID=ARTIFACT_ID")
        project_source = source / project_id
        manifest, entry, artifact_source = _validated_maturity_report_seed_artifact(
            source, project_source, project_id, artifact_id
        )
        project_target = target / project_id
        copy_tree(artifact_source, project_target / "artifacts" / artifact_id)
        filtered_manifest = {
            "schemaVersion": manifest["schemaVersion"],
            "projectId": project_id,
            "artifacts": [entry],
        }
        write_text(project_target / "manifest.json", json.dumps(filtered_manifest, ensure_ascii=False, indent=2) + "\n")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def backend_name(platform_name: str) -> str:
    return "SAPD-Wiki-Backend.exe" if platform_name.startswith("win") else "SAPD-Wiki-Backend"


def version_for_bundle_name(bundle_version: str) -> str:
    return bundle_version if bundle_version.lower().startswith("v") else f"v{bundle_version}"


def windows_start_script() -> str:
    return """@echo off
setlocal
cd /d "%~dp0"
set "BUNDLE_ROOT=%CD%"
if not exist "logs" mkdir "logs"
echo [%DATE% %TIME%] start-windows.bat launched> "logs\\launcher.log"
echo Bundle root: %BUNDLE_ROOT%>> "logs\\launcher.log"
if not exist "SAPD-Wiki-Backend.exe" (
  echo SAPD-Wiki-Backend.exe is missing.
  echo SAPD-Wiki-Backend.exe is missing.>> "logs\\launcher.log"
  echo Please check logs\\runtime.log or run diagnostics\\export-diagnostics.bat.
  pause
  exit /b 1
)
echo Running SAPD-Wiki-Backend...
echo Command: "%BUNDLE_ROOT%\\SAPD-Wiki-Backend.exe" --bundle-root "%BUNDLE_ROOT%" %*>> "logs\\launcher.log"
"%BUNDLE_ROOT%\\SAPD-Wiki-Backend.exe" --bundle-root "%BUNDLE_ROOT%" %* 1>>"logs\\backend-console.log" 2>&1
set "SAPD_EXIT=%ERRORLEVEL%"
echo Backend exit code: %SAPD_EXIT%>> "logs\\launcher.log"
if not "%SAPD_EXIT%"=="0" (
  echo SAPD Wiki failed to start. Please check logs\\runtime.log.
  if exist "logs\\backend-console.log" (
    echo.
    echo Last backend console lines:
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Path 'logs\\backend-console.log' -Tail 30" 2>nul
  )
  if exist "logs\\runtime.log" (
    echo.
    echo Last runtime log lines:
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Path 'logs\\runtime.log' -Tail 30" 2>nul
  )
  pause
  exit /b %SAPD_EXIT%
)
echo SAPD Wiki backend exited.
if exist "logs\\backend-console.log" (
  echo.
  echo Last backend console lines:
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Path 'logs\\backend-console.log' -Tail 30" 2>nul
)
if exist "logs\\runtime.log" (
  echo.
  echo Last runtime log lines:
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -Path 'logs\\runtime.log' -Tail 30" 2>nul
)
pause
exit /b %SAPD_EXIT%
"""


def windows_stop_script() -> str:
    return """@echo off
setlocal
echo ZIP alpha currently runs SAPD-Wiki-Backend as a local process.
echo Close the SAPD-Wiki-Backend window, press Ctrl+C in its console, or stop it from Task Manager.
echo A managed background service stop command is planned for a later alpha.
"""


def windows_diagnostics_script() -> str:
    return """@echo off
setlocal
cd /d "%~dp0.."
if not exist "SAPD-Wiki-Backend.exe" (
  echo SAPD-Wiki-Backend.exe is missing. Cannot export diagnostics.
  exit /b 1
)
"%~dp0..\\SAPD-Wiki-Backend.exe" --bundle-root "%~dp0.." --export-diagnostics
pause
"""


def windows_user_notes_export_script() -> str:
    return """@echo off
setlocal
cd /d "%~dp0.."
if not exist "SAPD-Wiki-Backend.exe" (
  echo SAPD-Wiki-Backend.exe is missing. Cannot export user notes.
  exit /b 1
)
"%~dp0..\\SAPD-Wiki-Backend.exe" --bundle-root "%~dp0.." --export-user-notes
pause
"""


def mac_start_script() -> str:
    return """#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR" || exit 1
mkdir -p "$DIR/logs"
LAUNCHER_LOG="$DIR/logs/launcher.log"
{
  echo "==== SAPD Wiki launcher ===="
  date
  echo "bundle_root=$DIR"
} >> "$LAUNCHER_LOG"
if [ ! -x "$DIR/SAPD-Wiki-Backend" ]; then
  echo "SAPD-Wiki-Backend is missing or not executable."
  echo "Try: chmod +x \"$DIR/SAPD-Wiki-Backend\" \"$DIR/start-macos.command\""
  echo "Then check logs/runtime.log or run diagnostics/export-diagnostics.command."
  echo "backend missing or not executable" >> "$LAUNCHER_LOG"
  exit 1
fi
if command -v xattr >/dev/null 2>&1 && xattr -p com.apple.quarantine "$DIR/SAPD-Wiki-Backend" >/dev/null 2>&1; then
  echo "macOS quarantine detected on SAPD-Wiki-Backend."
  echo "This unsigned alpha binary may be killed by Gatekeeper with 'Killed: 9'."
  echo "Run these commands in Terminal:"
  echo "  xattr -dr com.apple.quarantine \"$DIR\""
  echo "  chmod +x \"$DIR/SAPD-Wiki-Backend\" \"$DIR/start-macos.command\""
  echo "Then run start-macos.command again."
  echo "quarantine detected on backend" >> "$LAUNCHER_LOG"
  exit 1
fi
echo "starting backend" >> "$LAUNCHER_LOG"
"$DIR/SAPD-Wiki-Backend" --bundle-root "$DIR" "$@"
"""


def mac_stop_script() -> str:
    return """#!/bin/sh
echo "ZIP alpha currently runs SAPD-Wiki-Backend as a local process."
echo "Close the SAPD-Wiki-Backend window, press Ctrl+C in its Terminal window, or stop it from Activity Monitor."
echo "A managed background service stop command is planned for a later alpha."
"""


def mac_diagnostics_script() -> str:
    return """#!/bin/sh
DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -x "$DIR/SAPD-Wiki-Backend" ]; then
  echo "SAPD-Wiki-Backend is missing or not executable. Cannot export diagnostics."
  exit 1
fi
"$DIR/SAPD-Wiki-Backend" --bundle-root "$DIR" --export-diagnostics
"""


def mac_user_notes_export_script() -> str:
    return """#!/bin/sh
DIR="$(cd "$(dirname "$0")/.." && pwd)"
if [ ! -x "$DIR/SAPD-Wiki-Backend" ]; then
  echo "SAPD-Wiki-Backend is missing or not executable. Cannot export user notes."
  exit 1
fi
"$DIR/SAPD-Wiki-Backend" --bundle-root "$DIR" --export-user-notes
"""


def windows_changelog_content(app_version: str) -> str:
    changelog = WINDOWS_CHANGELOG.read_text(encoding="utf-8")
    marker = f"## {app_version}"
    start = changelog.find(marker)
    if start < 0:
        raise ValueError(
            f"Windows changelog has no section for app version {app_version}"
        )
    section = changelog[start:]
    return "\n".join(
        f"#{line}" if line.startswith("## ") else line
        for line in section.splitlines()
    ).strip()


def windows_readme_content(app_version: str, placeholder: bool = False) -> str:
    placeholder_note = (
        "\n> 注意：本 Runtime 由 `--allow-placeholder` 生成，只能用于目录结构验证，不能作为真实运行包分发。\n"
        if placeholder
        else ""
    )
    return f"""# SAPD Wiki {app_version} Windows 使用说明

本 Runtime 随 SAPD Wiki Windows NSIS 安装程序交付。当前版本：{app_version}。
{placeholder_note}
## Changelog

{windows_changelog_content(app_version)}

## 安装与首次启动

1. 运行 `SAPD-Wiki-Setup-{app_version}-win-x64.exe`，按安装向导选择程序安装位置。
2. 首次启动会要求选择数据父目录，应用会在其下创建 `SAPDWiki` 文件夹。
3. 如果选择 `D:\\Work`，实际目录为 `D:\\Work\\SAPDWiki`。
4. App 会启动本地后端，并在桌面窗口中打开 SAPD Wiki 工作台。

## 数据与文件位置

- Runtime：`<数据父目录>\\SAPDWiki\\Runtime`
- 文件上传路径：`<数据父目录>\\SAPDWiki\\import`
- 文件下载路径：`<数据父目录>\\SAPDWiki\\export`
- 用户数据库：`<数据父目录>\\SAPDWiki\\Runtime\\data\\user\\sapd_wiki_user.sqlite3`
- 日志目录：`<数据父目录>\\SAPDWiki\\Runtime\\logs`
- 路径设置：`%LOCALAPPDATA%\\SAPD Wiki\\settings.json`

可从 App 菜单打开“系统设置”，分别修改工作目录、文件上传路径和文件下载路径；修改后按界面提示重启。应用不会自动移动或覆盖旧目录中的用户数据。

## MCP 服务

1. 在“系统设置 > AI功能集成”中建立或修复本机安全连接。
2. 启动 MCP 服务后，可以查看服务状态、客户端授权和审计信息。
3. MCP 只提供 `search_knowledge`、`get_knowledge_object`、`get_related_knowledge`、`get_evidence` 和 `get_knowledge_version` 五个基础知识只读工具。
4. MCP 不读取用户批注、Issue、收藏、用户 SQLite、源文件、本地路径、密钥或不受限 SQL。

## 批注与诊断导出

- 首页“批注一键导出”会在文件下载路径生成便于阅读的 Markdown 文件。
- 如需诊断信息，可运行 `diagnostics\\export-diagnostics.bat`。
- 诊断包默认不包含用户批注全文或 SQLite 数据库内容。

## 卸载与升级

1. 可从 Windows“设置 > 应用 > 已安装的应用”或开始菜单卸载 SAPD Wiki。
2. 卸载默认保留用户选择的 `SAPDWiki` 数据目录和路径设置，避免误删用户库。
3. 安装新版时继续选择原数据目录即可复用已有用户数据。
4. 完全重置前应先备份，再手工删除数据目录和 `%LOCALAPPDATA%\\SAPD Wiki\\settings.json`。

## 当前内测边界

- 用户不需要安装 Python、Node.js 或 Docker。
- 当前只生成 Windows x64 NSIS 安装程序。
- 当前未配置 Windows 代码签名，可能出现“未知发布者”或 SmartScreen 提示。
- 安装包不携带真实用户数据库、个人历史记录、恢复包或开发机导出文件。
- 正式发布前仍需在真实 Windows 10 和 Windows 11 机器上完成启动、写入、MCP、退出和卸载保留数据验收。
"""


def readme_content(platform_name: str, app_version: str, placeholder: bool = False) -> str:
    if platform_name.startswith("win"):
        return windows_readme_content(app_version, placeholder=placeholder)

    start_file = "start-windows.bat" if platform_name.startswith("win") else "start-macos.command"
    security_note = (
        "\n- Windows alpha 如遇安全软件拦截，请记录软件名称和提示截图。"
        if platform_name.startswith("win")
        else ""
    )
    platform_note = (
        "Windows ZIP 内部包含 SAPD-Wiki-Backend.exe；它只是 ZIP 内的运行组件，不是安装器。"
        " Alpha 阶段如遇安全软件拦截，属于签名前的已知风险。"
        if platform_name.startswith("win")
        else (
            "macOS ZIP 内部包含 SAPD-Wiki-Backend 和 start-macos.command。"
            " 如果系统提示权限或安全风险，可先执行 chmod +x start-macos.command SAPD-Wiki-Backend；"
            " 如果 macOS 提示 Apple 无法验证，可在终端进入解压目录后执行 xattr -dr com.apple.quarantine .；"
            " 未签名可执行文件的 Gatekeeper 提示留到正式签名阶段解决。"
        )
    )
    placeholder_note = (
        "\n> 注意：本包由 `--allow-placeholder` 生成，只能用于目录结构验证，不能作为真实运行包分发。\n"
        if placeholder
        else ""
    )
    return f"""# SAPD Wiki {app_version} 使用说明

本包是 SAPD Wiki 本地运行 Runtime。macOS DMG 会把它复制到用户选择的父级保存位置下的 `SAPDWiki/Runtime`。
当前版本：{app_version}。
{placeholder_note}
它不是安装包，不包含 `.dmg`、`.msi`、安装向导、自动更新或代码签名。

## Changelog

### {app_version}

- README-FIRST 增加 Changelog，方便测试和交付追踪版本变化。
- macOS DMG 默认按同一版本号生成授权版和无授权版两个交付包。
- macOS 保存位置选择的是父级目录，App 会自动创建 `SAPDWiki/Runtime` 和 `SAPDWiki/export`。

## macOS DMG 初始化注意事项

1. 首次启动会要求设置“保存位置”，这里选择的是父级目录。
2. App 会在所选父级目录下创建 `SAPDWiki` 文件夹。
3. 用户数据库路径为：`<所选父级保存位置>/SAPDWiki/Runtime/data/user/sapd_wiki_user.sqlite3`。
4. 默认下载路径为：`<所选父级保存位置>/SAPDWiki/export`，可在“SAPD Wiki > 系统设置...”中修改。
5. 后续安装新版 App 时，默认复用 `SAPDWiki` 文件夹下已有用户数据库，不覆盖已有批注、Issue 和用户数据。
6. 除非已经备份，不要手动删除或移动 `SAPDWiki/Runtime/data/user`。

## macOS DMG 授权与试用

1. 每次打开 App 时会先显示授权窗口。
2. 如果暂时不知道授权码，可以点击“跳过输入”进入 30 天试用。
3. 试用期内，窗口顶部会显示使用有效期和剩余天数。
4. 试用到期后不能继续跳过，必须输入维护者提供的正确授权码。
5. 授权成功后，窗口顶部会显示“已激活”，后续不再受试用期限制。

## ZIP 运行方式

1. 解压 ZIP 到本机目录。
2. 双击 `{start_file}`。
3. 启动成功后，浏览器会自动打开本地 SAPD Wiki 页面。

{platform_note}

## 用户不需要做什么

- 不需要安装 Python。
- 不需要安装 Node。
- 不需要安装 Docker。
- 不需要执行 ETL。
- 不需要初始化数据库。
- 不需要手工配置端口。

## 数据位置

- 基础知识库：`data/base/sapd_wiki_base.sqlite3`，普通用户不应修改。
- 内容资产库：`data/base/sapd_content_assets.sqlite3`（如本版本携带），由 App 的只读 asset API 提供文档与预览。
- 用户数据：`data/user/sapd_wiki_user.sqlite3`，收藏、备注、个人标签和用户新增内容都写入这里。
- macOS DMG 首次初始化后，真实用户数据位于用户选择的父级保存位置下的 `SAPDWiki/Runtime/data/user/sapd_wiki_user.sqlite3`。

基础库升级不应覆盖用户库。

## 内部 alpha 试用建议

1. 先确认首页可以打开。
2. 访问基础知识库内容，确认数据能正常读取。
3. 尝试收藏一条对象，确认用户写入能力可用。
4. 关闭服务前，保留 `logs/runtime.log`。
5. 如遇问题，运行 `diagnostics/` 目录下的诊断脚本，并把诊断 ZIP 和问题描述反馈给维护者。

## 排查问题

- 启动失败时，先查看 `logs/runtime.log`。
- macOS DMG 运行时，日志位于 `<所选父级保存位置>/SAPDWiki/Runtime/logs`。
- 需要发给维护人员时，运行 `diagnostics/` 目录下的诊断脚本导出诊断包。
- 诊断包默认不包含用户备注全文或 SQLite 数据库内容。
- 如果需要单独导出批注正文，请运行 `diagnostics/` 目录下的 `export-user-notes` 脚本；导出文件会写入 `data/exports/`。
- macOS 内部 alpha 未签名。如果出现“Apple 无法验证 SAPD-Wiki-Backend”，可在解压后的 ZIP 根目录运行 `xattr -dr com.apple.quarantine .` 后再启动。
{security_note}
"""


def build_bundle(args: argparse.Namespace) -> Path:
    output_dir = args.output_dir.resolve()
    bundle_root = output_dir / f"SAPD-Wiki-{version_for_bundle_name(args.bundle_version)}-{args.platform}"
    if bundle_root.exists():
        shutil.rmtree(bundle_root)
    if args.backend_executable and not args.backend_binary:
        args.backend_binary = args.backend_executable
    if not args.backend_binary and not args.allow_placeholder:
        raise ValueError("--backend-binary is required for a real ZIP. Use --allow-placeholder only for structure checks.")

    (bundle_root / "app" / "frontend-dist").mkdir(parents=True)
    (bundle_root / "data" / "base").mkdir(parents=True)
    (bundle_root / "data" / "user").mkdir(parents=True)
    (bundle_root / "config").mkdir(parents=True)
    (bundle_root / "logs").mkdir(parents=True)
    (bundle_root / "diagnostics").mkdir(parents=True)

    removed_frontend_originals: list[str] = []
    excluded_frontend_sources: list[str] = []
    frontend_source_sha256 = ""
    frontend_source_file_count = 0
    frontend_runtime_sha256 = ""
    frontend_runtime_file_count = 0
    if args.frontend_dist:
        frontend_input = args.frontend_dist.expanduser()
        reject_symbolic_links(frontend_input)
        frontend_source = frontend_input.resolve()
        frontend_source_sha256, frontend_source_file_count = tree_sha256(
            frontend_source,
            excluded_suffixes=FRONTEND_SOURCE_ARTIFACT_SUFFIXES,
        )
        copy_tree(frontend_source, bundle_root / "app" / "frontend-dist")
        excluded_frontend_sources = exclude_frontend_source_artifacts(
            bundle_root / "app" / "frontend-dist"
        )
        if args.content_asset_db:
            removed_frontend_originals = prepare_frontend_asset_runtime(
                bundle_root / "app" / "frontend-dist",
                args.content_asset_db.resolve(),
            )
        frontend_runtime_sha256, frontend_runtime_file_count = tree_sha256(
            bundle_root / "app" / "frontend-dist"
        )
    if args.backend_binary:
        backend_target = bundle_root / backend_name(args.platform)
        shutil.copy2(args.backend_binary.resolve(), backend_target)
        if not args.platform.startswith("win"):
            backend_target.chmod(backend_target.stat().st_mode | 0o755)
        backend_internal = args.backend_binary.resolve().parent / "_internal"
        if backend_internal.is_dir():
            copy_tree(backend_internal, bundle_root / "_internal")
    elif args.allow_placeholder:
        backend_target = bundle_root / backend_name(args.platform)
        write_text(
            backend_target,
            "This is a placeholder backend marker for structure checks only.\n",
        )
    if args.base_db:
        shutil.copy2(args.base_db.resolve(), bundle_root / "data" / "base" / "sapd_wiki_base.sqlite3")
    if args.content_asset_db:
        shutil.copy2(
            args.content_asset_db.resolve(),
            bundle_root / "data" / "base" / "sapd_content_assets.sqlite3",
        )
    if not args.skip_user_db:
        initialize_user_db(bundle_root / "data" / "user" / "sapd_wiki_user.sqlite3", args.user_schema_version)
    if args.maturity_report_seed:
        seed_root = args.maturity_report_seed.resolve()
        if not seed_root.is_dir():
            raise ValueError(f"--maturity-report-seed is not a directory: {seed_root}")
        copy_maturity_report_seed(
            seed_root,
            bundle_root / "data" / "user" / "maturity-reports",
            args.maturity_report_seed_artifact,
        )

    base_db = bundle_root / "data" / "base" / "sapd_wiki_base.sqlite3"
    content_asset_db = bundle_root / "data" / "base" / "sapd_content_assets.sqlite3"
    artifact_db_sha256 = sha256_file(base_db) if base_db.exists() else ""
    projection_identity = (
        build_release_projection_identity(
            base_database=base_db,
            artifact_db_sha256=artifact_db_sha256,
        )
        if base_db.exists()
        else {}
    )
    manifest = {
        "app_name": "SAPD Wiki",
        "app_version": args.app_version,
        "bundle_type": "zip-portable",
        "platform": args.platform,
        "build_time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **projection_identity,
        "base_database": {
            "file": "sapd_wiki_base.sqlite3",
            "data_version": args.data_version,
            "schema_version": args.base_schema_version,
            "sha256": artifact_db_sha256,
        },
        **(
            {
                "content_asset_database": {
                    "file": "sapd_content_assets.sqlite3",
                    "schema_version": args.content_asset_schema_version,
                    "sha256": sha256_file(content_asset_db),
                }
            }
            if content_asset_db.exists()
            else {}
        ),
        "user_database": {
            "file": "sapd_wiki_user.sqlite3",
            "schema_version": args.user_schema_version,
        },
        "frontend": {
            "version": args.app_version,
            "source_sha256": frontend_source_sha256,
            "source_file_count": frontend_source_file_count,
            "runtime_sha256": frontend_runtime_sha256,
            "runtime_file_count": frontend_runtime_file_count,
        },
        "backend": {"version": args.app_version},
        "package": {
            "placeholder_backend": bool(args.allow_placeholder and not args.backend_binary),
            "frontend_original_assets_removed": removed_frontend_originals,
            "frontend_source_artifacts_excluded": excluded_frontend_sources,
        },
    }
    write_text(bundle_root / "data" / "base" / "base-manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    write_text(
        bundle_root / "config" / "app-config.json",
        json.dumps(
            {
                "host": "127.0.0.1",
                "preferred_port": 18765,
                "fallback_ports": [18766, 18767, 18768],
                "open_browser_on_start": True,
                "log_file": "logs/runtime.log",
                "runtime_state_file": "logs/runtime-state.json",
                "startup_check_file": "logs/startup-check-result.json",
                "mcp_platform_integration": True,
                "mcp_port": 28775,
                "frontend_dist": "app/frontend-dist",
                "base_database": "data/base/sapd_wiki_base.sqlite3",
                **(
                    {
                        "content_asset_database": (
                            "data/base/sapd_content_assets.sqlite3"
                        )
                    }
                    if content_asset_db.exists()
                    else {}
                ),
                "user_database": "data/user/sapd_wiki_user.sqlite3",
                "diagnostics_dir": "diagnostics",
                "backend_binary": backend_name(args.platform),
                "platform": args.platform,
                "default_port": 18765,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
    )
    write_text(bundle_root / "logs" / ".gitkeep", "")
    write_text(bundle_root / "diagnostics" / ".gitkeep", "")
    write_text(
        bundle_root / "README-FIRST.md",
        readme_content(args.platform, args.app_version, placeholder=bool(args.allow_placeholder and not args.backend_binary)),
    )
    if args.platform.startswith("win"):
        shutil.copy2(WINDOWS_CHANGELOG, bundle_root / "CHANGELOG.md")
    if args.platform.startswith("win"):
        write_text(bundle_root / "start-windows.bat", windows_start_script().replace("\n", "\r\n"))
        write_text(bundle_root / "stop-windows.bat", windows_stop_script().replace("\n", "\r\n"))
        write_text(bundle_root / "diagnostics" / "export-diagnostics.bat", windows_diagnostics_script().replace("\n", "\r\n"))
        write_text(bundle_root / "diagnostics" / "export-user-notes.bat", windows_user_notes_export_script().replace("\n", "\r\n"))
    else:
        write_text(bundle_root / "start-macos.command", mac_start_script())
        write_text(bundle_root / "stop-macos.command", mac_stop_script())
        write_text(bundle_root / "diagnostics" / "export-diagnostics.command", mac_diagnostics_script())
        write_text(bundle_root / "diagnostics" / "export-user-notes.command", mac_user_notes_export_script())
        for script_path in [
            bundle_root / "start-macos.command",
            bundle_root / "stop-macos.command",
            bundle_root / "diagnostics" / "export-diagnostics.command",
            bundle_root / "diagnostics" / "export-user-notes.command",
        ]:
            script_path.chmod(script_path.stat().st_mode | 0o755)

    if args.make_zip:
        zip_path = output_dir / f"{bundle_root.name}.zip"
        if zip_path.exists():
            zip_path.unlink()
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for path in bundle_root.rglob("*"):
                archive.write(path, path.relative_to(output_dir))
                if path.is_file() and not args.platform.startswith("win") and os.access(path, os.X_OK):
                    info = archive.getinfo(str(path.relative_to(output_dir)))
                    info.external_attr = (0o755 & 0xFFFF) << 16
        return zip_path
    return bundle_root


def main() -> int:
    parser = argparse.ArgumentParser(description="Assemble a controlled SAPD Wiki desktop Runtime directory.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Bundle output directory. Default: {DEFAULT_OUTPUT_DIR}",
    )
    parser.add_argument("--platform", required=True, choices=sorted(SUPPORTED_PLATFORMS))
    parser.add_argument("--bundle-version", default="0.3.0")
    parser.add_argument("--app-version", default="0.3.0")
    parser.add_argument("--data-version", default="2026.05-alpha")
    parser.add_argument("--base-schema-version", default="base_schema_0.1")
    parser.add_argument(
        "--content-asset-schema-version",
        default="content-asset-schema-v1",
    )
    parser.add_argument("--user-schema-version", default="user_schema_0.3")
    parser.add_argument("--frontend-dist", type=Path)
    parser.add_argument("--backend-binary", type=Path, help="Platform-native backend binary for this ZIP.")
    parser.add_argument("--backend-executable", type=Path, help="Deprecated alias for --backend-binary.")
    parser.add_argument("--base-db", type=Path)
    parser.add_argument(
        "--content-asset-db",
        type=Path,
        help="Optional separate read-only content asset SQLite database.",
    )
    parser.add_argument(
        "--maturity-report-seed",
        type=Path,
        help="Copy controlled maturity report test artifacts into data/user/maturity-reports.",
    )
    parser.add_argument(
        "--maturity-report-seed-artifact",
        action="append",
        default=[],
        metavar="PROJECT_ID=ARTIFACT_ID",
        help="Copy only an explicitly selected report artifact; may be repeated.",
    )
    parser.add_argument("--skip-user-db", action="store_true", help="Do not pre-create sapd_wiki_user.sqlite3 in the ZIP.")
    parser.add_argument("--allow-placeholder", action="store_true", help="Allow a non-runnable structure-check bundle.")
    parser.add_argument("--make-zip", action="store_true")
    args = parser.parse_args()

    result = build_bundle(args)
    print(f"bundle={result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
