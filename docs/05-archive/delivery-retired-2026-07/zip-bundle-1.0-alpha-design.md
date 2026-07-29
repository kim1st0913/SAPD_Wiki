# Delivery Bundle 1.0-alpha：ZIP 解压即用交付版设计

> 归档状态：`historical / ZIP alpha`

> 状态：draft  
> 日期：2026-05-28  
> 适用项目：SAPD Wiki  
> 目标形态：面向内部团队快速分发、快速验证、快速反馈的 ZIP 解压即用版本。

## 1. 结论

Delivery Bundle 1.0 的第一优先级正式定义为：

```text
P0：ZIP 解压即用版
P1：macOS .app / .dmg、Windows .exe / .msi 安装包
P2：自动更新、签名、公网发布、企业集中管理
P3：Docker / Server 版 / 多人协作版
```

这不是“低配版”，而是 Delivery Bundle 1.0 的主交付目标。当前阶段最重要的是让内部团队拿到对应平台的 zip 后可以解压、双击启动、打开本地页面、读取预构建基础库，并把个人数据写入独立用户库。

口径固定为：

```text
交付物：分平台 ZIP
Windows ZIP 内部运行组件：SAPD-Wiki-Backend.exe
macOS ZIP 内部运行组件：SAPD-Wiki-Backend / start-macos.command
```

`SAPD-Wiki-Backend.exe` 不是 Windows 安装器；`.dmg`、`.msi`、签名和自动更新均不属于 ZIP alpha。

## 2. 目标体验

```text
团队成员收到 ZIP
→ 解压到本机目录
→ 双击对应平台启动脚本
→ 系统检查目录、manifest、基础库、用户库和端口
→ 自动启动本地 API 和静态前端
→ 自动打开浏览器访问本地页面
→ 用户直接浏览 SAPD Wiki
```

用户不需要：

- 安装 Python；
- 安装 Node；
- 安装 Docker；
- 创建虚拟环境；
- 执行 ETL；
- 初始化数据库；
- 配置端口；
- 打开命令行排错。

## 3. 第一版技术路线

第一版不先卡在 Tauri 桌面壳上。

推荐路线：

```text
ZIP Bundle
= 后端可执行文件
+ 前端静态资源
+ 预构建只读基础数据库
+ 可写用户数据库目录
+ 启动 / 停止脚本
+ manifest
+ logs
+ diagnostics
```

后端职责：

- 同时提供 `/api/v1/*` 本地 API；
- 提供前端静态资源服务；
- 挂载 `sapd_wiki_base.sqlite3` 只读库；
- 创建或挂载 `sapd_wiki_user.sqlite3` 可写库；
- 输出日志；
- 生成诊断包。

打包方式可先评估：

| 选择 | 用途 | 说明 |
|---|---|---|
| PyInstaller | alpha 优先候选 | 复用现有 Python 后端最快；Windows 产出 ZIP 内部 `.exe`，macOS 产出 ZIP 内部原生可执行文件 |
| Nuitka | alpha / beta 候选 | 可能获得更好的启动和分发体验，但构建复杂度更高 |
| Go / Rust 后端 | beta 后候选 | 后续若 Python 可执行文件体积、误报或启动体验不理想，再评估重写服务层 |
| Tauri shell | P1 体验增强 | 不阻塞 ZIP alpha；待本地后端、双库、manifest、诊断跑通后再接入 |

ZIP-PACK-1 冻结选择 PyInstaller 作为 alpha 主线打包工具。Nuitka 暂不并行实现，避免打包链路发散。

重要限制：

- PyInstaller 不是交叉编译器；
- macOS 运行组件必须在 macOS 构建；
- Windows `SAPD-Wiki-Backend.exe` 必须在 Windows 构建；
- 当前 macOS arm64 环境只能真实生成并验证 `SAPD-Wiki-v0.1.0-mac-arm64.zip`；
- Windows ZIP 构建脚本和验收清单就绪后，仍需 Windows 环境实测。

ZIP-UAT-0 当前状态：

```text
macOS arm64：已具备 1-3 人内部小范围试发条件
Windows x64：构建脚本就绪 / 未实机验证
```

内部试发入口：

- `docs/09-delivery/zip-uat-0-internal-trial-guide.md`
- `docs/09-delivery/zip-uat-0-checklist.md`
- `docs/09-delivery/zip-uat-feedback-template.md`

## 4. ZIP 包结构

### Windows x64

```text
SAPD-Wiki-v0.1.0-win-x64/
├── start-windows.bat
├── stop-windows.bat
├── SAPD-Wiki-Backend.exe
├── app/
│   └── frontend-dist/
├── data/
│   ├── base/
│   │   ├── sapd_wiki_base.sqlite3
│   │   └── base-manifest.json
│   └── user/
├── config/
│   └── app-config.json
├── logs/
│   └── .gitkeep
├── diagnostics/
│   └── export-diagnostics.bat
└── README-FIRST.md
```

### macOS arm64 / x64

```text
SAPD-Wiki-v0.1.0-mac-arm64/
├── start-macos.command
├── stop-macos.command
├── SAPD-Wiki-Backend
├── app/
│   └── frontend-dist/
├── data/
│   ├── base/
│   │   ├── sapd_wiki_base.sqlite3
│   │   └── base-manifest.json
│   └── user/
├── config/
│   └── app-config.json
├── logs/
│   └── .gitkeep
├── diagnostics/
│   └── export-diagnostics.command
└── README-FIRST.md
```

建议不要做一个 zip 同时覆盖所有平台。内部团队分发直接拆成：

```text
SAPD-Wiki-v0.1.0-win-x64.zip
SAPD-Wiki-v0.1.0-mac-arm64.zip
SAPD-Wiki-v0.1.0-mac-x64.zip
```

## 5. 功能边界

### 5.1 必须有

| 能力 | 验收含义 |
|---|---|
| 解压即用 | 用户解压后不安装依赖即可启动 |
| 后端可执行文件可启动 | Windows / macOS 对应可执行文件可运行 |
| 前端页面可打开 | 后端提供静态页面并自动打开浏览器 |
| 读取基础库 | 数据来自 `data/base/sapd_wiki_base.sqlite3` |
| 自动创建用户库 | 缺失 `data/user/sapd_wiki_user.sqlite3` 时自动创建 |
| 双库物理分离 | base 只读，user 可写 |
| 轻量写入能力 | 收藏 / 备注 / 用户标签至少实现一种 |
| manifest 检查 | 启动时校验 `base-manifest.json` 存在和基础字段 |
| 日志落盘 | 写入 `logs/runtime.log` |
| 诊断包导出 | 可导出脱敏诊断 zip |

### 5.2 暂不做

- 正式安装器；
- 代码签名；
- 自动更新；
- 多用户协作；
- 云同步；
- 用户端执行 ETL；
- 用户直接修改 `sapd_wiki_base.sqlite3`；
- 完整 Excel 导入器；
- Docker 作为普通用户主路径；
- Tauri 桌面壳作为 alpha 阻塞项。

用户导入和编辑能力先做底座。第一版只开放轻量写入，例如备注、收藏或个人标签。

## 6. base/user 双库处理

ZIP 版固定使用：

```text
data/base/sapd_wiki_base.sqlite3
只读基础知识库

data/user/sapd_wiki_user.sqlite3
可写用户数据
```

后端启动时挂载：

```sql
ATTACH DATABASE 'data/base/sapd_wiki_base.sqlite3' AS base;
ATTACH DATABASE 'data/user/sapd_wiki_user.sqlite3' AS user;
```

读取模型：

```text
base 数据为主
user 数据作为叠加层
```

第一版采用“叠加展示”模式，不做用户库覆盖基础库：

| 数据 | 来源 |
|---|---|
| 基础能力、知识对象、关系 | `base` |
| 用户备注 | `user.notes` 或 `user_notes` |
| 用户收藏 | `user.favorites` 或 `user_favorites` |
| 用户标签 | `user.tags` / `user.item_tags` |
| 用户新增对象 | `user.custom_items` 或 `user.knowledge_items` |
| 用户新增关系 | `user.custom_relations` 或 `user.knowledge_relations` |

## 7. 启动流程

```text
1. 用户双击对应平台的 start 脚本
2. 检查当前目录结构
3. 检查 data/base/sapd_wiki_base.sqlite3 是否存在
4. 检查 data/base/base-manifest.json 是否存在
5. 检查 app/frontend-dist/ 是否存在
6. 检查或创建 data/user/sapd_wiki_user.sqlite3
7. 检查 user schema 版本
8. 选择可用端口
9. 启动本地 API 和静态资源服务
10. 自动打开浏览器
11. 写入 logs/runtime.log
```

端口策略：

```text
默认：127.0.0.1:18765
备用：18766、18767、18768
```

用户不填写端口。端口被占用时自动切换。

## 8. manifest

ZIP 版必须带 `base-manifest.json` 和可选 `app-config.json`。第一版可以不做复杂升级，但必须知道用户手里的包是什么版本、数据是什么版本。

推荐 `base-manifest.json`：

```json
{
  "app_name": "SAPD Wiki",
  "app_version": "0.1.0-alpha",
  "bundle_type": "zip-portable",
  "build_time": "2026-05-28",
  "platform": "win-x64",
  "base_database": {
    "file": "sapd_wiki_base.sqlite3",
    "data_version": "2026.05-alpha",
    "schema_version": "base_schema_0.1",
    "sha256": "..."
  },
  "user_database": {
    "file": "sapd_wiki_user.sqlite3",
    "schema_version": "user_schema_0.1"
  },
  "frontend": {
    "version": "0.1.0-alpha"
  },
  "backend": {
    "version": "0.1.0-alpha"
  }
}
```

推荐 `config/app-config.json`：

```json
{
  "host": "127.0.0.1",
  "preferred_port": 18765,
  "fallback_ports": [18766, 18767, 18768],
  "open_browser_on_start": true,
  "log_file": "logs/runtime.log",
  "runtime_state_file": "logs/runtime-state.json",
  "startup_check_file": "logs/startup-check-result.json",
  "frontend_dist": "app/frontend-dist",
  "base_database": "data/base/sapd_wiki_base.sqlite3",
  "user_database": "data/user/sapd_wiki_user.sqlite3",
  "diagnostics_dir": "diagnostics"
}
```

## 9. ZIP-RUN-1 最小本地运行闭环

ZIP-RUN-1 引入 `scripts/run_local_server.py` 作为本地后端源码入口，后续可被 PyInstaller / Nuitka 打包为不同平台的 ZIP 内部运行组件。

当前最小闭环：

```text
runtime check
→ user DB 自动创建
→ 静态前端服务
→ base DB 只读 API
→ user DB 收藏写入 API
→ runtime.log / runtime-state.json
→ diagnostics 脱敏导出
```

最小 API：

- `GET /api/v1/health`
- `GET /api/v1/base/summary`
- `GET /api/v1/base/items`
- `GET /api/v1/user/favorites`
- `POST /api/v1/user/favorites`，需携带启动期 `X-SAPD-Session-Token`

ZIP-RUN-1 只验证本地运行链路，不承诺完整业务 API 覆盖。现有前端主展示逻辑、字段边界和数据投影契约不在本轮重构范围内。

## 10. 日志与诊断包

启动和运行必须写入：

```text
logs/runtime.log
```

诊断包建议输出到：

```text
diagnostics/sapd-wiki-diagnostics-YYYYMMDD-HHMMSS.zip
```

诊断包包含：

```text
diagnostic-summary.json
base-manifest.json
app-config.json
runtime.log
startup-check-result.json
runtime-state.json
platform-info.json
database-files.json
redaction-note.txt
```

默认不包含：

- `sapd_wiki_base.sqlite3`；
- `sapd_wiki_user.sqlite3`；
- 原始导入文件；
- 用户导出文件；
- 用户备注全文。

## 11. macOS alpha 风险说明

macOS ZIP alpha 需要记录以下现实问题：

- `start-macos.command` 可能需要执行权限；
- `SAPD-Wiki-Backend` 可能需要执行权限；
- 用户可能需要执行 `chmod +x start-macos.command SAPD-Wiki-Backend`；
- 未签名可执行文件可能触发 Gatekeeper 提示；
- 本轮不做签名、notarization 或 `.dmg`。

这些问题不会改变 P0 交付形态：第一优先级仍然是分平台 ZIP。

## 12. 构建脚本目标

建议后续实现：

```text
scripts/build_zip_bundle.py
```

职责：

1. 创建 bundle 目录；
2. 复制后端可执行文件；
3. 复制前端静态资源到 `app/frontend-dist/`；
4. 复制正式基础库为 `data/base/sapd_wiki_base.sqlite3`；
5. 生成 `data/base/base-manifest.json`；
6. 创建 `data/user/`、`logs/`、`diagnostics/`；
7. 复制启动 / 停止 / 诊断脚本；
8. 生成 `README-FIRST.md`；
9. 压缩为平台 zip；
10. 输出构建摘要。

默认输出目录维护为：

```text
/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle
```

如需临时输出到其他位置，可以使用 `--output-dir` 覆盖；脚本也支持用 `SAPD_WIKI_BUNDLE_OUTPUT_DIR` 覆盖默认目录。

内部 alpha 发行目录维护为：

```text
"/Users/kim1st/Documents/kim note/04_workspace/research/知识库工程/sapd wiki bundle/dist/releases/0.1.0-alpha/"
```

该目录只作为本地发行产物目录，不提交大体积 ZIP。`release-manifest.json` 必须如实标记各平台状态；Windows 未实机验证时保持 `pending / not_verified`。

ZIP-PACK-1 起，真实运行 ZIP 必须传入：

```text
--backend-binary
```

不传入真实平台运行组件时，构建脚本默认失败。只有显式传入 `--allow-placeholder` 时才允许生成结构验证包，且 README / manifest 会标注 placeholder，不能作为内部试发包。

## 13. 验收标准

| 编号 | 标准 |
|---|---|
| 1 | 在未安装 Python、Node、Docker 的 Windows 机器上，解压后可启动 |
| 2 | 启动后浏览器可打开 SAPD Wiki 首页 |
| 3 | 页面数据来自 `sapd_wiki_base.sqlite3` |
| 4 | 用户执行收藏、备注或个人标签后，数据写入 `sapd_wiki_user.sqlite3` |
| 5 | 删除 `sapd_wiki_user.sqlite3` 后，再次启动可自动重建 |
| 6 | 缺失 base 数据库时，启动失败并给出明确错误 |
| 7 | 端口被占用时，系统自动切换备用端口 |
| 8 | 可一键导出诊断包 |
| 9 | `logs/runtime.log` 可记录启动成功和失败原因 |
| 10 | ZIP 包路径包含空格或中文时仍可启动，至少进入兼容性测试清单 |

## 14. 后续阶段

第一阶段：

```text
ZIP + 本地后端可执行文件 + 浏览器打开
```

第二阶段：

```text
Tauri 壳 + ZIP 便携版
```

第三阶段：

```text
macOS .dmg / Windows .msi
```

路线判断：

```text
先解决“团队拿到包能不能用”
再解决“体验像不像桌面软件”
最后解决“是否适合正式对外发布”
```
