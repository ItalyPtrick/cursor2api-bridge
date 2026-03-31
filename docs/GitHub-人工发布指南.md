# GitHub 人工发布指南

这篇文档是写给发布者自己的。

它只讲两件事：

1. 你本地要做什么
2. 你在 GitHub 网页上要点什么

## 发布前先确认

先确认这些事实：

- 当前软件默认端口是 `3011`
- 软件内更新只认 zip + sha256
- `portable.exe` 只是附加下载，不参与软件内更新
- 如果 `app.manifest.json` 里的 `updateFeed.owner/repo` 没填，软件内更新不可用

软件内更新使用的固定资产名是：

- `cursor2api-bridge-portable-win-x64.zip`
- `cursor2api-bridge-portable-win-x64.zip.sha256`

软件本地日志默认会落在：

- `data/logs/`
- `data/logs/cursor2api.db`

## 第一部分：本地操作

### 0. 先确认“项目根目录”是哪里

这篇文档里说的“项目根目录”，就是包含这些文件和目录的那个文件夹：

- `package.json`
- `app.manifest.json`
- `src/`
- `docs/`
- `scripts/`

在你这台机器上，这个目录就是：

```text
C:\GIT-TEST\repos\cursor2api-desktop
```

下面所有本地命令，都默认在这个目录里运行。

### 1. 填更新源

先打开：

```text
app.manifest.json
```

把下面两项改成你自己的 GitHub 仓库：

```json
"updateFeed": {
  "owner": "你的 GitHub 用户名或组织名",
  "repo": "你的仓库名",
  "assetName": "cursor2api-bridge-portable-win-x64.zip",
  "checksumName": "cursor2api-bridge-portable-win-x64.zip.sha256"
}
```

如果这里不填，`npm run release:assets` 会直接报错并拒绝继续。

### 2. 准备源码仓库内容

你准备上传到 GitHub 的源码仓库里，至少要有：

- `README.md`
- `LICENSE`
- `src/`
- `scripts/`
- `docs/`
- 其余源码本体

通常不需要上传：

- `release/`
- `dist/`
- `node_modules/`
- `vendor/`
- `data/`

### 2.1 如果你还没有把源码目录变成 Git 仓库

因为你现在这个目录还不是 Git 仓库，所以第一次上传源码时，可以在项目根目录运行：

```powershell
cd C:\GIT-TEST\repos\cursor2api-desktop
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/ItalyPtrick/cursor2api-bridge.git
git push -u origin main
```

上面这组命令的作用分别是：

1. `git init`：把当前目录初始化成 Git 仓库
2. `git add .`：把当前源码加入暂存区
3. `git commit -m "Initial release"`：生成第一次提交
4. `git branch -M main`：把默认分支名改成 `main`
5. `git remote add origin ...`：绑定你的 GitHub 仓库
6. `git push -u origin main`：把源码推到 GitHub

如果你以后已经是 Git 仓库了，就不需要再执行 `git init`；只需要继续 `git add`、`git commit`、`git push`。

### 2.2 如果这个目录已经是 Git 仓库

后续更新源码时，在项目根目录运行：

```powershell
cd C:\GIT-TEST\repos\cursor2api-desktop
git add .
git commit -m "Update release docs and assets"
git push
```

### 3. 生成正式更新资产

在本地项目根目录运行：

```powershell
npm run release:assets
```

这个命令会做三件事：

1. 重新打包 `release/win-unpacked/`
2. 生成正式发布用的 zip
3. 生成对应的 sha256 文件

生成结果会在：

```text
release/github-assets/
```

你应该能看到：

- `cursor2api-bridge-portable-win-x64.zip`
- `cursor2api-bridge-portable-win-x64.zip.sha256`

### 4. 可选生成 portable exe

如果你还想额外给朋友一个单文件版本，可以再运行：

```powershell
npm run dist:portable
```

但要记住：

- `portable.exe` 只是附加下载
- 软件内更新不用它
- 软件内更新只认 zip + sha256

### 5. 发布前本地真验证

正式发版前，至少自己做一遍：

1. 用旧版本打开软件
2. 进入 `设置`
3. 点击 `检查更新`
4. 下载并解压新版本
5. 点击 `启动新版本`
6. 确认：
   - `http://127.0.0.1:3011/health` 正常
   - 新版本已经启动
   - `data/` 被带过去了
   - `data/logs/` 里的日志和数据库仍能保留
   - 原项目前端还能打开

## 第二部分：GitHub 网页操作

下面这些步骤都是在 GitHub 网站上手动完成的。

### A. 如果你还没建仓库

1. 登录 GitHub
2. 点击右上角 `+`
3. 点击 `New repository`
4. 输入仓库名
5. 选择公开或私有
6. 点击 `Create repository`

### B. 先把源码推上去

如果你本地已经有源码，先把源码从项目根目录推到这个 GitHub 仓库。

如果你还没推过源码，就先按上面“2.1 如果你还没有把源码目录变成 Git 仓库”的命令执行一遍。

如果你已经推过源码，就按上面“2.2 如果这个目录已经是 Git 仓库”的命令执行。

这一步做完后，你的仓库首页应该能看到：

- `README.md`
- `LICENSE`
- `docs/`
- 源码目录

### C. 打开 Releases 页面

1. 进入你的 GitHub 仓库首页
2. 在右侧或顶部找到 `Releases`
3. 点击进去

如果这是第一次发版，你也可以在仓库页面里找到：

```text
Create a new release
```

### D. 新建 Release

1. 点击 `Draft a new release`
2. 在 `Choose a tag` 里输入一个新 tag，例如：

```text
v0.1.3
```

3. 确认创建这个 tag
4. 在标题里写版本名，例如：

```text
v0.1.3
```

5. 在说明里写清：
   - 这版新增了什么
   - 修复了什么
   - 普通用户怎么更新

### E. 上传发布资产

把这两个文件上传到 Release：

- `release/github-assets/cursor2api-bridge-portable-win-x64.zip`
- `release/github-assets/cursor2api-bridge-portable-win-x64.zip.sha256`

如果你还生成了 portable exe，也可以额外上传，但要在说明里写明：

- portable exe 只是附加下载
- 软件内更新不依赖它

### F. 发布 Release

检查下面这些内容都对：

- tag 对
- 标题对
- zip 传对
- sha256 传对
- 文案写清楚

然后点击：

```text
Publish release
```

## 第三部分：发完版以后要做什么

发完之后，不要立刻结束，至少再检查一遍：

1. 进入刚发布的 Release 页面
2. 确认能看到 zip 和 sha256
3. 用旧版本软件点击 `检查更新`
4. 确认旧版本真的能检测到新版本
5. 走一遍“下载并解压 -> 启动新版本”

更完整的发版后核对表，见：

- [发布后检查清单](./%E5%8F%91%E5%B8%83%E5%90%8E%E6%A3%80%E6%9F%A5%E6%B8%85%E5%8D%95.md)

## 常见错误

### 1. 软件里一直显示“未配置更新源”

原因通常是：

- `app.manifest.json` 里的 `owner/repo` 还是空的
- 你发布的是旧包，不是重新打包后的新包

### 2. Release 里只有 exe，没有 zip

这种情况下，软件内更新基本不成立。

因为当前实现只认：

- zip
- zip 对应的 sha256

### 3. Release 里 zip 名称不对

如果名称不是：

- `cursor2api-bridge-portable-win-x64.zip`
- `cursor2api-bridge-portable-win-x64.zip.sha256`

软件内更新也会失败。

### 4. 你只上传了源码，没有上传 Release 资产

这样别人可以看代码，但没法按软件内更新那条路径走。

## 最后总结

你人工在 GitHub 上真正要做的事情就是：

1. 建仓库
2. 推源码
3. 打开 `Releases`
4. 点击 `Draft a new release`
5. 填 tag、标题、说明
6. 上传 zip 和 sha256
7. 点击 `Publish release`

如果你后面要长期维护这个项目，再看：

- [项目维护手册](./%E9%A1%B9%E7%9B%AE%E7%BB%B4%E6%8A%A4%E6%89%8B%E5%86%8C.md)
