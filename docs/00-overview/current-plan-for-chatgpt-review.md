# SAPD Wiki 当前计划 Review 资料

本文档用于同步给外部 ChatGPT 做阶段 review。它是当前项目计划的摘要，不替代 `task_plan.md`。

## 1. 当前项目定位

SAPD Wiki 是一个本地运行的结构化工作知识库系统，当前核心数据源是 Excel。系统目标不是文件预览器，而是把 Excel 中的安全能力、作用域、技术服务、技术模块 / 措施、流程、职能、标准和岗位等内容结构化成可查询、可维护、可导出的关系知识库。

当前正式主线仍是：

1. 数据定义；
2. ETL / staging / review / approval；
3. 静态 JSON 作为 MVP API；
4. 前端通过 `dataClient` 和 ViewModel 展示业务关系；
5. 后续再扩展 PPT、Draw.io、DOCX 等多格式内容。

## 2. 重要边界

- 外部 ChatGPT 生成的 UI prototype、临时 Step 编号或编码方案，只作为 review / prototype 输入，不自动成为正式项目 Phase。
- 正式阶段以 `task_plan.md` 和 `docs/00-overview/project-roadmap.md` 为准。
- 当前不应直接进入正式 Phase 7 多格式增强，除非先完成已导入 Excel 数据的业务含义复核。
- 前端页面不应展示来源字段作为主内容；`sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`generated_at` 等只进入来源证据区，默认折叠。

## 3. 当前已完成

### 数据与 ETL

- 已跑通 Excel 导入 MVP：
  - source file 登记；
  - workbook reader；
  - Sheet parser；
  - staging preview；
  - validation report；
  - review-approved load；
  - local SQLite 正式表；
  - CSV / JSON / frontend JSON 导出。
- 已导入并处理多批 Sheet：
  - 安全能力目录；
  - 安全能力作用域目录；
  - 信息化环境-信息化对象-安全作用域映射；
  - 安全能力-安全技术服务；
  - 安全技术模块清单；
  - 作用域-安全技术服务-安全技术模块映射；
  - 安全能力-安全工作；
  - 安全能力-安全管理元素（high level）；
  - 安全职能流程清单；
  - 安全工作职能清单；
  - Gartner 工作岗位参考；
  - 第三批 LC-AP 相关 Sheet。
- 已完成 `security_technical_measures` 导出，当前安全技术措施按“措施名称 + 分类”去重后为 29 条。
- 已固化 G 列 `安全技术模块/措施` 分流规则：
  - 浅蓝底：安全技术模块；
  - 浅灰底：安全技术措施；
  - `N/A(...)`：说明类 / pending；
  - `/`：无适用服务，不生成服务或措施。

### 后端与接口契约

- 已形成后端接口设计：`docs/01-architecture/backend-interface-design.md`。
- 已形成字段级 API 契约：`docs/01-architecture/api-field-contract.md`。
- 已确认当前静态 JSON 是未来 `/api/v1/*` 的离线实现。
- 已确认后端负责：
  - ETL；
  - normalization；
  - master data；
  - relation generation；
  - validation；
  - frontend projection export。
- 已确认前端只负责：
  - navigation；
  - table / matrix / relation rendering；
  - filtering；
  - resizing；
  - detail interaction。

### 前端基线

当前静态前端已具备：

- 总览；
- 能力维度；
- 信息化环境维度；
- 专项知识维护：
  - 作用域清单；
  - 流程清单；
  - 职能清单；
  - 安全技术模块清单；
  - 安全技术措施清单；
  - 标准与岗位参考。

已完成：

- `dataClient` 抽象；
- ViewModel 层；
- 非业务字段清理；
- 来源证据默认折叠；
- 技术措施清单 6 列口径：
  1. 序号；
  2. 安全技术措施；
  3. 关联安全技术服务；
  4. 适用作用域；
  5. 关联信息化环境；
  6. 关联信息化对象。

## 4. 当前不建议立即做的事

- 不建议马上进入 PPT / Draw.io 多格式增强。
- 不建议继续做大规模视觉 polish。
- 不建议让前端继续猜测业务关系。
- 不建议把 ChatGPT 临时 UI 代码直接纳入正式工程主线。
- 不建议在已导入 Sheet 的业务含义未复核前，继续扩张新页面。

## 5. 下一步推荐主线

当前最建议进入：

**已完成映射 Sheet 的业务含义复核 + 前端关系展示校正。**

复核重点：

1. 每张已导入 Sheet 的业务含义；
2. 主对象是什么；
3. 主键或唯一约束是什么；
4. 是否存在 1:1、1:N、N:1、N:M；
5. 哪些字段是主展示字段；
6. 哪些字段只作为来源证据；
7. 哪些关系应进入能力维度、信息化环境维度或专项知识维护；
8. 哪些页面目前只是“技术上可显示”，但业务表达还不准确。

建议优先复核顺序：

1. 已完成第一批核心 Sheet；
2. 第二批管理、流程、职能、岗位相关 Sheet；
3. 第三批 LC-AP 生命周期相关 Sheet；
4. 再决定是否进入安全开发维度或数据生命周期维度页面深化。

## 6. 希望 ChatGPT Review 的问题

请重点 review：

1. 当前下一步是否应该优先做“已导入 Sheet 的业务含义复核”，而不是继续做 UI 或多格式增强？
2. 当前项目是否存在过度设计或治理文档堆积风险？
3. `security_technical_measures` 与 `security_technology_modules` 的边界是否清晰？
4. 当前前后端分离边界是否合理：后端负责业务关系，前端只消费投影？
5. 专项知识维护是否应该继续保持清单式页面，而不是转成复杂知识图谱？
6. 是否应该把外部 UI prototype 作为参考，而不是纳入正式 Phase？
7. 下一轮最值得确认的 Sheet 是哪些？

## 7. 当前判断

主控 Agent 当前判断：

- 可以继续使用当前前端作为数据关系排查工作台；
- 当前最重要的不是新功能，而是确保已导入数据的业务语义正确；
- 正式 Phase 7 多格式增强应后置；
- ChatGPT 的 review 价值主要在“计划合理性、过度设计风险、页面信息架构建议”，不应直接替代主控的数据契约决策。
