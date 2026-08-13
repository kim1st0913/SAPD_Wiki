# progress.md

> 状态：`active / recent milestones`
>
> 更新日期：2026-08-13

本页只保留最近的重要结果；历史记录从 `docs/05-archive/progress-history/` 进入。

## 2026-08-13

- `成熟度高分辨率与存储诊断主控验收 PASS`：源码区分 viewport 与逻辑坐标，只在进入图谱模型
  时按 adaptive scale 换算；`elementFromPoint` 保持原始坐标。右键菜单删除快捷装饰，保留业务
  动作和下级数量；渲染后按真实矩形二次收口。主控隔离复验 1920×1080 与 3008×1092，后者
  节点菜单 `top=574.08 / bottom=1072.99 / height=498.91`，编辑属性可用，画布菜单在界内，
  控制台无 error。模板合同 61/61、P2 43/43、V2.1 236/236、XLSX 23/23 通过。
- `本地存储失败分类 PASS`：读取拒绝、损坏 JSON / 结构、序列化、QuotaExceeded、DOMException
  和未知写错均保留中性诊断；读取异常 fail closed，不用空对象覆盖原数据；真实 WKWebView 保存
  仍留待新 DMG 状态保护验收。
- `Keychain 源码修复已验收`：条目访问修复使用 App 内原生 helper，失败不改变 secret bytes、
  CA/server 指纹或 OAuth；确认仅消费一次，失败审计和精确 recoverable error 已有永久测试。
  未触碰真实 Keychain 或 28775/28776，需在新 no-license DMG 做覆盖升级验收。
- Git 专用任务对当前 30 个源码文件完成范围、GitHub 数据边界、Keychain/MCP 53/53、系统设置、
  成熟度及交付定向门；因旧 `CURRENT_STATE.md` / `progress.md` 超行而按合同停止，未 stage、commit
  或 push。主控随后将当前状态、进度和计划压缩为最新 0.4.1 事实，等待重新 checkpoint。

## 2026-08-12

- `0.4.1 第一 checkpoint 已推送`：提交
  `abcb6a718cf83d3173b30411dfc5184ca9bf929a`，main / origin 0/0；版本准备只含当时授权的
  10 个 release 文件，正式数据和生成产物未进入 GitHub。
- `macOS 0.4.1 no-license 首包完成`：DMG SHA-256
  `22bcfaa6d638fc18cc85908bb16638669fc06cb0635971a9375f7cfd8f16a10d`；hdiutil、codesign、
  arm64、空用户库、Phase 2 owner、TC-010、摘要懒图谱及 sapd_wiki_app 28776 OAuth / 五工具
  TOOL_CALL 通过。后续 Keychain / 成熟度源码变化使该包降级为前序验证包，需重打。
- `Windows Delivery Data 发布 / Runner 阻断`：不可变 Release
  `windows-data-20260812-phase2-batch1-r1` 发布，archive SHA-256
  `13499c0c0b4d6531eca758a6fa08a0e9426750951c21566082ead9bd7e626ab3`。Run 31561038164
  三次均在隔离 build 前因 GitHub Artifact storage quota 失败；旧临时 artifacts 已清到 active=0，
  没有生成 Runtime / Setup。旧 run 绑定 abcb6a7，不作为下一新 SHA 的最终发布输入。
- `打包目录治理`：macOS 最终 DMG 进入 `dist/releases/<version>/<variant>`，Windows 本地下载
  副本进入 `apps/electron/releases/<version>`；只保留 0.3.0 及以后安装包，0.4.1 macOS 只构建
  no-license。私有 Windows Artifact 清理规则补丁已准备但尚未提交到私有 main。
- `active 5173 恢复`：旧进程 404 和缺 projection manifest 503 的根因已修复；当前 PID 89268，
  home / health / workspace 与三条 Batch 1 projection 均为 200，guard PASS。

## 2026-08-11

- `Phase 2 Batch 1 PASS 至 Windows 实包门`：正式 relation-only apply 将 base 更新为
  `188f20ef...cf3680`，对象 4694 不变、关系 7786→7788、`has_measure=53`；完整回退包与三次
  恢复演练通过。18 文件代码整合、页面 / dataClient owner switch、packaged Web 和 macOS
  projection 等价均由主控独立验收；无业务 JSON fallback，错误对象保持 404。
- 正式 base/content/源 Excel 与真实用户库均按保护边界处理；除获授权的 relation-only base
  apply 外，未修改源数据或用户状态。Batch 2 environment 未授权。

## 当前保护边界

- 不把 `data/`、SQLite、DMG、Setup、恢复包、虚拟环境、`node_modules` 或生成底图加入 Git。
- 不用 5173、旧 DMG 或旧 Windows Run 代替同一新 SHA 的双平台实包验收。
- 测试默认使用临时数据；真实用户库、Keychain 和正式双库不得作为写目标。
