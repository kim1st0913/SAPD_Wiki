# progress.md

本文件是当前会话恢复入口，只保留最近状态和历史索引。完整执行历史已归档到 `docs/05-archive/progress-history/2026-05.md`。

## 当前状态（2026-05-19 23:06:27）

- 当前分支：`codex-frontend-backend-separation-closure`。
- 当前重点：标准 / 框架数据导入、标准页统计与前端资源缓存修复后的收口。
- 本轮提速动作：已将 1747 行 `progress.md` 归档瘦身，避免后续会话恢复反复加载过长进度日志。
- 本地预览：`127.0.0.1:5173` 当前保留项目服务 `scripts/sapd_wiki.py serve --host 127.0.0.1 --port 5173`。
- 注意：工作区仍有较多未提交改动，继续开发前应优先 checkpoint commit。

## 最近完成事项

### 2026-05-19 NIST 800-53 Rev.5 原始表核对

- 已核对 `data/raw-samples/wiki sample.xlsx` 的 `NIST 800-53rev5` 页与 `NIST.SP.800-53r5.pdf` Appendix C。
- 有效控制 / 增强项 1007 条，与 PDF 非撤销项集合一致。
- 发现并记录 `PE-12(1)` 英文标题差异，后续用户已修订原始文件。
- 新增核对报告 `docs/03-import-etl/nist-800-53rev5-vs-raw-check.md`。

### 2026-05-19 NIST 800-53 Rev.5 导入与标准页统计优化

- 已导入 `NIST-800-53-REV5`：1 个标准框架对象、1007 条 `standard_control`、1007 条 `belongs_to_framework` 关系、2015 条来源引用。
- 标准页标题统计改为业务口径：NIST 显示 20 个安全控制类、298 项安全控制、1007 条安全策略。
- NIST 表格已调整：`安全控制项` 合并中英文名称；`安全类型` 使用 O / S / O/S，并在表头显示说明。
- 前端资源版本已提升到 `standard-summary-20260519-nist-2`，避免浏览器缓存旧统计逻辑。

### 2026-05-19 提速收口

- 诊断发现 `progress.md` 已增长到 1747 行，工作区 diff 约 3400 行。
- 已关闭重复的普通 `python -m http.server 5173`，仅保留项目 API 服务。
- 已将根目录 `progress.md` 完整内容追加归档，并重写为轻量入口。

## 最近验证

- `python3 -m py_compile src/sapd_wiki/parsers.py src/sapd_wiki/exports.py src/sapd_wiki/cli.py`：通过。
- `node --check frontend/capability-browser/components/StandardFrameworkTable.js frontend/capability-browser/components/AppShell.js frontend/capability-browser/app.js frontend/capability-browser/viewModels.js`：通过。
- `git diff --check`：最近验证通过；本次瘦身后需重新执行。
- `curl http://127.0.0.1:5173/`：返回 200。
- `curl http://127.0.0.1:5173/api/v1/capabilities/workspace-projection`：返回 200。

## 历史索引

| 归档文件 | 内容 |
|---|---|
| `docs/05-archive/progress-history/2026-05.md` | 2026-05 完整执行记录与本次瘦身前快照 |
| `docs/05-archive/findings-history/2026-05.md` | 2026-05 历史发现 |
| `docs/05-archive/context-slimming-2026-05-15/` | 2026-05-15 上下文瘦身快照 |

## 维护规则

- 本文件只保留最近 1-3 次重要执行和当前恢复信息。
- 超过 120 行时继续归档到 `docs/05-archive/`。
- 详细过程、长命令输出和阶段性历史不写入根目录 `progress.md`。
