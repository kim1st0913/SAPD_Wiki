#!/usr/bin/env python3
"""Build a SAPD Wiki ZIP alpha bundle directory.

It expects caller-provided frontend assets, a platform-native backend binary,
and a base database. It does not run ETL.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import time
import zipfile
from pathlib import Path

from check_bundle_runtime import sha256_file
from create_user_db import initialize_user_db


SCRIPT_DIR = Path(__file__).resolve().parent
SUPPORTED_PLATFORMS = {"win-x64", "mac-arm64", "mac-x64"}
DEFAULT_BUNDLE_ROOT = Path(
    os.environ.get(
        "SAPD_WIKI_BUNDLE_ROOT",
        "/Users/kim1st/Documents/kim note/04_workspace/analysis/research/知识库工程/sapd wiki bundle",
    )
)
DEFAULT_OUTPUT_DIR = Path(os.environ.get("SAPD_WIKI_BUNDLE_OUTPUT_DIR", str(DEFAULT_BUNDLE_ROOT / "package-work")))


def copy_tree(source: Path, target: Path) -> None:
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(source, target)


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def backend_name(platform_name: str) -> str:
    return "SAPD-Wiki-Backend.exe" if platform_name.startswith("win") else "SAPD-Wiki-Backend"


def version_for_bundle_name(bundle_version: str) -> str:
    return bundle_version if bundle_version.startswith("v") else f"v{bundle_version}"


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


def readme_content(platform_name: str, placeholder: bool = False) -> str:
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
    return f"""# SAPD Wiki ZIP Alpha

本包是 SAPD Wiki Delivery Bundle 1.0-alpha 的分平台 ZIP 解压即用版。
{placeholder_note}
它不是安装包，不包含 `.dmg`、`.msi`、安装向导、自动更新或代码签名。

## 启动

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
- 用户数据：`data/user/sapd_wiki_user.sqlite3`，收藏、备注、个人标签和用户新增内容都写入这里。

基础库升级不应覆盖用户库。

## 内部 alpha 试用建议

1. 先确认首页可以打开。
2. 访问基础知识库内容，确认数据能正常读取。
3. 尝试收藏一条对象，确认用户写入能力可用。
4. 关闭服务前，保留 `logs/runtime.log`。
5. 如遇问题，运行 `diagnostics/` 目录下的诊断脚本，并把诊断 ZIP 和问题描述反馈给维护者。

## 排查问题

- 启动失败时，先查看 `logs/runtime.log`。
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

    if args.frontend_dist:
        copy_tree(args.frontend_dist.resolve(), bundle_root / "app" / "frontend-dist")
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
    if not args.skip_user_db:
        initialize_user_db(bundle_root / "data" / "user" / "sapd_wiki_user.sqlite3", args.user_schema_version)

    base_db = bundle_root / "data" / "base" / "sapd_wiki_base.sqlite3"
    manifest = {
        "app_name": "SAPD Wiki",
        "app_version": args.app_version,
        "bundle_type": "zip-portable",
        "platform": args.platform,
        "build_time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "base_database": {
            "file": "sapd_wiki_base.sqlite3",
            "data_version": args.data_version,
            "schema_version": args.base_schema_version,
            "sha256": sha256_file(base_db) if base_db.exists() else "",
        },
        "user_database": {
            "file": "sapd_wiki_user.sqlite3",
            "schema_version": args.user_schema_version,
        },
        "frontend": {"version": args.app_version},
        "backend": {"version": args.app_version},
        "package": {
            "placeholder_backend": bool(args.allow_placeholder and not args.backend_binary),
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
                "frontend_dist": "app/frontend-dist",
                "base_database": "data/base/sapd_wiki_base.sqlite3",
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
    write_text(bundle_root / "README-FIRST.md", readme_content(args.platform, placeholder=bool(args.allow_placeholder and not args.backend_binary)))
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
    parser = argparse.ArgumentParser(description="Build a minimal SAPD Wiki ZIP alpha bundle directory.")
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Bundle output directory. Default: {DEFAULT_OUTPUT_DIR}",
    )
    parser.add_argument("--platform", required=True, choices=sorted(SUPPORTED_PLATFORMS))
    parser.add_argument("--bundle-version", default="v0.1.0")
    parser.add_argument("--app-version", default="0.1.0-alpha")
    parser.add_argument("--data-version", default="2026.05-alpha")
    parser.add_argument("--base-schema-version", default="base_schema_0.1")
    parser.add_argument("--user-schema-version", default="user_schema_0.1")
    parser.add_argument("--frontend-dist", type=Path)
    parser.add_argument("--backend-binary", type=Path, help="Platform-native backend binary for this ZIP.")
    parser.add_argument("--backend-executable", type=Path, help="Deprecated alias for --backend-binary.")
    parser.add_argument("--base-db", type=Path)
    parser.add_argument("--skip-user-db", action="store_true", help="Do not pre-create sapd_wiki_user.sqlite3 in the ZIP.")
    parser.add_argument("--allow-placeholder", action="store_true", help="Allow a non-runnable structure-check bundle.")
    parser.add_argument("--make-zip", action="store_true")
    args = parser.parse_args()

    result = build_bundle(args)
    print(f"bundle={result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
