# ArchiMate 3.2 / SAPD 元素与图例 Registry V1

日期：2026-06-02

本文件说明 `config/archimate/archimate-sapd-notation-registry.v1.json` 的建模口径。该 registry 来自 `data/raw-samples/drawio sample.drawio` 第一页 `图例`，用于后续替换前端临时 `ARCHIMATE_NOTATION_REGISTRY`，并作为 SAPD 元素类型、ArchiMate 3.2 基准元素和 draw.io notation 的统一来源。

## 1. 当前范围

本轮只完成第一页 `图例` 的建模：

```text
sapd_element_type_id
  -> archimate_element_type_id
  -> sapd_archimate_notation
  -> draw.io source_cell_id
```

当前不处理：

- 第二页 `元模型`；
- 第三页 `信息化环境及对象底图`；
- 元模型边；
- 环境实例；
- 前端渲染替换；
- ETL、数据库、ViewModel 或导出 JSON。

## 2. 产物位置

| 文件 | 用途 |
|---|---|
| `config/archimate/archimate-sapd-notation-registry.v1.json` | 机器可读 registry，后续可被脚本、ETL 或前端构建读取 |
| `docs/02-data-model/archimate-sapd-element-registry-v1.md` | 当前人工审阅说明 |
| `docs/02-data-model/archimate-sapd-environment-mapping-design.md` | 总体设计和信息化环境映射页面落点 |

## 3. Registry 结构

| 顶层字段 | 说明 |
|---|---|
| `meta` | 版本、来源文件、来源页面和边界说明 |
| `archimate_element_types` | 当前启用的 ArchiMate 3.2 基准元素子集 |
| `sapd_element_types` | SAPD 元素类型清单，包含 `sapd_subtype` 或 `sapd_subtypes` |
| `notation_entries` | 每个 SAPD 元素类型对应的 draw.io 图例样式和来源 cell |
| `relation_notation_candidates` | 第一页关系线图例，只作为线型候选，包含 `sapd_relation_subtype` |
| `metamodel_edges` | 暂为空，等待用户更新第二页 `元模型` 后再写入 |
| `unresolved` | 待处理或待确认事项 |

## 4. 数量摘要

| 类型 | 数量 |
|---|---:|
| ArchiMate 基准元素 | 18 |
| SAPD 元素类型 | 32 |
| draw.io notation | 32 |
| 关系线候选 | 3 |
| 元模型边 | 0 |

## 5. SAPD 元素分组

### 5.1 信息化基础元素

| 图例元素 | ArchiMate 3.2 元素 | SAPD 子类型 | 来源 cell |
|---|---|---|---|
| 人员 | `Business Actor` | `person / person_group` | `7ItswNm4vXiC20CjoquN-13` |
| 系统软件 | `System Software` | `system_software` | `AAQXr0sE322LsEo370Wa-160` |
| 设备 | `Device` | `device` | `AAQXr0sE322LsEo370Wa-159` |
| 节点 | `Node` | `node` | `AAQXr0sE322LsEo370Wa-158` |
| 网络 | `Communication Network` | `network` | `7ItswNm4vXiC20CjoquN-9` |
| 设施 | `Facility` | `facility` | `7ItswNm4vXiC20CjoquN-11` |
| 地点 | `Location` | `location` | `AAQXr0sE322LsEo370Wa-157` |
| 分组 | `Grouping` | `grouping` | `7ItswNm4vXiC20CjoquN-3` |
| 应用组件 | `Application Component` | `application_component` | `AAQXr0sE322LsEo370Wa-161` |
| 应用功能 | `Application Function` | `application_function` | `vQ8R7M-gHEICZEnD_mai-4` |
| 应用服务 | `Application Service` | `application_service` | `FsAD_74Q9mUPb6IP9m1h-3` |
| 数据对象 | `Data Object` | `data_object` | `FsAD_74Q9mUPb6IP9m1h-16` |

### 5.2 SAPD 安全元素

| 图例元素 | ArchiMate 3.2 元素 | SAPD 子类型 | 来源 cell | 状态 |
|---|---|---|---|---|
| 安全人员 | `Business Actor` | `security_person` | `FsAD_74Q9mUPb6IP9m1h-30` | `active` |
| 安全技术服务 | `Technology Service` | `security_technical_service` | `G4A913ovFA3HE-56RTNh-9` | `active` |
| 安全技术模块 | `Technology Function` | `security_technical_module` | `G4A913ovFA3HE-56RTNh-11` | `active`，来源图写作 `Function`，按 SAPD 技术语义映射为 `Technology Function` |
| 安全系统 | `Node` | `security_system` | `G4A913ovFA3HE-56RTNh-4` | `active` |
| 安全技术工件 | `Artifact` | `security_technical_artifact` | `G4A913ovFA3HE-56RTNh-3` | `active` |
| 安全系统软件 | `System Software` | `security_system_software` | `G4A913ovFA3HE-56RTNh-18` | `active` |
| 安全设备 | `Device` | `security_device` | `G4A913ovFA3HE-56RTNh-5` | `active` |
| 安全威胁 | `Technology Event` | `security_threat` | `G4A913ovFA3HE-56RTNh-1` | `active` |
| 安全应用 / 安全应用组件 | `Application Component` | `security_application_component` | `vQ8R7M-gHEICZEnD_mai-0` | `active` |
| 安全应用功能 | `Application Function` | `security_application_function` | `FsAD_74Q9mUPb6IP9m1h-6` | `active` |
| 安全应用服务 | `Application Service` | `security_application_service` | `FsAD_74Q9mUPb6IP9m1h-9` | `active` |
| 安全数据 | `Data Object` | `security_data` | `FsAD_74Q9mUPb6IP9m1h-19` | `active` |

### 5.3 SAPD 安全管理元素

| 图例元素 | ArchiMate 3.2 元素 | SAPD 子类型 | 来源 cell | 状态 |
|---|---|---|---|---|
| 安全组织单元 | `Business Actor` | `security_org_unit` | `FsAD_74Q9mUPb6IP9m1h-49` | `active` |
| 安全工作岗位 | `Business Actor` | `security_work_position` | `FsAD_74Q9mUPb6IP9m1h-50` | `active`，当前确认岗位作为可承担工作的施动者建模 |
| 安全工作职能 / 角色 | `Business Role` | `security_work_function` | `FsAD_74Q9mUPb6IP9m1h-47` | `active`，当前确认职能和角色合并为职责身份 / 责任集合 |
| 安全流程类别（1级） | `Business Process` | `security_process_l1` | `FsAD_74Q9mUPb6IP9m1h-52` | `active` |
| 安全职能流程组（2级） | `Business Process` | `security_process_l2` | `FsAD_74Q9mUPb6IP9m1h-57` | `active` |
| 安全职能流程（3级） | `Business Process` | `security_process_l3` | `FsAD_74Q9mUPb6IP9m1h-58` | `active` |
| 流程活动（4级） | `Business Process` | `security_process_activity_l4` | `FsAD_74Q9mUPb6IP9m1h-59` | `active` |
| 活动任务（5级） | `Business Process` | `security_activity_task_l5` | `FsAD_74Q9mUPb6IP9m1h-60` | `active` |

## 6. 关系线候选

第一页关系线只表示 notation，不表示元模型边。

| 图例关系 | ArchiMate 3.2 Relationship | SAPD 子类型 | 来源 cell | 处理方式 |
|---|---|---|---|---|
| 服务关系 | `Serving` | `serving_relation` | `FsAD_74Q9mUPb6IP9m1h-35` | 作为线型候选 |
| 数据流 / 控制流 | `Flow` | `flow_relation` | `FsAD_74Q9mUPb6IP9m1h-37` | 作为线型候选 |
| 访问关系 | `Access` | `access_relation` | `FsAD_74Q9mUPb6IP9m1h-41` | 作为线型候选 |

## 7. 当前待复核项与已确认口径

| 项目 | 原因 | 当前处理 |
|---|---|---|
| `安全工作岗位 -> Business Actor` | SAPD 当前版本把岗位视为可承担工作的施动者，例如“安全架构师岗”“安全运营岗” | 已确认，状态改为 `active` |
| `安全工作职能 / 角色 -> Business Role` | SAPD 当前版本不再拆“岗位、角色、职能”三套概念，职能 / 角色统一表达岗位承担的职责身份 / 责任集合 | 已确认，显示名使用“安全工作职能 / 角色” |
| `security_authorization_role` | 授权角色属于后续 RBAC 范畴，不混入当前 ArchiMate 管理元素 | 当前不建，后续确有 RBAC 需求时单独建模 |
| `安全技术模块 -> Technology Function` | 来源图标签是泛化 `Function`，不是显式 `Technology Function` | 因 SAPD 定义为安全技术逻辑实体，当前先映射为 `Technology Function` |
| `人员 / 安全人员 -> Business Actor` | draw.io 使用 actor 图标，ArchiMate 3.2 标准中常用基准为 `Business Actor` | 当前按 `Business Actor` 建模 |
| 元模型边 | 第二页尚未更新 | 暂不识别，保持 `metamodel_edges=[]` |

当前管理元素关系口径：

| SAPD 概念 / 类型 | ArchiMate 元素 | 当前口径 |
|---|---|---|
| `security_org_unit` | `Business Actor` | 安全人员所属组织，也作为可承担责任的业务参与者处理 |
| `security_work_position` | `Business Actor` | 岗位作为可承担工作的施动者处理 |
| `security_person` | `Business Actor` | 安全人员作为参与安全工作的施动者处理 |
| `security_work_function` | `Business Role` | 职能 / 角色统一为岗位或人员承担的职责身份 / 责任集合 |
| `security_process_*` | `Business Process` | L1-L5 流程、活动、任务统一按业务过程族处理 |

```text
安全工作岗位（Business Actor）
  assigned to
安全工作职能 / 角色（Business Role）
  assigned to
流程 / 活动 / 任务（Business Process）
```

该口径承接原图中的 `岗位 : 职能 = 1 : N`。当前版本不再单独建立 `security_role` 作为第三类管理元素；业务上说“角色”时，等同于 `security_work_function`，因此 `岗位 : 角色` 与 `岗位 : 职能` 是同一组 `1:N` 关系。这样可以避免把 ArchiMate `Business Role`、SAPD 安全工作职能和 RBAC 授权角色混在一起，便于后续绘制元模型图、信息化环境视图和安全环境视图。

## 8. 后续使用方式

后续前端替换时，不应继续把图例硬编码在 `app.js` 中，而应从 registry 生成或导入：

```text
config/archimate/archimate-sapd-notation-registry.v1.json
  -> frontend ARCHIMATE_NOTATION_REGISTRY
  -> 统一 ArchiMate / SAPD renderer
```

后续 ETL / draw.io 解析时，应先按 `source_cell_id` 和 draw.io style 匹配 notation；无法匹配的元素标记为：

```text
待映射 / 非标准图例
```

不得把无法识别的自由图形渲染成标准 ArchiMate / SAPD 元素。
