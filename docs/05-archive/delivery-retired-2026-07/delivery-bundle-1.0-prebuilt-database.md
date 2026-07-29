# Delivery Bundle 1.0：预构建数据库交付版设计

> 归档状态：`historical / superseded by current desktop packaging`

> 状态：implemented / internal testing
> 日期：2026-07-21
> 适用项目：SAPD Wiki
> 目标形态：面向普通用户的本地桌面客户端，随包携带预构建知识库数据库，用户安装后无需 Python、Node、Docker、ETL 或数据库初始化即可使用。

## 1. 结论

Delivery Bundle 1.0 建议采用：

```text
P0：.zip 解压即用版
P1：macOS .dmg/.app + Windows .msi/.exe
P2：自动更新、签名、公网发布、企业集中管理
P3：Docker / Server 版 / 多人协作版
内部构建物：后端可执行文件 + frontend assets + base database + user database + manifest + logs + diagnostics
```

当前交付已从 ZIP alpha 演进为两条安装包支线：macOS 使用原生 App + DMG；Windows 使用 Electron 壳 + Python sidecar + NSIS `Setup.exe`。Windows 平台后端由 GitHub Actions `windows-2022` 一次生成，Mac 可完成后续 Runtime 与安装器组装。签名、自动更新和企业集中管理仍后置。

核心产品形态是：

```text
SAPD Wiki ZIP Bundle
= ZIP Launcher / start scripts
+ Embedded Local Backend Executable
+ Frontend Assets
+ Read-only Base Database
+ User Database
+ Data Manifest
+ Diagnostics / Repair Tools
```

关键原则：

- 普通用户端不运行生产 ETL。
- 普通用户不安装 Python、Node、Docker、虚拟环境或数据库工具。
- 基础知识库与用户数据物理分离。
- 基础知识库只读，用户编辑、导入、备注、收藏、个人标签、修正建议单独写入 `sapd_wiki_user.sqlite3`。
- App 版本、基础数据版本、schema 版本和前端数据包版本必须由 manifest 绑定。
- 更新基础库不得覆盖用户库。
- 交付包必须提供诊断与修复入口，而不是要求用户打开命令行排错。

## 2. 目标用户与使用场景

### 2.1 目标用户

1. 普通业务用户  
   只需要浏览、搜索、筛选、查看详情、导出结果、添加备注或收藏。

2. 顾问 / 内部试用用户  
   需要快速拿到一个解压即用版本，用于演示、评审、离线工作或客户现场使用。

3. 知识库维护者 / 制作者  
   在内部环境中运行 ETL、清洗、审查、审批、构建基础数据库，并发布新版本数据包。

### 2.2 使用场景

| 场景 | Delivery Bundle 1.0 支持方式 |
|---|---|
| 离线浏览 SAPD 知识库 | 内置只读 `sapd_wiki_base.sqlite3` |
| 搜索、筛选、详情页 | 本地 API 读取 SQLite，前端展示 |
| 用户备注、收藏、个人标签 | 写入 `sapd_wiki_user.sqlite3` |
| 用户导入自己的补充资料 | 进入用户库 staging，审查后写入用户库正式表 |
| 基础知识库更新 | 安装新版本或导入新的 base data package |
| 用户数据备份 | 导出 `sapd_wiki_user.sqlite3` + 用户附件 + manifest |
| 故障排查 | 一键导出诊断包 |

## 3. 不解决的问题

Delivery Bundle 1.0 不解决以下问题：

- 不把原始 Excel、PPT、Draw.io、DOCX 工作文件放进普通用户交付包。
- 不要求普通用户执行 ETL。
- 不把当前开发用 CLI 暴露给普通用户。
- 不做多人协作、账号权限、云同步和集中管理。
- 不做 Docker 作为普通用户主交付方式。
- 不允许用户直接修改基础库。
- 不承诺用户导入任意格式文件；1.0 只支持受控模板或受控导入范围。

## 4. 推荐系统架构

```text
SAPD Wiki Desktop
├── ZIP Launcher                           # 1.0-alpha
│   ├── start-windows.bat / start-macos.command
│   ├── stop-windows.bat / stop-macos.command
│   ├── 检查目录、manifest、base/user 数据库和端口
│   ├── 启动本地后端可执行文件
│   └── 自动打开浏览器
├── Embedded Backend Executable            # 1.0-alpha
│   ├── 本地 HTTP API 或 IPC API
│   ├── 提供前端静态资源服务
│   ├── 只读连接 base database
│   ├── 可写连接 user database
│   ├── 提供合并查询 read model
│   ├── 提供用户导入、编辑、导出、备份接口
│   └── 输出健康检查和诊断信息
├── Frontend Assets
│   ├── 当前前端静态资源
│   ├── 页面路由、搜索、筛选、详情
│   ├── 用户导入审查界面
│   └── fallback JSON 只读浏览模式
├── Base Data
│   ├── sapd_wiki_base.sqlite3             # 只读基础知识库
│   ├── base-manifest.json
│   └── frontend fallback JSON
└── User Data
    ├── sapd_wiki_user.sqlite3             # 用户库
    ├── imports/
    ├── exports/
    ├── backups/
    ├── logs/
    └── diagnostics/
```

## 5. 交付包内容

1.0-alpha 先实现 ZIP 解压即用包，详见 `docs/09-delivery/zip-bundle-1.0-alpha-design.md`。正式安装包结构保留为 P1 设计参考。

### 5.1 正式安装包

正式安装包面向普通用户：

```text
SAPD-Wiki-Desktop-1.0.0/
├── Sapd Wiki.app 或 SapdWiki.exe
├── resources/
│   ├── frontend/
│   │   ├── index.html
│   │   └── assets/
│   ├── backend/
│   │   └── sapd-wiki-backend 或 sapd-wiki-backend.exe
│   ├── data/
│   │   ├── base/
│   │   │   ├── sapd_wiki_base.sqlite3
│   │   │   └── base-manifest.json
│   │   └── fallback/
│   │       ├── capability-workbench.json
│   │       ├── environment-workbench.json
│   │       ├── lifecycle-workbench.json
│   │       ├── maintenance-knowledge.json
│   │       └── shared-lookups.json
│   ├── migrations/
│   │   ├── user/
│   │   └── app/
│   └── templates/
│       └── user-import-template.xlsx
└── license / notices
```

### 5.2 zip 解压即用包

`.zip` 版本用于内部试用和顾问快速分发：

```text
SAPD-Wiki-Portable-1.0.0/
├── SAPD Wiki.exe 或 SAPD Wiki.app
├── resources/
├── SAPD_Wiki_Data/
│   ├── base/
│   ├── user/
│   ├── imports/
│   ├── exports/
│   ├── backups/
│   └── logs/
└── README-First-Run.md
```

zip 版本的写入目录优先使用解压目录下的 `SAPD_Wiki_Data/`。如果目录不可写，应自动退回系统用户数据目录，并提示用户当前处于“非便携数据模式”。

## 6. 运行期数据目录

正式安装版不应把用户数据写入 App 安装目录。推荐目录：

### macOS

```text
~/Library/Application Support/SAPD Wiki/
├── base/
│   └── v2026.05.28/
│       ├── sapd_wiki_base.sqlite3
│       └── base-manifest.json
├── user/
│   └── sapd_wiki_user.sqlite3
├── imports/
├── exports/
├── backups/
├── logs/
├── diagnostics/
└── settings.json
```

### Windows

```text
%LOCALAPPDATA%\SAPD Wiki\
├── base\
│   └── v2026.05.28\
│       ├── sapd_wiki_base.sqlite3
│       └── base-manifest.json
├── user\
│   └── sapd_wiki_user.sqlite3
├── imports\
├── exports\
├── backups\
├── logs\
├── diagnostics\
└── settings.json
```

说明：

- App 包内的 base database 是交付源。
- 首次启动时可以把 base database 复制到运行期 `base/v<version>/`，再以只读方式打开。
- 复制后的 base database 仍然视为不可修改资产。
- 用户数据只写入 `user/sapd_wiki_user.sqlite3`。
- 备份和导出默认写入用户数据目录，不写入安装目录。

## 7. 数据库分离设计

### 7.1 基础库：`sapd_wiki_base.sqlite3`

基础库由知识库维护者提前构建、验证、冻结，随交付包发布。

基础库包含：

- `source_files`
- `import_jobs`
- `knowledge_items`
- `knowledge_relations`
- `source_references`
- `item_aliases`
- `change_logs`
- `guide_pages`
- `diagram_views`
- FTS 表和索引
- 只读元数据表，如 `base_release_info`

基础库不包含：

- 用户备注
- 用户收藏
- 用户个人标签
- 用户本地导入数据
- 用户修正建议
- 用户设置
- 用户日志

打开方式：

```text
read only
query only
no write transaction
no migration on user machine except verified base replacement
```

SQLite 连接建议：

```text
file:sapd_wiki_base.sqlite3?mode=ro&immutable=1
```

如果运行期复制后的 base database 需要兼容平台文件系统差异，也可以不用 `immutable=1`，但必须执行 `PRAGMA query_only = ON`。

### 7.2 用户库：`sapd_wiki_user.sqlite3`

用户库用于保存所有用户产生的数据。

用户库建议包含两类表：

1. 与基础库同构的知识表，用来保存用户新增对象和关系：
   - `knowledge_items`
   - `knowledge_relations`
   - `source_references`
   - `source_files`
   - `import_jobs`
   - `staging_items`
   - `staging_relations`
   - `review_decisions`
   - `change_logs`

2. 用户特有表：
   - `user_notes`
   - `user_favorites`
   - `user_tags`
   - `user_item_tags`
   - `user_overrides`
   - `user_correction_suggestions`
   - `user_settings`
   - `user_backups`

这样做的好处是：

- 用户库可以复用现有 `source -> staging -> review -> approval -> formal tables` 机制。
- 用户导入不会污染基础库。
- 备份用户库即可迁移用户个人数据。
- 基础库升级时不覆盖用户库。

## 8. 合并查询模型

后端对前端提供统一 read model，不让前端关心数据来自 base 还是 user。

### 8.1 数据命名空间

API 层必须区分来源：

```text
base:<item_id>
user:<item_id>
base:<relation_id>
user:<relation_id>
```

前端永远使用带命名空间的 ID，避免 base 和 user 两个 SQLite 文件内 UUID 碰撞。

### 8.2 合并查询示例

概念查询：

```sql
SELECT 'base' AS namespace, id, type, code, title, description, status
FROM base.knowledge_items
WHERE status = 'active'

UNION ALL

SELECT 'user' AS namespace, id, type, code, title, description, status
FROM user.knowledge_items
WHERE status = 'active';
```

用户备注和收藏通过 overlay 叠加：

```text
base item + user_notes / user_favorites / user_tags
user item + user_notes / user_favorites / user_tags
```

### 8.3 用户覆盖规则

基础库不允许被改写。用户想“修改基础对象”时，实际写入用户库：

| 用户动作 | 写入位置 | 说明 |
|---|---|---|
| 收藏基础对象 | `user_favorites` | 指向 `base:<id>` |
| 给基础对象打个人标签 | `user_item_tags` | 指向 `base:<id>` |
| 给基础对象写备注 | `user_notes` | 指向 `base:<id>` |
| 对基础对象提出修正 | `user_correction_suggestions` | 不直接改 base |
| 本地隐藏某基础对象 | `user_overrides` | 仅影响本人视图 |
| 新增本地知识对象 | `user.knowledge_items` | namespace 为 `user` |
| 新增本地关系 | `user.knowledge_relations` | 可连接 `base:<id>` 与 `user:<id>` |

## 9. 基础数据版本与稳定 ID

这是 Delivery Bundle 能否长期升级的关键。

### 9.1 必须增加稳定对象键

如果基础库每次 clean rebuild 都生成新的 UUID，用户库中指向基础对象的备注、收藏、关系会在升级后失效。

因此，基础库发布前必须保证每个公开对象有稳定键：

```text
stable_key = object_type + normalized_business_code
或
stable_key = object_type + normalized_title + parent_stable_key
或
由映射规则生成的 deterministic public id
```

建议在基础库中增加或保留：

```text
knowledge_items.stable_key
knowledge_relations.stable_key
base_id_redirects
base_release_info
```

其中 `base_id_redirects` 用于处理对象改名、合并、拆分：

| 字段 | 说明 |
|---|---|
| old_stable_key | 旧稳定键 |
| new_stable_key | 新稳定键 |
| redirect_type | rename、merge、split、deprecated |
| release_version | 生效版本 |
| note | 说明 |

### 9.2 base manifest

每个基础库必须附带 `base-manifest.json`：

```json
{
  "bundle_id": "sapd-wiki-desktop",
  "bundle_version": "1.0.0-alpha.1",
  "app_min_version": "1.0.0-alpha.1",
  "app_max_tested_version": "1.x",
  "base_data_version": "2026.05.28",
  "base_schema_version": "2026.05.base.1",
  "user_schema_min_version": "2026.05.user.1",
  "created_at": "2026-05-28T00:00:00Z",
  "database_file": "sapd_wiki_base.sqlite3",
  "database_sha256": "<sha256>",
  "fallback_exports": [
    {
      "name": "capability-workbench.json",
      "sha256": "<sha256>"
    },
    {
      "name": "environment-workbench.json",
      "sha256": "<sha256>"
    },
    {
      "name": "lifecycle-knowledge.json",
      "sha256": "<sha256>"
    },
    {
      "name": "maintenance-knowledge.json",
      "sha256": "<sha256>"
    },
    {
      "name": "shared-lookups.json",
      "sha256": "<sha256>"
    }
  ],
  "counts": {
    "knowledge_items": 0,
    "knowledge_relations": 0,
    "source_references": 0
  },
  "build_source": {
    "git_commit": "<commit>",
    "import_job_ids": []
  }
}
```

## 10. 启动流程

```text
用户打开 App
→ Desktop Shell 定位安装资源和运行期数据目录
→ 创建或检查运行期目录
→ 读取包内 manifest
→ 校验 base database hash
→ 如运行期没有该版本 base，则复制 base 到 runtime/base/v<version>/
→ 以只读方式打开 base database
→ 检查或创建 sapd_wiki_user.sqlite3
→ 执行用户库 schema migration
→ 执行 integrity_check / foreign_key_check / schema version check
→ 启动 embedded backend sidecar
→ backend 绑定 127.0.0.1 随机端口或 IPC 通道
→ desktop shell 将 endpoint 和 session token 注入前端
→ 前端 health check
→ 进入首页
```

启动失败时不显示技术堆栈，显示可执行动作：

- 重新检查
- 修复基础数据
- 备份并修复用户库
- 打开日志目录
- 导出诊断包
- 进入只读 fallback 模式

## 11. 更新流程

### 11.1 App 更新

App 更新可以包含：

- 新前端资源
- 新后端 sidecar
- 新用户库 migration
- 新基础库版本
- 新 fallback JSON

App 更新不得：

- 删除用户库
- 覆盖用户库
- 未备份就迁移用户库
- 静默丢弃用户备注、收藏、标签、导入数据

### 11.2 基础库更新

基础库更新流程：

```text
发现新 base version
→ 校验 manifest 和 hash
→ 安装到 runtime/base/v<new_version>/
→ 保留旧 base version 至少一个版本
→ 检查 stable_key redirect
→ 重建或刷新合并查询缓存
→ 前端提示基础库已更新
```

如果新基础库 schema 不兼容当前 App，应拒绝加载，并提示用户升级 App。

### 11.3 用户库迁移

用户库迁移流程：

```text
检测 user_schema_version
→ 备份 sapd_wiki_user.sqlite3
→ 执行 migration
→ integrity_check
→ 成功则更新 user_schema_version
→ 失败则恢复备份并提示诊断
```

用户库迁移必须具备回滚策略。

## 12. 用户导入与编辑功能

Delivery Bundle 1.0 仍然应支持用户自己的数据导入和编辑，但导入范围要受控。

### 12.1 1.0-alpha 推荐支持

| 能力 | 支持程度 |
|---|---|
| 用户备注 | 支持 |
| 收藏 | 支持 |
| 个人标签 | 支持 |
| 用户新增知识对象 | 支持，写入用户库 |
| 用户新增关系 | 支持，写入用户库 |
| 模板 Excel 导入 | 支持，进入用户 staging |
| 用户导入审查 | 支持，复用 staging/review/approval |
| 任意 Excel 自动理解 | 不支持 |
| 修改基础库对象 | 不支持，只能写 overlay 或修正建议 |
| 把用户修改回写给官方基础库 | 不自动支持，可导出修正建议包 |

### 12.2 用户导入流程

```text
用户选择模板 Excel / CSV
→ 写入 user.source_files
→ 创建 user.import_jobs
→ 解析为 user.staging_items / user.staging_relations
→ 前端展示新增 / 修改 / 冲突 / 错误
→ 用户确认
→ 写入 user.knowledge_items / user.knowledge_relations
→ 写入 user.review_decisions / user.change_logs
```

导入时可以引用基础对象，但不能改写基础对象。

## 13. 技术路线选择

### 13.1 推荐路线：ZIP + backend executable + SQLite

1.0-alpha 推荐：

```text
ZIP Portable Bundle
+ Local Backend Executable
+ SQLite base/user databases
+ Static Frontend Assets
+ start / stop scripts
+ logs
+ diagnostics
```

原因：

- 与当前项目“本地、SQLite、静态前端”的方向一致。
- 可以复用现有 Python/SQLite/导出逻辑的一部分。
- 前后端边界清晰，适合快速做 alpha。
- 后续可以接入 Tauri 壳或替换 sidecar，不影响前端和数据包结构。

### 13.2 sidecar 实现选择

| 选择 | 优点 | 风险 | 建议 |
|---|---|---|---|
| Python 后端打包成二进制 | 复用当前代码快 | 打包体积大、杀毒误报、跨平台依赖处理复杂 | alpha 可用，但要尽早验证 |
| Node 后端 | 前端生态一致 | 仍有运行时和 native sqlite 打包问题 | 可选 |
| Go 后端 | 单文件、跨平台较稳 | 需要重写服务层 | beta 候选 |
| Rust/Tauri command 直接读 SQLite | 进程少、安全边界好 | 需要重写 API 和查询层 | 稳定后评估 |

建议：

```text
1.0-alpha：先做 ZIP 解压即用版，后端可执行文件同时提供 API 和静态前端服务。
1.0-beta：评估是否接入 Tauri 壳或迁移为 Tauri command 直接读 SQLite。
```

## 14. 本地后端安全边界

如果使用 HTTP sidecar：

- 只绑定 `127.0.0.1`。
- 使用随机端口，不使用固定端口。
- App 启动时生成一次性 session token。
- 前端请求必须带 token。
- CORS 只允许 App 自己的 origin。
- 禁止局域网访问。
- 禁止任意文件路径读取。
- 用户导出、导入目录必须经过 App 授权或限定在用户数据目录。
- 日志默认不记录知识库正文内容。

如果使用 IPC / Tauri command：

- 优先使用强类型 command。
- 所有写操作后端校验，不信任前端传入的路径和 ID。
- 文件选择使用 Tauri dialog 返回授权路径。

## 15. 诊断包设计

用户点击“一键导出诊断包”后生成：

```text
sapd-wiki-diagnostics-YYYYMMDD-HHMMSS.zip
├── diagnostic-summary.json
├── app-version.txt
├── manifest.json
├── health-check.json
├── base-integrity-check.txt
├── user-integrity-check.txt
├── logs/
│   ├── app.log
│   └── backend.log
└── redaction-note.txt
```

默认不包含：

- 用户数据库全文
- 基础数据库全文
- 原始导入文件
- 导出文件
- 用户知识正文

如需包含用户数据，应明确提示并让用户确认。

## 16. 修复策略

App 设置页提供：

| 操作 | 行为 |
|---|---|
| 重新校验基础库 | 计算 hash，执行 integrity check |
| 修复基础库 | 从 App resources 重新复制 base database |
| 备份用户库 | 复制 `sapd_wiki_user.sqlite3` 到 backups |
| 修复用户库 | 先备份，再执行轻量修复或 migration 重试 |
| 重置用户设置 | 只重置 `settings.json`，不删用户库 |
| 清理日志 | 删除过旧日志 |
| 导出诊断包 | 生成脱敏诊断 zip |

禁止提供“一键清空所有数据”作为默认入口。删除用户库必须二次确认，并提示先备份。

## 17. macOS / Windows 打包路线

### 17.1 macOS

交付物：

```text
.dmg
└── SAPD Wiki.app
```

需要关注：

- Apple Developer ID 签名。
- Notarization。
- App bundle 资源只读。
- 用户数据目录权限。
- sidecar 二进制签名。
- 首次启动 Gatekeeper 提示。
- Apple Silicon / Intel 架构选择。

### 17.2 Windows

交付物：

```text
SAPD-Wiki-Setup-<version>-win-x64.exe
└── Electron shell + SAPD-Wiki-Backend.exe sidecar + NSIS uninstaller
```

当前实现：

- 使用 assisted NSIS 安装向导，允许用户选择程序安装目录。
- 首次启动选择业务数据父目录，并创建 `SAPDWiki/import`、`export`、`Runtime`。
- App 菜单可分别调整工作目录、导入目录和导出目录，修改后重启生效。
- Windows “已安装的应用”和开始菜单均提供卸载入口。
- 卸载和覆盖安装默认保留用户数据，不自动迁移或覆盖旧目录。
- 路径偏好单独保存在 `%LOCALAPPDATA%\SAPD Wiki\settings.json`。

需要关注：

- 代码签名证书。
- Windows Defender / 杀毒误报。
- 用户选择的数据目录写入权限。
- 程序安装目录保持只读，不承载用户库。
- sidecar 进程生命周期。
- 卸载时默认保留用户数据。

具体命令、目录和验收流程见 `windows-electron-build-guide.md`。

### 17.3 zip

交付物：

```text
SAPD-Wiki-Portable-<version>.zip
```

需要关注：

- 解压路径包含中文或空格。
- 解压目录只读。
- Windows SmartScreen。
- macOS quarantine attribute。
- 用户误删数据目录。

zip 版定位为 Delivery Bundle 1.0 的主交付目标，优先服务内部团队快速分发、快速验证和快速反馈。正式安装包后置。

## 18. Docker 定位

Docker 不建议作为普通用户交付主形态。

Docker 保留为高级选项：

- 开发环境复现。
- 自动化构建基础数据库。
- 内部测试。
- 顾问团队在受控环境中启动 Web 版。
- 未来服务端版或团队版原型。

普通用户主路径仍应是桌面客户端。

## 19. 构建流水线

建议增加一个 Delivery Builder：

```text
输入：已审批的正式 SQLite 数据库、前端构建产物、后端二进制、migrations、模板
→ 复制并重命名 base database
→ 执行 PRAGMA integrity_check
→ 执行 PRAGMA foreign_key_check
→ 检查必需表和 schema version
→ 检查 stable_key 覆盖率
→ 导出 fallback JSON
→ 计算 sha256
→ 生成 base-manifest.json
→ 组装 resources
→ 生成 ZIP portable bundle
→ 分平台输出 win-x64 / mac-arm64 / mac-x64 ZIP
→ ZIP 解压后 smoke test
→ macOS 原生 App 组装并生成 DMG
→ GitHub Windows CI 生成 PyInstaller win-x64 后端 Artifact
→ Mac 使用 electron-builder 组装 Electron Runtime 和 NSIS Setup.exe
→ 真实 Windows 10/11 完成安装、启动、写入、退出和卸载 UAT
```

## 20. MVP 实施步骤

### Step 1：确定交付边界

产物：

- 本文档进入 `docs/09-delivery/`。
- `task_plan.md` 中 Phase 9 拆成具体子任务。
- 明确普通用户端不执行生产 ETL。

### Step 2：基础库改名与 manifest

产物：

- `sapd_wiki_base.sqlite3`
- `base-manifest.json`
- hash 校验脚本
- 数据版本字段

### Step 3：用户库 schema

产物：

- `sapd_wiki_user.sqlite3` 初始化脚本
- 用户库 migration
- 用户备注、收藏、标签、overlay 表
- 用户导入 staging 表

### Step 4：稳定 ID / stable_key

产物：

- `knowledge_items.stable_key`
- `knowledge_relations.stable_key`
- base release 之间稳定性测试
- redirect 表设计

这是进入正式交付前的 P0 前置项。

### Step 5：合并查询 API

产物：

- base/user attach 查询
- namespace ID
- 搜索、详情、关系查询合并 read model
- 用户 overlay 合并逻辑

### Step 6：ZIP alpha

产物：

- 分平台 ZIP portable bundle
- Windows ZIP 内部 `SAPD-Wiki-Backend.exe`
- macOS ZIP 内部 `SAPD-Wiki-Backend`
- 分平台启动/停止脚本
- 本地 health check
- 后端提供前端静态资源服务
- 自动打开浏览器
- Windows / macOS ZIP 基础启动验证

### Step 7：诊断、修复、备份

产物：

- 导出诊断包
- 修复基础库
- 备份用户库
- 用户库 migration 失败恢复

### Step 8：打包验证

产物：

- Windows `.zip` portable bundle
- macOS arm64 `.zip` portable bundle
- macOS x64 `.zip` portable bundle
- macOS `.dmg` 校验、签名状态与 App Runtime 验收
- Windows Electron NSIS `Setup.exe`、安装路径选择和内置卸载程序
- Windows 首次启动数据目录、导入目录、导出目录与覆盖安装保留数据
- 干净机器 ZIP 解压启动测试清单
- 真实 Windows 10/11 安装 / 启动 / 写入 / 退出 / 卸载保留数据测试清单

## 21. 验收清单

### 用户体验验收

- 用户安装后第一次打开无需命令行。
- 用户无需安装 Python、Node、Docker、SQLite。
- 用户无需执行数据库初始化。
- App 首页可直接浏览基础知识库。
- 搜索、筛选、详情、关系展示可用。
- 用户备注、收藏、个人标签写入用户库。
- 用户导入模板数据进入审查流程，不直接污染基础库。
- App 升级后用户数据仍在。
- Windows 安装向导可选择程序安装目录，首次启动可选择独立数据目录。
- Windows 卸载入口可见，卸载程序默认保留用户数据。

### 数据安全验收

- 基础库只读。
- 用户库单独存储。
- 基础库更新不覆盖用户库。
- 用户库迁移前自动备份。
- 原始敏感 Excel 不进入普通用户交付包。
- 诊断包默认脱敏。

### 工程验收

- base manifest 校验通过。
- base database `integrity_check` 通过。
- user database `integrity_check` 通过。
- schema version 检查通过。
- sidecar 异常退出后 App 能提示并导出诊断。
- macOS 和 Windows 都能从干净环境启动。
- zip 版在含空格/中文路径下能启动。

## 22. 主要风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| base UUID 每次重建变化 | 用户收藏、备注、关系失效 | 增加 stable_key / deterministic ID / redirect 表 |
| Python sidecar 打包复杂 | 安装包体积大、杀毒误报 | alpha 验证，beta 评估 Go/Rust 后端 |
| 基础库被误写 | 数据一致性破坏 | 只读连接、query_only、复制到版本目录 |
| 用户库迁移失败 | 用户数据损坏 | 迁移前备份，失败自动恢复 |
| zip 目录不可写 | 用户数据无法保存 | 检查写权限，自动退回系统数据目录 |
| 基础库升级导致用户关系断裂 | 用户本地关系变成孤儿 | stable_key + redirect + deprecated/tombstone 策略 |
| 诊断包泄露敏感数据 | 安全风险 | 默认脱敏，敏感内容需用户确认 |
| sidecar 端口冲突或被访问 | 可用性/安全风险 | 随机端口、127.0.0.1、session token、CORS 限制 |

## 23. 当前项目需要补齐的关键前置设计

根据现有 SAPD Wiki 方向，进入 Delivery Bundle 前最需要补齐：

1. `sapd_wiki_base.sqlite3` 与 `sapd_wiki_user.sqlite3` 的明确 schema 分界。
2. 基础对象 stable_key / deterministic ID 策略。
3. base manifest 格式。
4. 用户库初始化与 migration 机制。
5. base/user 合并查询 read model。
6. 用户导入模板与用户 staging 审查边界。
7. 诊断包与修复流程。
8. 分平台 ZIP 后端启动协议。

## 24. 推荐立即新增的任务

建议在 `task_plan.md` 的 Phase 9 下新增：

```text
- [ ] 新增 Delivery Bundle 1.0 设计文档。
- [ ] 设计 base/user 双数据库边界。
- [ ] 设计 base manifest 和数据版本规范。
- [ ] 为基础对象和关系增加 stable_key 策略。
- [ ] 设计用户库 schema 与 migration。
- [ ] 设计 base/user 合并查询 API。
- [ ] 实现 delivery builder，生成 sapd_wiki_base.sqlite3 + manifest + fallback JSON。
- [ ] 实现 ZIP 本地后端启动、health check 和诊断包。
- [ ] 生成分平台 zip portable alpha。
- [ ] 验证 Windows ZIP、macOS arm64 ZIP 和 macOS x64 ZIP。
- [ ] 后置验证 macOS .dmg 和 Windows .msi / 安装器路线。
```

## 25. 最小 alpha 范围

Delivery Bundle 1.0-alpha 不应一次性追求完整正式交付。最小可验收范围：

```text
一个 zip 解压即用版本
+ 一个本地后端可执行文件
+ 后端提供静态前端页面
+ 浏览器自动打开本地地址
+ 一个只读 sapd_wiki_base.sqlite3
+ 一个自动创建的 sapd_wiki_user.sqlite3
+ 首页 / 搜索 / 详情 / 关系浏览
+ 收藏 / 备注
+ manifest 校验
+ 诊断包导出
```

alpha 先证明：

- 用户可以不装依赖直接打开。
- 基础库和用户库确实分离。
- 数据版本和 App 版本可以绑定。
- 出错时能导出诊断。

在 alpha 成立后，再进入 Tauri 壳、正式安装包、签名、公证、自动更新和用户导入模板。
