# 右侧浮层批注抽屉与工作台设计

本文档固定 `OI-128C` 之后的用户工作台方向，替代当前横向 `加入关注清单 / 收藏备注` 条作为后续 UI 和产品语义基准。

## 1. 设计结论

后续不再保留当前这种横向 `加入关注清单 / 收藏备注` 条。

新的用户写入入口采用“右侧浮层批注抽屉 + 工作台”的模式：

- 默认在页面右侧显示窄标签，不挤占表格、矩阵、幻灯片或工作台主体空间。
- 点击标签后，从页面右侧平滑外拉一个浮层抽屉。
- 抽屉浮在表格上层，不改变表格列宽，也不触发主工作区重新布局。
- 第一阶段以 `批注` 为主；后续扩展为 `工作台`，承载批注、待复核、数据篮、导出、能力重组、我的版本、导入和 Skill 集成。
- `收藏` 不再作为主业务动作；底层 `user_favorites` 可暂时作为兼容存储，但前端主语义应改为 `批注`、`待复核`、`加入数据篮`、`加入工作台`。

## 2. 产品边界

系统仍采用“基础库只读 + 用户库 overlay”的长期模型：

| 层级 | 写入规则 | 说明 |
|---|---|---|
| 基础库 `base` | 只读 | ETL、数据包和 base DB 生成的权威安全能力、标准、服务、流程、指南等对象 |
| 用户库 `overlay` | 可写 | 用户批注、工作台、数据篮、导出配置、自定义能力模型、导入草稿和 Skill 输出 |

禁止直接用用户操作覆盖基础库对象。所有用户新增、编辑、重新分类、导入和 Skill 输出都必须先进入用户库或待审核区。

## 3. 右侧浮层批注抽屉

### 3.1 入口形态

右侧标签应位于表格 / 内容区的上浮层面：

```text
页面内容 / 表格 / 矩阵 / 幻灯片
                                      ┌ 批注 3 ┐
                                      └ 工作台 ┘
```

默认状态：

- 标签吸附在当前工作区右侧边缘。
- 标签宽度建议 `36px` 到 `44px`。
- 文案优先显示 `批注`，可附带数量，例如 `批注 3`。
- 标签层级高于表格和矩阵，低于全局模态弹窗。

展开状态：

- 抽屉宽度建议 `360px` 到 `420px`。
- 抽屉从右侧滑入，不挤压主页面。
- 背景使用 Apple shell demo 的浅色半透明表面、低噪声边框和轻阴影。
- 表格区域不变形，宽表格仍可横向滚动。

### 3.2 动画规则

动画必须轻、稳、可预测：

- 收起到展开：`transform: translateX(0)`，建议 `220ms` 到 `260ms`。
- 展开到收起：建议 `180ms` 到 `220ms`。
- 可叠加轻微 `opacity` 变化，但不做强烈弹跳。
- 支持 `prefers-reduced-motion: reduce`，在低动画偏好下取消滑动或缩短动画。
- 抽屉不应触发表格 reflow；只改变自身 `transform`。

### 3.3 抽屉信息架构

V1B 抽屉先聚焦批注：

```text
批注
├── 当前上下文
├── 添加批注
├── 当前对象批注
├── 当前页面批注
└── 全部批注入口
```

当前上下文自动带出：

- 页面名称
- 当前路由
- 当前对象类型
- 当前对象标题 / 编码
- 幻灯片页码或表格行信息
- 自动标签

示例：

```text
页面：安全技术架构设计方法
对象：第 12 页幻灯片
标签：安全指南、幻灯片、安全技术架构设计方法
```

### 3.4 批注对象锚点

批注必须支持多粒度锚点：

| 锚点类型 | 示例 | 阶段 |
|---|---|---|
| 页面级 | `/guides/security-architecture-method` | V1B |
| 对象级 | `base:capability_focus:T-AS.AD-01` | V1B |
| 表格行级 | 某个安全技术服务、标准控制项、流程记录 | V1B |
| 关系级 | 某个能力 -> 标准条款映射 | V2 |
| 字段级 | 某个表格单元格或详情字段 | V2 |
| 选中文本级 | 指南或文档中的一段文字 | V3 |

## 4. 批注清单与状态

工作台必须提供全部批注清单和状态管理。这是批注系统从“页面便签”升级为“审查工作流”的关键。

### 4.1 批注状态

建议状态：

| 状态 | 含义 |
|---|---|
| `todo` / 待处理 | 已记录，尚未处理 |
| `reviewing` / 处理中 | 正在核查或修改 |
| `waiting_confirm` / 待确认 | 需要用户或业务确认 |
| `confirmed` / 已确认 | 结论已确认 |
| `closed` / 已关闭 | 已完成处理 |
| `deferred` / 暂不处理 | 当前接受保留或后置 |

### 4.2 批注清单字段

批注清单至少包含：

| 字段 | 说明 |
|---|---|
| `id` | 批注 ID |
| `body` | 批注正文 |
| `status` | 批注状态 |
| `target_ref` | 目标对象 |
| `anchor_type` | 页面 / 对象 / 行 / 关系 / 字段 |
| `page_route` | 页面路由 |
| `page_title` | 页面标题 |
| `object_type` | 对象类型 |
| `object_title` | 对象标题 |
| `tags` | 自动标签和用户标签 |
| `created_at` | 创建时间 |
| `updated_at` | 更新时间 |

主展示区不得显示 `raw_value`、`sheet`、`row`、`column`、`metadata` 等非业务字段。来源证据仍只在折叠证据区出现。

## 5. 工作台信息架构

工作台从批注抽屉扩展而来，但不应一次性把所有功能堆在抽屉第一屏。

建议结构：

```text
工作台
├── 批注
├── 待复核
├── 数据篮
├── 导出
├── 能力重组
├── 我的版本
├── 导入
└── Skill
```

### 5.1 批注

能力：

- 查看当前页批注。
- 查看当前对象批注。
- 查看全部批注。
- 按状态、标签、页面、对象类型筛选。
- 修改状态。
- 跳回批注所在页面和对象。

### 5.2 待复核

能力：

- 聚合状态为 `todo`、`reviewing`、`waiting_confirm` 的对象。
- 支持从批注、导入草稿、Skill 输出生成待复核项。
- 支持批量关闭、后置、加入数据篮。

### 5.3 数据篮

数据篮是导出的前置容器。

能力：

- 将当前对象加入数据篮。
- 将当前筛选结果加入数据篮。
- 将当前表格行或关系加入数据篮。
- 数据篮内支持删除、分组、排序、去重。
- 数据篮可直接进入导出预览。

### 5.4 导出

导出统一放在工作台，不在每个页面各做一套完整导出系统。

页面可保留轻入口：

- `导出当前视图`
- `加入数据篮`

工作台导出中心支持：

- 当前页面
- 当前筛选
- 数据篮
- 当前工作区
- 基础库 + 批注
- 基础库 + 我的版本
- 全量用户库备份

导出前必须有预览摘要和字段边界检查。

### 5.5 能力重组

能力重组是用户自定义能力模型，不是直接修改基础能力树。

支持：

- 自定义 L0 能力分类。
- 自定义 L1 能力域。
- 自定义 L2 安全能力。
- 自定义关注点。
- 将现有基础能力按需放入新的能力分类。
- 继承现有能力相关信息：安全技术服务、模块 / 措施、标准控制项、流程、职能、来源证据。
- 新能力支持标题、编码、描述、状态、标签编辑。
- 支持能力模型版本，例如 `我的能力模型 V1`、`客户 A 能力模型 V2`。

基础能力树仍保留原始 SAPD 权威结构；用户重组能力树作为 overlay 展示。

### 5.6 我的版本

能力：

- 从基础对象复制为用户版本。
- 编辑用户版本标题、描述、状态。
- 维护用户版本关系。
- 清晰区分 `基础对象` 与 `我的版本`。

### 5.7 导入

导入不能直接覆盖基础库。

导入流程：

```text
选择文件 -> 解析预览 -> 字段映射 -> 待审核区 -> 用户库草稿 -> 确认后进入我的版本 / 数据篮 / 工作台
```

导入结果默认进入用户库草稿或待审核区。后续如需纳入基础库，必须走独立 ETL 和治理流程。

### 5.8 Skill 集成

Skill 集成应作为工作台的动作层，而不是直接改基础数据。

Skill 可作用于：

- 当前批注
- 当前对象
- 数据篮
- 当前工作区
- 导入草稿
- 我的能力模型

Skill 输出必须进入：

- 批注草稿
- 待复核项
- 用户版本草稿
- 导出预览

禁止 Skill 输出静默覆盖基础对象或权威关系。

## 6. 数据模型建议

当前 `user_favorites` 可作为过渡兼容，但新设计应以 `user_notes`、`user_workspaces`、`user_data_basket` 和 `user_custom_*` 为主。

### 6.1 批注表

```sql
CREATE TABLE IF NOT EXISTS user_notes (
  id TEXT PRIMARY KEY,
  target_ref TEXT NOT NULL,
  anchor_type TEXT NOT NULL DEFAULT 'object',
  page_route TEXT,
  page_title TEXT,
  object_type TEXT,
  object_title TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  tags_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 6.2 数据篮表

```sql
CREATE TABLE IF NOT EXISTS user_data_baskets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_data_basket_items (
  id TEXT PRIMARY KEY,
  basket_id TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  object_type TEXT,
  object_title TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(basket_id, target_ref)
);
```

### 6.3 能力重组表

```sql
CREATE TABLE IF NOT EXISTS user_capability_models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_capability_model_nodes (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  parent_id TEXT,
  source_ref TEXT,
  node_type TEXT NOT NULL,
  code TEXT,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_capability_model_relations (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  source_node_id TEXT NOT NULL,
  target_ref TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

## 7. API 建议

### 7.1 批注 API

```text
GET /api/v1/user/notes
GET /api/v1/user/notes?target_ref=<target_ref>
GET /api/v1/user/notes?page_route=<route>
POST /api/v1/user/notes
PATCH /api/v1/user/notes/:id
DELETE /api/v1/user/notes/:id
```

### 7.2 数据篮 API

```text
GET /api/v1/user/data-baskets
POST /api/v1/user/data-baskets
PATCH /api/v1/user/data-baskets/:id
DELETE /api/v1/user/data-baskets/:id
GET /api/v1/user/data-baskets/:id/items
POST /api/v1/user/data-baskets/:id/items
DELETE /api/v1/user/data-baskets/:id/items/:item_id
```

### 7.3 导出 API

```text
POST /api/v1/user/exports/preview
POST /api/v1/user/exports
GET /api/v1/user/exports/:id
GET /api/v1/user/exports/:id/download
```

### 7.4 能力重组 API

```text
GET /api/v1/user/capability-models
POST /api/v1/user/capability-models
PATCH /api/v1/user/capability-models/:id
GET /api/v1/user/capability-models/:id/nodes
POST /api/v1/user/capability-models/:id/nodes
PATCH /api/v1/user/capability-models/:id/nodes/:node_id
POST /api/v1/user/capability-models/:id/reclassify
```

`reclassify` 用于把基础能力放入用户自定义分类：

```json
{
  "source_ref": "base:capability:T-AD.SA",
  "target_parent_node_id": "user-node-l1-detect",
  "inherit_relations": true
}
```

## 8. 阶段路线

| 阶段 | 名称 | 范围 |
|---|---|---|
| V1B / `OI-128C` | 右侧浮层批注抽屉 | 下线横向收藏条；实现右侧浮层标签、抽屉、当前上下文、添加批注、当前页 / 当前对象批注列表 |
| V2 | 工作台总览 | 全部批注清单、状态筛选、待复核、数据篮 |
| V3 | 导出中心 | 当前页、筛选、数据篮、工作区、批注、我的版本导出 |
| V4 | 能力重组 | 自定义 L0-L2 / 关注点，重新分类基础能力并继承相关信息 |
| V5 | 导入与 Skill 集成 | 导入待审核区、Skill 输出进入批注 / 待复核 / 用户版本草稿 |

## 9. `OI-128C` 验收标准

`OI-128C` 只实现右侧浮层批注抽屉的第一版，不实现能力重组和导出中心。

验收标准：

- 当前横向 `加入关注清单 / 收藏备注` 条从主内容区移除。
- 页面右侧出现浮层 `批注` 标签。
- 点击标签后抽屉从右侧平滑滑出。
- 抽屉不挤压表格、矩阵或幻灯片。
- 抽屉自动识别当前页面和当前对象标签。
- 在 `安全技术架构设计方法` 幻灯片页可读到用户已写备注。
- 可新增页面级或对象级批注。
- 批注支持状态字段，至少包含 `待处理`、`待确认`、`已关闭`。
- API 不可用时显示 `用户库不可用`，不伪装为空列表。
- 主展示区不泄露原始来源字段。
- 真实 Chrome 截图回归覆盖安全指南页、知识库字典页、标准 / 框架页和安全能力映射页。

## 10. 后续变更要求

后续相关变更必须遵守：

- 不再新增横向收藏 / 备注条。
- 不再把 `收藏` 作为主业务动作。
- 用户动作统一从右侧浮层批注 / 工作台进入。
- 能力重组必须以用户能力模型 overlay 实现，不直接改基础能力树。
- 导入和 Skill 输出必须先进用户库草稿或待审核区。
- 导出必须经过预览摘要和字段边界检查。
- 所有用户写入必须写入 `sapd_wiki_user.sqlite3` 和变更日志。
- 不允许用户写入静默覆盖基础库、基础数据包或 base DB。
