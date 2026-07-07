# macOS DMG 与 5173 开发版一致性契约

本文档固定 SAPD Wiki macOS DMG 与本地浏览器开发版 `http://127.0.0.1:5173/` 的一致性口径。目标不是让两者运行外壳完全一样，而是保证用户看到的业务内容、数据口径、页面逻辑和核心工作流来自同一构建输入。

## 本质规则

DMG 是当前工作区的一次发布快照，不是实时读取开发目录。打包完成后，5173 后续变化不会自动进入已生成 DMG。每次发布前必须重新打包并复验。

## 必须一致

| 范围 | 权威源 | 当前打包流程 | 验收口径 |
|---|---|---|---|
| 前端页面代码 | `frontend/capability-browser` | `build_and_run.sh` 将该目录复制到 Runtime 的 `app/frontend-dist` | DMG Runtime 前端文件来自同一目录；同一 smoke 用例在 5173 和 DMG Runtime 均通过 |
| 后端运行代码 | `scripts/run_local_server.py`、`scripts/check_bundle_runtime.py`、`scripts/create_user_db.py`、`scripts/export_diagnostics.py`、`src/sapd_wiki/**/*.py` | PyInstaller 从当前源码生成 `SAPD-Wiki-Backend` | backend source hash 变化必须触发重建；不允许默认复用外部 backend |
| 基础库 | `data/database/sapd_wiki.sqlite3` | `build_zip_bundle.py` 复制为 Runtime `data/base/sapd_wiki_base.sqlite3` | manifest hash 与包内 base DB hash 一致 |
| 前端离线数据包 | `frontend/capability-browser/public/data/**` | 随前端目录一起复制进 Runtime | JSON 边界审计通过；关键数据页面 smoke 通过 |
| 用户库 schema 模板 | `scripts/create_user_db.py` | Runtime 内生成干净 `sapd_wiki_user.sqlite3` | 包内用户库为空，`schema_version=user_schema_0.3` |
| 核心业务工作流 | 5173 + Runtime API | 先验 5173，再验 DMG Runtime | 搜索、能力映射、标准页、批注导出、Issue 工作台等关键路径使用同一组样例 |

## 允许差异

| 差异 | 当前流程 | 影响 | 是否可接受 |
|---|---|---|---|
| 外壳 | 5173 用系统浏览器；DMG 用 macOS Swift wrapper + WebView | 窗口、菜单、关闭 / 最小化行为不同 | 可接受，属于桌面交付体验 |
| 授权 | 5173 无授权门禁；DMG 分 `license` / `no-license` 两包 | 授权版启动前有授权 / 试用窗口，无授权版无窗口 | 可接受，属于交付变体，不应影响业务页面数据 |
| 用户库 | 5173 使用开发本地用户库；DMG 首次初始化使用用户选择保存位置下的新用户库 | 批注、收藏、Issue、导出历史不一致 | 可接受，必须不同；DMG 不能携带开发机用户数据 |
| 保存 / 下载路径 | 5173 依赖开发目录；DMG 使用用户选择的 `SAPDWiki/Runtime` 和 `SAPDWiki/export` | 导出文件位置不同 | 可接受，属于普通用户交付边界 |
| 签名与 Gatekeeper | 5173 不涉及；当前 DMG ad-hoc signed、未公证 | 外部分发可能需要手动允许打开 | 可接受于内测；正式外部分发前需签名和 notarization |
| 已生成 DMG 与工作区后续变化 | DMG 固化打包时刻的快照 | 打包后再改代码 / 数据不会进入旧 DMG | 可接受，但发布前必须重打包 |

## 当前流程差异与影响判断

| 差异项 | 当前状态 | 影响 | 结论 |
|---|---|---|---|
| 不是实时同步 5173 | DMG 复制当前目录快照 | 旧 DMG 不会自动获得后续修复 | 可接受，发布前重打包解决 |
| backend 默认 `auto` 重建 | 通过 source hash 判断是否复用已有 PyInstaller 产物 | 若 hash 漏掉 helper 脚本，会复用旧 backend | 已补齐 helper 脚本 hash，发布仍建议 `SAPD_WIKI_REBUILD_BACKEND=1` |
| 双变体打包 | `package_dmg.sh` 默认生成 `license` 和 `no-license` | 两包授权状态不同 | 可接受，业务页面应一致 |
| 用户库不同 | DMG 包内空库，运行后用户选择保存位置 | 不能复用开发批注和收藏 | 可接受，且必须如此 |
| WebView 与浏览器差异 | DMG 用 WKWebView | 少数交互、滚动和窗口行为需单独验收 | 可接受，但工作台滚动、导出路径、授权状态必须进入 DMG 验收 |

## 不可接受

- 打包时使用未确认的外部 backend。
- 5173 通过后不验 DMG Runtime。
- 旧 DMG 当成最新工作区交付。
- DMG 包内带开发机用户批注、收藏、Issue 或导出历史。
- 正式发布前不检查 base DB hash、用户库 schema 和授权模式。
- 直接在签名后的 `.app/Contents/Resources/Runtime` 内运行后端写日志或导出文件，导致封签被破坏。

## 发布前验收闸门

1. 5173 开发态验证：
   - `python3 scripts/dev_server_guard.py --status`
   - `node scripts/frontend_content_smoke_check.mjs --url http://127.0.0.1:5173`
   - 关键页面 / 搜索轻量 smoke。
2. 边界审计：
   - `python3 scripts/audit_json_package_boundary.py`
   - `python3 scripts/check_github_data_boundary.py`
   - `node scripts/audit_mac_dmg_browser_parity_contract.mjs`
3. DMG 构建：
   - `SAPD_WIKI_REBUILD_BACKEND=1 apps/macos/SAPDWiki/script/package_dmg.sh`
4. DMG 产物验收：
   - 两个 DMG 均 `hdiutil verify`。
   - staging `.app` 均 `codesign --verify --deep --strict`。
   - `Info.plist` 版本、`SAPDWikiLicenseMode`、`SAPDWikiDisplayVersion` 正确。
   - 包内用户库 `user_notes=0` 且 `schema_version=user_schema_0.3`。
   - 从 DMG Runtime 复制到临时目录后执行 `SAPD-Wiki-Backend --check-only` 和必要 API smoke。
   - 授权版 / 无授权版只允许授权状态不同，核心页面和数据一致。

## 固定结论

当前差异可接受，前提是严格执行上述验收闸门。DMG 与 5173 的一致性定义为“同源构建输入 + 同业务验收样例通过 + 交付层差异进入白名单”，而不是窗口外壳、用户库内容、授权门禁和文件路径完全相同。
