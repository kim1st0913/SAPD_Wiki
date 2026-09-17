# CURRENT_STATE: SAPD Wiki

> 状态：`active / OI-201 R2.1 detached Demo / 0.4.2 source checkpoint`
>
> 更新日期：2026-09-17

本页只保留恢复工作所需的当前事实、保护边界、风险和下一步。详细执行结果见
`progress.md`，未完成顺序见 `task_plan.md`。

## 1. Git 与工作区

- 本轮 0.4.2 源码已在 Electron、macOS、API / CLI、本地服务、Windows 运行时及相关审计 / 测试中
  统一；最终 source checkpoint 的完整 SHA 以最终推送后的 Git 实查和收口报告为准，状态文档不
  嵌入自身 commit SHA。后续双平台打包必须使用该 checkpoint 作为唯一 `source_sha`，只更新状态
  文档的提交不得替代产品源码身份。
- 工作树包含 R2.1 独立 Demo、状态文档和既有 AppIcon，以及 `data/`、generated basemap 等未提交
  资产；全部按现状保留，不得覆盖、批量加入或用 reset / clean 清理。
- `data/`、两张 generated basemap、DMG、Setup、SQLite、恢复包、导出和构建缓存不进入 Git。

## 2. 数据与 Phase 2

- Phase 2 Batch 1 `capability + maintenance + shared lookups` 已完成正式 data apply、代码整合、
  页面 / `dataClient` owner switch、packaged Web 和 macOS 验收。
- 正式 base SHA 为 `188f20efed31631f1f53219d4d8ef6f5e8c4fa5f2f07309b6bbe185994cf3680`；
  content SHA 为 `adaa19bf1fb641eb6e54da74b33b3f0510126ed9208d0d97ed565398db05bce6`。
- 对象保持 4694；关系 7786→7788，仅新增 I-AP / I-US 两条物理 `uses_measure`；投影
  `has_measure=53`。完整回退包和三次候选→旧 SHA 恢复演练均已验收。
- 当前 5173 PID 22252 为项目 stable Runtime；home、health、workspace projection、
  capability-catalog / maintenance / shared-lookups 均为 200，guard PASS。安全运行生产接口已
  移出主版本运行时。
- Batch 2 `environment` 未授权；Batch 1 Windows 实包未完成前不得开始 Batch 2。

## 3. OI-201 安全运行知识

- 2026-09-17 R2.1 已将安全运行前端、API、MCP 查询依赖和候选入口从生产主版本移出；主版本相关
  路由保留明确的历史占位，不再加载 SQLite、用户库或安全运行候选数据。
- 独立审阅 Demo 位于 `demos/security-operations-r2/`，不进入产品构建或交付包；原始候选、正式库和
  用户数据仍按保护边界留在本地，不纳入 Git。
- 临时预览已验证主页、能力页 L0→L2 / focus、成熟度页、RASP 搜索及生产安全运行 API 404；
  本轮未写真实用户库或正式 SQLite，未进行 DMG、Windows Setup 或 Release 打包。
- 后续业务关联、视觉使用和正式迁移仍需单独评审与授权；独立 Demo 的验收不自动授权回迁主版本。

## 4. 当前源码修复

- macOS Keychain 条目级访问修复已完成源码验收：精确区分访问拒绝、锁定和缺失；App 内原生
  权限修复不更换证书、私钥或 OAuth，失败时 fail closed 且不诱导重置材料。
- 成熟度模板工作台已完成高分辨率坐标、菜单边界、快捷装饰移除和本地存储错误分类修复。
  主控在 3008×1092 下复核节点菜单 `bottom=1072.99 <= 1092`，编辑按钮和画布菜单正常。
- 自定义模板脑图拖动第一阶段优化已完成主控运行态验收：5.34 秒内 14,717 次 mousemove 合并为
  330 帧，拖动帧耗时 p95=0.4 ms、p99=0.5 ms、Long Task=0；同级移动、跨层级吸附、保存持久化、
  边缘自动平移和滚动均通过，真实用户库未写入。该写集已进入 `4f909044` 并推送。
- Keychain 与此前成熟度修复已进入 `d2a644c4` 和当前 macOS 0.4.1 DMG；新拖动优化只进入
  `4f909044` 源码，尚未进入新 DMG 或 Windows Setup。

## 5. 0.4.2 源码 / 0.4.1 既有交付状态

- 当前 0.4.2 产品源码身份以本轮最终推送到 Public `main` 的 source checkpoint 为准；Electron、
  macOS 和 Windows 默认版本均为 0.4.2，本轮尚未生成 0.4.2 DMG、Windows Setup 或 Release。
- 既有 0.4.1 macOS no-license DMG 是历史候选；9/17 pre-dmg 门禁未通过，不得作为 0.4.2
  交付物或验收依据。
- 0.4.2 新包装候选仍待重建：08:08:47Z 旧候选因未引用 SVG 不予交付；Public Run `35197954377`
  因旧 manifest 失败，未生成 Artifact 或 Private Run。
- macOS no-license DMG 已生成：
  `SAPD-Wiki-0.4.1-no-license-20260813-095002Z-mac-arm64.dmg`，bytes=347736271，
  SHA-256 `3d7e11e1607a3dfce9344eb6b427e0e4bf5c8a695f93648a8d2d2e948e97a783`。
  已完成 `hdiutil` 验证；真实 28776 Keychain / 覆盖升级仍属于人工实包验收。
- 私有不可变 Delivery Data `windows-data-20260813-phase2-batch1-r2` 已发布并验证；
  archive SHA-256 `29da6bdf4487be22cb51a62b086a689970867a06e1b306f5d7ed40177a2a8313`，
  user DB=`not_included`。
- Windows Run 31687536086 成功下载、拼接并校验 Delivery Data，但在上传约 198 MB 中间
  Artifact 时命中存储配额；build / publish 未执行，未生成 Runtime、Setup 或 Internal Release。
- 历史 0.4.1 Windows Public Run `35186432363` 成功；对应 Synthetic Run `35186801694` 因名称校验
  失败。该记录对应旧 `d7daa48` 源码，不代表 0.4.2；私有 Synthetic 身份修复已在 `f8346be` 推送，
  本轮不触发 workflow、不打包。
- 私有 workflow 已在提交 `e46f8384bc5c1175eac4786b6a3971b485240b17` 优化：build 直接读取
  不可变私有 Release，只保留约 303 MB 安装器 Artifact，保留期 1 天，发布成功后按 artifact ID
  精确删除。随后 schedule watcher 错把旧 `windows-data-20260727-r1` 与 `d2a644c4` 组合并循环
  自动触发；删除上线前最后一次旧 Run 32107804191 在 Phase 2 数据门禁失败，未生成 Runtime、
  Setup 或 Internal Release。根因是 watcher 的旧数据常量与无限失败重试，不是源码回归。
- 用户已明确 Windows Run 只能在下令打包后执行。私有提交
  `966c2f64af149db3cc2a6c3398868159561d9493` 已删除
  `watch-public-main.yml`，彻底移除 schedule、空闲期 manifest / hash 检查与自动 dispatch；只保留
  人工 `windows-installer.yml` 入口。人工构建启动后一次性校验 archive / base / content SHA-256、
  不可变 Release、manifest 和 `user.status=not_included`；私有 README 也已同步。YAML、Bash、
  权限与手工触发合同通过，私有 main / origin 0/0；推送未触发 Windows Run。
- 本地产物目录合同已统一到 `apps/*/dist/releases` 或 `apps/electron/releases`；低于 0.3.0
  的桌面安装包已删除。macOS 0.4.1 本轮只允许 no-license。

## 6. 当前未完成主线

1. OI-201 R2.1 安全运行内容已移入独立 Demo；等待用户对业务关联与视觉使用反馈，正式迁移不自动开启。
   原文、原图、技术身份不作为未经授权的主版本变更依据。
2. 仅在用户明确下令且 Windows Synthetic / Delivery Data 门禁重新通过后，以本轮最终 Public `main`
   source checkpoint 和经确认的 Delivery Data 人工触发一次 0.4.2，验收 backend、Runtime、Setup、
   Internal Release 与 Artifact 清理；不得把旧 0.4.1 Run 或产物当作新版本依据。
3. 成功后下载本地副本到 `apps/electron/releases/0.4.2/`；取得 Windows 10/11 主机后完成
   安装、启动、MCP、退出和卸载保留数据 UAT。
4. 三平台 Batch 1 同候选通过后，用户再决定是否授权 Batch 2 `environment`。
5. OI-197 V3 Rubric 继续按“全局规则→争议对象”分批业务复核；正式迁移另行授权。

## 7. 保护边界

- 不修改正式 SQLite、源 Excel、Rubric、评分规则或真实用户库，除非用户明确授权并已有恢复路径。
- 不使用旧 Windows Runtime、旧 Delivery manifest 或 retired 二进制冒充新源码候选。
- 只有用户明确下令才可手动触发 Windows Runner；不得使用旧 r1 或放宽 job 权限绕过门禁。
- 5173 通过不能替代 DMG / Windows 实包验收；不因保存回退方案而执行实际回退。
- 独立 Demo / 5173 验收不等于正式 freeze / apply、App / DMG、Windows 实包或发布验收；本轮源码
  checkpoint 已完成 commit / push，但未进行打包或发布。
- 未完成 Windows 10/11 UAT、Developer ID / notarization 前，只能声明内部测试包。
