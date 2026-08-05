#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$APP_ROOT/../../.." && pwd)"
DIST_DIR="${SAPD_WIKI_DIST_DIR:-$APP_ROOT/dist}"
APP_NAME="SAPD Wiki"
APP_BUNDLE="$DIST_DIR/$APP_NAME.app"
APP_VERSION="${SAPD_WIKI_APP_VERSION:-0.4.0}"
export SAPD_WIKI_DISPLAY_VERSION="${SAPD_WIKI_DISPLAY_VERSION:-$APP_VERSION}"
BUILD_STAMP="${SAPD_WIKI_BUILD_STAMP:-$(date -u +%Y%m%d-%H%M%SZ)}"
ARCH="$(uname -m)"
DMG_VARIANT="${SAPD_WIKI_DMG_VARIANT:-all}"
MATURITY_REPORT_SEED="${SAPD_WIKI_MATURITY_REPORT_SEED:-$REPO_ROOT/data/user/maturity-reports}"
export SAPD_WIKI_MATURITY_REPORT_SEED="$MATURITY_REPORT_SEED"
BACKEND_BUILT_THIS_RUN=0
PACKAGE_LOCK_FILE="${SAPD_WIKI_PACKAGE_LOCK_DIR:-$APP_ROOT/.build/package-dmg.lock}"
PACKAGE_LOCK_STALE_SECONDS="${SAPD_WIKI_PACKAGE_LOCK_STALE_SECONDS:-21600}"
PACKAGE_CHILD_PID=""

prepare_package_lock_file() {
  local modified_at
  local now
  local age
  if [[ ! -d "$PACKAGE_LOCK_FILE" ]]; then
    return 0
  fi
  if find "$PACKAGE_LOCK_FILE" -mindepth 1 -print -quit | grep -q .; then
    echo "legacy package lock directory is not empty; refusing recovery: $PACKAGE_LOCK_FILE" >&2
    exit 1
  fi
  modified_at="$(stat -f %m "$PACKAGE_LOCK_FILE" 2>/dev/null || stat -c %Y "$PACKAGE_LOCK_FILE")"
  now="$(date +%s)"
  age=$((now - modified_at))
  if (( age < PACKAGE_LOCK_STALE_SECONDS )); then
    echo "legacy package lock directory lacks sufficient stale-time evidence: $PACKAGE_LOCK_FILE" >&2
    exit 1
  fi
  rmdir "$PACKAGE_LOCK_FILE"
  echo "recovered stale legacy package lock directory: $PACKAGE_LOCK_FILE" >&2
}

terminate_process_tree() {
  local parent_pid="$1"
  local child_pid
  local child_pids
  if ! kill -STOP "$parent_pid" 2>/dev/null; then
    return 0
  fi
  child_pids="$(pgrep -P "$parent_pid" 2>/dev/null || true)"
  for child_pid in $child_pids; do
    terminate_process_tree "$child_pid"
  done
  kill -TERM "$parent_pid" 2>/dev/null || true
  kill -CONT "$parent_pid" 2>/dev/null || true
}

terminate_package() {
  local exit_code="$1"
  trap - INT TERM
  if [[ -n "$PACKAGE_CHILD_PID" ]] && kill -0 "$PACKAGE_CHILD_PID" 2>/dev/null; then
    terminate_process_tree "$PACKAGE_CHILD_PID"
    wait "$PACKAGE_CHILD_PID" 2>/dev/null || true
  fi
  exit "$exit_code"
}

run_package_command() {
  local status
  "$@" &
  PACKAGE_CHILD_PID=$!
  if wait "$PACKAGE_CHILD_PID"; then
    status=0
  else
    status=$?
  fi
  PACKAGE_CHILD_PID=""
  return "$status"
}

if [[ "${SAPD_WIKI_INTERNAL_PACKAGE_LOCK_HELD:-0}" != "1" ]]; then
  prepare_package_lock_file
  mkdir -p "$(dirname "$PACKAGE_LOCK_FILE")"
  exec lockf -t 0 -k "$PACKAGE_LOCK_FILE" env \
    SAPD_WIKI_INTERNAL_PACKAGE_LOCK_HELD=1 \
    "$0" "$@"
fi
trap 'terminate_package 130' INT
trap 'terminate_package 143' TERM

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
  local mode_summary
  title="$(variant_title "$variant")"
  if [[ "$variant" == "license" ]]; then
    mode_summary="授权版保留现有授权窗口和 30 天试用流程。"
  else
    mode_summary="无授权版不显示授权窗口或 30 天倒计时。"
  fi

  cat >"$staging_dir/README-FIRST.md" <<README
# SAPD Wiki ${APP_VERSION} macOS 使用说明（${title}）

本 DMG 用于 SAPD Wiki macOS 内测交付。当前版本：${APP_VERSION}。当前包类型：${title}。

## Changelog

### 0.4.0

- 升级为 0.4.0 macOS ${title}测试包，同步当前最新前端、后端、正式基础查询库、内容资产库和成熟度评估测试数据。
- 成熟度评估新增自定义模板脑图工作台，支持分层展开、节点编辑、复制、移动、撤销 / 重做、模板导入导出和项目选模。
- 自定义评估点按来源加载当前对象专用或通用四维评分依据；服务评估点与平台工具参考继续执行固定角色规则。
- DMG 新增指向系统 \`/Applications\` 的安装入口，可将 \`SAPD Wiki.app\` 拖入“应用程序”完成安装。
- MCP 新 Runtime 默认端口保持 \`28775\`，已有本地控制库的端口与运行偏好优先加载。
- ${mode_summary}
- 当前仍为 ad-hoc signing、未 notarize 的内测包，不启用自动更新。

### 0.3.5

- 升级为 0.3.5 macOS ${title}测试包，同步当前最新前端、后端、正式基础查询库、内容资产库和成熟度评估测试数据。
- 优化“系统设置 > AI功能集成”的 MCP Runtime 控制与状态呈现。
- 恢复 macOS 登录钥匙串安全存储路径；钥匙串暂时不可访问时提示用户解锁，不再误判为证书永久失效。
- ${mode_summary}
- 当前仍为 ad-hoc signing、未 notarize 的内测包，不启用自动更新。

### 0.3.0

- 升级为 0.3.0 macOS 测试包；本次交付只生成无授权版，不显示授权窗口或 30 天倒计时。
- Runtime 同步当前最新前端、后端、正式基础查询库、内容资产库和成熟度评估测试数据。
- 新增本机 MCP Sidecar，可在“系统设置 > AI功能集成”中建立本机 HTTPS 连接、启动服务、确认客户端只读授权并查看审计。
- MCP 提供 \`search_knowledge\`、\`get_knowledge_object\`、\`get_related_knowledge\`、\`get_evidence\`、\`get_knowledge_version\` 五个只读工具。
- MCP 不读取用户批注、Issue、收藏、用户 SQLite、源文件、本地路径、密钥或不受限 SQL；授权与审计使用独立控制库。

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

1. 打开 DMG 后，将 \`SAPD Wiki.app\` 拖到镜像内的 \`Applications\` 图标完成安装。
2. 安装完成后请从 macOS“应用程序”中启动 SAPD Wiki，不要长期直接从 DMG 运行。
3. 首次打开如果 macOS 提示无法验证开发者，请到“系统设置 > 隐私与安全性”中允许打开。
4. App 会启动本地 SAPD Wiki 后端，并在内置窗口中打开工作台。

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

## MCP 配置说明

### 首次启用

1. 保持 SAPD Wiki App 正在运行，打开系统菜单“SAPD Wiki > 系统设置...”，进入“AI功能集成”。
2. 按页面提示建立本机安全连接。首次建立或轮换证书时，macOS 可能要求确认当前用户证书信任。
3. 点击“启动 MCP”，等待页面状态变为已就绪。端口只能在 MCP 停止时修改。
4. 点击“复制连接配置”。客户端配置应为：
   - 名称：\`SAPD Wiki\`
   - 类型：\`流式 HTTP\`（Streamable HTTP）
   - URL：使用设置页显示的完整 \`https://127.0.0.1:<端口>/mcp\`
   - Bearer Token：留空
   - Headers：留空
5. 在支持远程 MCP / Streamable HTTP 的客户端中添加该配置，并发起 OAuth 登录。不要手工生成或粘贴 Token。
6. 客户端发起授权后，返回 SAPD Wiki 的“AI功能集成”页面，核对客户端名称、回调地址和只读范围，然后点击允许。
7. 授权完成后，客户端应能看到五个只读工具：\`search_knowledge\`、\`get_knowledge_object\`、\`get_related_knowledge\`、\`get_evidence\`、\`get_knowledge_version\`。

### MCP 数据与排障

- MCP 地址只监听本机 \`127.0.0.1\`，SAPD Wiki App 退出后 MCP 服务也会停止。
- MCP 控制库位于 \`<所选父级保存位置>/SAPDWiki/Runtime/data/mcp/runtime/control/control.sqlite3\`，与用户数据库分离；不要手工修改或发送该目录。
- 本机证书材料位于 \`Runtime/data/mcp/certificates\`，私密材料由当前用户 Keychain 保护，不应复制到其他电脑。
- 如果连接失败，先确认 App 与 MCP 均在运行，再在设置页执行连接检查；修改端口、修复证书或撤销客户端后，重启对应 MCP 客户端。
- Access Token 默认有效 1 小时；Refresh Token 默认有效 30 天并执行轮换与复用检测。客户端应通过 OAuth 自动刷新，不应保存明文 Token。

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
3. 本次 ${APP_VERSION} 无授权变体请按 DMG 文件名和版本号核对测试包。

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
  local mode_summary
  title="$(variant_title "$variant")"
  if [[ "$variant" == "license" ]]; then
    mode_summary="授权版保留现有授权窗口和 30 天试用流程。"
  else
    mode_summary="无授权版不显示授权窗口或 30 天倒计时。"
  fi

  cat >"$runtime_readme" <<README
# SAPD Wiki ${APP_VERSION} Runtime 使用说明（${title}）

本 Runtime 由 macOS DMG 自动安装到用户选择的父级保存位置下的 \`SAPDWiki/Runtime\`。
当前版本：${APP_VERSION}。当前包类型：${title}。

## Changelog

### 0.4.0

- 升级为 0.4.0 Runtime，同步当前最新前端、后端、正式双库和成熟度评估测试数据。
- Runtime 包含自定义成熟度模板脑图编辑、模板 / 项目管理、评分依据来源跟随和 XLSX 交换能力。
- MCP 新 Runtime 默认端口保持 \`28775\`；已有 \`data/mcp/runtime/control/control.sqlite3\` 持久配置优先加载。
- 用户 SQLite 继续使用干净 \`user_schema_0.3\` 模板，不携带开发机批注、Issue、收藏或其他个人数据。
- ${mode_summary}

### 0.3.5

- 升级为 0.3.5 Runtime，同步当前最新前端、后端、正式基础查询库、内容资产库和成熟度评估测试数据。
- 优化 MCP Runtime 控制与状态投影，继续使用本机 HTTPS、OAuth 只读授权和独立审计控制库。
- macOS 安全存储继续使用登录钥匙串；暂时不可访问时提示用户解锁，不删除或重建健康证书。
- ${mode_summary}

### 0.3.0

- 升级为 0.3.0 Runtime；本次 macOS 交付只生成无授权版。
- 同步当前最新前端、后端、正式基础查询库、内容资产库和成熟度评估测试数据。
- Runtime 新增可持久化的本机 MCP Sidecar、HTTPS 证书生命周期、OAuth 客户端授权和独立审计控制库。
- MCP 只公开五个基础知识只读工具，不访问用户数据库、源文件、本地路径、密钥或不受限 SQL。

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

## MCP 配置说明

1. 在 App 的“系统设置 > AI功能集成”中建立本机安全连接并启动 MCP。
2. 使用设置页“复制连接配置”得到实际地址；客户端类型选择 Streamable HTTP，URL 为 \`https://127.0.0.1:<端口>/mcp\`，Bearer Token 与 Headers 均留空。
3. 客户端发起 OAuth 后，返回 App 设置页确认只读授权。授权完成后应出现 \`search_knowledge\`、\`get_knowledge_object\`、\`get_related_knowledge\`、\`get_evidence\`、\`get_knowledge_version\` 五个工具。
4. MCP 控制状态位于 \`data/mcp/runtime\`，证书材料位于 \`data/mcp/certificates\`；它们与 \`data/user/sapd_wiki_user.sqlite3\` 分离，升级 Runtime 时保留。
5. MCP 仅监听本机 \`127.0.0.1\`。连接失败时，先确认 App 与 MCP 正在运行，再检查证书、端口和客户端授权状态。
6. 不要手工配置 Bearer Token，不要发送 \`data/mcp\` 目录。Access Token 默认 1 小时，Refresh Token 默认 30 天并自动轮换。

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
3. 本次 ${APP_VERSION} 无授权变体请按 DMG 文件名和版本号核对测试包。

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
  local rebuild_backend
  license_mode="$(license_mode_for_variant "$variant")"
  output_dir="$DIST_DIR/$variant"
  staging_dir="$DIST_DIR/dmg-staging-$variant"
  dmg_path="$output_dir/SAPD-Wiki-${APP_VERSION}-${variant}-${BUILD_STAMP}-mac-${ARCH}.dmg"
  title="$(variant_title "$variant")"
  rebuild_backend="${SAPD_WIKI_REBUILD_BACKEND:-auto}"
  if [[ "$BACKEND_BUILT_THIS_RUN" == "1" ]]; then
    rebuild_backend=0
  fi
  if [[ -e "$dmg_path" || -L "$dmg_path" ]]; then
    echo "refusing to overwrite existing historical DMG: $dmg_path" >&2
    return 1
  fi

  run_package_command env \
    "SAPD_WIKI_LICENSE_MODE=$license_mode" \
    "SAPD_WIKI_REBUILD_BACKEND=$rebuild_backend" \
    SAPD_WIKI_INTERNAL_PACKAGE_LOCK_HELD=1 \
    "$SCRIPT_DIR/build_and_run.sh" build
  BACKEND_BUILT_THIS_RUN=1

  rm -rf "$staging_dir"
  mkdir -p "$staging_dir" "$output_dir"
  cp -R "$APP_BUNDLE" "$staging_dir/"
  ln -s /Applications "$staging_dir/Applications"
  if command -v xattr >/dev/null 2>&1; then
    xattr -cr "$staging_dir/$APP_NAME.app" >/dev/null 2>&1 || true
  fi

  write_readme "$staging_dir" "$variant"
  write_runtime_readme "$staging_dir" "$variant"
  resign_staged_app "$staging_dir/$APP_NAME.app"

  run_package_command hdiutil create \
    -volname "SAPD Wiki ${APP_VERSION} ${title}" \
    -srcfolder "$staging_dir" \
    -format UDZO \
    "$dmg_path" >/dev/null

  printf 'dmg_%s=%s\n' "${variant//-/_}" "$dmg_path"
}

assert_variant_output_available() {
  local variant="$1"
  local dmg_path="$DIST_DIR/$variant/SAPD-Wiki-${APP_VERSION}-${variant}-${BUILD_STAMP}-mac-${ARCH}.dmg"
  if [[ -e "$dmg_path" || -L "$dmg_path" ]]; then
    echo "refusing to overwrite existing historical DMG: $dmg_path" >&2
    return 1
  fi
}

NORMALIZED_DMG_VARIANT="$(normalize_variant "$DMG_VARIANT")"
case "$NORMALIZED_DMG_VARIANT" in
  all)
    assert_variant_output_available "license"
    assert_variant_output_available "no-license"
    ;;
  license) assert_variant_output_available "license" ;;
  no-license) assert_variant_output_available "no-license" ;;
esac

case "$NORMALIZED_DMG_VARIANT" in
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
