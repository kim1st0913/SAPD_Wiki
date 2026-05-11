# 能力目录浏览页 MVP

这是第一版本地前端页面，用来验证 5 个核心 Excel Sheet 导入后的浏览体验。

## 运行方式

先生成页面数据：

```bash
python scripts/sapd_wiki.py export-capability-tree
```

再启动本地静态服务器：

```bash
cd frontend/capability-browser
python -m http.server 5173
```

浏览器打开：

```text
http://localhost:5173
```

## 当前范围

- 左侧能力树：能力分类、L1、L2、关注点。
- 中间详情：当前节点编码、描述、来源。
- 右侧关联：关注点关联的安全技术服务和适用作用域。
- 顶部搜索：匹配编码、标题、描述和服务。

第一版只读，不做编辑。
