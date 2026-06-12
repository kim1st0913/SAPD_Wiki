# 退役 Sheet 归档：信息化环境-信息化对象-安全作用域映射

- 退役日期：2026-06-11
- 原 Sheet 名：`信息化环境-信息化对象-安全作用域映射`
- 当前状态：已退役 / 已归档 / 不再作为 ETL 输入

## 退役原因

用户已从原始工作簿中删除该 Sheet。其原有内容已由 `作用域-安全技术服务-安全技术模块映射` 和后续底图详情投影覆盖，后续不再维护两套信息化环境、信息化对象、作用域和安全技术服务映射来源。

## 当前替代来源

- 信息化对象、作用域、服务、模块、措施的连续关系：`作用域-安全技术服务-安全技术模块映射`
- 环境底图节点详情：`frontend/capability-browser/generated/environmentBasemap.node-details.json`
- 环境底图语义绑定：`frontend/capability-browser/generated/environmentBasemap.semantic.json`

## 代码下线范围

- `src/sapd_wiki/cli.py`：`CORE_SHEETS` 不再包含该 Sheet。
- `src/sapd_wiki/parsers.py`：已删除 `parse_environment_scope_sheet`，`parse_core_sheets` 不再识别该 Sheet。

## 验证记录

- 当前 `data/raw-samples/wiki sample.xlsx` 已不包含该 Sheet。
- `python3 scripts/sapd_wiki.py bootstrap-local-data --profile full --workbook "data/raw-samples/wiki sample.xlsx" --reset` 不再因缺少该 Sheet 阻断。
- 底图绑定仍保持 `nodes=97`、`edges=73`、`bound=91`、`ignored=6`。

## 维护规则

后续不得重新把该 Sheet 加回核心导入、当前样本清单、剩余建模清单或前端数据契约。若未来需要恢复，只能作为新的业务需求重新设计，不沿用旧解析器。
