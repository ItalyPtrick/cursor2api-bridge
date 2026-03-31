# Cursor2API Bridge v0.1.0

首个公开版本，基于 `cursor2api v2.7.8` 打包为 Windows 桌面应用。

## 这版包含什么

- Windows 桌面启动器与系统托盘
- `浅色 / 深色 / 跟随系统` 三种主题
- `控制台 / 设置 / 统计` 三页界面
- 浏览器打开上游原项目前端
- 软件内更新：
  - 检查更新
  - 下载 zip
  - 校验 sha256
  - 解压到新目录
  - 启动新版本并自动导入旧 `data/`

## 使用方式

1. 下载 `cursor2api-bridge-portable-win-x64.zip`
2. 解压到新的文件夹
3. 双击 `Cursor2API Bridge.exe`

默认本地地址：

```text
http://127.0.0.1:3011
```

支持的兼容接口：

- Anthropic Messages API
- OpenAI Chat Completions API
- OpenAI Responses API

## 更新方式

### 软件内更新

1. 打开旧版本
2. 进入 `设置`
3. 点击 `检查更新`
4. 有新版本后点击 `下载并解压`
5. 下载完成后点击 `启动新版本`

### 手动更新

1. 下载新的 zip
2. 解压到新的目录
3. 如需保留配置、日志和数据库，把旧目录里的 `data/` 复制到新目录

## 下载说明

软件内更新依赖这两个资产：

- `cursor2api-bridge-portable-win-x64.zip`
- `cursor2api-bridge-portable-win-x64.zip.sha256`

`portable.exe` 只作为附加下载，不参与软件内更新。

## 隐私与日志提醒

- 没有发现额外隐藏遥测或第三方统计上报
- 软件更新会访问 GitHub Releases
- 软件核心代理会把请求转发给上游服务
- 软件默认会把部分请求/响应信息持久化到本地 `data/logs/`

如涉及敏感内容，建议先备份或清理 `data/logs/`。

## 致谢

本项目基于上游项目 `7836246/cursor2api` 封装。
