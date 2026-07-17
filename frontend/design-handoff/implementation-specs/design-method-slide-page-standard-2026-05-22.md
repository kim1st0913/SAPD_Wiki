# 设计方法幻灯片页面前端标准（2026-05-22）

本标准用于固化 `数据安全设计方法` 幻灯片页面的前端设计。后续安全指南中的设计方法类幻灯片页面，应默认复用本标准，不再重新设计一套播放器体验。

## 适用范围

- 适用于 `安全指南` 下以幻灯片方式浏览的设计方法页面。
- 当前基准页面：`/guides/data-security-design`。
- 后续同类页面示例：安全技术架构设计方法、安全管控模式设计方法、成熟度模型使用指南等。

## 页面结构标准

- 页面采用两栏结构：左侧为 `幻灯片目录`，右侧为主幻灯片展示区。
- 左侧目录标题固定为 `幻灯片目录`，标题在区域头部上下左右居中。
- 左侧目录只显示缩略图和页码，不显示来源字段、调试字段或原始数据字段。
- 右侧主展示区只显示幻灯片画面，不显示播放器内部标题栏、顶部页码栏、`上一页 / 下一页` 文本按钮或右侧详情栏。
- 页面右上角不显示 `导出数据` 和 `编辑映射` 操作按钮，避免与只读设计方法浏览场景冲突。

## 交互标准

- 点击左侧任意缩略页时，主展示区同步显示对应页，目录滚动位置保持不变。
- 键盘 `ArrowUp` / `ArrowDown` 支持前后切页，主展示区和左侧 active 页同步更新。
- 翻页控件放在幻灯片舞台底部居中，形式为：左箭头、页码、右箭头。
- 翻页控件默认隐藏；鼠标悬停在控件热区时显示；鼠标移到幻灯片主体区域时隐藏。
- 翻页控件不能压缩幻灯片展示面积，不能遮挡页面主要内容；必要时只允许微调底部偏移、透明度和按钮尺寸。

## 数据契约标准

- 幻灯片页面应使用单独 JSON 数据包，不应把完整幻灯片定义直接塞回 `content-views.json`。
- `content-views.json` 只作为指南索引，记录 `guide_id`、`route`、`title`、`data_path` 等轻量入口信息。
- 每个设计方法幻灯片页面使用独立数据包，例如：
  - `frontend/capability-browser/public/data/guides/data-security-design.json`
  - 后续可扩展为 `frontend/capability-browser/public/data/guides/<guide-id>.json`
- 独立数据包至少包含：`data_state`、`guide_id`、`route`、`title`、`version`、`source`、`slides`。
- `slides` 应描述 `count`、`width`、`height`、`path_pattern`，实际图片放在对应 `slides/` 目录。
- 后端 API 应为每个独立指南数据包提供 `/api/v1/data-packages/<guide-package-id>` 读取入口。

## 禁止项

- 不在前端组件中直接扫描原始目录生成幻灯片列表。
- 不把其他二级安全指南 fallback 到 `数据安全设计方法` 数据包。
- 不在主展示区显示 `sheet`、`row`、`column`、`raw_value`、`source_file`、`import_id`、`source_id`、`source_ref`、`source_label`、`debug`、`raw`、`metadata`、`intermediate`、`generated_at`。
- 不为同类幻灯片页面新增独立视觉风格，除非用户明确要求新模板。

## 当前基准验证

- 当前 `数据安全设计方法` 使用独立数据包：`frontend/capability-browser/public/data/guides/data-security-design.json`。
- 当前索引入口在：`frontend/capability-browser/public/data/content-views.json`，其中 `data_path` 指向独立数据包。
- 当前后端数据包入口：`/api/v1/data-packages/data-security-design-guide`。
- 当前 smoke 回归入口：`node scripts/frontend_smoke_check.mjs --page content --route /guides/data-security-design --url http://127.0.0.1:6189/ --debug-port 9431`。
