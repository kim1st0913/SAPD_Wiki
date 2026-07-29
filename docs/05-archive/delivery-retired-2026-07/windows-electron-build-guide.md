# Windows Electron 客户端打包指南

> 归档状态：`retired / historical`

> 状态：`retired / historical entry`
>
> 原流程日期：2026-07-21

Windows 生产构建已迁移到私有 GitHub Windows Runner。本页不再维护旧的
“Windows CI 只生成 backend、Mac 再组装 Electron”步骤。

当前唯一操作入口：

- [`desktop-packaging-runbook.md`](desktop-packaging-runbook.md)

当前规则：

- 源码只取公开仓 `main` 的精确 40 位 SHA；
- 正式数据只取私有、不可变且已批准的 Delivery Data Release；
- backend、Electron Runtime 和 NSIS `Setup.exe` 全部在私有
  `windows-2022` Runner 构建；
- 安装包只上传到 `SAPD_Wiki_Delivery_Private` 的私有 Release；
- `codex/windows-electron` 本地和远端分支已经删除，不得重新作为生产打包分支；
- Mac 不再承担 Windows 安装器的生产组装；
- Windows 10 / 11 UAT 通过前，安装包只能标记为 internal testing。

本地 `apps/electron` 命令只用于维护者诊断 Electron 代码和旧本地组装边界，不是
发布入口。
