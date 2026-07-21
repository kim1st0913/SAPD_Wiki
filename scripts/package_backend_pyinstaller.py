#!/usr/bin/env python3
"""Package the ZIP alpha backend with PyInstaller.

PyInstaller is not a cross-platform cross-compiler. Run this script on the
target platform:

- macOS arm64 -> creates a macOS arm64 SAPD-Wiki-Backend
- macOS x64 -> creates a macOS x64 SAPD-Wiki-Backend
- Windows x64 -> creates SAPD-Wiki-Backend.exe
"""

from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_DIR = REPO_ROOT / "scripts"
ENTRYPOINT = SCRIPT_DIR / "run_local_server.py"


def current_platform() -> str:
    system = platform.system().lower()
    machine = platform.machine().lower()
    if system == "darwin" and machine in {"arm64", "aarch64"}:
        return "mac-arm64"
    if system == "darwin" and machine in {"x86_64", "amd64"}:
        return "mac-x64"
    if system == "windows" and machine in {"amd64", "x86_64"}:
        return "win-x64"
    return f"{system}-{machine}"


def binary_name(platform_name: str) -> str:
    return "SAPD-Wiki-Backend.exe" if platform_name.startswith("win") else "SAPD-Wiki-Backend"


def ensure_pyinstaller() -> None:
    result = subprocess.run(
        [sys.executable, "-m", "PyInstaller", "--version"],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "PyInstaller is not available for this Python. Install it first, "
            "for example: python -m pip install pyinstaller"
        )


def ensure_runtime_dependencies() -> None:
    result = subprocess.run(
        [sys.executable, "-c", "import openpyxl"],
        check=False,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "openpyxl is required for maturity XLSX import/export. "
            "Install project runtime dependencies first, for example: "
            "python -m pip install 'openpyxl>=3.1.0'"
        )


def add_data_arg(source: Path, destination: str) -> str:
    return f"{source}{os.pathsep}{destination}"


def package_backend(args: argparse.Namespace) -> Path:
    target_platform = args.platform or current_platform()
    actual_platform = current_platform()
    if args.require_native and target_platform != actual_platform:
        raise RuntimeError(
            f"PyInstaller must run on the target platform. "
            f"target={target_platform}; current={actual_platform}"
        )
    ensure_pyinstaller()
    ensure_runtime_dependencies()

    output_dir = args.output_dir.resolve()
    dist_dir = output_dir / "dist" / target_platform
    work_dir = output_dir / "build" / target_platform
    spec_dir = output_dir / "spec" / target_platform
    for path in [dist_dir, work_dir, spec_dir]:
        path.mkdir(parents=True, exist_ok=True)
    config_dir = output_dir / "pyinstaller-config"
    config_dir.mkdir(parents=True, exist_ok=True)

    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--clean",
        "--noconfirm",
        "--onedir",
        "--name",
        "SAPD-Wiki-Backend",
        "--collect-all",
        "openpyxl",
        "--paths",
        str(REPO_ROOT / "src"),
        "--paths",
        str(SCRIPT_DIR),
        "--add-data",
        add_data_arg(REPO_ROOT / "src" / "sapd_wiki" / "__init__.py", "runtime_src/sapd_wiki"),
        "--add-data",
        add_data_arg(REPO_ROOT / "src" / "sapd_wiki" / "paths.py", "runtime_src/sapd_wiki"),
        "--add-data",
        add_data_arg(REPO_ROOT / "src" / "sapd_wiki" / "api_server.py", "runtime_src/sapd_wiki"),
        "--add-data",
        add_data_arg(REPO_ROOT / "src" / "sapd_wiki" / "maturity.py", "runtime_src/sapd_wiki"),
        "--distpath",
        str(dist_dir),
        "--workpath",
        str(work_dir),
        "--specpath",
        str(spec_dir),
        str(ENTRYPOINT),
    ]
    env = dict(**os.environ, PYINSTALLER_CONFIG_DIR=str(config_dir))
    subprocess.run(command, check=True, env=env)

    produced_dir = dist_dir / "SAPD-Wiki-Backend"
    if not produced_dir.is_dir():
        raise FileNotFoundError(f"PyInstaller did not produce {produced_dir}")
    produced = produced_dir / binary_name(target_platform)
    if not produced.exists() and not target_platform.startswith("win"):
        produced = produced_dir / "SAPD-Wiki-Backend"
    if not produced.exists():
        raise FileNotFoundError(f"PyInstaller did not produce {produced}")

    final_dir = output_dir / "backend" / target_platform
    if final_dir.exists():
        shutil.rmtree(final_dir)
    shutil.copytree(produced_dir, final_dir)
    final_binary = final_dir / binary_name(target_platform)
    if not target_platform.startswith("win"):
        final_binary.chmod(final_binary.stat().st_mode | 0o755)
    return final_binary


def main() -> int:
    parser = argparse.ArgumentParser(description="Package SAPD Wiki ZIP alpha backend with PyInstaller.")
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--platform", choices=["mac-arm64", "mac-x64", "win-x64"])
    parser.add_argument(
        "--require-native",
        action="store_true",
        help="Fail if the requested platform does not match the current machine.",
    )
    args = parser.parse_args()

    binary = package_backend(args)
    print(f"backend_binary={binary}")
    print(f"platform={args.platform or current_platform()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
