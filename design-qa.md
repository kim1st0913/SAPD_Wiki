# 成熟度评估第六轮 Tab、格内评分定义与整体锁定 Design QA（2026-07-14）

- 本节覆盖并取代下文第五轮中“适用性仍与名称分离”“定义在选中格外展示”和“只锁定项目页签”的结论；旧记录仅保留为否决与修正过程追踪。
- visual truth：用户本轮提供的 3 张截图，分别约束服务 Tab、选中评分格内的定义动画和完整项目上下文锁定；路径为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-94201573-1c9b-4391-91aa-20b7df20f24f.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-4200c61a-2830-4a0c-a029-d74be1b32315.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-4bcdfd70-0717-4b86-8aed-006c61d9baf4.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`；应用内浏览器最终聚焦证据为 `/private/tmp/sapd-maturity-sixth-focus-755x466.jpg`、`/private/tmp/sapd-maturity-sixth-project-header-1034x100.jpg`，三组参考与最终实现同屏对照为 `/private/tmp/sapd-maturity-sixth-tabs-reference-vs-final.jpg`、`/private/tmp/sapd-maturity-sixth-score-reference-vs-final.jpg`、`/private/tmp/sapd-maturity-sixth-header-reference-vs-final.jpg`。
- viewport：应用内浏览器覆盖 `1280 × 720`、`1024 × 900`、`390 × 844`；未启动系统 Chrome。

## Findings

无剩余本轮范围内的 Web P0 / P1 / P2 设计问题。

- 服务 Tab：每个安全技术服务使用单一卡片边界，状态点、完整服务名和适用性方框形成一个连续阅读单元；1280px 下为三列两行，名称溢出计数为 `0`，checkbox 实测 `17 × 17px`。1024px 仍保持三列，390px 只允许 Tab 导航内部水平滚动。
- 评分反馈：定义不再占据独立列或独立卡片。未选格保持 `42px`，当前选中格实测扩展为约 `432 × 66px`，数字、`Lx` 等级名和定义全部在同一蓝色格内；真实点击时轨道从 `42 42 432 42 42` 平滑切换为 `42 432 42 42 42`，再恢复为 `42 42 432 42 42`。减少动态效果偏好下自动取消动画。
- 项目导航：项目名称 / 模板 / 最近更新时间和六个项目步骤合并为同一 sticky 容器，实测总高 `100px`（项目上下文 `48px` + 项目步骤 `52px`）；评分区滚动 `520px` 后两个子区仍固定在内容顶部。
- 视觉系统：字体、字重、蓝灰层级、圆角、边界、间距、checkbox 和已选蓝色继续复用现有 Apple Shell token；没有引入新的图片、图标资产或营销文案。服务卡片、评分格和锁定区的文字均在各自边界内完整可读。
- 既有第五轮有效项继续保留：用户可见术语为“目标等级”；关注点摘要分组；重复服务头和展开 / 收起删除；底部承载排除规则与“保存并转到下一项”；不适用服务不进入评分、聚合或完成率分母。
- 业务边界：不适用服务不进入评分、聚合或完成率分母；关注点仍只作定义和一次性初始化入口，不在执行页回填下级聚合分。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 服务 Tab | 通过 | 1280px 下 6 项按 `3 × 2` 排列，完整名称溢出 `0`，适用方框 `17 × 17px` 并与对象共享卡片边界 |
| 四维评分 | 通过 | 真实点击 `3 → 2 → 3` 后定义同步为 L2 / L3；当前轨道宽约 `432px`，定义节点位于当前按钮内部，独立定义节点计数 `0` |
| 动画与滚动保持 | 通过 | 格宽与定义进入动画均生效；实际坐标点击后工作台滚动位置保持 `253.5 → 253.5`，页面不跳顶 |
| 完整项目锁定 | 通过 | 滚动 `520px` 后 `100px` 项目上下文 + 项目步骤整体保持在主内容顶部，两个子区没有分离 |
| 响应式边界 | 通过 | 1280 / 1024 / 390px 的 html、项目页、工作台和评分表单页面级横向溢出均为 `0`；窄屏仅 Tab 和五格轨道内部局部滚动 |
| 视觉与字段 | 通过 | 字体、间距、颜色、圆角、边界、图标 / 图片资产和文案面均完成聚焦核对；主展示区禁显字段命中 `0` |
| 契约审计 | 通过 | 成熟度 V2.1 专项审计 `109/109`；maturity smoke、完整 `static,frontend` 套件、数据边界和 diff-check 通过 |

## Open Questions

- macOS DMG App 本轮未重建、未回归；本轮属于 `shared runtime`，共享前端会同时影响 Web 与 App，但 5173 证据不替代下次 DMG 发布矩阵验收。
- 应用内浏览器在滚动态截取带透明 / fixed 图层的整页图时，顶部曾出现黑色合成伪影；DOM 计算值、滚动固定断言和滚动前截图均确认实际页面背景正常，因此不作为产品缺陷。
- `OI-192` 保持“已修复 / 待用户验收”；用户需在固定 5173 入口核对 Tab、格内定义动画和完整项目区锁定后再关闭。

final result: passed

---

# P0-4 标准深链与 Issue 按需详情 Design QA（2026-07-13）

- source：P0-4 修复前真实工程 `http://127.0.0.1:5173/#/standards/nist-csf-2-0` 与 `http://127.0.0.1:5173/#/workbench/annotations`；应用内浏览器源状态截图为 `/private/tmp/sapd-p04-standard-before.png`、`/private/tmp/sapd-p04-issue-before.png`。
- implementation：标准深链、Issue 初始 / 打开 / 关闭状态均来自同一 5173 真实工程；截图为 `/private/tmp/sapd-p04-standard-workforce-after.png`、`/private/tmp/sapd-p04-issue-initial-after.png`、`/private/tmp/sapd-p04-issue-open-after.png`。
- viewport：应用内浏览器 `1280 × 720`；未启动系统 Chrome。
- 对照方式：Issue 修复前源状态与修复后初始状态以同一视口放入同一视觉对照输入，另以打开态核对按需详情层；标准页保持既有 Apple Shell 视觉语言，只对深链导航定位和边界留白做功能性校正。

## Findings

无剩余本轮范围内的 Web P0 / P1 / P2 设计问题。

- 标准深链：当前业务域和当前框架同时可见；最靠近导航底部的框架也保留 `10px` 安全留白，没有出现已选项贴边、被裁切或与下一业务域混淆。
- Issue 初始态：页面只常驻作用域栏与队列，空 inspector 不再挤占约 `320px`；队列可用宽度由约 `520px` 恢复为约 `734px`，页面无横向溢出。
- Issue 打开态：明确点击或键盘打开后，详情才进入第三列；边界、圆角、密度和按钮继续使用 P0-2 Apple Shell 既有 token，没有新增独立视觉标准。
- Issue 关闭态：详情完全退出布局，队列宽度恢复，焦点返回来源行；批量 checkbox 保持未勾选，避免“查看”被误表达为“批量选择”。
- 路由隔离：从标准页重新进入 Issue 时无旧详情、旧激活行或旧批量勾选泄漏，只展开工作台业务域。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 8 个标准深链 | 通过 | `standards` 域展开，当前框架可见，导航边界留白 `10px` |
| Issue 首次进入 | 通过 | `data-review-inspector-open=false`，inspector 宽度 `0`，队列约 `734px` |
| 行点击打开 | 通过 | 显式 `workbenchSelectedIssueId` 驱动详情，批量勾选数仍为 `0` |
| 键盘打开 | 通过 | `ArrowUp / ArrowDown` 移动焦点，`Enter / Space` 打开当前行 |
| 关闭详情 | 通过 | inspector 移除、队列恢复约 `734px`、焦点回到来源行 |
| 路由重入 | 通过 | 详情、激活行和批量选择均为 `0`，仅工作台域展开 |
| 页面边界 | 通过 | 1280px 页面无横向溢出，应用内浏览器错误日志为空 |

## Open Questions

- macOS DMG App 本轮未重建、未回归；P0-4 属于共享前端，需在下次发布矩阵补 App 证据，5173 通过不替代 DMG 验收。
- 用户仍需在固定 5173 入口完成标准深链和 Issue 工作台的最终业务 / 视觉人工验收。

final result: passed

---

# 全局共享标题区旧 DMG 对照 Design QA（2026-07-13）

- visual truth：用户提供的旧 DMG 截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-7bd26c67-9dfd-4d09-81a9-22d211d9d901.png`，并在同一应用内浏览器中读取已挂载旧 DMG `0.1.7` 的 `http://127.0.0.1:18765/`。
- 反例：用户提供的当前程序截图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-6726336c-4f54-438e-b604-aae3e82c2b57.png`。
- implementation：`http://127.0.0.1:5173/#/`；同尺寸旧 DMG 与修复后证据为 `/private/tmp/sapd-global-header-old-dmg-20260713.png`、`/private/tmp/sapd-global-header-fixed-20260713.png`。
- 根因：上轮 P0-2 舒适度修正把旧 DMG 的 `24px` 标题、`12px` 说明和 `12px 18px` 页头内边距漂移为 `26px / 14px / 10px 24px`；问题属于共享 App Shell token，不是“全局导航”单页样式。
- 修正后计算值：页头 `96px`、标题 `24px / 27.12px`、说明 `12px / 17.4px`、页头内边距 `12px 18px`、页头 gap `12px`、文本组 gap `5px`、标题与标签 gap `7px`，与旧 DMG 同值。
- 全局抽查：`全局导航`、`安全能力映射`、`成熟度评估` 三条路由参数一致；页面横向溢出为 `0`，主区禁显字段命中为 `0`。

final result: passed

---

# 成熟度评估共享几何、评分反馈与左图右数 Design QA（2026-07-13）

- visual truth：用户本轮 5 张截图；项目页签与高度基线为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-fd9b0853-e8a4-4795-9c09-54036a73f6ac.png`、`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-a6b22162-d2e7-4325-953a-d6586925adb9.png`；评分反馈基线为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-c137936e-dfa3-480c-9daf-07a06939eee6.png`；雷达基线为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-63c22e30-6f06-4faf-9477-7f9c72540203.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/project-001`。
- 评分区证据：`/private/tmp/sapd-maturity-score-qa.png`。
- 雷达区证据：`/private/tmp/sapd-maturity-radar-qa-final.png`。
- viewport：应用内浏览器 `1280 × 720`；未启动系统 Chrome。

## Findings

无剩余本轮范围内的 Web P0 / P1 / P2 设计问题。

- 共享几何：评分复核不再定义独立页签高度；评估模板、评分执行、评分复核和评估结果均复用同一项目上下文与 `52px` 项目页签，内容起点一致。
- 服务 Tab：桌面端按可用宽度等分，6 个评估点一屏展示；删除重复作用域后缀，仅保留业务码与名称。窄屏才允许 Tab 容器内部横向滚动，页面本身不产生横向溢出。
- 评分反馈：每个维度的 1—5 按钮在评分区居中。切换采用 `180ms` 平滑过渡，选中项放大到 `1.14`；下方只显示当前等级完整定义，例如 `L3 充分定义。职责和责任已正式分配，各角色定义清楚，流程所有者和责任人明确。`，不再显示“对照全部 L1—L5”。减少动态效果偏好有降级规则。
- 图表表达：结果页使用全部 `32` 项 L2 后端能力结果，量尺固定 `1—5`，当前值为蓝色实线、目标为金色虚线；轴标签使用中文简写，不再以代码环绕占据阅读空间。
- 左图右数：雷达居左，右侧按后端 `categoryResults / subCategoryResults / capabilityResults / gapItems` 展示 T / G / M 当前值、目标值、L2 数量、L1 分层与低于目标数量。评价只陈述覆盖、差距和后端候选，不由前端重新计算成熟度或生成正式业务结论。
- 视觉对照：评分参考与运行评分区、旧代码雷达与中文简写左图右数实现分别放入同一视觉输入比较；最终结果无标签碰撞、卡片裁切或页面级横向溢出。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 项目页签高度 | 通过 | 评估模板 / 评分执行 / 评分复核 / 评估结果页签均为 `52px`，项目上下文与内容起点一致 |
| 服务 Tab | 通过 | 当前关注点 6 项全部可见，作用域后缀计数为 `0`，桌面 Tab 条无溢出 |
| 四维评分 | 通过 | 每个维度均为 5 个居中按钮；选中态计算变换为 `matrix(1.14, 0, 0, 1.14, 0, 0)`，当前定义随选择平滑切换 |
| 等级定义 | 通过 | 仅显示当前完整等级定义，“对照全部 L1—L5”计数为 `0` |
| 结果雷达 | 通过 | 全部 32 项 L2 保持可核对；T / G / M 数量为 `19 / 1 / 12`，中文简写与右侧统计并列展示 |
| 页面边界 | 通过 | 1280px 页面无横向溢出，应用内浏览器错误日志为空 |

## Open Questions

- 完整 `frontend` 套件中的成熟度、P0-1、P0-2 与本轮专项检查均通过；仅前端治理检查发现未由本轮修改的 `styles.css` 比既有行数基线多 `8` 行，本轮不擅自改治理基线。
- macOS DMG App 本轮未重建、未回归；共享前端代码需在下次发布矩阵补 App 证据，5173 通过不替代 DMG 验收。
- 用户仍需在固定 5173 入口完成最终业务和视觉人工验收。

final result: passed

---

# 成熟度评估评分目录与能力雷达 Design QA（2026-07-13）

- 目录 visual truth：`http://127.0.0.1:5173/#/capability-mapping`，截图 `/private/tmp/sapd-capability-directory-reference-20260713.png`。
- 旧结果页基线：`/private/tmp/sapd-maturity-results-before-20260713.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`。
- 评分目录证据：`/private/tmp/sapd-maturity-v2-1-directory-workbench-final-20260713.png`。
- 评分目录标签微调证据：`/private/tmp/sapd-maturity-v2-1-directory-status-tags-final-20260713.png`；节点状态标签视觉上仅保留圆点，文字状态通过 `aria-label` / `title` 提供。
- 能力雷达证据：`/private/tmp/sapd-maturity-v2-1-capability-radar-final-20260713.png`。
- viewport：应用内浏览器当前可见区 `1280 × 720`；不使用系统 Chrome。

## Findings

无剩余 P0 / P1 / P2 设计问题。

- 信息架构：评分执行页从“横向 L0 / L1 / L2 + 关注点列表 + 上一 / 下一服务”三套位置模型收口为“左侧 L0 / L1 / L2 / FOCUS 评分目录 + 右侧评分工作台”。目录形态复用安全能力映射的树轨道、缩进、轻分隔线和紧凑编码层级。
- 状态语义：目录节点使用绿色 / 黄色 / 冷灰 / 中性灰圆点标签表达“已完成 / 进行中 / 未开始 / 不适用”，不重复显示文字；文字由目录图例、`aria-label` 和 `title` 保留，蓝色只表达当前选中路径。
- 服务切换：当前关注点的安全技术服务改为可换行 Tab，Tab 显示逐项状态并保留模板顺序；评分表单右上角显示“保存并转到下一项”，不再使用上一 / 下一服务分页作为主导航。
- 评分反馈：等级按钮选中后计算样式为 `transform: matrix(1.14, 0, 0, 1.14, 0, 0)`，当前维度定义立即显现；减少动态效果偏好有独立降级规则。
- 结果叙事：旧结果页同时平铺能力域条形、成熟度分布和证据分布，首屏竞争明显。新结果页先给总体结论，再并列 L2 能力四维雷达与覆盖 / 排除口径；成熟度和证据分布默认折叠，能力域结果后置。
- 图表诚实性：雷达四轴固定为组织与角色、制度与流程、平台与工具、数据与信息，量尺固定 `1—5`；当前实线、人工目标虚线和四个精确值同时出现，不通过截断量尺放大差异，不用雷达面积表达评估点数量。
- 不适用口径：结果统计单独显示适用、已完成、待完成和不适用并排除数量；不适用项不进入当前分、目标分、能力聚合或完成率分母。
- 对照方式：安全能力映射目录参考与评分目录实现、旧结果页与新雷达 / 覆盖组件分别在同一视觉输入中完成对照；未发现裁切、重叠、错误状态色或层级漂移。

## Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 目录定位 | 通过 | L0 / L1 / L2 / FOCUS 当前路径一致，节点状态标签仅显示圆点；完成数 / 适用数仍在节点右侧，目录图例保留文字 |
| 服务 Tab | 通过 | 当前关注点 6 个真实评估点可直接定位，完成 / 进行中 / 不适用状态可辨 |
| 保存并转到下一项 | 通过 | 当前评分项 ID 从 `score:…:0fd95cca…` 切换为模板顺序下一项 `score:…:80bc9f9f…`，活动 Tab 同步为 `I-DI&T-AS.AD-01` |
| 四维评分 | 通过 | 选中等级后按钮放大至 `1.14`，定义区显示所选 L5 文本，自动保存与试算正常 |
| 结果雷达 | 通过 | 后端重算后能力选择可用，四维值 `4.11 / 4.17 / 3.89 / 3.11` 与人工目标 `3.83` 同时显示 |
| 排除统计 | 通过 | 页面显示 `175` 个适用、`154` 个已完成、`21` 个待完成、`10` 个不适用并排除，完成率 `88%` |
| 页面日志 | 通过 | 应用内浏览器 `dev.logs()` 返回空数组 |

## Open Questions

- macOS DMG App 本轮未重建、未回归；共享前端和 API 投影需在下次发布矩阵补 App 证据，5173 通过不替代 DMG 验收。
- 用户仍需在固定 5173 入口进行最终业务与视觉人工验收。

final result: passed

---

# 成熟度评估方案 1 真实工程复刻收口 Design QA（2026-07-13）

- SERVICE visual truth：`/Users/kim1st/.codex/generated_images/019f4ca2-3fc5-7511-aca7-28474f497efc/exec-179723e8-8ebc-4b69-8049-d870814a2b73.png`。
- FOCUS visual truth：`/Users/kim1st/.codex/generated_images/019f4ca2-3fc5-7511-aca7-28474f497efc/exec-39512eed-fd52-42cb-818c-f7af84861ffc.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`。
- SERVICE evidence：`/private/tmp/sapd-maturity-service-final-1440x1024.png`。
- FOCUS evidence：`/private/tmp/sapd-maturity-focus-final-1440x1024.png`。
- viewport：应用内浏览器 `1440 × 1024` 进行视觉对照；另检查 `1024 × 900`、`390 × 844`。截图文件记录可见 WebView 区域，不使用系统 Chrome。

## Findings

无剩余 P0 / P1 / P2 设计问题。

- 本质根因：上一轮运行实现同时保留 App Shell 页头、项目详情头和常驻评分工具条，使评分主内容相对方案 1 下移约 `190px`；三级能力切换又被实现成高密度换行区，破坏了参考图的首屏几何关系。这不是单个颜色或间距问题，而是页面壳职责重复。
- 壳层修复：评分执行页不再渲染重复项目详情头；进度、自动保存和“更多”迁入真实 App Shell 页头。“更多”以 `720px` 浮层承接能力跳转、搜索、状态 / 证据筛选、导入导出与返回项目列表，保留功能但不占用主工作区。
- 主工作区：保持方案 1 的项目内导航、两行 L0 / L1 / L2 能力切换、不可折叠 L2 汇总、当前关注点摘要、`280px` 关注点列表和右侧单点四维评分表单。评分依据保持长输入区，当前等级定义下沉，全部 L1—L5 通过就地浮层对照。
- 两种形态：SERVICE 与无服务 FOCUS 使用同一壳、同一层级和同一评分表单；仅由真实对象类型决定下级服务分页、直接评估标签和对象文案，不拼接、不另造页面。
- 真实数据差异：参考图中的关注点数量和数值只是视觉样例。运行实现保留 `T-AS.AD` 当前真实 3 个关注点及其实际汇总，并保留 `G-SP.SM-01—03` 直接关注点评估，不为了像图而伪造第 4—6 行或覆盖真实评分结果。
- 响应式：`1440`、`1024`、`390px` 均无 document 或项目页面级横向溢出；能力 Tab 只在自己的局部区域滚动且隐藏原生滚动条。`1024px` 下关注点摘要改用 `minmax(0, 1fr) auto auto`，消除内部 `83px` 溢出。
- 字段边界：主评分区未出现 `sheet / row / column / raw_value / source_file / import_id / source_id / source_ref / source_label / debug / raw / metadata / intermediate / generated_at`。

## Interaction Verification

- “更多”可在 App Shell 页头展开，浮层宽 `720px`，原搜索、筛选、导入、导出和返回功能可用。
- 评分表单可收起 / 展开，不改变当前能力、关注点或评分项。
- 从安全技术 `T` 切到安全治理 `G` 后进入无服务 `FOCUS` 直接评分；返回 `T` 后恢复 SERVICE 状态。
- SERVICE 与 FOCUS 分别独立截图，并与各自 visual truth 在同一输入中完成目视对照。
- 控制台无 `error`；专项成熟度契约审计扩展到 `82/82`，新增 App Shell 页头归属、“更多”功能保留、评分面板收起和中宽度无溢出断言。

## Open Questions

- macOS DMG App 本轮未回归；共享前端代码会进入 App，但 5173 结论不能替代下次发布矩阵验收。
- 参考图的样例数量与当前工程真实数据不同，按数据契约保留真实数据，需由用户在 5173 做最终视觉人工评审。
- 5173 页面及 maturity HTTP/API smoke 均可用；`dev_server_guard --status` 初检短暂 `warn`，未干预现有服务后复检为 `pass`。全量 content smoke 的本地包检查通过，但 API 阶段仍出现 `fetch failed`；该检查超出本轮成熟度专项范围，未被写成通过证据。

final result: passed

---

# 成熟度评估第二轮业务验收 Design QA（2026-07-13）

- visual truth：用户本轮图 1—9，主基线为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-397bada4-2377-4c83-a4e4-77e9787beb85.png`，评分区基线为 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-8e9881c6-2b94-4632-886a-a0a8ebff3bb3.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`；用户可见页面不显示 demo / 演示身份，路由中的稳定内部 ID 不作为界面文案。
- viewport：应用内浏览器 `1486 × 1058`；另检查 `1024 × 900`、`390 × 844`。未启动系统 Chrome。
- implementation screenshot：`/private/tmp/sapd-maturity-v2-1-second-acceptance-final-1486x1058.jpg`。
- full-view comparison：`/private/tmp/sapd-maturity-reference-vs-final.jpg`，左侧用户图 1，右侧运行实现。
- focused comparison：`/private/tmp/sapd-maturity-scoring-focused-reference-vs-final.jpg`，左侧用户图 2，右侧运行评分区。

## Findings

无剩余 P0 / P1 / P2 设计问题。

- 字体与排版：项目步骤、L0 / L1 / L2、L2 指标、关注点和维度名称建立了可辨层级；关注点列表计算字号为编码 `12px`、名称 `13px`、计数 `12px`。评分依据提示与当前等级定义为 `11px`，不再抢占主评分。
- 间距与布局：评估点列表与安全技术服务评分区使用独立表面和分隔线；当前项为原生蓝色 radio，完成项为原生绿色 checkbox。右侧表单保留宽评分依据，未引入卡片墙或未授权重排。
- 颜色与 token：沿用 SAPD Wiki Apple Shell 的蓝色选中态、绿色完成态、冷灰表面和细分隔线；禁用批量入口有明确低对比状态。
- 内容：当前关注点带出后端定义；评分执行页只显示下级数量、完成度和“评分结果在评估结果页统一计算”，不回写下级汇总出的关注点评级。当前等级只显示等级、名称和定义，不显示“通用等级定义 / 适用等级定义 · 模型”标签。
- 图像与图标：本页没有业务图片资产；当前 / 完成状态使用原生表单控件，没有新增 CSS 图、手绘 SVG、emoji 或占位资产。
- 响应式：`1486 / 1024 / 390px` 下 `html`、`.maturity-v1-project-page`、能力导航和评分表单均满足 `scrollWidth === clientWidth`；1024px 评分区改为上下分层，390px 维度和结果栅格为单列，无裁切和页面级横向滚动。
- 可访问性：适用性使用带可访问名称的原生 checkbox；评分为 `button + aria-pressed`；目录状态圆点带 `aria-label` / `title`，评分工作台仍显示文字状态；服务导航使用 Tab。

## Primary Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 四维评分按钮 | 通过 | 真实坐标点击前、点击后、自动保存和试算完成后 `.maturity-v1-project-page.scrollTop` 均为 `512.5` |
| 是否适用方框 | 通过 | 取消与重新勾选全程 `scrollTop = 512.5`；四维控件保留原位并置灰，不因内容收缩跳位 |
| 关注点批量入口 | 通过 | 任一下级任一维度已有评分时显示“已有下级评分”且禁用；静态审计确认仅全空白时选择一个等级初始化全部下级四维 |
| 下级服务切换 | 通过 | 当前下级无下拉菜单；显示第 N / 总数及上一服务 / 下一服务 |
| 当前等级提示 | 通过 | 选中等级后就地显示该等级定义；“对照全部 L1—L5”按需展开 |
| 页面运行日志 | 通过 | 应用内浏览器 `dev.logs()` 返回空数组 |

## Comparison History

1. 用户图 1—9：指出跳顶、分区弱、能力栏滚动、字号 / 对齐、demo 暴露、适用性与下级下拉、等级提示和关注点批量 / 聚合边界问题。
2. 第一轮实现：功能边界已落地，但 1024px 评分双列内部 `scrollWidth > clientWidth`，判定为 P1；改为 `< 1280px` 上下分层。
3. 移动复核：后置密度样式覆盖了 720px 单列规则，导致评分内部裁切，判定为 P1；在最终样式层补回维度、等级按钮、结果和次级字段单列规则。
4. 最终对照：三档视口无横向溢出；真实评分和适用性点击不跳位；执行页无聚合回写与用户可见 demo 文案；无剩余 P0 / P1 / P2。

## Open Questions

无 Web 设计阻塞。macOS DMG App 本轮未重建、未回归；共享前端需在下次发布矩阵补 App 证据，5173 通过不替代 DMG 验收。

final result: passed

---

# 成熟度模型使用指南 Design QA

- source visual truth: `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-2dfcc904-9e0e-40af-a4ec-22e3bf4db963.png`
- follow-up visual truth: `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-dc2fa4bf-c51b-427b-94f9-deac319cb0b8.png`
- removal target: `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-119924d1-d78f-43bd-836d-b2916f98235b.png`
- compact-height target: `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-bb28ac43-72a6-444d-9de4-0f5abca19999.png`
- source document: `/Users/kim1st/Downloads/SAPD_成熟度模型使用指南_v1.2_20260709.html`
- implementation screenshot: `/private/tmp/sapd-maturity-guide-compact-desktop.png`
- focused comparison: `/private/tmp/sapd-maturity-guide-compact-comparison.png`
- responsive screenshot: `/private/tmp/sapd-maturity-guide-compact-mobile-390.png`
- viewport: `1440 x 900` desktop；`820 x 900` tablet；`390 x 844` mobile
- state: 从 `/overview` 展开“安全指南”并点击“成熟度模型使用方法”；另验证刷新态和第 6 项目录跳转

## Findings

无剩余 P0 / P1 / P2 问题。

- 字体与排版：实现继续使用原始 HTML 的系统字体栈、字号、字重和层级；按用户裁定仅将 hero 正文行高收紧到 `1.58`，窄屏换行无截断。
- 间距与布局：右侧通用内容标题条已隐藏；文档面顶部 `20px`，封面圆角 `28px`；desktop hero 从约 `355px` 收紧到 `265px`，仍完整显示标题与两段说明。
- 颜色与视觉 token：封面计算样式保留原始 `radial-gradient` 与 `linear-gradient(135deg, #0b1f4d, #1f5bd6 54%, #00a1c9)`，白色文案和右下装饰圆形一致。
- 图片与资产：正文图片、表格和全部内嵌资产来自用户原始 HTML，没有占位图、CSS 仿图或二次生成资产。
- 文案与内容：标题、说明、章节和图表内容来自原始 HTML；只按用户明确要求删除重复眉标“SAPD Wiki 指南”。
- 响应式：`820px` 和 `390px` 下主页面与 iframe 均满足 `scrollWidth === clientWidth`；窄屏隐藏章节侧栏，正文无横向溢出。
- 交互与可访问性：iframe 使用 `aria-label` 保留可访问名称，不再设置会触发 Chrome 原生悬浮标题的 `title`；整页容器不携带 `data-annotation-tooltip` 或 `data-annotation-target-ref`，页面级 Issue 目标仍由 `setCurrentAnnotationTarget` 维护。

## Full-view Comparison Evidence

桌面全屏实现截图显示：SAPD Wiki 主壳、左侧指南目录和右侧完整 HTML 文档面同时存在；悬浮标题和 hero 眉标均不存在；压缩后的封面与第一章开头可同时进入首屏。

## Focused Comparison Evidence

`/private/tmp/sapd-maturity-guide-compact-comparison.png` 将用户问题截图与修复后桌面实现置于同一画面。实现删除悬浮标题和眉标，减少 hero 垂直占用，同时保留渐变方向、浅蓝径向高光、标题层级、正文颜色、圆角和右下装饰圆形。

## Comparison History

1. 用户初始证据：首次点击出现空白，刷新后出现重复标题条，且手工迁移样式不等于原始 HTML。修复为原始 HTML 同源隔离文档面，复用幻灯片两栏布局。
2. 第一轮实现截图 `/private/tmp/sapd-maturity-guide-implementation.png`：发现默认目录选中态触发自动滚动，首屏跳过封面，判定为 P1。修复为“目录选中态”和“用户主动跳转”分离。
3. 第二轮桌面截图与 focused comparison：首屏封面恢复，重复标题条隐藏，首次点击、刷新、目录跳转、桌面和窄屏均通过；无剩余 P0 / P1 / P2。
4. 用户 follow-up 指出整页悬浮标题、重复眉标和 hero 偏高。先修复整页批注锚点误绑定，随后根据用户复验继续移除 iframe 原生 `title`；删除 hero pill，并将 desktop hero 收紧为 `265px`。自定义与原生 tooltip 来源均已清除。

## Open Questions

无设计阻塞。macOS DMG App 本轮未回归，5173 结论不替代下次 DMG 验收。

## Implementation Checklist

- [x] 原始 HTML 保持正文与视觉基线，用户明确裁定的嵌入外观覆盖单独记录。
- [x] 首次点击与刷新态一致。
- [x] 删除右侧重复标题条。
- [x] 保留 6 项章节目录并可跳转。
- [x] 完成桌面、tablet、mobile 和浏览器错误检查。
- [x] 删除整页悬浮标题、hero 眉标并压缩封面高度。

## Follow-up Polish

无阻断性交互或视觉优化项。

final result: passed

---

# Apple Shell 舒适度与成熟度全能力结果 Design QA（2026-07-13）

- visual truth：用户本轮 7 张截图；关键对照为旧标题 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-00ba84c2-06bd-46c7-86db-db9bdbd544eb.png`、评分项目上下文 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-1086aabe-685b-4101-884b-4349abf66bf8.png`、旧单 L2 四维雷达 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-1770208b-9c2f-4e64-b1d7-c7c591a19186.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-002`；应用内浏览器 `1280 × 720`，未启动系统 Chrome。
- after evidence：`/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/sapd-frontend-regression-2026-07-13/post-overview-apple-shell.png`、`post-scoring-shared-service-tabs.png`、`post-results-all-l2-radar.png`、`post-results-radar-bottom.png`。

## Findings 与验证结论

无剩余 Web P0 / P1 / P2 设计阻塞。

- 标题节奏：该轮先把 `82px / 22px` 恢复到 `96px / 26px`，但后续旧 DMG 精确对照确认 `26px` 仍偏大；当前最终契约已由本文顶部的标题专项 QA 修正为页头 `96px`、标题 `24px`、说明 `12px`、页面 `h1=1`。
- 项目上下文：项目概览、评估模板、评分执行、评分复核、评估结果、报告快照逐项真实点击，六个页面均存在且只存在一条 `.maturity-v5-project-context`，项目名保持一致。
- 结果粒度：雷达契约为 `l2-capability-by-top-category`，32 条轴全部来自后端能力结果，分组为技术 `19`、治理 `1`、管理 `12`；未评分不写 0，精确值可展开核对。
- 共享 Tab：`T-AS.AD-01` 真实 6 个服务使用 `maintenance-section-tabs / maintenance-section-tab`，单行、不压缩业务名称，`scrollWidth=1779 / clientWidth=730` 时只在 Tab 容器内部滚动，页面无横向溢出。
- 目录密度：节点网格不再为已删除状态文字保留固定列宽，状态圆点到层级标签间距 `6px`，层级与名称作为连续信息组呈现。
- 字段边界：主区 14 个禁显字段命中 `0`；应用内浏览器控制台日志为空。
- 浏览器截图中局部半透明层仍可能出现黑块，这是既有内置截图工具合成伪影；DOM、计算样式、交互和自动门禁均未出现对应黑色表面。

final result: passed

---

# 成熟度评估方案 1 与新建退出交接收口 Design QA（2026-07-13）

- visual truth：用户提供的 SERVICE 图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-6a256b44-4caa-4e9b-ba3a-7de302e4eb3d.png`、FOCUS 图 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-4dec9f3d-26df-4f5d-a8b8-5526626ed9f2.png` 和旧关闭确认反例 `/var/folders/81/8nwy3h2n00s1dw1g5bnvj7j40000gn/T/codex-clipboard-42039948-a4a6-4b33-861a-e4b925fff3f3.png`。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity` 与 `http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`。
- visual viewport：应用内浏览器 `1486 × 1058`；另检查 `1024 × 900`、`390 × 844`。未启动系统 Chrome。
- SERVICE state：`T-AS.AD 网络安全体系架构管控能力`，左侧当前 L2 的 3 个关注点，右侧 `I-AP&T-AS.AD-01 应用架构管控`。
- FOCUS state：`G-SP.SM 安全战略管理能力`，左侧 `G-SP.SM-01—03`，右侧直接评估 `G-SP.SM-01`。

## Findings

无剩余 P0 / P1 / P2 设计问题。

- 结构：方案 1 的项目内导航、L0 / L1 / L2 能力切换、L2 汇总、聚焦摘要、当前 L2 关注点列表和主评分表单均保持原位置与顺序；SERVICE / FOCUS 使用同一壳和同一控件体系。
- 数据粒度：SERVICE 只显示当前关注点的真实服务评估点；FOCUS 不显示空服务、伪作用域或重复评估对象。前端没有生成 rubric、评分或聚合结果。
- 排版：首轮实现的关注点列表、维度名、当前 rubric、评分依据和目标 / 证据标签仍为 `8—11px`，判定为 P1；修复后计算字号分别为 `13px / 13px / 12px / 10px / 11px`，核心信息恢复到规格的可读层级。
- 主动作：`.maturity-v1-project-page` 滚动到 `422.5 / 423px` 后，评分底部动作保持在视口 `965—1023px`，可继续操作且没有覆盖评分输入。
- 响应式：`1024 × 900` 与 `390 × 844` 均无页面级横向溢出；L2 导航和评分内容只在声明的局部区域处理宽度。
- 字段边界：主展示区对 `sheet / row / column / raw_value / source_file / import_id / source_id / source_ref / source_label / debug / raw / metadata / intermediate / generated_at` 的命中数为 `0`。

## Full-view Comparison Evidence

- SERVICE：`/private/tmp/sapd-maturity-v3-service-comparison-20260713-final.png`，左侧用户图、右侧运行实现。
- FOCUS：`/private/tmp/sapd-maturity-v3-focus-comparison-20260713-final.png`，左侧用户图、右侧运行实现。
- 对照结论：两种状态的页面壳、层级、汇总、左右分栏、评分按钮、评分依据和目标 / 证据区一致；实现新增的跳转、搜索、筛选和文件交换工具条属于三份规格明确允许的 demo 功能迁移，不是未授权重排。
- 应用内浏览器对局部半透明层偶发黑块；该现象与本项目既有截图工具伪影一致，已通过 DOM、计算样式和可见控件交互复核，不作为页面缺陷。

## Focused Comparison Evidence

- SERVICE：`/private/tmp/sapd-maturity-v3-service-focused-comparison-20260713-final.png`。
- FOCUS：`/private/tmp/sapd-maturity-v3-focus-focused-comparison-20260713-final.png`。
- 主动作证据：`/private/tmp/sapd-maturity-v3-service-sticky-footer-20260713.png`、`/private/tmp/sapd-maturity-v3-focus-sticky-footer-20260713.png`。
- 浏览器接口不支持评分区元素级 screenshot，PNG 探测也超时；因此 focused 证据采用同一视口滚动到评分区后的画面对照，并辅以计算样式、滚动坐标和 DOM 断言。

## Comparison History

1. 用户参考图：方案 1 的 SERVICE / FOCUS 完整页面与旧“保留当前填写内容”关闭确认反例。
2. 第一轮运行对照：结构与对象粒度正确，但核心业务信息大量使用 `8—11px`，判定为 P1；主动作位于首屏以下。
3. 第二轮实现：只调整成熟度局部排版、评分底部动作滚动可见性和旧关闭确认残留，不移动方案 1 不可变区；重新载入缓存版本后字号与 sticky 状态生效。
4. 最终对照：SERVICE / FOCUS 同构，主动作滚动后可见，`1024 / 390px` 无页面级横向溢出，无剩余 P0 / P1 / P2。

## Primary Interaction Verification

| 路径 | 结果 | 状态断言 |
|---|---|---|
| 右上角 `X` | 通过 | 浮层关闭、焦点回到 `maturityNewProjectButton`、项目行仍为 `1`、无测试项目 |
| 第一步“取消” | 通过 | 与 `X` 完全相同，不保存草稿、不出现确认层 |
| `Esc` | 通过 | 与 `X` 完全相同，键盘焦点恢复 |
| 背景遮罩 | 通过 | `12,12` 命中 `.maturity-v2-create-scrim`，应用内浏览器真实坐标点击后浮层关闭；locator 的相对位置参数未被该浏览器接口采用，不是页面失败 |

- 旧 `.maturity-v2-close-confirm` 组件、样式与 `createCloseConfirm` 状态均已删除。
- 专项静态审计同时断言关闭按钮、第一步取消、`Esc`、遮罩和无旧确认层。
- 运行页控制台 error 数为 `0`。

## Open Questions

无 Web 设计阻塞。macOS DMG App 本轮未重建、未回归；共享前端修复需在下次发布矩阵中补 App 证据，5173 通过不替代 DMG 验收。

## Implementation Checklist

- [x] SERVICE / FOCUS 独立同构运行状态。
- [x] 同一视口全画面和评分区对照。
- [x] 核心排版 P1 修复并读取计算样式。
- [x] `X / 取消 / Esc / 背景遮罩` 四路径真实回归。
- [x] 1024 / 390px 页面级横向溢出检查。
- [x] 字段边界、控制台错误、专项审计和 maturity smoke。
- [x] 三份成熟度文档同步记录“本轮无业务规则变化”。

final result: passed

---

# 成熟度评估评分执行 Design QA（2026-07-12）

- visual truth：用户提供的层级评分、位置稳定和分层汇总问题截图。
- implementation：`http://127.0.0.1:5173/#/workbench/maturity/demo-project-001`
- viewport：应用内浏览器 `1280 x 720`，未启动系统 Chrome。

## 验证结论

无剩余 P0 / P1 / P2 设计问题。

- 首次进入和刷新只显示 3 个能力 L0，L1 / L2 / 关注点 / 服务均未预展开，页面无横向溢出。
- 按 L0、L1、L2、关注点逐级展开后，层级标题显示当前、目标、完成度和状态；同一关注点下的服务连续排列。
- 关注点统一设置四维 L3、目标 L4 后，5 个适用服务同步带入；1 个不适用服务保持置灰且不计分。
- 单个服务组织维度覆盖为 L1 后，关注点统一值显示“混合”，关注点指数由 `3` 更新为 `2.9`，能力 L2 指数由 `3.35` 更新为 `3.31`。
- 连续下拉重渲染前后，当前控件屏幕位置均为 `812.0859375px`；路由、展开路径和滚动位置未变化。
- 刷新后评分草稿恢复，同时层级回到默认 L0 折叠；恢复演示数据后无控制台错误。

final result: passed
