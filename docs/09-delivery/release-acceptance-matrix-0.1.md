# SAPD Wiki 0.1 发布验收矩阵

> 状态：active
> 适用范围：macOS DMG `0.1.x` 内测发布、Web 5173 对照、授权版 / 无授权版双变体、带本地用户状态的桌面 App。

## 本质规则

SAPD Wiki 发布验收对象不是“网页是否能打开”，而是“同源知识库 Runtime 在本地桌面 App 中，带用户状态、授权状态、保存路径和导出路径后，能否稳定完成顾问核心工作流”。

因此发布验收必须同时覆盖：

- 构建输入：前端、后端、基础库、用户库模板、配置和 README 是否来自当前发布源。
- 运行宿主：5173 系统浏览器和 macOS DMG `WKWebView` 是否在同一业务样例上通过。
- 用户状态：干净首次启动、已有用户库升级、路径变更、导出目录、授权 / 试用状态是否稳定。
- 核心工作流：搜索定位、能力 / 环境 / 生命周期 / 标准浏览、批注、Issue、数据篮、导出、全屏、窗口恢复是否可用。
- 证据留存：每次发布必须有可复查的命令输出、截图 / 录屏、hash、Runtime 指纹和失败清单。

## Bug 修复进入发布验收的规则

每个 bug 根因修复都必须先做 Web / App 运行面分类，再决定验收范围。分类不是为了扩大每次修复的工作量，而是避免把 Web 通过误当作 App 通过。

| 分类 | 典型范围 | 发布验收要求 |
|---|---|---|
| `shared runtime` | 前端 JS / CSS、路由、搜索、批注、Issue、导出状态 | Web 必验；若影响 P0 / P1 或用户高频路径，进入 DMG 人工矩阵 |
| `data / ETL / JSON package` | 源数据、SQLite、索引、投影、字段边界 | 必须验源到包到页面链路；发布前同时确认包内 Runtime 使用同一数据 |
| `web-only` | 5173 开发服务、系统浏览器缓存、开发预览问题 | 可不进 DMG，但必须记录不影响 App 的理由 |
| `app-only` | `WKWebView`、窗口、全屏、下载、保存路径、用户库、授权、打包 runtime | Web 通过不算验收；必须进入 DMG 人工矩阵或 `known-limitations.md` |
| `release blocker` | 启动、授权、用户数据、搜索定位、批注 / Issue 写入、导出、核心页面不可用 | 必须进入证据目录并按 P0 / P1 阻断发布 |

发布候选的 `manual-test-log.md` 必须保留本轮重要 bug 修复的影响面摘要；`known-limitations.md` 必须保留未覆盖的 App-only、Web-only 或 P2/P3 接受项。

## 发布等级

| 等级 | 用途 | 必过范围 |
|---|---|---|
| `dev-smoke` | 日常开发后自检 | G0-G2 |
| `pre-dmg` | 打包前确认 | G0-G3 |
| `internal-release` | 发给用户内测 | G0-G7，允许 G8 外部分发为已知限制 |
| `public-release` | 外部分发 | G0-G8，且签名 / 公证问题不得为业务接受状态 |

当前 `0.1.x` DMG 属于 `internal-release`。

## 证据目录

每次候选发布建立一个证据目录：

```text
data/exports/worker-verify/release-acceptance/<version>-<buildStamp>/
```

目录至少包含：

| 文件 | 内容 |
|---|---|
| `release-inputs.json` | 版本、build stamp、DMG 路径、SHA-256、Git commit、dirty diff 摘要 |
| `automated-checks.txt` | 自动命令输出摘要 |
| `runtime-fingerprints.json` | license / no-license Runtime 指纹、前端 hash、base DB hash |
| `manual-test-log.md` | 人工验收矩阵结果、截图 / 录屏路径、失败项 |
| `known-limitations.md` | 已知限制、业务接受项、阻断项和后续 OI |

## 退出标准

候选发布只能进入内测交付，当且仅当：

- `P0 / P1` 阻断项为 `0`。
- 授权版和无授权版都能完成首次启动。
- 干净用户库和已有用户库升级路径都被验过。
- 至少一条完整顾问工作流从搜索到定位、批注、导出闭环通过。
- 所有失败项都被标记为 `blocker`、`accepted limitation` 或 `follow-up`，不能留空。

## 阻断分级

| 级别 | 定义 | 发布处理 |
|---|---|---|
| P0 | App 无法启动、基础库不可用、用户库损坏、授权版不可进入、导出写入错误、用户数据丢失 | 阻断发布 |
| P1 | 核心业务页面无法使用、搜索定位错误、批注 / Issue 写入失败、升级路径覆盖用户数据 | 阻断内测发布 |
| P2 | 单页交互不顺、部分定位不精确、全屏 / 滚动体验缺陷但有替代路径 | 可内测，必须登记 |
| P3 | 文案、视觉细节、低频操作体验问题 | 可内测，集中后续修 |

## 自动验收闸门

| ID | 场景 | 命令 / 动作 | 通过标准 | 证据 |
|---|---|---|---|---|
| G0-01 | 工作区边界 | `git status --short --branch` | 无未知大范围 dirty diff；打包前明确本轮改动范围 | `release-inputs.json` |
| G0-02 | GitHub 数据边界 | `python3 scripts/check_github_data_boundary.py` | 输出 OK；无源 Excel、SQLite、生成 JSON、DMG、导出包待提交 | `automated-checks.txt` |
| G1-01 | 5173 服务 | `python3 scripts/dev_server_guard.py --status` | 5173 为项目服务且健康 | `automated-checks.txt` |
| G1-02 | 前端内容 smoke | `node scripts/frontend_content_smoke_check.mjs --url http://127.0.0.1:5173` | 通过；如有既有 warning，必须登记原因 | `automated-checks.txt` |
| G1-03 | JSON 边界 | `python3 scripts/audit_json_package_boundary.py` | errors=0 | `automated-checks.txt` |
| G1-04 | 字典 / 标准基线 | `python3 scripts/audit_dictionary_standard_baseline_integrity.py` | 关键数组不为 0，errors=0 | `automated-checks.txt` |
| G1-05 | Web / DMG 契约 | `node scripts/audit_mac_dmg_browser_parity_contract.mjs` | result=pass；warning 必须进入限制清单 | `automated-checks.txt` |
| G2-01 | 搜索契约 | `node scripts/audit_global_search_index_contract.mjs --url http://127.0.0.1:5173` | 关键黄金样例和反例通过 | `automated-checks.txt` |
| G2-02 | 批注契约 | `node scripts/audit_user_annotation_contract.mjs` | 关键页面锚点和 overlay 契约通过 | `automated-checks.txt` |
| G2-03 | 前端治理 | `node scripts/audit_frontend_governance.mjs` | 无高风险文件治理错误 | `automated-checks.txt` |
| G3-01 | 构建双变体 DMG | `SAPD_WIKI_REBUILD_BACKEND=1 SAPD_WIKI_DMG_VARIANT=all apps/macos/SAPDWiki/script/package_dmg.sh` | 生成 license / no-license 两个 DMG，版本和 build stamp 一致 | `release-inputs.json` |
| G3-02 | DMG 校验 | `hdiutil verify <dmg>` | 两包均通过 | `automated-checks.txt` |
| G3-03 | App 签名校验 | `codesign --verify --deep --strict <staging app>` | 两个 staging App 均通过 | `automated-checks.txt` |
| G3-04 | Info.plist | 读取 `CFBundleShortVersionString`、`SAPDWikiDisplayVersion`、`SAPDWikiLicenseMode` | 版本正确；license / no-license 模式正确 | `release-inputs.json` |
| G3-05 | 包内用户库模板 | 只读检查包内 `sapd_wiki_user.sqlite3` | `user_schema_0.3`，用户数据为空 | `runtime-fingerprints.json` |
| G3-06 | Runtime 指纹 | 读取 `.sapd-runtime-fingerprint` 和前端 / base DB hash | license / no-license 除授权模式外业务输入一致 | `runtime-fingerprints.json` |

## 人工验收矩阵

人工验收必须固定变量：同一候选 DMG、同一窗口尺寸、同一测试账号状态、同一保存位置父目录、同一测试词和 route。

| ID | 场景 | 前置状态 | 操作 | 通过标准 | 证据 | 阻断级别 |
|---|---|---|---|---|---|---|
| M1-01 | 授权版首次启动 / 跳过试用 | license DMG，干净 `UserDefaults`，空保存位置 | 启动 App，跳过授权，选择保存位置 | 进入首页；显示试用状态；创建 `SAPDWiki/Runtime` 和 `SAPDWiki/export` | 截图 + 路径记录 | P0 |
| M1-02 | 授权版激活 | license DMG，未激活 | 输入正确授权码 `Passc0de` | 显示已激活；重启后仍已激活 | 截图 + config 摘要 | P0 |
| M1-03 | 无授权版首次启动 | no-license DMG，干净状态 | 启动 App，选择保存位置 | 不显示授权窗口；前端显示无限制版 | 截图 | P0 |
| M1-04 | 保存路径变更 | 任一变体，已有 Runtime | 打开系统设置，更改保存位置和下载路径 | 后端重启 / 刷新后使用新路径；旧用户库不被误覆盖 | 录屏 + config 摘要 | P1 |
| M2-01 | 已有用户库升级 | 准备含批注 / Issue 的旧用户库 | 用新 DMG 指向旧保存位置启动 | 复用旧用户库；schema 迁移后用户数据仍在 | user DB 只读计数 + 截图 | P0 |
| M2-02 | 用户库不可写保护 | 将保存位置设为不可写或模拟写入失败 | 尝试保存批注 / Issue | 应用给出可理解错误，不静默丢数据 | 截图 + runtime.log | P1 |
| M3-01 | 全局搜索到标准行 | 搜索词：`运营技术` 或已知标准明细样例 | 从全局搜索点击目标结果 | 定位到具体标准行 / chip，不只停在标准首页 | 截图 + `route + target_ref` | P1 |
| M3-02 | 全局搜索到能力关系 | 搜索 `M-PM.PR-00` 等双目标样例 | 分别点击字典结果和能力关系结果 | 字典落服务清单行；能力落技术视角 chip | 截图 | P1 |
| M3-03 | 页面内搜索隔离 | 在能力、环境、LC-DT、标准页分别输入同一词 | 切换页面和返回 | 搜索历史按业务域隔离；局部搜索不污染全局搜索 | 录屏 | P2 |
| M4-01 | 能力映射核心浏览 | 进入能力映射，选择 L0 / L1 / L2 / 关注点 | 切换对象，打开技术 / 管理 / 标准视角 | 右侧标题、当前对象、关系图 / 表格同粒度一致 | 截图 | P1 |
| M4-02 | 环境映射核心浏览 | 进入环境映射，选择环境 / 对象 / 服务 | 展开对象关系，查看服务 / 模块 / 措施 / 系统 | 不出现跨对象继承；关系符合对象级事实 | 截图 | P1 |
| M4-03 | LC-DT 策略矩阵 | 搜索 `PR.07` / `US.08` | 点击结果进入矩阵行 | 行内服务集合等于源表单行粒度，不按阶段全集扩展 | 截图 | P1 |
| M5-01 | 批注闭环 | 在能力或标准页对一个值添加批注 | 保存、刷新、定位、删除 | 批注写入用户库；常态标记和定位高亮正确 | 截图 + user_notes 计数 | P1 |
| M5-02 | Issue 工作台 | 新建 / 修改 / 取消 / 删除 Issue | 编辑优先级和状态，测试取消恢复 | 保存可读；取消恢复上次保存；删除走应用内确认 | 录屏 | P1 |
| M5-03 | 数据篮 / 导出 | 选择若干对象加入数据篮并导出 | 执行导出 | 文件写入配置下载路径；前端显示实际路径 | 导出文件路径 | P1 |
| M6-01 | 指南 / 幻灯片浏览 | 进入安全技术架构设计指南 | 点击缩略图、翻页、返回 | 缩略图点击不被 fullscreen / 文本选择残留吞掉 | 录屏 | P2 |
| M6-02 | ArchiMate / 环境底图全屏 | 打开 ArchiMate 或环境底图 | 全页面显示、缩放、拖拽、关闭 | Web 和 DMG 都有可用 fallback；关闭后路由状态清理 | 录屏 | P2 |
| M6-03 | 窗口恢复 | 关闭红色按钮、Dock 重开、最小化恢复 | 多次重复 | 主窗口恢复且 WebView 不黑屏 | 录屏 | P1 |
| M7-01 | 同包第二台 Mac | 同一 DMG，在另一台 Mac 干净启动 | 重复 M1-03、M3-01、M5-01 | 如结果不同，必须收集多机差异证据，不可直接发布 | 多机证据包 | P1 |
| M7-02 | 外部分发 Gatekeeper | 将 DMG 通过真实分发路径传给另一台 Mac | 打开 DMG 和 App | 当前内测可接受手动允许；若无法打开需登记 | 用户反馈 + 截图 | P2 / public P0 |

## 不做全量笛卡尔积

发布验收不把所有变量做全排列，否则无法执行。采用风险配对：

- `license` 至少跑 M1-01、M1-02、M5-01。
- `no-license` 至少跑 M1-03、M3-01、M5-03。
- 干净用户库跑首次启动、搜索、导出。
- 已有用户库跑升级、批注、Issue。
- 第二台 Mac 跑一条启动、一条搜索、一条写入。

只有当某类问题出现时，才扩展该变量组合。

## 发布判定模板

```text
版本：
Build stamp：
候选 DMG：
自动验收：通过 / 失败
人工验收：通过 / 失败
P0：
P1：
业务接受限制：
必须修复后再发：
可发内测结论：
```

## 和现有文档的关系

- `mac-dmg-browser-parity-contract.md`：解释 Web 5173 与 DMG `WKWebView` 为什么必须分开验。
- `user-database-minimum-schema.md`：定义用户库最低 schema。
- `packaging-cleanup-checklist.md`：定义打包产物和 GitHub 边界。
- 本文档：发布前“怎么验、验到什么程度、什么叫通过”的准入矩阵。
