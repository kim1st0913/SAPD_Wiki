# ZIP-UAT-0 macOS Alpha UAT Checklist

> 适用包：`SAPD-Wiki-v0.1.0-mac-arm64.zip`  
> 状态：内部小范围试用清单  
> 记录方式：每位试用人员复制本清单，逐项填写结果。

| 编号 | 检查项 | 结果 | 备注 |
|---|---|---|---|
| 1 | ZIP 可正常解压 | 待验证 | 记录解压路径 |
| 2 | `start-macos.command` 可启动 | 待验证 | 记录是否双击启动 |
| 3 | 未安装 Python / Node / Docker 的机器上能否运行 | 待验证 | 如机器已安装，也请备注 |
| 4 | 浏览器是否自动打开 | 待验证 | 记录浏览器名称 |
| 5 | 首页是否可访问 | 待验证 | 记录本地 URL |
| 6 | `GET /api/v1/base/summary` 是否返回正确数量 | 待验证 | 记录 `knowledge_items`、`knowledge_relations` |
| 7 | 收藏或备注是否可写入 | 待验证 | alpha 优先测试收藏 |
| 8 | 重启后用户收藏或备注是否保留 | 待验证 | 关闭后重新启动确认 |
| 9 | 删除 `data/user/sapd_wiki_user.sqlite3` 后是否能自动重建 | 待验证 | 删除前请先备份或只在测试包中操作 |
| 10 | base DB 是否保持不变 | 待验证 | 对比 `base-manifest.json` 中 hash |
| 11 | 端口 `18765` 被占用时是否能切换 | 待验证 | 可由维护者协助测试 |
| 12 | 启动失败时 `logs/runtime.log` 是否可读 | 待验证 | 记录失败原因 |
| 13 | diagnostics 是否可导出 | 待验证 | 记录诊断包文件名 |
| 14 | 诊断包是否不含用户数据库原文件和用户备注全文 | 待验证 | 检查 ZIP 文件列表 |
| 15 | macOS Gatekeeper / 权限提示是否可按说明处理 | 待验证 | 截图并记录处理方式 |

## 验收结论

```text
试用人：
机器型号：
芯片类型：
macOS 版本：
ZIP 文件名：
是否通过：
阻塞问题：
诊断包文件名：
```

## 通过标准

内部 alpha 小范围试发通过的最低标准：

- 至少 1 台 Apple Silicon Mac 可解压启动；
- 首页可访问；
- base summary 可读；
- 收藏写入 user DB；
- 重启后收藏保留；
- diagnostics 可导出；
- 未发现诊断包包含用户库原文件或用户备注全文。
