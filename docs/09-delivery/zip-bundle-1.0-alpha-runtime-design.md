# ZIP Alpha 分平台本地运行闭环设计

本文档定义 Delivery Bundle 1.0-alpha 分平台 ZIP 解压即用版的运行目录、base/user 双库连接方式、启动检查、端口策略、本地服务和诊断包边界。

ZIP 是本阶段的交付边界。Windows ZIP 内部可以包含 `SAPD-Wiki-Backend.exe`，macOS ZIP 内部应包含 `SAPD-Wiki-Backend`、`.command` 脚本或后续 `.app`；这些只是 ZIP 内部运行组件，不代表本阶段交付 exe 安装器、`.dmg` 或 `.msi`。

## 1. 运行目录

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
│       └── sapd_wiki_user.sqlite3
├── config/
│   └── app-config.json
├── logs/
├── diagnostics/
│   └── export-diagnostics.bat
└── README-FIRST.md
```

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
│       └── sapd_wiki_user.sqlite3
├── config/
│   └── app-config.json
├── logs/
├── diagnostics/
│   └── export-diagnostics.command
└── README-FIRST.md
```

ZIP alpha 的合法 bundle root 必须至少包含：

- `app/frontend-dist/`
- `data/base/sapd_wiki_base.sqlite3`
- `data/base/base-manifest.json`
- `data/user/`
- `config/app-config.json`
- `logs/`
- `diagnostics/`
- 平台对应运行组件：Windows 为 `SAPD-Wiki-Backend.exe`，macOS 为 `SAPD-Wiki-Backend`

## 2. base/user 双库连接

基础库：

```text
data/base/sapd_wiki_base.sqlite3
```

用户库：

```text
data/user/sapd_wiki_user.sqlite3
```

推荐后端连接方式：

```sql
ATTACH DATABASE 'data/base/sapd_wiki_base.sqlite3' AS base;
ATTACH DATABASE 'data/user/sapd_wiki_user.sqlite3' AS user;
```

基础库打开策略：

```text
read only
query only
no migration on user machine
no user write transaction
```

SQLite URI 可优先使用：

```text
file:data/base/sapd_wiki_base.sqlite3?mode=ro&immutable=1
```

如果平台兼容性影响 `immutable=1`，也必须在连接后执行：

```sql
PRAGMA query_only = ON;
```

用户库是唯一可写库。用户备注、收藏、个人标签、新增对象和新增关系都写入用户库。

## 3. 启动检查流程

启动时按顺序检查：

1. 当前目录是否为合法 bundle root；
2. `app/frontend-dist/` 是否存在；
3. `data/base/sapd_wiki_base.sqlite3` 是否存在；
4. `data/base/base-manifest.json` 是否存在；
5. `base-manifest.json` 是否为合法 JSON；
6. manifest 必填字段是否完整；
7. 基础库 SHA-256 是否匹配 manifest；
8. `data/user/sapd_wiki_user.sqlite3` 是否存在；
9. 用户库不存在时自动创建；
10. 用户库 `schema_version` 是否匹配 manifest；
11. `logs/` 是否可写；
12. 默认端口是否可用；
13. 默认端口占用时自动尝试备用端口。

## 4. 端口策略

默认端口：

```text
127.0.0.1:18765
```

备用端口：

```text
18766
18767
18768
```

端口选择规则：

1. 优先使用 `config/app-config.json` 中的 `preferred_port`；
2. 如果被占用，依次尝试 `fallback_ports`；
3. 找到可用端口后写入 `logs/runtime.log`；
4. 不要求用户填写端口。

## 5. app-config.json

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

## 6. 失败处理

| 场景 | 处理 |
|---|---|
| bundle root 不合法 | 启动失败，提示缺少必要目录 |
| frontend-dist 缺失 | 启动失败，提示前端资源缺失 |
| base 数据库缺失 | 启动失败，提示缺少基础库 |
| manifest 缺失 | 启动失败，提示缺少 manifest |
| base hash 不匹配 | 启动失败，提示基础库可能损坏 |
| user 库缺失 | 自动创建 |
| user schema 不匹配 | ZIP alpha 先启动失败，后续接 migration |
| logs 不可写 | 启动失败，提示目录不可写 |
| 端口全部占用 | 启动失败，提示端口不可用并写日志 |

## 7. 本地服务最小 API

ZIP-RUN-1 阶段新增 `scripts/run_local_server.py` 作为后续打包成平台运行组件的源码入口。该入口负责：

- 启动前执行 runtime check；
- 缺失用户库时自动创建；
- 服务 `app/frontend-dist/` 静态资源；
- 根路径 `/` 返回 `index.html`；
- 前端深层路由刷新时回退到 `index.html`；
- 提供最小 API 验证 base/user 双库读写。

最小 API：

| API | 方法 | 作用 |
|---|---|---|
| `/api/v1/health` | `GET` | 返回运行状态、平台、端口和 bundle root |
| `/api/v1/base/summary` | `GET` | 只读读取 base DB 的数据版本、schema 版本、hash 和表计数 |
| `/api/v1/base/items?limit=20` | `GET` | 从 base DB 读取示例知识对象，用于 alpha smoke |
| `/api/v1/user/favorites` | `GET` | 读取 user DB 中的收藏 |
| `/api/v1/user/favorites` | `POST` | 写入或更新用户收藏，只写入 user DB；必须带 `Content-Type: application/json` 和 `X-SAPD-Session-Token` |

`X-SAPD-Session-Token` 由本地后端启动时生成，可通过同源 `GET /api/v1/health` 获取；浏览器跨源页面不能读取该 token，且写接口会拒绝非本机来源的 POST。ZIP-RUN-1 的用户写入验证优先使用收藏动作。后续备注、标签、新增对象和新增关系继续沿用 `sapd_wiki_user.sqlite3`。

## 8. 诊断包内容

诊断包输出：

```text
diagnostics/sapd-wiki-diagnostics-YYYYMMDD-HHMMSS.zip
```

内容：

- `manifest.json` 或 `base-manifest.json`
- `app-config.json`
- `runtime.log`
- `startup-check-result.json`
- `runtime-state.json`
- `platform-info.json`
- `database-files.json`
- `redaction-note.txt`

`database-files.json` 只记录：

- 文件是否存在；
- 文件大小；
- SHA-256；
- 路径相对 bundle root 的相对路径。

诊断包默认不包含：

- 用户备注全文；
- 用户库全文；
- 基础库全文；
- 原始导入文件；
- 导出文件。

## 9. 分平台启动脚本

Windows:

```text
start-windows.bat
→ 检查 SAPD-Wiki-Backend.exe
→ 执行 SAPD-Wiki-Backend.exe --bundle-root <ZIP root>
→ 启动失败时提示查看 logs/runtime.log 或 diagnostics
```

macOS:

```text
start-macos.command
→ 检查 SAPD-Wiki-Backend 是否存在且可执行
→ 执行 SAPD-Wiki-Backend --bundle-root <ZIP root>
→ 启动失败时提示 chmod +x 和查看 logs/runtime.log
```

macOS alpha 风险：

- `.command` 和 `SAPD-Wiki-Backend` 需要执行权限；
- ZIP 解压后权限可能丢失，需要 `chmod +x`；
- 未签名可执行文件可能触发 Gatekeeper 提示；
- 本轮只记录说明，不做签名和 notarization。

## 10. 启动成功标准

ZIP alpha 启动成功必须满足：

1. bundle root 合法；
2. base manifest 校验通过；
3. base 数据库存在且 hash 匹配；
4. user 数据库存在或已自动创建；
5. user schema 版本匹配；
6. logs 可写；
7. 本地 API 端口已选择；
8. 前端静态资源可服务；
9. 浏览器可打开本地地址；
10. `/api/v1/base/summary` 能只读访问 base DB；
11. `/api/v1/user/favorites` 能写入 user DB；
12. base DB hash 在用户写入后保持不变。

## 11. 后续工程入口

后续工程顺序：

1. `scripts/create_user_db.py`
2. `scripts/check_bundle_runtime.py`
3. `scripts/export_diagnostics.py`
4. `scripts/build_zip_bundle.py`
5. `scripts/run_local_server.py`
6. 后端平台运行组件打包：Windows 输出 `SAPD-Wiki-Backend.exe`，macOS 输出 `SAPD-Wiki-Backend`
7. Windows / macOS ZIP 冒烟测试

## 12. ZIP-PACK-1 打包口径

ZIP-PACK-1 选择 PyInstaller 作为 alpha 打包工具，Nuitka 保留为后续备选。选择理由：

- 当前后端入口仍是 Python；
- PyInstaller 对 macOS / Windows 单文件运行组件支持成熟；
- alpha 阶段优先验证“解压后可运行”，不同时维护两套打包链路。

限制：

- PyInstaller 不是交叉编译器；
- Windows `SAPD-Wiki-Backend.exe` 必须在 Windows x64 环境构建和验证；
- macOS `SAPD-Wiki-Backend` 必须在对应 macOS 架构构建和验证；
- 未签名产物只适合内部 alpha 试发。

当前 macOS arm64 构建入口：

```text
scripts/package_backend_pyinstaller.py
```

Windows 构建入口：

```text
scripts/package_backend_windows.ps1
docs/09-delivery/windows-zip-build-guide.md
```

`scripts/build_zip_bundle.py` 从 ZIP-PACK-1 起要求传入真实平台运行组件：

```text
--backend-binary <SAPD-Wiki-Backend 或 SAPD-Wiki-Backend.exe>
```

默认打包输出目录为：

```text
/Users/kim1st/Documents/kim note/04_workspace/analysis/research/知识库工程/sapd wiki bundle
```

Windows 实机构建、CI 或一次性验证可以显式传入 `--output-dir` 覆盖该默认路径。

如果只是目录结构验证包，必须显式传入：

```text
--allow-placeholder
```

结构验证包不得用于内部试发或普通用户验证。

## 13. ZIP-UAT-0 状态

ZIP-UAT-0 不扩大功能，只收口内部试发准备：

- macOS arm64 真实 ZIP 已完成本机启动验证，可进入 1-3 人内部 alpha 试用；
- Windows x64 只能标记为构建脚本就绪，仍需 Windows 实机构建和启动验证；
- 诊断包继续保持脱敏，不包含用户库原文件、用户备注全文或用户敏感输入；
- 本阶段不做 Tauri、`.dmg`、`.msi`、签名、自动更新、Docker 或用户端 Excel ETL。

UAT 文档：

```text
docs/09-delivery/zip-uat-0-internal-trial-guide.md
docs/09-delivery/zip-uat-0-checklist.md
docs/09-delivery/zip-uat-feedback-template.md
docs/09-delivery/windows-zip-build-guide.md
```
