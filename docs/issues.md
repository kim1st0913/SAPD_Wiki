# 文档审查问题记录

本文档记录用户 review 后发现的问题、修复状态和处理说明。

## 严重

### 阶段计划三份文档不一致

状态：已修复

修复说明：

- 明确 `task_plan.md` 是唯一权威阶段表。
- `docs/project-plan.md` 改为面向用户阅读的解释版，并声明阶段划分以 `task_plan.md` 为准。
- `work-knowledge-base-project-plan.md` 顶部加入“历史参考说明”，不再作为当前执行计划来源。
- `task_plan.md` 更新为当前 Phase 1，Phase 0 标记完成。

### 多处引用不存在的文件

状态：已修复

修复说明：

- 新增 `docs/data-model.md`，作为 Phase 3 数据模型设计占位文档。
- 新增 `docs/user-guide.md`，作为后续用户指南占位文档。
- 将 `docs/sample-files.md` 修正为 `docs/sample-file-inventory.md`。
- 更新 `AGENTS.md`、`findings.md`、`docs/project-plan.md` 中的相关引用。

### `task_plan.md` 状态过期

状态：已修复

修复说明：

- `Current phase` 改为 Phase 1 - 数据发现与字段定义。
- Phase 0 标记为 `complete`。
- Phase 1 标记为 `in_progress`。
- Phase 2 标记为 `in_progress`，因为 README、`.gitignore` 和 Git 初始化已完成，但完整工程骨架尚未完成。
- 将样例文件确认事项移动到 Phase 1 Tasks。

## 中等

### `progress.md` 内部矛盾

状态：已修复

修复说明：

- 保留历史记录，但把早期 “not currently a Git repository” 改为“当时状态”，并说明已被后续 Git 初始化和提交工作取代。

### `docs/import-rules.md` 章节编号重复

状态：已修复

修复说明：

- 将 `## 5.1 安全能力成熟度评估表示例` 改为 `### 5.1 安全能力成熟度评估表示例`，作为第 5 节 Excel 映射示例下的子章节。

### `findings.md` 含本地绝对路径

状态：已修复

修复说明：

- 将本地绝对路径改为“用户提供的非开发者实施指南”。
- 同时将 `findings.md` 统一改为中文表达，降低阅读门槛。

### `work-knowledge-base-project-plan.md` 权限过严

状态：已修复

修复说明：

- 文件权限已从 `600` 调整为 `644`。
- 文件顶部已加入历史参考说明，当前执行以 `task_plan.md`、`docs/project-plan.md`、`docs/architecture.md` 和 `AGENTS.md` 为准。

## 轻微

### 语言不统一

状态：已修复

修复说明：

- `findings.md` 已由英文为主改为中文为主。

### 技术选型重复定义

状态：已修复

修复说明：

- 新增 `docs/technology-decisions.md` 作为技术选型集中记录。
- `docs/project-plan.md` 明确技术路线以 `docs/technology-decisions.md` 为权威记录。
- `docs/architecture.md` 增加“技术选型以 `docs/technology-decisions.md` 为集中记录”的原则。
- 其他文档中少量出现技术名词属于上下文说明或任务示例，不再作为独立权威定义。

### `docs/sample-file-inventory.md` 缺少状态说明

状态：已修复

修复说明：

- 文件开头已明确说明这是待填写模板，不代表盘点已经完成。

