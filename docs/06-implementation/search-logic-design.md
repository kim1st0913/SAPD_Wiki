# 搜索逻辑设计

更新时间：2026-06-30

## 版本边界

本文件最初用于 `OI-144`，核心目标是解决“全局搜索与页面内搜索状态串线”。它仍然保留状态隔离、页面搜索作用域和空态规则。

全局搜索的产品形态、独立搜索结果页、`search-index` 加载边界和后续实施路线，以 `docs/06-implementation/global-search-redesign-2026-06-30.md` 为准。后续不得只按本文件继续给现有顶部搜索面板打补丁。

## 设计结论

SAPD Wiki 的搜索分为两类：

1. 顶部全局搜索：面向跨知识域查找，不直接过滤当前页面内容。
2. 页面内搜索 / 过滤：只影响当前模块、当前表格或当前关系视图。

两类搜索必须使用独立状态。任何搜索框输入都不得把内容同步到另一个搜索框，也不得跨页面复用同一个过滤条件。

## 状态边界

| 搜索 / 过滤入口 | 状态归属 | 影响范围 |
| --- | --- | --- |
| 顶部 `searchInput` | `globalSearch` | 全局检索入口；当前阶段不驱动页面过滤 |
| 能力映射 `capabilitySearchInput` | `pageSearches[capability-mapping]` | 能力树与当前能力映射工作台 |
| 环境映射 `environmentSearchInput` | `pageSearches[environment-mapping]` | 环境映射页当前映射视图 |
| 知识库 / 标准页 `sourceSearchInput` | `pageSearches[knowledge:*]` 或 `pageSearches[standards:*]` | 当前字典表、标准表或当前二级页 |
| LC-AP `devLifecycleStageSearch` | `devLifecycleStageSearch` | 开发安全生命周期阶段导航 |
| LC-DT `dataLifecycleStageSearch` | `dataLifecycleStageSearch` | 数据生命周期过程导航 |
| 能力关系表 `data-relation-filter` | `relationshipFilters` | 当前关系表字段级过滤 |
| 环境核对表 `data-environment-review-filter` | `environmentReviewFilters` | 环境核对表字段级过滤 |

## 页面搜索必要性

保留页面内搜索的页面：

- 安全能力映射：对象多、层级深，需要快速定位能力、关注点、作用域、服务、流程和模块。
- 环境映射：对象和映射关系多，需要在映射视图内局部定位。
- 知识库字典维护页：表格数据密集，需要按名称、编码、分组和关系过滤。
- 标准 / 框架页：控制项数量大，需要按控制编号、标题、域和层级过滤。
- LC-AP / LC-DT：阶段 / 过程导航需要快速定位。
- 环境核对表与能力关系表：属于表格级筛选，必须保留为局部过滤。

不设置页面内搜索的页面：

- 总览页：不是数据表或深层列表。
- 指南类内容页：内容固定，当前不做局部过滤。
- 占位页 / 未接入页面：避免输入后产生误导空态。

## 空态规则

页面内搜索无结果时，应提示“未找到匹配项”或同类文案。不得提示数据文件缺失、导出失败或系统错误。

数据包真正缺失或为空时，才显示数据缺失类提示。

## 回归规则

- 顶部全局搜索不得写入 `state.search`。
- 页面内搜索不得写入 `globalSearch` 或顶部搜索 DOM。
- 新增搜索框必须先明确状态归属，再接入渲染逻辑。
- 排序字段仍必须显式判断缺省值，不能使用 `value || fallback`。
