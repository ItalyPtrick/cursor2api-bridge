# Cursor2API Bridge

基于 [7836246/cursor2api](https://github.com/7836246/cursor2api) 的 Windows 桌面壳项目。

它把 `cursor2api v2.7.8` 做成一个更容易分发和使用的本地桌面应用，包含：

- 桌面启动器与系统托盘
- `浅色 / 深色 / 跟随系统` 三种主题
- 控制台、设置、统计三页
- 浏览器打开原项目前端 `/vuelogs` 或 `/logs`
- 软件内安全更新：下载 zip、校验 sha256、解压到新目录、启动新版本并导入旧 `data`

## 先说最重要的三件事

1. 普通使用者运行打包好的软件时，不需要安装 Python、Node.js、Git。
2. 普通使用方式就是：下载作者发布好的 zip，解压，然后双击启动。
3. 软件内更新依赖 GitHub Releases 中的 zip 和 sha256 资产，不是靠 `portable.exe` 更新。

## 这份 README 适合谁

- 想快速了解这个项目是什么的人
- 想知道下载后怎么启动的人
- 想知道隐私边界和更新方式的人
- 想找到“新手说明”和“GitHub 发布指南”的人

如果你是普通使用者，建议优先看：

- [如果你什么都不懂-看这篇](./docs/%E5%A6%82%E6%9E%9C%E4%BD%A0%E4%BB%80%E4%B9%88%E9%83%BD%E4%B8%8D%E6%87%82-%E7%9C%8B%E8%BF%99%E7%AF%87.md)

如果你是发布者，建议优先看：

- [GitHub-人工发布指南](./docs/GitHub-%E4%BA%BA%E5%B7%A5%E5%8F%91%E5%B8%83%E6%8C%87%E5%8D%97.md)
- [项目维护手册](./docs/%E9%A1%B9%E7%9B%AE%E7%BB%B4%E6%8A%A4%E6%89%8B%E5%86%8C.md)

## 下载后怎么启动

普通使用者拿到发布包后：

1. 下载作者发布好的 zip
2. 解压到一个新的文件夹
3. 双击 `Cursor2API Bridge.exe`

默认服务地址：

```text
http://127.0.0.1:3011
```

支持的兼容接口：

- Anthropic Messages API
- OpenAI Chat Completions API
- OpenAI Responses API

## 更新方式概览

### 软件内更新

前提是发布者已经把 `app.manifest.json` 中的 `updateFeed.owner/repo` 配好，并在 GitHub Releases 上传了下面这两个资产：

- `cursor2api-bridge-portable-win-x64.zip`
- `cursor2api-bridge-portable-win-x64.zip.sha256`

软件内更新的实际流程是：

1. 进入 `设置`
2. 点击 `检查更新`
3. 发现新版本后点击 `下载并解压`
4. 下载完成后点击 `启动新版本`
5. 新版本会自动带上旧版本的 `data/`

### 手动更新

如果不用软件内更新，也可以：

1. 去 GitHub Releases 下载最新 zip
2. 解压到新的目录
3. 如需保留配置、日志和数据库，把旧版本目录里的 `data/` 复制到新目录

更细的新手步骤，见：

- [如果你什么都不懂-看这篇](./docs/%E5%A6%82%E6%9E%9C%E4%BD%A0%E4%BB%80%E4%B9%88%E9%83%BD%E4%B8%8D%E6%87%82-%E7%9C%8B%E8%BF%99%E7%AF%87.md)

## 隐私与日志边界

这里不要用“零隐私风险”去理解，准确边界如下：

- 目前没有发现额外隐藏的遥测、分析埋点或第三方统计上报
- 软件更新会访问 GitHub Releases API，并下载更新资产
- 软件核心代理会把请求转发给 `cursor2api` 所使用的上游服务
- 软件默认会把请求摘要与部分 payload 持久化到本地 `data/logs/`

默认本地日志重点包括：

- `data/logs/cursor2api.db`
- JSONL 日志文件
- 请求摘要、消息预览、模型响应摘要，以及按需查询的 payload

如果涉及敏感内容：

- 更新前可以先备份或清理 `data/logs/`
- 分发给朋友前，建议在 Release 文案中明确说明本地日志行为

## 发布到 GitHub 概览

如果你是发布者，大致流程是：

1. 在 `app.manifest.json` 里填好 `updateFeed.owner/repo`
2. 本地运行 `npm run release:assets`
3. 生成 GitHub Releases 需要的 zip 和 sha256
4. 把源码推到你的 GitHub 仓库
5. 去 GitHub 网页创建 Release 并上传资产
6. 用旧版本软件跑一遍真更新验证

完整操作清单见：

- [GitHub-人工发布指南](./docs/GitHub-%E4%BA%BA%E5%B7%A5%E5%8F%91%E5%B8%83%E6%8C%87%E5%8D%97.md)

## 仓库里还有哪些文档

- [如果你什么都不懂-看这篇](./docs/%E5%A6%82%E6%9E%9C%E4%BD%A0%E4%BB%80%E4%B9%88%E9%83%BD%E4%B8%8D%E6%87%82-%E7%9C%8B%E8%BF%99%E7%AF%87.md)
- [GitHub-人工发布指南](./docs/GitHub-%E4%BA%BA%E5%B7%A5%E5%8F%91%E5%B8%83%E6%8C%87%E5%8D%97.md)
- [项目维护手册](./docs/%E9%A1%B9%E7%9B%AE%E7%BB%B4%E6%8A%A4%E6%89%8B%E5%86%8C.md)
- [发布后检查清单](./docs/%E5%8F%91%E5%B8%83%E5%90%8E%E6%A3%80%E6%9F%A5%E6%B8%85%E5%8D%95.md)
- [README-更新说明](./docs/README-%E6%9B%B4%E6%96%B0%E8%AF%B4%E6%98%8E.md)

## 许可证与致谢

本项目基于并打包了 [7836246/cursor2api](https://github.com/7836246/cursor2api)。

当前仓库使用 [MIT License](./LICENSE)。

分发包中也会附带：

- 上游源码快照
- `VERSION.json`
- `README-更新说明.md`
