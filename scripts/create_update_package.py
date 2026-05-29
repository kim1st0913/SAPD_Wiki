#!/usr/bin/env python3
"""Create a ZIP alpha update package from one platform ZIP to another.

The update package is a conservative internal-alpha artifact: it carries only
changed files plus a manifest and an optional macOS apply script. It must not
include user databases, logs, or diagnostics output.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import tempfile
import time
import zipfile
from pathlib import Path
from typing import Any


SKIPPED_PREFIXES = (
    "data/user/",
    "logs/",
)
SKIPPED_NAMES = {".DS_Store"}


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def extract_zip(zip_path: Path, target: Path) -> Path:
    with zipfile.ZipFile(zip_path) as archive:
        archive.extractall(target)
    roots = [path for path in target.iterdir() if path.is_dir()]
    if len(roots) != 1:
        raise RuntimeError(f"{zip_path} should contain exactly one bundle root directory")
    return roots[0]


def should_skip(relative: Path) -> bool:
    normalized = relative.as_posix()
    if relative.name in SKIPPED_NAMES:
        return True
    return any(normalized == prefix.rstrip("/") or normalized.startswith(prefix) for prefix in SKIPPED_PREFIXES)


def file_map(root: Path) -> dict[str, Path]:
    rows: dict[str, Path] = {}
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        if should_skip(relative):
            continue
        rows[relative.as_posix()] = path
    return rows


def readme_update(bundle_name: str) -> str:
    return f"""# SAPD Wiki ZIP Alpha Update Package

本包是内部 alpha update 包，不是完整安装包，也不是 `.dmg` / `.msi`。

## 适用对象

- 目标目录：`{bundle_name}/`
- 用途：把上一版 ZIP 解压目录更新到当前 ZIP 内容。
- 不包含：`data/user/`、`logs/`、用户备注全文、用户数据库原文件。

## macOS 使用方式

1. 先关闭正在运行的 `SAPD-Wiki-Backend`。
2. 解压本 update 包。
3. 把 update 包目录和 `{bundle_name}` 放在同一级目录。
4. 双击或终端运行 `apply-update-macos.command`。
5. 如 macOS 提示权限问题，执行：

```sh
chmod +x apply-update-macos.command
./apply-update-macos.command
```

也可以手工把 `files/` 目录中的内容覆盖复制到 `{bundle_name}/`。

## 注意

- 更新前建议备份 `{bundle_name}/data/user/sapd_wiki_user.sqlite3`。
- 不要删除 `data/user/`，否则会丢失本机收藏、备注和标签。
- 如果 macOS 提示 Apple 无法验证 `SAPD-Wiki-Backend`，可在完整 bundle 根目录执行：

```sh
xattr -dr com.apple.quarantine .
```
"""


def mac_apply_script(bundle_name: str) -> str:
    return f"""#!/bin/sh
DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET="${{1:-"$DIR/../{bundle_name}"}}"
if [ ! -d "$TARGET" ]; then
  echo "Target bundle not found: $TARGET"
  echo "Usage: ./apply-update-macos.command /path/to/{bundle_name}"
  exit 1
fi
if [ ! -d "$DIR/files" ]; then
  echo "Update files directory is missing: $DIR/files"
  exit 1
fi
echo "Applying update to: $TARGET"
ditto "$DIR/files" "$TARGET"
chmod +x "$TARGET/start-macos.command" "$TARGET/SAPD-Wiki-Backend" 2>/dev/null || true
echo "Update complete."
"""


def write_zip(source_dir: Path, zip_path: Path) -> None:
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in source_dir.rglob("*"):
            archive.write(path, path.relative_to(source_dir.parent))
            if path.is_file() and path.name.endswith(".command"):
                info = archive.getinfo(str(path.relative_to(source_dir.parent)))
                info.external_attr = (0o755 & 0xFFFF) << 16


def create_update_package(args: argparse.Namespace) -> Path:
    old_zip = args.old_zip.resolve()
    new_zip = args.new_zip.resolve()
    output_dir = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="sapd-update-") as temp_name:
        temp_dir = Path(temp_name)
        old_root = extract_zip(old_zip, temp_dir / "old")
        new_root = extract_zip(new_zip, temp_dir / "new")
        if old_root.name != new_root.name:
            raise RuntimeError(f"bundle root mismatch: {old_root.name} != {new_root.name}")

        old_files = file_map(old_root)
        new_files = file_map(new_root)
        changed: list[str] = []
        added: list[str] = []
        deleted: list[str] = []

        package_name = args.package_name or f"{new_root.name}-update-from-{sha256_file(old_zip)[:8]}-to-{sha256_file(new_zip)[:8]}"
        package_root = temp_dir / package_name
        files_root = package_root / "files"
        files_root.mkdir(parents=True)

        for relative, new_path in sorted(new_files.items()):
            old_path = old_files.get(relative)
            if old_path is None:
                added.append(relative)
            elif sha256_file(old_path) != sha256_file(new_path):
                changed.append(relative)
            else:
                continue
            target = files_root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(new_path, target)

        for relative in sorted(set(old_files) - set(new_files)):
            deleted.append(relative)

        manifest: dict[str, Any] = {
            "package_type": "zip-alpha-update",
            "created_at": now_iso(),
            "target_bundle_name": new_root.name,
            "from_zip": old_zip.name,
            "from_zip_sha256": sha256_file(old_zip),
            "to_zip": new_zip.name,
            "to_zip_sha256": sha256_file(new_zip),
            "changed_files": changed,
            "added_files": added,
            "deleted_files": deleted,
            "skipped_prefixes": list(SKIPPED_PREFIXES),
            "notes": [
                "Update package excludes user DB, logs, and diagnostics outputs.",
                "Deleted files are recorded but not removed automatically in this alpha package.",
            ],
        }
        write_text(package_root / "update-manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        write_text(package_root / "README-UPDATE.md", readme_update(new_root.name))
        apply_script = package_root / "apply-update-macos.command"
        write_text(apply_script, mac_apply_script(new_root.name))
        apply_script.chmod(apply_script.stat().st_mode | 0o755)

        zip_path = output_dir / f"{package_name}.zip"
        write_zip(package_root, zip_path)
        write_text(zip_path.with_suffix(".sha256"), f"{sha256_file(zip_path)}  {zip_path.name}\n")
        return zip_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Create a SAPD Wiki ZIP alpha update package.")
    parser.add_argument("--old-zip", type=Path, required=True)
    parser.add_argument("--new-zip", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--package-name", help="Optional update package root name.")
    args = parser.parse_args()

    result = create_update_package(args)
    print(f"update_zip={result}")
    print(f"update_sha256={result.with_suffix('.sha256')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
