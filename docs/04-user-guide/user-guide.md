# SAPD Wiki 用户指南

> 状态：`active / user entry`
>
> 更新日期：2026-07-28

SAPD Wiki 是本地运行的安全知识库。普通用户不需要安装 Python、Node，也不需要执行
ETL、迁移数据库或选择原始 Excel。

## 1. 日常使用

安装并启动应用后，可以：

- 从全局导航进入安全能力、信息化环境、生命周期、安全知识、标准 / 框架和成熟度；
- 使用全局搜索查找知识对象、内容文档和片段；
- 在对象、字段和表格行上添加批注；
- 使用待复核、数据篮和工作台整理个人工作；
- 使用 AI 功能集成页启动或停止本地 MCP，并管理只读客户端授权。

基础知识库由维护者发布。用户批注、收藏、数据篮和工作台状态保存在独立用户库中，
更新基础知识库不应覆盖这些个人数据。

## 2. Windows

维护者在 GitHub 私有 Windows Runner 上生成并校验 `Setup.exe`。测试者只需要：

1. 从私有 Internal Release 下载最新 `Setup.exe`；
2. 在 Windows 10 或 Windows 11 安装；
3. 验证启动、导航、搜索、用户状态、MCP 和卸载 / 升级；
4. 把问题反馈给维护者。

没有真实 Windows 10/11 UAT 的构建只能称为 Internal Release。

## 3. macOS

维护者在正式 Mac 主工作区本地生成 DMG。测试者只需要：

1. 下载或取得最新 DMG；
2. 拖动安装并启动应用；
3. 验证首次数据路径、搜索、用户状态、证书和 MCP OAuth；
4. 正式外部分发时另行确认签名和 notarization。

无签名、无公证或 no-license DMG 可以内部测试，但不能宣称正式外部分发通过。

## 4. AI 功能集成

SAPD Wiki 的 MCP 只提供受控的基础知识只读访问，不负责导入新资料。新知识进入系统的
流程是：

1. 来源登记与审批；
2. 构建候选查询库和内容资产库；
3. 质量门禁；
4. 正式 apply；
5. 重启 immutable MCP runtime；
6. 五工具验收并 accept。

MCP 不开放真实用户库、源文件、本机路径、凭据或任意 SQL。

## 5. 数据与隐私

- 基础知识库、内容资产库和用户库相互独立；
- 安装包只能携带受控基础数据和空用户库模板；
- 真实用户数据库不得上传 GitHub 或进入安装包；
- 卸载、升级和恢复前应先确认用户数据备份路径。

## 6. 维护者入口

- 打包与发布：`docs/09-delivery/desktop-packaging-runbook.md`
- 验收矩阵：`docs/09-delivery/release-acceptance-matrix-0.1.md`
- 当前问题：`docs/06-implementation/open-issues.md`
- 文档导航：`docs/README.md`
