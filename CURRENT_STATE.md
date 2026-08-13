# CURRENT_STATE: SAPD Wiki

> 状态：`active / 0.4.1 release consolidation`
>
> 更新日期：2026-08-13

本页只保留恢复工作所需的当前事实、保护边界、风险和下一步。详细执行结果见
`progress.md`，未完成顺序见 `task_plan.md`。

## 1. Git 与工作区

- 当前分支 `main`，HEAD / `origin/main` 为
  `abcb6a718cf83d3173b30411dfc5184ca9bf929a`，`0 / 0`；该提交是首个 0.4.1 发布准备
  checkpoint，不包含随后完成的 Keychain 和成熟度修复。
- 当前待收口写集为 28 个 tracked 文件，加
  `apps/macos/SAPDWiki/Resources/AppIcon.icns` 与
  `apps/macos/SAPDWiki/Sources/SAPDWikiKeychainRepair/main.m` 两个源码文件。
- `data/`、两张 generated basemap、DMG、Setup、SQLite、恢复包、导出和构建缓存不进入 Git。
- Git 专用任务已完成范围、数据边界和定向测试，但因本页与 `progress.md` 超出治理行数门而停止，
  未 stage、commit 或 push；本轮已由主控压缩项目记忆，下一步重新执行同一个 checkpoint。

## 2. 数据与 Phase 2

- Phase 2 Batch 1 `capability + maintenance + shared lookups` 已完成正式 data apply、代码整合、
  页面 / `dataClient` owner switch、packaged Web 和 macOS 验收。
- 正式 base SHA 为 `188f20efed31631f1f53219d4d8ef6f5e8c4fa5f2f07309b6bbe185994cf3680`；
  content SHA 为 `adaa19bf1fb641eb6e54da74b33b3f0510126ed9208d0d97ed565398db05bce6`。
- 对象保持 4694；关系 7786→7788，仅新增 I-AP / I-US 两条物理 `uses_measure`；投影
  `has_measure=53`。完整回退包和三次候选→旧 SHA 恢复演练均已验收。
- 当前 5173 PID 89268 为项目 stable Runtime；home、health、workspace projection 及
  capability-catalog / maintenance / shared-lookups 均为 200，guard PASS。
- Batch 2 `environment` 未授权；Batch 1 Windows 实包未完成前不得开始 Batch 2。

## 3. 当前源码修复

- macOS Keychain 条目级访问修复已完成源码验收：精确区分访问拒绝、锁定和缺失；App 内原生
  权限修复不更换证书、私钥或 OAuth，失败时 fail closed 且不诱导重置材料。
- 成熟度模板工作台已完成高分辨率坐标、菜单边界、快捷装饰移除和本地存储错误分类修复。
  主控在 3008×1092 下复核节点菜单 `bottom=1072.99 <= 1092`，编辑按钮和画布菜单正常。
- 两项修复均只通过源码 / 隔离运行时验收，尚未进入新的 Git SHA、macOS DMG 或 Windows Setup。

## 4. 0.4.1 交付状态

- 首个 0.4.1 checkpoint 为 `abcb6a7`；Electron、macOS 和 Windows 默认版本均为 0.4.1。
- macOS no-license DMG 已生成：
  `SAPD-Wiki-0.4.1-no-license-20260812-044539Z-mac-arm64.dmg`，SHA-256
  `22bcfaa6d638fc18cc85908bb16638669fc06cb0635971a9375f7cfd8f16a10d`。
  该包通过挂载、codesign、Phase 2、TC-010、摘要懒图谱和 28776 五工具验收，但早于后续
  Keychain / 成熟度修复，不能作为最终最新包。
- 私有不可变 Delivery Data `windows-data-20260812-phase2-batch1-r1` 已发布并验证；旧 Run
  31561038164 Attempt 3 在 upload-artifact 配额门失败，未进入 build / publish，因此没有
  Windows 0.4.1 Runtime 或 Setup。私有仓当前 active Actions artifacts 为 0。
- 旧 Run / r1 绑定 `abcb6a7`，不得作为包含当前共享前端修复的最终发布输入；新源码 SHA 后应
  生成新的不可变 Delivery Data ID，再触发 Windows Runner。
- 本地产物目录合同已统一到 `apps/*/dist/releases` 或 `apps/electron/releases`；低于 0.3.0
  的桌面安装包已删除。macOS 0.4.1 本轮只允许 no-license。

## 5. 当前未完成主线

1. 将当前已验收源码与本轮项目记忆作为一次显式 checkpoint push 到 `main`，取得唯一新 SHA。
2. 基于新 SHA 重新构建 macOS 0.4.1 no-license，并完成覆盖升级、Keychain、模板保存、菜单与
   28776 实包验收。
3. 为新 SHA 生成 / 发布新的不可变 Windows Delivery Data，触发私有 Runner，验收原生 backend、
   Runtime、Setup 和 Windows 10/11；成功后下载本地副本到 `apps/electron/releases/0.4.1/`。
4. 三平台 Batch 1 同候选通过后，用户再决定是否授权 Batch 2 `environment`。
5. OI-197 V3 Rubric 继续按“全局规则→争议对象”分批业务复核；正式迁移另行授权。

## 6. 保护边界

- 不修改正式 SQLite、源 Excel、Rubric、评分规则或真实用户库，除非用户明确授权并已有恢复路径。
- 不使用旧 Windows Runtime、旧 Delivery manifest 或 retired 二进制冒充新源码候选。
- 5173 通过不能替代 DMG / Windows 实包验收；不因保存回退方案而执行实际回退。
- 未完成 Windows 10/11 UAT、Developer ID / notarization 前，只能声明内部测试包。
