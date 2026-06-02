# data/exports 分类清单（2026-06-01）

本清单只对 `data/exports/` 做分类登记，不移动、不删除任何 `data/exports/worker-verify` 文件。

## 当前概况

| 路径 | 当前大小 / 数量 | 分类 |
|---|---:|---|
| `data/exports/` | 约 `600MB` | 本地导出总目录 |
| `data/exports/worker-verify/` | 约 `529MB`，42 个文件 | 人工校对 / Worker 验证材料，暂不动 |
| `data/exports/data-quality/` | 约 `84KB` | 数据质量报告 |
| `data/exports/maturity/` | 约 `340KB` | maturity 侧线导出 |
| `data/exports/import-review-latest/` | 约 `144KB` | 导入审查报告集合 |
| `data/exports/clean-*` | 每个约 `3.8MB` | 历史 clean 导出快照，可再生或归档 |
| `items-latest*`、`relations-latest*`、`relations-with-history-latest/` | 约 `22MB` | 当前通用 items / relations 导出 |
| 顶层 `knowledge-items.*`、`knowledge-relations.*` | 约 `36MB` | 通用对象 / 关系导出 |
| 顶层 `import-summary-*`、`import-result-report-*`、`warning-review-*` | 小文件 | 零散导入报告 |

## 分类建议

| 分类 | 包含 | 建议 |
|---|---|---|
| 保留，不动 | `worker-verify/` | 当前仍可能支撑 `OI-038` Gartner 候选映射人工校对，不移动、不删除 |
| 保留，可定期重建 | `items-latest*`、`relations-latest*`、`relations-with-history-latest/`、顶层 `knowledge-items.*`、`knowledge-relations.*` | 后续如需释放空间，可先确认重建命令，再归档旧版 |
| 保留，治理参考 | `data-quality/` | 小体积，保留用于数据问题追溯 |
| 侧线保留 | `maturity/` | 属 maturity 模块侧线，不并入本轮主库清理 |
| 可归档候选 | `clean-491f6322/`、`clean-d1c3fe17/`、`clean-e85cfb35/` | 历史 clean 快照，后续可移动到 `data/exports/archive/` 或项目外部归档 |
| 可归档候选 | 顶层 `import-summary-*`、`import-result-report-*`、`warning-review-*`、`import-review-latest/` | 如果当前 Open Issues 不再引用，可归档 |

## 本轮动作

- 未移动 `data/exports/worker-verify/`。
- 未删除 `data/exports/` 下任何文件。
- 未创建 `data/exports/archive/`。
- 仅生成本文档作为分类清单。

## 后续执行条件

真正移动或删除 `data/exports/` 文件前，需要先确认：

- `OI-038` 是否仍需要 `worker-verify` 中的候选映射 CSV。
- 当前 release / bundle 是否依赖某些导出文件。
- 是否已记录可重建命令。
- 是否需要先把历史快照移动到项目外部归档。
