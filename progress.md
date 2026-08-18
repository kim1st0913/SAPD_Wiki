# progress.md

> 状态：`active / recent milestones`
>
> 更新日期：2026-08-18

本页只保留最近的重要结果；历史记录从 `docs/05-archive/progress-history/` 进入。

## 2026-08-18

- `stable 5173 Runtime 恢复 PASS`：清理旧监听并恢复 PID 8893；项目根目录、正式 base / content
  双库、真实用户库、data root、export root、`stable` 标签和 persistent CurrentUser MCP 身份全部
  匹配，home / health / workspace 与三条 Batch 1 projection 均为 200。一次受沙箱阻止的本地连接
  曾被误判为服务失效，获准的回环验收已排除该误判。真实用户库 SHA-256 前后保持
  `0e3db1224b4c2044bcd0dfe4a7fbe9e3e5a28cf081a8ab1ff0b2622030c0af81`。
- `成熟度脑图拖动第一阶段主控验收 PASS`：document 高频 mousemove 由 rAF 合并，候选矩形按失效
  条件缓存，drop target 仅在变化时更新，ghost 跟手延迟和全页 dragging 样式重算已收窄，边缘平移
  使用独立帧循环。运行态 5.34 秒内 14,717 次 mousemove 合并为 330 帧，p95=0.4 ms、p99=0.5 ms、
  Long Task=0；同级移动、46px / 88px 跨层级吸附、持久化、自动平移和滚动通过。写集保留未提交。
- `Windows watcher 根因确认`：私有提交 `e46f8384…` 后的 schedule watcher 仍锁定旧
  `windows-data-20260727-r1`，并把失败结论视为下一轮可自动重试，造成 Run 32100869419、
  32102863152、32104736344 连续触发。最新 Run 使用正确 public SHA `d2a644c4`，但旧数据只有
  51 个 measure 且缺两份 workbench JSON，因此在 Phase 2 门禁停止；没有 Runtime / Setup /
  Internal Release，正式数据和用户库未写入。修正由指定 Windows 专用任务在隔离 checkout 处理，
  未获 commit / push / dispatch 授权前不改变远端状态。
- `Windows 改为严格手工打包 / 本地补丁 PASS / 未上线`：按用户更正的产品合同删除
  `watch-public-main.yml`，彻底移除 schedule、空闲期 manifest / hash 检查和自动 dispatch；只保留
  人工 `windows-installer.yml` 入口。人工构建启动后才一次性校验 archive / base / content SHA、
  不可变 Release、manifest 与 `user.status=not_included`。精确差异 `+41 / -123`，Workflow YAML、
  Bash、权限及手工触发合同通过；本机无 pwsh / actionlint，未做 PowerShell 专用解析或 Windows
  Runtime 验收。当前无排队或运行中 Run；私有远端仍是 `e46f8384…`，旧 watcher 在补丁推送前
  仍可能再次触发，私有 README 的“自动检查”说明也待同步。
- `公开源码与私有手工打包合同已推送`：公开仓提交
  `4f9090440c5e295bf7ac289c67e99990690adf61` 含精确 5 文件，成熟度 63 项、P2 43 项、文档治理、
  5173 guard 与 GitHub 数据边界通过；私有仓提交
  `966c2f64af149db3cc2a6c3398868159561d9493` 含 README、删除 watcher、收紧 installer 三项。
  远端已确认无 schedule，Windows installer 仅 `workflow_dispatch`；两仓 main / origin 均 0/0，
  推送未触发 Windows Run。上一条“未上线”记录作为执行前阶段证据保留，当前状态以本条为准。

## 2026-08-13

- `Windows workflow Artifact 峰值优化已提交 / 未 dispatch`：Run 31687536086 日志复核确认
  Delivery Data 下载、分片大小与 SHA-256 校验均成功，唯一失败点为约 198 MB 中间 Artifact
  上传命中配额。私有仓提交 `e46f8384bc5c1175eac4786b6a3971b485240b17` 删除该中间
  Artifact，build 直接读取不可变私有 Release；执行公开源码的 job 只有 `contents:read`，
  无发布权限，令牌只显式注入首个受控下载步骤。安装器 Artifact 保留期改为 1 天，发布成功后
  由独立 `actions:write` job 按上传返回的 artifact ID 精确删除。YAML、固定 Action SHA、
  job 权限与边界断言通过；未触发 Runner、未生成 Setup / Release，正式数据和用户库未写入。
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
