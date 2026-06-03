# 用户自定义工作区 V1-V4 设计

本文档固定 `OI-128` 后续用户写入能力的产品边界、UI 入口、数据表、API、阶段路线和验收标准。目标是在不破坏基础知识库数据的前提下，让用户逐步完成收藏、备注、个人工作区、新增对象、复制编辑、关联维护和导出。

## 1. 设计结论

当前系统应采用“基础库只读 + 用户库叠加”的工作区模型：

- 基础数据仍来自后端 ETL / 数据包 / base DB，页面只读展示。
- 用户动作只写入 `sapd_wiki_user.sqlite3`。
- 前端把用户收藏、备注、自定义对象和自定义关系作为 overlay 叠加到当前对象视图，不回写基础数据。
- V1 只做轻量写入入口；V2 再做工作区；V3 再做新增 / 复制编辑；V4 再做导出和版本化交付。

`OI-128A` 的实现边界：先在安全能力映射页对象详情区提供“收藏 + 轻备注”入口，用来验证页面操作可以写入用户库、刷新后保留、并且不修改基础库。

`OI-128B` 的实现边界：复用同一个用户动作组件到知识库字典、安全标准 / 框架和安全指南页面。入口仍是对象级收藏 / 收藏备注，不新增正式批注、标签、工作区或编辑能力。

## 2. 产品模型

### 2.1 对象来源

| 来源 | 引用前缀 | 说明 |
|---|---|---|
| 基础对象 | `base:` | ETL 或数据包生成的标准、能力、关注点、流程、职能、指南等对象 |
| 用户对象 | `user:` | 用户新增、复制编辑、导入或人工维护的对象 |

目标对象统一使用 `target_ref`：

```text
base:<object_type>:<stable_key>
user:<id>
```

示例：

```text
base:capability_focus:T-AS.AD-01
base:capability_group:T-AS.AD
base:standard_clause:ISO27001-A.5.1
user:8f5c4d4a-...
```

其中 `stable_key` 优先使用业务稳定编码；没有编码时才使用后端稳定 ID。后续如果基础对象 ID 发生重算，必须通过 `stable_key` 做迁移。

### 2.2 用户工作区语义

用户工作区不是另一个基础知识库，而是用户对基础知识库的工作副本和个人叠加层：

- 收藏：把对象加入“我的关注清单”，用于后续回访、复核、导出或加入工作区；收藏不是业务确认、不是接受映射、不是编辑动作。
- 备注：记录个人判断、复核结论、待补充信息；正式备注应像 Office 批注一样锚定到具体对象、行、关系或字段，并在统一备注中心可维护。
- 标签：用户自己的分组和筛选维度。
- 工作区：把一批对象和关系组织成某个项目、客户、版本或专题。
- 新增对象：用户补充一条新的能力、关注点、标准条款、流程或指南条目。
- 复制编辑：从基础对象复制一份用户对象，继承可复用关系后再做调整。
- 导出：把基础对象 + 用户 overlay 按需或全量导出。

### 2.3 收藏与备注业务语义

收藏、取消收藏和备注必须分清：

| 动作 | 业务含义 | 不代表什么 | 当前 V1A 处理 |
|---|---|---|---|
| 加入关注清单 | 用户认为该对象后续需要回看、复核、跟踪、纳入工作区或导出 | 不代表该对象正确、不代表映射已确认、不修改基础对象 | 写入 `user_favorites` |
| 移出关注清单 | 用户不再把该对象放入个人关注列表 | 不代表删除基础对象、不代表否定该对象 | 从 `user_favorites` 删除 |
| 收藏备注 | 附加在收藏记录上的轻量个人说明 | 不等同于正式批注系统，不支持多条线程、定位到字段或统一管理 | 暂存于 `user_favorites.note` |
| 正式备注 / 批注 | 类似 Office 批注，可锚定对象、表格行、关系、字段或选中文本，支持统一查看、编辑、删除和状态提示 | 不依赖对象是否收藏，不应随取消收藏丢失 | V1B 进入 `user_notes` |

V1A 只做最小可验证写入，因此“收藏备注”暂时绑定在收藏记录上。进入 V1B 后，备注必须从 `user_favorites.note` 升级为独立 `user_notes` 记录，并支持：

- 对象详情、表格行、关系单元格或字段级锚点。
- 类似 Office 的备注入口和备注标记。
- 页面上提示“这里有备注”。
- `我的工作区 / 最近备注` 统一维护、检索和删除。
- 备注可独立于收藏存在；取消收藏不得删除正式备注。

## 3. UI 入口设计

### 3.1 V1A：对象级收藏 / 轻备注入口

入口位置：对象详情主展示区顶部，紧贴当前选中对象，不放在全局导航。

适用页面：

- `安全能力映射`：对象详情顶部，随当前选中的 L0 / L1 / L2 / 关注点对象变化。
- `安全知识`：表格上方，绑定当前选中知识库对象，例如能力、关注点、作用域、服务、模块、流程、职能等。
- `安全标准 / 框架`：表格上方，优先绑定当前选中的标准控制项；未选中控制项时绑定当前标准 / 框架。
- `安全指南`：内容主区顶部，绑定当前指南内容；专用二级指南页使用当前路由作为稳定对象。

UI 结构：

- 左侧显示当前用户动作状态：`未加入关注清单` / `已加入关注清单`
- 主按钮：`加入关注清单` / `移出关注清单`
- 次入口：`收藏备注`
- 备注输入：一行到多行轻量文本框
- 保存动作：`保存收藏备注`
- API 不可用时：显示 `用户库不可用`，按钮禁用，不把空态伪装成未收藏

交互规则：

- 当前对象变化时，收藏状态必须随对象重新计算。
- 收藏状态来自 user DB，不得写入 `localStorage` 作为事实来源。
- V1A 用户备注保存在 `user_favorites.note`，只代表收藏备注；正式多条备注在 V1B 进入 `user_notes`。
- 如果用户直接保存收藏备注，应自动建立关注清单记录，避免轻量备注没有对象入口。
- 未加载用户库时，按钮处于加载态；失败时显示 API 状态文案。
- 跨页面复用时，`target_ref` 必须保持稳定：基础对象统一使用 `base:<object_type>:<stable_key>`，其中 `stable_key` 优先使用业务编码或路由。

### 3.2 V1B：备注 / 标签面板

入口位置：对象详情顶部的 `备注`、`标签` 入口，打开右侧轻量面板。

能力：

- 查看该对象的多条备注。
- 新增、编辑、删除备注。
- 在对象、表格行、关系单元格或字段级显示备注标记。
- 创建个人标签。
- 给当前对象打个人标签。
- 在对象列表中按个人标签过滤。

### 3.3 V2：我的工作区

新增一级或二级导航入口：

```text
我的工作区
├── 收藏
├── 最近备注
├── 我的标签
├── 工作区列表
└── 导出记录
```

能力：

- 查看所有收藏对象。
- 查看最近备注。
- 创建专题工作区，例如“某客户安全架构评估 V1”。
- 把基础对象或用户对象加入工作区。
- 在工作区内维护对象状态：`draft`、`reviewing`、`accepted`、`archived`。

### 3.4 V3：新增 / 复制编辑

入口位置：

- 对象详情顶部：`复制为我的版本`
- 工作区页面：`新增对象`
- 关系矩阵或详情页：`新增关联`

能力：

- 新增能力、关注点、标准条款、流程、职能等用户对象。
- 从基础对象复制用户对象，继承标题、编码、描述和可复用关系。
- 用户对象允许编辑标题、描述、状态和关联。
- 用户关系只写入 `user_custom_relations`。
- 页面明确区分“基础对象”和“我的版本”。

### 3.5 V4：按需 / 全量导出

入口位置：

- 当前页面顶部：`导出当前视图`
- 我的工作区：`导出工作区`
- 系统交付页：`全量导出 / 备份`

能力：

- 导出当前筛选结果。
- 导出某个工作区。
- 导出基础对象 + 用户 overlay。
- 导出用户库备份。
- 导出前生成预览和字段边界检查。

## 4. 数据表设计

当前 Delivery Bundle 已具备最小用户库 schema。后续不需要推翻，只需要分阶段扩展。

### 4.1 当前已具备表

| 表 | 阶段 | 用途 |
|---|---|---|
| `user_meta` | V1 | 用户库版本、创建来源 |
| `user_favorites` | V1A | 收藏对象和轻备注 |
| `user_notes` | V1B | 多条备注 |
| `user_tags` | V1B | 个人标签 |
| `user_item_tags` | V1B | 对象和个人标签关系 |
| `user_custom_items` | V3 | 用户新增对象 |
| `user_custom_relations` | V3 | 用户新增关系 |
| `user_import_jobs` | V3/V4 | 用户导入任务 |
| `user_change_logs` | V1-V4 | 用户写操作审计 |
| `user_schema_migrations` | V1-V4 | 用户库迁移记录 |

### 4.2 建议新增表

V2 需要新增：

```sql
CREATE TABLE IF NOT EXISTS user_workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_workspace_items (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  item_status TEXT NOT NULL DEFAULT 'active',
  sort_order INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, target_ref),
  FOREIGN KEY(workspace_id) REFERENCES user_workspaces(id) ON DELETE CASCADE
);
```

V3 可按需要新增：

```sql
CREATE TABLE IF NOT EXISTS user_object_versions (
  id TEXT PRIMARY KEY,
  target_ref TEXT NOT NULL,
  version_label TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

V4 可按需要新增：

```sql
CREATE TABLE IF NOT EXISTS user_export_jobs (
  id TEXT PRIMARY KEY,
  export_type TEXT NOT NULL,
  source_ref TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  output_path TEXT,
  summary TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 5. API 设计

所有写入 API 必须满足：

- 同源访问。
- JSON 请求体。
- ZIP runtime 使用 `X-SAPD-Session-Token`。
- 只写 `sapd_wiki_user.sqlite3`。
- 每次写入 `user_change_logs`。
- 响应不返回原始调试字段、数据库路径或敏感用户内容。

### 5.1 V1A 收藏 API

```text
GET /api/v1/user/favorites
POST /api/v1/user/favorites
DELETE /api/v1/user/favorites?target_ref=<target_ref>
```

`POST` 请求：

```json
{
  "target_ref": "base:capability_focus:T-AS.AD-01",
  "note": "需要后续补充客户场景"
}
```

响应：

```json
{
  "ok": true,
  "favorite": {
    "id": "...",
    "target_ref": "base:capability_focus:T-AS.AD-01",
    "note": "需要后续补充客户场景",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

### 5.2 V1B 备注 / 标签 API

```text
GET /api/v1/user/notes?target_ref=<target_ref>
POST /api/v1/user/notes
PATCH /api/v1/user/notes/:id
DELETE /api/v1/user/notes/:id

GET /api/v1/user/tags
POST /api/v1/user/tags
POST /api/v1/user/item-tags
DELETE /api/v1/user/item-tags/:id
```

### 5.3 V2 工作区 API

```text
GET /api/v1/user/workspaces
POST /api/v1/user/workspaces
PATCH /api/v1/user/workspaces/:id
DELETE /api/v1/user/workspaces/:id

GET /api/v1/user/workspaces/:id/items
POST /api/v1/user/workspaces/:id/items
DELETE /api/v1/user/workspaces/:id/items/:item_id
```

### 5.4 V3 新增 / 复制编辑 API

```text
POST /api/v1/user/custom-items
PATCH /api/v1/user/custom-items/:id
POST /api/v1/user/custom-items/clone

POST /api/v1/user/custom-relations
PATCH /api/v1/user/custom-relations/:id
DELETE /api/v1/user/custom-relations/:id
```

`clone` 必须明确输入：

```json
{
  "source_ref": "base:capability_focus:T-AS.AD-01",
  "workspace_id": "...",
  "inherit_relations": true
}
```

### 5.5 V4 导出 API

```text
POST /api/v1/user/exports/preview
POST /api/v1/user/exports
GET /api/v1/user/exports/:id
GET /api/v1/user/exports/:id/download
```

导出必须先生成预览摘要，确认字段边界后再生成文件。

## 6. 阶段路线

| 阶段 | 范围 | 目标 |
|---|---|---|
| V1A | 收藏 + 轻备注 | 页面可验证 user DB 写入，解决 `OI-128` 最小入口 |
| V1B | 多条备注 + 个人标签 | 对象级个人工作痕迹可维护、可筛选 |
| V2 | 我的工作区 | 把收藏、备注、标签组织成项目或版本 |
| V3 | 新增 / 复制编辑 | 用户可维护自己的能力、关注点和关系 |
| V4 | 按需 / 全量导出 | 用户工作区可交付、可备份、可迁移 |

## 7. 验收标准

### 7.1 V1A 验收标准

- 安全能力映射页选中关注点、L2、L1、L0 时，详情区能看到用户动作入口。
- 未加载用户库时显示加载态，不显示错误的未收藏状态。
- 点击收藏后刷新页面，当前对象仍显示已收藏。
- 点击取消收藏后刷新页面，当前对象不再显示已收藏。
- 保存备注后，备注写入 `user_favorites.note`，刷新后可见。
- 收藏 / 备注写入只影响 `sapd_wiki_user.sqlite3`，不修改基础数据文件和 base DB。
- API 不可用时按钮禁用，并显示 `用户库不可用`。
- 主展示区不泄露 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。

### 7.2 V1B 验收标准

- 当前对象可新增、编辑、删除多条备注。
- 当前对象可添加、移除个人标签。
- 对象列表可按个人标签过滤。
- 备注和标签写入用户库并写入变更日志。

### 7.3 V2 验收标准

- 可创建、重命名、归档工作区。
- 可把基础对象和用户对象加入工作区。
- 工作区刷新后保留。
- 工作区列表可显示收藏数、备注数和对象数。

### 7.4 V3 验收标准

- 可从基础对象复制为用户对象。
- 用户对象可编辑标题、描述和状态。
- 用户对象可继承并调整关系。
- 页面清晰区分基础对象与用户对象。
- 不允许用户对象静默覆盖基础对象。

### 7.5 V4 验收标准

- 可导出当前视图、某个工作区或全量用户工作区。
- 导出前有预览摘要。
- 导出文件不包含禁止展示字段。
- 诊断包不得包含 `sapd_wiki_user.sqlite3` 或用户备注正文。

## 8. 当前 OI-128A 执行边界

本轮只实现：

- 安全能力映射页对象详情区收藏入口。
- 轻备注输入和保存。
- 开发 API 与 ZIP runtime 的 `GET` / `POST` / `DELETE /api/v1/user/favorites` 对齐。
- 刷新后状态恢复。
- 治理记录和最小验证。

本轮不实现：

- 多条备注列表。
- 用户标签。
- 我的工作区导航页。
- 新增能力 / 新增关注点。
- 复制编辑。
- 关系编辑。
- 导出功能。

这些能力必须按 V1B-V4 分阶段实现。
