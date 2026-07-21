#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/../../.." && pwd)"
DIST_DIR="$APP_ROOT/dist"
APP_NAME="SAPD Wiki"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
APP_VERSION="${SAPD_WIKI_APP_VERSION:-0.2.0}"
export SAPD_WIKI_DISPLAY_VERSION="${SAPD_WIKI_DISPLAY_VERSION:-$APP_VERSION}"
BUILD_STAMP="${SAPD_WIKI_BUILD_STAMP:-$(date -u +%Y%m%d-%H%M%SZ)}"
ARCH="$(uname -m)"
DMG_VARIANT="${SAPD_WIKI_DMG_VARIANT:-all}"
MATURITY_REPORT_SEED="${SAPD_WIKI_MATURITY_REPORT_SEED:-$REPO_ROOT/data/user/maturity-reports}"
export SAPD_WIKI_MATURITY_REPORT_SEED="$MATURITY_REPORT_SEED"

if [[ ! -d "$MATURITY_REPORT_SEED" ]]; then
  echo "maturity report seed does not exist: $MATURITY_REPORT_SEED" >&2
  exit 1
fi

normalize_variant() {
  case "$1" in
    all) printf '%s\n' "all" ;;
    license|licensed) printf '%s\n' "license" ;;
    no-license|nolicense|unlicensed|open) printf '%s\n' "no-license" ;;
    *)
      echo "unsupported SAPD_WIKI_DMG_VARIANT=$1; use all, license, or no-license" >&2
      exit 1
      ;;
  esac
}

variant_title() {
  case "$1" in
    license) printf '%s\n' "授权版" ;;
    no-license) printf '%s\n' "无授权版" ;;
  esac
}

license_mode_for_variant() {
  case "$1" in
    license) printf '%s\n' "license" ;;
    no-license) printf '%s\n' "no-license" ;;
  esac
}

write_readme() {
  local staging_dir="$1"
  local variant="$2"
  local title
  title="$(variant_title "$variant")"

  cat >"$staging_dir/README-FIRST.md" <<README
# SAPD Wiki ${APP_VERSION} macOS 使用说明（${title}）

本 DMG 用于 SAPD Wiki macOS 内测交付。当前版本：${APP_VERSION}。当前包类型：${title}。

## Changelog

### 0.2.0

- 升级为 0.2.0 双版本测试包，授权版与无授权版使用同一构建时间戳。
- 包含当前成熟度评估完整运行模块，以及 2 个受控测试案例：1 个已完成、1 个正在进行。
- 仅已完成案例携带 1 份与当前评分哈希一致的正式报告；进行中案例不携带报告。
- 成熟度报告作为首次安装测试种子写入 \`Runtime/data/user/maturity-reports\`；已有报告目录不会被覆盖。
- 用户 SQLite 继续使用干净模板，不携带开发机批注、Issue、收藏或其他个人数据。
- 用户目录统一为 \`SAPDWiki/import\`、\`SAPDWiki/export\` 和 \`SAPDWiki/Runtime\`；导出按报告、评分表、模板、Issue 和诊断包分类保存。

### 0.1.7

- 基于当前最新工作区重新打包，便于后续验证。
- 授权版和无授权版继续同版本、同时间戳、分目录交付。
- 保存位置继续使用父级目录规则，App 自动创建 \`SAPDWiki/Runtime\` 和 \`SAPDWiki/export\`。
- 本版本仍按内测交付处理，不启用正式签名公证、安装器或自动更新机制。

### 0.1.6

- 按最新打包要求同时生成授权版和无授权版 DMG。
- 授权版和无授权版使用同一版本号与构建时间戳，文件名和存储目录分别带 \`license\` / \`no-license\`。
- 保存位置选择改为父级目录，App 自动创建 \`SAPDWiki/Runtime\` 和 \`SAPDWiki/export\`。
- \`README-FIRST.md\` 增加 Changelog，后续打包持续记录版本变化。

## 安装与启动

1. 可以把 \`SAPD Wiki.app\` 拖到“应用程序”，也可以直接从 DMG 中双击运行。
2. 首次打开如果 macOS 提示无法验证开发者，请到“系统设置 > 隐私与安全性”中允许打开。
3. App 会启动本地 SAPD Wiki 后端，并在内置窗口中打开工作台。

## 首次初始化注意事项

1. 首次启动会要求设置“保存位置”，这里选择的是父级目录。
2. App 会在所选父级目录下创建 \`SAPDWiki\` 文件夹。
3. 用户数据库路径为：\`<所选父级保存位置>/SAPDWiki/Runtime/data/user/sapd_wiki_user.sqlite3\`。
4. 默认导入路径为：\`<所选父级保存位置>/SAPDWiki/import\`；文件选择器也允许临时选择其他位置。
5. 默认导出路径为：\`<所选父级保存位置>/SAPDWiki/export\`，可以在“SAPD Wiki > 系统设置...”中修改。
6. 后续安装新版 App 时，默认继续加载当前 \`SAPDWiki\` 文件夹下已有的用户数据库，不会覆盖已有 Issue 和用户数据。
7. 除非已经备份，不要手动删除或移动 \`SAPDWiki/Runtime/data/user\`。

## 成熟度评估测试数据

1. 当前包内置 2 个受控测试案例：1 个正在进行、1 个已完成。
2. 已完成案例内置 1 份对应的正式报告，用于验证报告预览、历史读取和 Markdown / HTML 下载；进行中案例用于验证完成度、状态和结果门禁。
3. 首次初始化时，测试报告会写入 \`SAPDWiki/Runtime/data/user/maturity-reports\`。
4. 如果该目录已经存在，App 会保留用户已有报告，不用包内测试报告覆盖。
5. 成熟度项目的本机编辑仍保存在 App 的浏览器本地存储中，不写入用户 SQLite。

README

  if [[ "$variant" == "license" ]]; then
    cat >>"$staging_dir/README-FIRST.md" <<README
## 授权与试用

1. 每次打开 App 时会先显示授权窗口。
2. 如果暂时不知道授权码，可以点击“跳过输入”进入 30 天试用。
3. 试用期内，窗口顶部会显示使用有效期和剩余天数。
4. 试用到期后不能继续跳过，必须输入维护者提供的正确授权码。
5. 授权成功后，窗口顶部会显示“已激活”，后续不再受试用期限制。

README
  else
    cat >>"$staging_dir/README-FIRST.md" <<README
## 授权说明

1. 当前包为无授权版，不显示授权输入窗口。
2. 当前包不启用 30 天试用倒计时，适合内部无授权测试。
3. 请不要和授权版混发；对外测试优先使用 \`license\` 包。

README
  fi

  cat >>"$staging_dir/README-FIRST.md" <<README
## 导出与文件位置

- 评估报告、评分表、模板、Issue 和诊断包分别写入 \`export/maturity-reports\`、\`export/maturity-scores\`、\`export/maturity-templates\`、\`export/issues\` 和 \`export/diagnostics\`。
- 当前“本地工作目录”“默认导入文件夹”“导出文件夹”和“系统数据”可在系统菜单“SAPD Wiki > 系统设置...”中查看；前三项可修改。
- Runtime 日志位于：\`<所选父级保存位置>/SAPDWiki/Runtime/logs\`。

## 关闭与退出

- 点击窗口红色关闭按钮会隐藏主窗口，App 继续在后台保留。
- 需要完全退出时，请使用系统菜单“SAPD Wiki > 退出 SAPD Wiki”。

## 反馈问题

如果启动失败或页面异常，请保留问题截图，并把以下信息一并反馈：

- 当前版本：${APP_VERSION}
- 包类型：${title}
- DMG 文件名
- \`SAPDWiki/Runtime/logs\` 下的日志文件
README
}

write_runtime_readme() {
  local staging_dir="$1"
  local variant="$2"
  local runtime_readme="$staging_dir/$APP_NAME.app/Contents/Resources/Runtime/README-FIRST.md"
  local title
  title="$(variant_title "$variant")"

  cat >"$runtime_readme" <<README
# SAPD Wiki ${APP_VERSION} Runtime 使用说明（${title}）

本 Runtime 由 macOS DMG 自动安装到用户选择的父级保存位置下的 \`SAPDWiki/Runtime\`。
当前版本：${APP_VERSION}。当前包类型：${title}。

## Changelog

### 0.2.0

- 升级为 0.2.0 双版本测试 Runtime。
- Runtime 包含当前成熟度评估前端、后端、基础能力数据，以及 2 个受控测试案例（1 个已完成、1 个正在进行）。
- 仅已完成案例携带 1 份与当前评分哈希一致的正式报告。
- 成熟度报告测试种子仅在目标目录不存在时复制，已有用户报告保持不变。
- 用户 SQLite 继续使用干净模板，不携带开发机批注、Issue、收藏或其他个人数据。
- 用户可见文件按 \`import\` 和分类 \`export\` 管理，Runtime 只保留系统数据库、报告历史和日志。

### 0.1.7

- 基于当前最新工作区重新打包，便于后续验证。
- 授权版和无授权版继续生成同版本 Runtime。
- Runtime 默认安装到 \`SAPDWiki/Runtime\`，导出目录默认为 \`SAPDWiki/export\`。
- 本版本仍按内测交付处理，不启用正式签名公证、安装器或自动更新机制。

### 0.1.6

- 跟随 macOS DMG 生成授权版和无授权版 Runtime。
- Runtime 默认安装到 \`SAPDWiki/Runtime\`，导出目录默认为 \`SAPDWiki/export\`。
- \`README-FIRST.md\` 增加 Changelog，方便测试和交付追踪版本变化。

## macOS DMG 初始化注意事项

1. 首次启动会要求设置“保存位置”，这里选择的是父级目录。
2. App 会在所选父级目录下创建 \`SAPDWiki\` 文件夹。
3. 用户数据库路径为：\`<所选父级保存位置>/SAPDWiki/Runtime/data/user/sapd_wiki_user.sqlite3\`。
4. 默认导入路径为：\`<所选父级保存位置>/SAPDWiki/import\`。
5. 默认导出路径为：\`<所选父级保存位置>/SAPDWiki/export\`，可在“SAPD Wiki > 系统设置...”中修改。
6. 后续安装新版 App 时，默认复用 \`SAPDWiki\` 文件夹下已有用户数据库，不覆盖已有 Issue 和用户数据。
7. 除非已经备份，不要手动删除或移动 \`SAPDWiki/Runtime/data/user\`。

## 成熟度评估测试数据

1. 受控测试案例由当前 \`capability-workbench\` 和成熟度 V2.1 后端生成，共 2 个案例：1 个正在进行、1 个已完成。
2. 当前报告种子位于 \`data/user/maturity-reports\`，打包时只选择已完成案例的 1 份哈希匹配报告工件。
3. 首次初始化会复制这些报告；目标报告目录已存在时不覆盖。
4. 用户 SQLite 仍为空库模板，成熟度测试报告与批注、Issue 等用户数据保持分离。

README

  if [[ "$variant" == "license" ]]; then
    cat >>"$runtime_readme" <<README
## 授权与试用

1. 当前包为授权版，每次打开 App 时会先显示授权窗口。
2. 如果暂时不知道授权码，可以点击“跳过输入”进入 30 天试用。
3. 试用期内，窗口顶部会显示使用有效期和剩余天数。
4. 试用到期后不能继续跳过，必须输入维护者提供的正确授权码。
5. 授权成功后，窗口顶部会显示“已激活”，后续不再受试用期限制。

README
  else
    cat >>"$runtime_readme" <<README
## 授权说明

1. 当前包为无授权版，不显示授权输入窗口。
2. 当前包不启用 30 天试用倒计时，适合内部无授权测试。
3. 请不要和授权版混发；对外测试优先使用 \`license\` 包。

README
  fi

  cat >>"$runtime_readme" <<README
## 数据位置

- 基础知识库：\`data/base/sapd_wiki_base.sqlite3\`，普通用户不应修改。
- 用户数据：\`data/user/sapd_wiki_user.sqlite3\`，收藏、备注、个人标签和用户新增内容都写入这里。
- macOS DMG 首次初始化后，真实用户数据位于用户选择的父级保存位置下的 \`SAPDWiki/Runtime/data/user/sapd_wiki_user.sqlite3\`。

基础库升级不应覆盖用户库。

## 排查问题

- 启动失败时，先查看 \`logs/runtime.log\`。
- macOS DMG 运行时，日志位于 \`<所选父级保存位置>/SAPDWiki/Runtime/logs\`。
- 需要发给维护人员时，运行 \`diagnostics/\` 目录下的诊断脚本导出诊断包。
- 诊断包默认不包含用户备注全文或 SQLite 数据库内容。
- 如果需要单独导出批注正文，请运行 \`diagnostics/\` 目录下的 \`export-user-notes\` 脚本；导出文件会写入当前文件下载路径。
README
}

resign_staged_app() {
  local staged_app="$1"
  local identity="${SAPD_WIKI_CODESIGN_IDENTITY:--}"
  if [[ "$identity" == "-" ]]; then
    codesign --force --deep --sign "$identity" "$staged_app" >/dev/null
  else
    codesign --force --deep --options runtime --timestamp --sign "$identity" "$staged_app" >/dev/null
  fi
}

build_variant() {
  local variant="$1"
  local license_mode
  local output_dir
  local staging_dir
  local dmg_path
  local title
  license_mode="$(license_mode_for_variant "$variant")"
  output_dir="$DIST_DIR/$variant"
  staging_dir="$DIST_DIR/dmg-staging-$variant"
  dmg_path="$output_dir/SAPD-Wiki-${APP_VERSION}-${variant}-${BUILD_STAMP}-mac-${ARCH}.dmg"
  title="$(variant_title "$variant")"

  SAPD_WIKI_LICENSE_MODE="$license_mode" "$SCRIPT_DIR/build_and_run.sh" build

  rm -rf "$staging_dir"
  mkdir -p "$staging_dir" "$output_dir"
  cp -R "$APP_BUNDLE" "$staging_dir/"
  if command -v xattr >/dev/null 2>&1; then
    xattr -cr "$staging_dir/$APP_NAME.app" >/dev/null 2>&1 || true
  fi

  write_readme "$staging_dir" "$variant"
  write_runtime_readme "$staging_dir" "$variant"
  resign_staged_app "$staging_dir/$APP_NAME.app"

  rm -f "$dmg_path"
  hdiutil create \
    -volname "SAPD Wiki ${APP_VERSION} ${title}" \
    -srcfolder "$staging_dir" \
    -ov \
    -format UDZO \
    "$dmg_path" >/dev/null

  printf 'dmg_%s=%s\n' "${variant//-/_}" "$dmg_path"
}

case "$(normalize_variant "$DMG_VARIANT")" in
  all)
    build_variant "license"
    build_variant "no-license"
    ;;
  license)
    build_variant "license"
    ;;
  no-license)
    build_variant "no-license"
    ;;
esac
