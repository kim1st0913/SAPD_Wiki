# ZIP Alpha base-manifest.json 契约

本文档定义 Delivery Bundle 1.0-alpha 分平台 ZIP 解压即用版随包携带的 `data/base/base-manifest.json` 最小契约。该 manifest 用于让后端在启动时判断当前 bundle、平台、基础库、前端资源和用户库 schema 是否匹配。

## 1. 文件位置

```text
SAPD-Wiki-v0.1.0-{platform}/
└── data/
    └── base/
        └── base-manifest.json
```

`base-manifest.json` 是随 ZIP 包发布的只读说明文件。用户端不应手工编辑。

## 2. 最小字段

```json
{
  "app_name": "SAPD Wiki",
  "app_version": "0.1.0-alpha",
  "bundle_type": "zip-portable",
  "platform": "win-x64",
  "build_time": "2026-05-28T00:00:00Z",
  "base_database": {
    "file": "sapd_wiki_base.sqlite3",
    "data_version": "2026.05-alpha",
    "schema_version": "base_schema_0.1",
    "sha256": "<sha256>"
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
  },
  "package": {
    "placeholder_backend": false
  }
}
```

## 3. 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `app_name` | 是 | 固定为 `SAPD Wiki` |
| `app_version` | 是 | ZIP 包应用版本，例如 `0.1.0-alpha` |
| `bundle_type` | 是 | 固定为 `zip-portable` |
| `platform` | 是 | 构建目标，只允许 `win-x64`、`mac-arm64`、`mac-x64` |
| `build_time` | 是 | 构建时间，建议 ISO 8601 |
| `base_database.file` | 是 | 基础库文件名，当前固定为 `sapd_wiki_base.sqlite3` |
| `base_database.data_version` | 是 | 基础知识库数据版本 |
| `base_database.schema_version` | 是 | 基础库 schema 版本 |
| `base_database.sha256` | 是 | 基础库文件 SHA-256 |
| `user_database.file` | 是 | 用户库文件名，当前固定为 `sapd_wiki_user.sqlite3` |
| `user_database.schema_version` | 是 | 用户库期望 schema 版本 |
| `frontend.version` | 是 | 前端静态资源版本 |
| `backend.version` | 是 | 后端可执行文件版本 |
| `package.placeholder_backend` | 否 | 是否为结构验证包；真实试发 ZIP 必须为 `false` |

## 4. 启动校验规则

后端启动时必须检查：

1. `data/base/base-manifest.json` 存在；
2. manifest 是合法 JSON；
3. 必填字段存在；
4. `bundle_type == "zip-portable"`；
5. `platform` 属于 `win-x64`、`mac-arm64`、`mac-x64`；
6. 平台对应运行组件存在：Windows 为 `SAPD-Wiki-Backend.exe`，macOS 为 `SAPD-Wiki-Backend`；
7. `data/base/<base_database.file>` 存在；
8. 基础库 SHA-256 与 `base_database.sha256` 一致；
9. 用户库 schema 版本与 `user_database.schema_version` 一致；如果用户库不存在，则按该版本创建。
10. 如果 `package.placeholder_backend == true`，不得作为真实运行 ZIP 分发。

## 5. 失败策略

| 失败场景 | 处理 |
|---|---|
| manifest 缺失 | 启动失败，写入 `logs/runtime.log`，提示 bundle 不完整 |
| manifest JSON 无效 | 启动失败，提示 manifest 损坏 |
| 基础库缺失 | 启动失败，提示缺少 `sapd_wiki_base.sqlite3` |
| 基础库 hash 不一致 | 启动失败，提示基础库可能损坏 |
| 用户库缺失 | 自动创建 |
| 用户库 schema 过旧 | 后续 migration 处理；ZIP alpha 可先提示不兼容 |

## 6. 后续扩展

后续可增加：

- `files[]`：记录所有随包资源 hash；
- `counts`：记录基础库对象数量；
- `build_source.git_commit`：记录构建来源；
- `fallback_exports[]`：记录 fallback JSON 文件；
- `min_backend_version` / `max_tested_backend_version`：增强版本约束。
