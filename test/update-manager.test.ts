import test from 'node:test';
import assert from 'node:assert/strict';
import type { RuntimePaths } from '../src/main/paths';
import type { VersionInfo } from '../src/shared/contracts';
import {
  extractReleaseTagFromLocation,
  getGitHubLatestDownloadUrl,
  getGitHubLatestReleasePageUrl,
  isGitHubApiRateLimitResponse
} from '../src/shared/update';

function createPaths(): RuntimePaths {
  return {
    installRoot: 'C:\\app',
    resourcesRoot: 'C:\\app\\resources',
    dataDir: 'C:\\app\\data',
    logsDir: 'C:\\app\\data\\logs',
    updatesDir: 'C:\\app\\updates',
    sourceDir: 'C:\\app\\source',
    versionFile: 'C:\\app\\VERSION.json',
    readmeFile: 'C:\\app\\README-更新说明.md',
    stateFile: 'C:\\app\\data\\launcher-state.json',
    serviceDir: 'C:\\app\\service',
    serviceEntry: 'C:\\app\\service\\dist\\index.js',
    serviceConfigFile: 'C:\\app\\service\\config.yaml',
    dataConfigFile: 'C:\\app\\data\\config.yaml',
    runtimeNodePath: 'C:\\app\\runtime\\node\\node.exe',
    rendererIndexFile: 'C:\\app\\dist\\renderer\\index.html',
    preloadFile: 'C:\\app\\dist\\preload\\preload.js',
    guestPreloadFile: 'C:\\app\\dist\\preload\\webview-preload.js',
    guestPreloadUrl: 'file:///C:/app/dist/preload/webview-preload.js',
    iconDir: 'C:\\app\\assets\\generated',
    desktopShortcutFile: 'C:\\Users\\admin\\Desktop\\Cursor2API Bridge.lnk'
  };
}

function createVersionInfo(): VersionInfo {
  return {
    productName: 'Cursor2API Bridge',
    appId: 'com.cursor2api.bridge',
    appVersion: '0.1.0',
    buildTime: '2026-03-31T00:00:00.000Z',
    upstream: {
      repo: '7836246/cursor2api',
      url: 'https://github.com/7836246/cursor2api',
      version: '2.7.8',
      commit: 'abcdef0'
    },
    defaults: {
      port: 3011,
      frontendRoute: '/vuelogs',
      themes: ['light', 'dark', 'system']
    },
    updateFeed: {
      owner: 'ItalyPtrick',
      repo: 'cursor2api-bridge',
      assetName: 'cursor2api-bridge-portable-win-x64.zip',
      checksumName: 'cursor2api-bridge-portable-win-x64.zip.sha256'
    }
  };
}

test('isGitHubApiRateLimitResponse detects GitHub anonymous API limits', () => {
  assert.equal(
    isGitHubApiRateLimitResponse(
      403,
      '{"message":"API rate limit exceeded for 1.2.3.4"}',
      '0'
    ),
    true
  );
  assert.equal(
    isGitHubApiRateLimitResponse(403, '{"message":"Forbidden"}', '10'),
    false
  );
});

test('extractReleaseTagFromLocation reads a tag URL from GitHub latest redirect', () => {
  assert.equal(
    extractReleaseTagFromLocation(
      'https://github.com/ItalyPtrick/cursor2api-bridge/releases/tag/v0.1.1',
      'ItalyPtrick',
      'cursor2api-bridge'
    ),
    'v0.1.1'
  );
});

test('getGitHubLatestReleasePageUrl and download URLs use the public latest release routes', () => {
  assert.equal(
    getGitHubLatestReleasePageUrl('ItalyPtrick', 'cursor2api-bridge'),
    'https://github.com/ItalyPtrick/cursor2api-bridge/releases/latest'
  );
  assert.equal(
    getGitHubLatestDownloadUrl('ItalyPtrick', 'cursor2api-bridge', 'cursor2api-bridge-portable-win-x64.zip'),
    'https://github.com/ItalyPtrick/cursor2api-bridge/releases/latest/download/cursor2api-bridge-portable-win-x64.zip'
  );
});

test('UpdateManager falls back to the public latest release redirect when GitHub API rate limit is exceeded', async () => {
  const module = await import('../src/main/update-manager');
  const UpdateManager = module.UpdateManager ?? module.default?.UpdateManager;

  assert.equal(typeof UpdateManager, 'function');

  const manager = new UpdateManager(createPaths(), createVersionInfo());
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = async (input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);

    if (url.includes('/api.github.com/repos/ItalyPtrick/cursor2api-bridge/releases/latest')) {
      return new Response(
        JSON.stringify({
          message: 'API rate limit exceeded for 1.2.3.4'
        }),
        {
          status: 403,
          headers: {
            'content-type': 'application/json; charset=utf-8',
            'x-ratelimit-remaining': '0'
          }
        }
      );
    }

    if (url === 'https://github.com/ItalyPtrick/cursor2api-bridge/releases/latest') {
      return new Response('', {
        status: 302,
        headers: {
          location: 'https://github.com/ItalyPtrick/cursor2api-bridge/releases/tag/v0.1.1'
        }
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  try {
    const snapshot = await manager.checkForUpdates();
    assert.equal(snapshot.phase, 'available');
    assert.equal(snapshot.remoteVersion, 'v0.1.1');
    assert.equal(
      snapshot.releasePageUrl,
      'https://github.com/ItalyPtrick/cursor2api-bridge/releases/tag/v0.1.1'
    );
    assert.equal(
      snapshot.downloadUrl,
      'https://github.com/ItalyPtrick/cursor2api-bridge/releases/latest/download/cursor2api-bridge-portable-win-x64.zip'
    );
    assert.equal(
      snapshot.checksumUrl,
      'https://github.com/ItalyPtrick/cursor2api-bridge/releases/latest/download/cursor2api-bridge-portable-win-x64.zip.sha256'
    );
    assert.deepEqual(calls, [
      'https://api.github.com/repos/ItalyPtrick/cursor2api-bridge/releases/latest',
      'https://github.com/ItalyPtrick/cursor2api-bridge/releases/latest'
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
