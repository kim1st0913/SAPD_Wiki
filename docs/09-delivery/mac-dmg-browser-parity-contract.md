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
| 内容资产库 | `data/database/sapd_content_assets.sqlite3` | 文件存在时由 `build_zip_bundle.py` 复制为 Runtime `data/base/sapd_content_assets.sqlite3` | manifest hash 与包内资产库 hash 一致；App 只经受控 asset API 读取，MCP 不读 BLOB |
| 前端离线数据包 | `frontend/capability-browser/public/data/**` | 随前端目录一起复制进 Runtime | JSON 边界审计通过；关键数据页面 smoke 通过 |
| 用户库 schema 模板 | `scripts/create_user_db.py` | Runtime 内生成干净 `sapd_wiki_user.sqlite3` | 包内用户库为空，`schema_version=user_schema_0.3` |
| 核心业务工作流 | 5173 + Runtime API | 先验 5173，再验 DMG Runtime | 搜索、能力映射、标准页、批注导出、Issue 工作台等关键路径使用同一组样例 |

## 允许差异

| 差异 | 当前流程 | 影响 | 是否可接受 |
|---|---|---|---|
| 外壳 | 5173 用系统浏览器；DMG 用 macOS Swift wrapper + WebView | 窗口、菜单、关闭 / 最小化行为不同 | 可接受，属于桌面交付体验 |
| 授权 | 5173 无授权门禁；DMG 分 `license` / `no-license` 两包 | 授权版启动前有授权 / 试用窗口，无授权版无窗口 | 可接受，属于交付变体，不应影响业务页面数据 |
| 用户库 | 5173 使用开发本地用户库；DMG 首次初始化使用用户选择保存位置下的新用户库 | 批注、收藏、Issue、导出历史不一致 | 可接受，必须不同；DMG 不能携带开发机用户数据 |
| 本地目录 | 5173 依赖开发目录；DMG 使用用户选择的 `SAPDWiki/import`、分类 `SAPDWiki/export` 和内部 `SAPDWiki/Runtime` | 导入起始位置、导出文件位置不同 | 可接受，属于普通用户交付边界 |
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

## 架构分层差异

`5173` 和 macOS DMG 不是同一个浏览器宿主。

| 层级 | 5173 开发版 | macOS DMG | 审计重点 |
|---|---|---|---|
| 页面宿主 | 用户系统浏览器访问 `http://127.0.0.1:5173/` | 原生 `NSWindow` 内嵌 `WKWebView`，由 wrapper 加载本地后端 URL | 不能用系统浏览器通过来推断 WKWebView 通过 |
| 后端启动 | 开发态 Python 服务常驻 5173 | wrapper 复制 Runtime 后启动 `SAPD-Wiki-Backend --bundle-root <Runtime> --no-browser` | Runtime 路径、端口、日志、后端可执行文件必须单独记录 |
| 前端资源 | 直接读取工作区 `frontend/capability-browser` | 打包时复制到 `.app/Contents/Resources/Runtime/app/frontend-dist`，首次运行后再复制到用户选择的 Runtime | 当前工作区 hash 与已生成 DMG hash 不一致只能说明发布新鲜度，不能单独解释打包当时的 Web / DMG 差异 |
| 缓存与刷新 | 系统浏览器缓存 / DevTools / 普通刷新 | `WKWebsiteDataStore.default()`；wrapper 只提供 `reload()` 和 `reloadFromOrigin()` 工具栏 | 需要记录 WebView 缓存、强制刷新路径和 Runtime 指纹 |
| 弹窗、文件选择与下载 | 浏览器内置 `alert` / `confirm` / 文件选择 / 下载栏 / 新标签页 | wrapper 使用 `WKUIDelegate` 把导入默认定位到配置目录；用户导出由后端写入分类目录，不依赖 `WKDownload` | 删除确认和错误提示使用应用内 UI；导出返回真实保存路径 |
| 全屏 | 系统浏览器 Fullscreen API 与浏览器窗口全屏 | DOM Fullscreen API 与原生 `NSWindow` 全屏不是同一个契约；当前 wrapper 没有显式 fullscreen bridge | 全屏控件必须同时验 DOM fallback 和原生窗口行为 |
| 用户状态 | 开发机本地用户库与浏览器状态 | 目标 Mac 用户选择位置下的 `SAPDWiki/Runtime` 和复用用户库 | 同包多机差异必须记录 Runtime 指纹、用户库 schema / 数据量和授权态 |

固定判断：DMG 不是“模拟浏览器路线”，也不是完全重写业务前端；它是“同源前端 / 后端 Runtime + 新的 macOS WebView 宿主 + 新的本地用户状态”。因此差异根因优先在宿主能力、Runtime 初始化、缓存 / 刷新、用户库复用、下载 / 弹窗 / 全屏桥接和窗口尺寸里查。

## Bug 修复影响面分类

后续所有 bug 根因修复都必须先判断运行面，而不是只问“5173 是否通过”。分类结论进入任务反馈；涉及发布候选时进入 `release-acceptance-matrix-0.1.md` 的证据目录。

| 分类 | 判定标准 | 最小验收 |
|---|---|---|
| `shared runtime` | 共享前端、API 契约、路由、搜索、批注、Issue、导出状态 | 5173 自动 / 轻量验收；说明是否需要 DMG 回归 |
| `data / ETL / JSON package` | 数据源、SQLite、投影、索引和字段边界 | 源到包到页面链路验证；说明包内 Runtime 是否需要重建 |
| `web-only` | 只在系统浏览器开发态出现 | 记录不影响 App 的理由 |
| `app-only` | `WKWebView`、`NSWindow`、用户库路径、下载路径、授权、打包 runtime、Gatekeeper | 必须 App 验收；Web 通过不能关闭 |
| `release blocker` | P0 / P1 发布阻断项 | 进入发布矩阵证据目录，关闭前给出 blocker 解除证据 |

完成反馈必须写清：`影响面：Web / App / 两者 / 暂未覆盖`、`根因层：data / shared frontend / API / user DB / macOS wrapper / packaging runtime`、`验证范围：5173 / DMG App / 自动审计 / 人工验收 / 未做原因`。

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

## 交互验收矩阵

DMG 与 5173 的一致性不能只靠包体来源和文件 hash 证明。凡是用户会点击、滚动、弹窗、下载或全屏查看的核心路径，以及可能出现显示异常的页面区域，必须进入交互验收矩阵，并在 Web 浏览器和 DMG WKWebView 中用同一组 route、窗口尺寸、用户库状态和授权状态复验。

| 工作流 | Web 5173 验收点 | DMG Runtime 验收点 | 多机差异证据 |
|---|---|---|---|
| 全局搜索 / 标准框架定位 | 搜索结果保留查询词，点击标准 / 框架结果后定位到具体行级锚点 | 同一搜索词、同一结果点击后定位到同一行级锚点，不落到框架首页 | 记录前端文件哈希、Runtime 指纹、搜索词、目标 `route + target_ref` |
| ISSUE清单 | 行点击、复选框、批量按钮、单条操作、删除确认、滚动区域均可用 | 同样按钮可点性和自定义删除对话框可用，不使用浏览器默认弹窗 | 记录用户库 schema、Issue 数量、窗口尺寸、授权模式 |
| 批注抽屉 | 展开 / 收起、当前页计数、锚点定位和侧边吸附正确 | WKWebView 中抽屉边缘、滚动条和定位不脱离页面 | 记录当前 route、抽屉状态、截图 |
| 环境底图全屏控件 | Fullscreen API 或应用内 fullscreen fallback 可用，popover 不被裁切 | WKWebView 中全屏控件、缩放、拖动画布和 popover 均可用 | 记录 WebView / macOS 版本、窗口尺寸、是否触发 fallback |
| 导出 / 下载 | 评估报告、评分表、模板和 Issue 导出返回成功状态，路径提示正确 | 文件分别写入 DMG 配置的 `export/maturity-reports`、`export/maturity-scores`、`export/maturity-templates`、`export/issues`；诊断包写入 `export/diagnostics` | 记录 `download_dir`、分类相对路径、Runtime 日志和导出文件名 |

## 同包多机差异取证

同一个 DMG 在不同 Mac 上出现差异时，不能只比较系统版本。每台 Mac 必须同时收集以下信息：

- DMG 文件名、SHA-256、授权变体和 `Info.plist` 中的 `SAPDWikiDisplayVersion` / `SAPDWikiLicenseMode`。
- 复制后 Runtime 的 `.sapd-runtime-fingerprint`、`app/frontend-dist/index.html` / `app.js` / `styles.css` 前端文件哈希。
- 用户库路径、`user_meta.schema_version`、`user_notes` / Issue 数量和是否复用旧用户库。
- `config/app-config.json` 中的 `runtime_root`、`import_dir`、`download_dir`、`license` 状态。
- macOS 版本、芯片架构、屏幕缩放、窗口尺寸、是否外接显示器。
- 复现路径的截图或短录屏，以及 `Runtime/logs/runtime.log`。

只要上述任一变量不同，就不能把两台 Mac 的现象归为同一个运行样本；审计结论必须先区分“包体差异”“Runtime 复制差异”“用户库差异”“WebView 能力差异”和“页面代码缺陷”。

## 固定结论

当前差异可接受，前提是严格执行上述验收闸门。DMG 与 5173 的一致性定义为“同源构建输入 + 同业务验收样例通过 + 交付层差异进入白名单”，而不是窗口外壳、用户库内容、授权门禁和文件路径完全相同。
