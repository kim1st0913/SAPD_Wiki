# scripts 目录说明

本目录只登记脚本分类和维护状态。具体命令、输入文件和操作步骤放在对应专题文档，避免和 README / 治理文档重复。

## 长期工具

这些脚本是项目日常开发和交付流程的一部分，可以被 README、CI、Agent 工作流或其他开发者长期引用。

| 脚本 | 用途 | 常用场景 |
|---|---|---|
| `sapd_wiki.py` | 项目主 CLI 入口，包含 `bootstrap-local-data` 一键初始化子命令 | README、`docs/03-import-etl/github-local-data-initialization.md` |
| `check_github_data_boundary.py` | GitHub 数据边界检查 | `docs/07-governance/data-governance.md` |
| `data_package_summary.py` | 前端数据包摘要检查 | `CURRENT_STATE.md` |
| `dev_server_guard.py` | 本地预览服务守护 | `CURRENT_STATE.md` |
| `frontend_smoke_check.mjs` | 前端页面 smoke 检查 | `CURRENT_STATE.md` |

## 专题脚本

这些脚本服务于某次数据处理、标准翻译或专项 ETL。它们可以保留用于复核历史，但不应默认作为通用开发入口。

| 脚本 | 用途 | 状态 |
|---|---|---|
| `translate_dsp_2026_sheet.py` | DSP 2026 Sheet 翻译辅助 | 专题脚本 |
| `verify_dsp_2026_translation.py` | DSP 2026 翻译结果验证 | 专题脚本 |
| `etl_dsp_2026_csf_maturity.py` | DSP 2026 / CSF 成熟度相关 ETL | 专题脚本 |

## 新增脚本规则

- 能被多人长期复用的脚本，放在“长期工具”表。
- 只服务于某次导入、校验、翻译、修表或数据修复的脚本，放在“专题脚本”表。
- 不要把真实原始资料路径、个人桌面路径或敏感文件名硬编码成唯一入口；需要默认路径时，应提供命令行参数覆盖。
- 新脚本如果会生成数据，应默认输出到已忽略的本地目录，例如 `data/processed/`、`data/exports/` 或 `frontend/capability-browser/public/data/`。
- 新脚本如果用于提交前或 CI 检查，应尽量不依赖本地原始数据。
