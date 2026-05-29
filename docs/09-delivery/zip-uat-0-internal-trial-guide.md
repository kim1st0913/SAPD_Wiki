# ZIP-UAT-0 内部试发指南

> 状态：alpha 内部试发准备  
> 日期：2026-05-29  
> 适用范围：`SAPD-Wiki-v0.1.0-mac-arm64.zip` 小范围内部试用  
> 不适用范围：Windows 正式试发、Tauri、`.dmg`、`.msi`、签名、自动更新、Docker、用户端 ETL

## 1. 当前结论

当前可以进入小范围内部试发的是：

```text
SAPD-Wiki-v0.1.0-mac-arm64.zip
```

该包是 ZIP 解压即用版，不是安装包。ZIP 是交付物，`SAPD-Wiki-Backend` 只是 ZIP 内部的 macOS arm64 运行组件。

Windows x64 仍处于：

```text
构建脚本就绪 / 未实机验证
```

不得把 Windows ZIP 标记为已完成真实运行验证，直到在 Windows x64 机器、Windows VM 或 Windows CI runner 上生成并验证 `SAPD-Wiki-Backend.exe`。

## 2. 试发包指纹

| 项 | 值 |
|---|---|
| ZIP 文件名 | `SAPD-Wiki-v0.1.0-mac-arm64.zip` |
| 当前试发路径 | `/private/tmp/sapd_zip_uat0/bundle/SAPD-Wiki-v0.1.0-mac-arm64.zip` |
| 后续默认生成目录 | `/Users/kim1st/Documents/kim note/04_workspace/analysis/research/知识库工程/sapd wiki bundle` |
| `app_version` | `0.1.0-alpha` |
| `bundle_type` | `zip-portable` |
| `platform` | `mac-arm64` |
| `build_time` | `2026-05-29T02:21:47Z` |
| `data_version` | `2026.05-alpha` |
| base schema | `base_schema_0.1` |
| user schema | `user_schema_0.1` |
| base DB hash | `3e1f50d9af9700e2ab0bde7dd46dd4cad05514faefc8ca0cbd61f718c278dd80` |
| backend binary hash | `6c538044ec337a112127191ba1834aa233dabf3f5c624110594cda0e6ed71419` |
| ZIP hash | `bb216ce25d3e6e76db16ce5d84017f3e799ff2963cac52110bba5fc97edc90f9` |
| backend binary size | `9,492,496 bytes` |
| base DB size | `708,177,920 bytes` |
| ZIP size | `190,149,724 bytes` |

如重新构建 ZIP，应重新计算本节 hash、大小和 `build_time`。

## 3. 试用人员操作说明

1. 下载 `SAPD-Wiki-v0.1.0-mac-arm64.zip`。
2. 解压到本地非系统目录，例如用户自己的 Documents 或 Downloads 下的测试目录。
3. 打开解压后的文件夹。
4. 双击 `start-macos.command`。
5. 如遇权限问题，按 `README-FIRST.md` 中说明执行 `chmod +x start-macos.command SAPD-Wiki-Backend`。
6. 如遇 macOS 未签名或 Gatekeeper 安全提示，记录提示截图；本 alpha 不做签名。
7. 浏览器打开后，确认首页可访问。
8. 浏览基础知识库内容，确认基础数据可读取。
9. 测试收藏一条对象，确认用户写入能力可用。
10. 关闭本地服务：关闭 `SAPD-Wiki-Backend` 运行窗口，或在终端中按 `Ctrl+C`。
11. 运行 `diagnostics/export-diagnostics.command` 导出诊断包。
12. 将诊断 ZIP、问题描述和截图反馈给项目维护者。

## 4. 用户不需要做什么

- 不需要安装 Python。
- 不需要安装 Node。
- 不需要安装 Docker。
- 不需要执行 ETL。
- 不需要初始化数据库。
- 不需要配置端口。
- 不需要打开或编辑 SQLite。

## 5. 数据边界

基础知识库：

```text
data/base/sapd_wiki_base.sqlite3
```

普通用户不应修改该文件。后端以只读方式使用基础库，启动时会校验 hash。

用户数据：

```text
data/user/sapd_wiki_user.sqlite3
```

收藏、备注、个人标签、用户新增对象和用户新增关系都应写入用户库。基础库升级不应覆盖用户库。

## 6. 诊断包边界

诊断包应包含：

- `base-manifest.json`
- `app-config.json`
- `runtime.log`
- `runtime-state.json`
- `startup-check-result.json`
- `platform-info.json`
- `database-files.json`
- `redaction-note.txt`

诊断包不得包含：

- `sapd_wiki_user.sqlite3` 原文件；
- 用户备注全文；
- 用户标签全文；
- 用户自定义对象全文；
- 用户敏感输入内容。

## 7. 试发限制

- 当前只建议 macOS arm64 内部试用。
- Intel Mac 需要单独构建 `mac-x64` 包。
- Windows x64 必须等 Windows 实机构建验证通过后再进入双平台 UAT。
- 本阶段不做 Tauri、`.dmg`、`.msi`、签名、自动更新、Docker 或用户端 Excel ETL。
