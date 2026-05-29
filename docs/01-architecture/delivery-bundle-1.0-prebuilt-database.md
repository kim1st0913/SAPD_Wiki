# Delivery Bundle 1.0：预构建数据库交付版方案评估

> 本文档保留为架构评估入口。正式设计文档已升级到 `docs/09-delivery/delivery-bundle-1.0-prebuilt-database.md`，当前 alpha 主目标见 `docs/09-delivery/zip-bundle-1.0-alpha-design.md`。后续工程实施以 `docs/09-delivery/` 下的版本为准。

本文档定义 SAPD Wiki 面向普通用户交付的 `Delivery Bundle 1.0` 方案。当前 alpha 阶段的交付边界是分平台 ZIP 解压即用包；Windows ZIP 内部可以包含 `SAPD-Wiki-Backend.exe`，macOS ZIP 内部应包含 `SAPD-Wiki-Backend` 和 `.command` 启动脚本。`.exe` 在这里只是 Windows ZIP 内部运行组件，不是本阶段交付的安装器。用户不需要安装 Python、Node、Docker、SQLite CLI，不需要执行 ETL、migration 或数据初始化命令。

## 1. 目标定位

`Delivery Bundle 1.0` 是“预构建知识库运行版”，不是开发环境、数据导入工具或 ETL 平台。

正式工程边界进一步收紧为：

```text
制作者 / 管理员端：
原始 Excel / ETL / 清洗 / 审查 / 审批 / 构建 sapd_wiki_base.sqlite3

普通用户端：
安装 App → 只读读取 sapd_wiki_base.sqlite3 → 写入 sapd_wiki_user.sqlite3
```

基础知识库和用户数据必须物理分离。普通用户不能直接修改基础库；备注、收藏、个人标签、覆盖视图、修正建议和用户新增知识对象都写入用户库。

交付后用户体验应是：

```text
下载对应平台 ZIP
→ 解压
→ 打开 SAPD Wiki
→ 应用自动校验并部署预构建数据
→ 进入本地知识库工作台
```

第一版允许保留一个可见的“初始化 / 修复数据”按钮，但默认流程应尽量自动完成。用户不应看到数据库路径、原始 Excel、ETL 日志、API 地址或开发命令。

## 2. 推荐结论

推荐采用“ZIP 优先，安装包后置”的策略：

| 交付形态 | 推荐程度 | 说明 |
|---|---:|---|
| macOS / Windows `.zip` 解压即用 | P0 | Delivery Bundle 1.0 第一优先级，适合内部团队快速分发、快速验证、快速反馈 |
| macOS `.dmg` / `.app` | P1 | 适合普通 Mac 用户正式安装体验；需要处理签名、公证和首次打开提示 |
| Windows `.msi` / `.exe` | P1 | 适合普通 Windows 用户正式安装体验；需要处理安装目录、用户数据目录和杀毒误报风险 |
| 纯静态 HTML 压缩包 | 低，仅作应急 | 可离线打开部分页面，但无法稳定承载本地数据库、备份、导出和后续桌面能力 |
| Docker 镜像 | P3 | 不作为普通用户主路径，只保留为开发 / 高级部署 / 服务端原型选项 |

内部构建物保持一致：一次发布构建生成应用本体、只读 `sapd_wiki_base.sqlite3`、用户库初始化 / migration、前端离线数据包、预览资源和发布 manifest，再按平台打成不同外壳。

## 3. 总体架构

当前 alpha 不先卡在 Tauri 上。优先做 ZIP Bundle：后端可执行文件同时提供 `/api/v1/*` 本地 API 和前端静态资源服务，启动脚本自动打开浏览器。Tauri 壳和正式安装包后置。

后续数据读取层有三种可选实现：

| 方案 | 说明 | 评估 |
|---|---|---|
| A. Tauri command 直接读取 SQLite / JSON | Rust 侧内置 SQLite 读取和文件复制，前端通过 Tauri IPC 获取数据 | 最适合长期桌面化，依赖少、安全边界清楚，但需要实现一层 Rust 数据接口 |
| B. 内置本地 API sidecar | 随包携带已编译后端可执行文件，启动本地 `127.0.0.1` API，前端继续调用 HTTP | 与当前 `/api/v1/*` 思路最贴近，迁移成本低；需要管理端口、进程生命周期和本地访问安全 |
| C. 纯离线 JSON fallback | 前端只读取随包 JSON，不启本地后端 | 最简单，但无法体现“内置本地后端 + SQLite”目标，后续搜索、备份、导出能力受限 |

推荐路径：

1. `Delivery Bundle 1.0-alpha`：采用 ZIP + 后端可执行文件 + 浏览器访问 localhost，最快验证内部团队交付。
2. `Delivery Bundle 1.0-beta`：评估接入 Tauri 壳，提升桌面应用体验。
3. `Delivery Bundle 1.0-stable`：逐步评估是否把核心读取迁移到 A，减少本地端口和进程管理复杂度。

## 4. 包内结构

发布包建议逻辑结构如下：

```text
SAPD-Wiki-v0.1.0-{platform}/
├─ start-windows.bat 或 start-macos.command
├─ stop-windows.bat 或 stop-macos.command
├─ SAPD-Wiki-Backend.exe 或 SAPD-Wiki-Backend
├─ app/frontend-dist/
├─ data/base/sapd_wiki_base.sqlite3
├─ data/base/base-manifest.json
├─ data/user/sapd_wiki_user.sqlite3
├─ config/app-config.json
├─ logs/
├─ diagnostics/
└─ README-FIRST.md
```

安装目录或解压目录中的 `resources/` 视为只读发布资源。应用首次运行时，把可写运行数据部署到系统应用数据目录。

## 5. 运行期数据目录

运行期目录继续遵守 `docs/06-implementation/local-data-layout.md`：

```text
<app_data_dir>/SAPD_Wiki/base/v<base_version>/sapd_wiki_base.sqlite3
<app_data_dir>/SAPD_Wiki/user/sapd_wiki_user.sqlite3
<app_data_dir>/SAPD_Wiki/resources/
<app_data_dir>/SAPD_Wiki/exports/
<app_data_dir>/SAPD_Wiki/backups/
<app_data_dir>/SAPD_Wiki/app-state.json
```

平台建议：

| 平台 | 应用数据目录示例 |
|---|---|
| macOS | `~/Library/Application Support/SAPD_Wiki/` |
| Windows | `%APPDATA%\\SAPD_Wiki\\` 或 `%LOCALAPPDATA%\\SAPD_Wiki\\` |

原则：

- 基础库只读，不在安装目录直接写库；
- 首次运行复制基础库到运行期 base 版本目录，并以只读方式打开；
- 后续备份、导出、偏好、备注、收藏、个人标签和用户新增数据都写入用户库或应用数据目录；
- 用户库迁移、重新初始化、升级或修复前必须先备份已有用户库。

## 6. 发布构建流水线

内部维护者执行发布构建，普通用户不接触该流程。

建议流水线：

```text
原始资料
→ ETL / staging / approval
→ 生成正式 SQLite
→ 生成前端数据包和预览资源
→ 执行数据包摘要、字段边界、API smoke、hash 校验
→ 复制为 sapd_wiki_base.sqlite3
→ 生成 base-manifest.json
→ 组装分平台 ZIP
→ ZIP 解压运行 smoke
→ 后置评估 Tauri / 安装包
```

`manifest.json` 至少记录：

| 字段 | 用途 |
|---|---|
| `appVersion` | 应用版本 |
| `dataVersion` | 数据版本 |
| `schemaVersion` | SQLite schema 版本 |
| `buildTime` | 构建时间 |
| `files[]` | 包内文件路径、大小、hash |
| `requiredAppVersion` | 数据包要求的最低应用版本 |
| `releaseNotes` | 面向维护者的版本说明入口 |

## 7. 启动与初始化策略

应用启动时建议执行：

1. 读取包内 `resources/manifest.json`；
2. 检查 `<app_data_dir>/SAPD_Wiki/app-state.json`；
3. 如果未初始化，复制基础库到运行期 base 版本目录；
4. 创建或迁移 `sapd_wiki_user.sqlite3`；
5. 校验基础库、用户库、数据包和预览资源 hash；
6. 启动内置数据读取层；
7. 进入工作台。

异常处理：

| 异常 | 用户可见处理 |
|---|---|
| 基础库不存在 | 自动从随包基础库恢复 |
| hash 校验失败 | 提示“本地数据可能损坏”，提供修复按钮，修复前备份 |
| 数据版本低于应用要求 | 提示需要升级数据包 |
| 本地 API 启动失败 | 回退到离线 JSON，只读浏览；提示部分功能不可用 |
| 用户库升级失败 | 从 `backups/` 回滚上一版用户库 |

## 8. 平台适配评估

### macOS

alpha 推荐优先交付 `.zip`；正式阶段再评估 `.dmg`：

- `.dmg`：适合正式用户，拖入 Applications；
- `.zip`：适合内部试用和顾问快速分发。

注意事项：

- 正式外部分发需要 Apple Developer ID 签名和 notarization；
- 未签名包会触发 Gatekeeper 提示，普通用户体验较差；
- 数据目录应使用 macOS Application Support，不写入 `.app` 内部。

### Windows

alpha 推荐优先交付 `.zip`，ZIP 内部放置 Windows 可运行组件 `SAPD-Wiki-Backend.exe`；正式阶段再评估 `.msi` 或 `.exe` 安装器。

注意事项：

- 需要明确选择 `%APPDATA%` 或 `%LOCALAPPDATA%` 作为运行数据目录；
- 内置本地 API sidecar 可能触发防火墙或安全软件提示，监听地址必须固定为 `127.0.0.1`；
- 可执行文件签名能显著降低 SmartScreen 和杀毒误报风险。

## 9. 安全与数据边界

发布包不得包含：

- 原始 Excel、PDF、PPT、DOCX 或未脱敏资料；
- `data/raw-samples/`、`data/raw/`、`data/processed/`；
- 开发备份库、历史中间库；
- ETL 调试日志；
- 未确认可分发的来源全文。

发布前必须验证：

- SQLite 基础库是正式审批后的发布库，并且以只读方式使用；
- 前端主展示区未泄露 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`；
- `manifest.json` hash 与包内资源一致；
- GitHub 不追踪发布数据库和生成数据包。

## 10. 版本升级策略

`Delivery Bundle 1.0` 可以先做整包升级，不做在线增量更新。

建议规则：

1. 新版本启动时比较包内 `dataVersion` 与本地 `app-state.json`；
2. 基础库允许按版本替换或并存；
3. 用户库不得被静默覆盖，收藏、备注、评估记录、个人标签和用户导入数据必须保留；
4. 升级失败必须保留上一版备份。

## 11. 验收清单

发布前至少通过：

| 类别 | 验收项 |
|---|---|
| 构建 | macOS / Windows 包可生成 |
| 启动 | 首次打开无需 Python、Node、Docker、ETL |
| 数据 | 只读基础库和可写用户库可创建，关键数据包可读取 |
| 页面 | 核心页面可打开，路由刷新可恢复 |
| 离线 | 断网情况下可浏览已打包知识库 |
| 安全 | 包内无原始敏感资料和开发中间产物 |
| 字段 | 主展示区无非业务字段泄露 |
| 升级 | 用户库升级前会备份，基础库更新不覆盖用户库 |
| 回退 | 损坏或升级失败时可恢复上一版 |

## 12. 当前项目落地建议

后续实现建议拆成四步：

1. `DB-1`：发布资源清单和 manifest 生成脚本，只做 ZIP 目录构建，不碰 Tauri。
2. `DB-2`：本地后端可执行文件打包验证，绑定 `127.0.0.1`，复用现有 `/api/v1/*` 和静态前端服务。
3. `DB-3`：ZIP 启动 / 停止 / 诊断脚本、日志和 README-FIRST。
4. `DB-4`：ZIP alpha 在 Windows / macOS 上做冒烟测试；Tauri 和正式安装包后置。

本轮只完成方案设计和进度同步，不修改 SQLite schema、ETL、前端运行代码、`public/data/*.json` 或真实发布资源。
