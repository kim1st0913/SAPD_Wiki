# ZIP Alpha 内部试用反馈模板

请试用人员复制以下模板填写，并随反馈附上 diagnostics ZIP。

当前 macOS arm64 alpha 试发材料来自：

```text
"/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle/dist/releases/0.1.0-alpha/"
```

## 1. 基本信息

| 项 | 内容 |
|---|---|
| 试用人 |  |
| 机器型号 |  |
| 芯片类型 | Apple Silicon / Intel |
| macOS 版本 |  |
| ZIP 文件名 |  |
| 解压路径 |  |
| 首次试用时间 |  |

## 2. 启动结果

| 项 | 结果 |
|---|---|
| 是否首次启动成功 | 是 / 否 |
| 是否出现权限提示 | 是 / 否 |
| 是否出现 Gatekeeper / 未签名提示 | 是 / 否 |
| 是否自动打开浏览器 | 是 / 否 |
| 本地 URL |  |
| 是否看到首页 | 是 / 否 |

## 3. 数据读写

| 项 | 结果 |
|---|---|
| base 数据是否可读 | 是 / 否 |
| `GET /api/v1/base/summary` 是否成功 | 是 / 否 |
| 收藏是否可写入 | 是 / 否 |
| 备注是否可写入 | 是 / 否 / 未测试 |
| 重启后用户数据是否保留 | 是 / 否 / 未测试 |
| 删除 user DB 后是否自动重建 | 是 / 否 / 未测试 |

## 4. diagnostics

| 项 | 内容 |
|---|---|
| 是否已导出 diagnostics | 是 / 否 |
| diagnostics 文件名 |  |
| 是否包含 `runtime.log` | 是 / 否 |
| 是否包含 `runtime-state.json` | 是 / 否 |
| 是否确认不含用户数据库原文件 | 是 / 否 |
| 是否确认不含用户备注全文 | 是 / 否 |

## 5. 问题描述

```text
请描述你遇到的问题、错误提示或异常表现。
```

## 6. 复现步骤

```text
1.
2.
3.
```

## 7. 截图

```text
请附上权限提示、浏览器错误、终端错误或页面异常截图。
```

## 8. 附件

```text
diagnostics ZIP：
其他附件：
```
