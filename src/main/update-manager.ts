import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import extract from 'extract-zip';
import { app } from 'electron';
import type { UpdateCommandResult, UpdateSnapshot, VersionInfo } from '../shared/contracts';
import {
  extractReleaseTagFromLocation,
  getGitHubLatestDownloadUrl,
  getGitHubLatestReleaseApiUrl,
  getGitHubLatestReleasePageUrl,
  getReleaseAssetNames,
  getStagedReleaseDir,
  isGitHubApiRateLimitResponse,
  isRemoteVersionNewer,
  isUpdateFeedConfigured,
  pickReleaseAsset
} from '../shared/update';
import type { RuntimePaths } from './paths';

interface GitHubReleasePayload {
  tag_name: string;
  html_url: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
  }>;
}

export class UpdateManager extends EventEmitter {
  private readonly paths: RuntimePaths;
  private readonly versionInfo: VersionInfo;
  private snapshot: UpdateSnapshot;

  constructor(paths: RuntimePaths, versionInfo: VersionInfo) {
    super();
    this.paths = paths;
    this.versionInfo = versionInfo;
    this.snapshot = {
      phase: 'idle',
      currentVersion: versionInfo.appVersion,
      integrity: versionInfo.updateFeed.owner && versionInfo.updateFeed.repo ? 'pending' : 'not_configured'
    };
  }

  getSnapshot(): UpdateSnapshot {
    return this.snapshot;
  }

  async checkForUpdates(): Promise<UpdateSnapshot> {
    const { owner, repo, assetName, checksumName } = this.versionInfo.updateFeed;
    if (!isUpdateFeedConfigured({ owner, repo })) {
      return this.updateSnapshot({
        ...this.snapshot,
        phase: 'unavailable',
        integrity: 'not_configured',
        message: '未配置 GitHub Releases 更新源。'
      });
    }

    this.updateSnapshot({
      ...this.snapshot,
      phase: 'checking',
      message: '正在检查 GitHub Releases…'
    });

    const releaseAssetNames = getReleaseAssetNames({ assetName, checksumName });
    const response = await fetch(getGitHubLatestReleaseApiUrl(owner, repo), {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'Cursor2API-Bridge-Updater'
      }
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => '');
      if (isGitHubApiRateLimitResponse(response.status, responseText, response.headers.get('x-ratelimit-remaining'))) {
        const fallbackSnapshot = await this.checkForUpdatesViaReleaseRedirect(owner, repo, releaseAssetNames.archiveName, releaseAssetNames.checksumName);
        if (fallbackSnapshot) {
          return fallbackSnapshot;
        }

        return this.updateSnapshot({
          ...this.snapshot,
          phase: 'error',
          integrity: 'pending',
          message: '更新检查失败：GitHub API 匿名请求额度已用尽，且公开 Release 页面回退失败。'
        });
      }

      return this.updateSnapshot({
        ...this.snapshot,
        phase: 'error',
        integrity: 'pending',
        message: `更新检查失败：HTTP ${response.status}`
      });
    }

    const release = await response.json() as GitHubReleasePayload;
    const zipAsset = pickReleaseAsset(release.assets, releaseAssetNames.archiveName);
    const checksumAsset = pickReleaseAsset(release.assets, releaseAssetNames.checksumName);

    if (!zipAsset || !checksumAsset) {
      return this.updateSnapshot({
        ...this.snapshot,
        phase: 'error',
        releasePageUrl: release.html_url,
        message: '最新发布缺少 zip 资产或 sha256 校验文件。'
      });
    }

    if (!isRemoteVersionNewer(this.versionInfo.appVersion, release.tag_name)) {
      return this.updateSnapshot({
        ...this.snapshot,
        phase: 'idle',
        remoteVersion: release.tag_name,
        releasePageUrl: release.html_url,
        message: '当前已经是最新版本。'
      });
    }

    return this.updateSnapshot({
      ...this.snapshot,
      phase: 'available',
      remoteVersion: release.tag_name,
      releasePageUrl: release.html_url,
      downloadUrl: zipAsset.browser_download_url,
      checksumUrl: checksumAsset.browser_download_url,
      integrity: 'pending',
      message: '发现新版本，可下载到新目录。'
    });
  }

  private async checkForUpdatesViaReleaseRedirect(owner: string, repo: string, archiveName: string, checksumName: string): Promise<UpdateSnapshot | undefined> {
    const latestReleaseUrl = getGitHubLatestReleasePageUrl(owner, repo);
    const response = await fetch(latestReleaseUrl, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Cursor2API-Bridge-Updater'
      },
      redirect: 'manual'
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return undefined;
    }

    const location = response.headers.get('location');
    if (!location) {
      return undefined;
    }

    const releasePageUrl = new URL(location, latestReleaseUrl).toString();
    const remoteVersion = extractReleaseTagFromLocation(releasePageUrl, owner, repo);
    if (!remoteVersion) {
      return undefined;
    }

    if (!isRemoteVersionNewer(this.versionInfo.appVersion, remoteVersion)) {
      return this.updateSnapshot({
        ...this.snapshot,
        phase: 'idle',
        remoteVersion,
        releasePageUrl,
        integrity: 'pending',
        message: '当前已经是最新版本。'
      });
    }

    return this.updateSnapshot({
      ...this.snapshot,
      phase: 'available',
      remoteVersion,
      releasePageUrl,
      downloadUrl: getGitHubLatestDownloadUrl(owner, repo, archiveName),
      checksumUrl: getGitHubLatestDownloadUrl(owner, repo, checksumName),
      integrity: 'pending',
      message: 'GitHub API 匿名请求额度已用尽，已通过公开 Release 页面检查到新版本。'
    });
  }

  async downloadAndStageUpdate(): Promise<UpdateCommandResult> {
    if (!this.snapshot.downloadUrl || !this.snapshot.remoteVersion || !this.snapshot.checksumUrl) {
      return { ok: false, message: '当前没有可下载的新版本。' };
    }

    mkdirSync(this.paths.updatesDir, { recursive: true });
    this.updateSnapshot({
      ...this.snapshot,
      phase: 'downloading',
      message: `正在下载 ${this.snapshot.remoteVersion}…`
    });

    const version = this.snapshot.remoteVersion;
    const archivePath = join(this.paths.updatesDir, `cursor2api-bridge-${version}.zip`);
    const checksumPath = join(this.paths.updatesDir, `cursor2api-bridge-${version}.sha256`);
    const stagedDir = getStagedReleaseDir(this.paths.updatesDir, version);

    const [zipBuffer, checksumBuffer] = await Promise.all([
      this.downloadBuffer(this.snapshot.downloadUrl),
      this.downloadBuffer(this.snapshot.checksumUrl)
    ]);

    writeFileSync(archivePath, zipBuffer);
    writeFileSync(checksumPath, checksumBuffer);

    const expectedChecksum = checksumBuffer.toString('utf8').trim().split(/\s+/)[0]?.toLowerCase();
    const actualChecksum = createHash('sha256').update(zipBuffer).digest('hex');

    if (!expectedChecksum || expectedChecksum !== actualChecksum) {
      this.updateSnapshot({
        ...this.snapshot,
        phase: 'error',
        integrity: 'failed',
        message: '更新包 sha256 校验失败，已取消解压。'
      });
      return { ok: false, message: '更新包 sha256 校验失败。' };
    }

    rmSync(stagedDir, { force: true, recursive: true });
    await extract(archivePath, { dir: stagedDir });

    this.updateSnapshot({
      ...this.snapshot,
      phase: 'ready',
      integrity: 'verified',
      stagedDir,
      message: '新版本已下载并解压到新目录，可启动并导入旧数据。'
    });

    return { ok: true, message: '更新已下载完成。' };
  }

  launchStagedBuild(): UpdateCommandResult {
    if (!this.snapshot.stagedDir) {
      return { ok: false, message: '还没有可启动的已解压版本。' };
    }

    const executable = this.findExecutable(this.snapshot.stagedDir);
    if (!executable) {
      return { ok: false, message: '未在新版本目录中找到可执行文件。' };
    }

    spawn(executable, [`--import-data-from=${this.paths.dataDir}`], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();

    app.quit();
    return { ok: true, message: '正在启动新版本。' };
  }

  importDataFrom(sourceDataDir: string): UpdateCommandResult {
    if (!sourceDataDir || !existsSync(sourceDataDir)) {
      return { ok: false, message: '旧版数据目录不存在。' };
    }

    mkdirSync(this.paths.dataDir, { recursive: true });
    cpSync(sourceDataDir, this.paths.dataDir, { recursive: true, force: true });
    return { ok: true, message: '旧版 data 已导入到当前目录。' };
  }

  private async downloadBuffer(url: string): Promise<Buffer> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Cursor2API-Bridge-Updater'
      }
    });

    if (!response.ok) {
      throw new Error(`下载失败：HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private findExecutable(stagedDir: string): string | undefined {
    for (const entry of readdirSync(stagedDir, { withFileTypes: true })) {
      const fullPath = join(stagedDir, entry.name);
      if (entry.isDirectory()) {
        const nestedExecutable = this.findExecutable(fullPath);
        if (nestedExecutable) {
          return nestedExecutable;
        }
      } else if (entry.name.endsWith('.exe')) {
        return fullPath;
      }
    }

    return undefined;
  }

  private updateSnapshot(nextSnapshot: UpdateSnapshot): UpdateSnapshot {
    this.snapshot = nextSnapshot;
    this.emit('change', this.snapshot);
    return this.snapshot;
  }
}
