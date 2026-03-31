import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(projectRoot, 'app.manifest.json'), 'utf8'));
const appPackage = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const upstreamRoot = join(projectRoot, '..', 'cursor2api-upstream-v278');
const upstreamPackage = JSON.parse(readFileSync(join(upstreamRoot, 'package.json'), 'utf8'));
const versionDir = join(projectRoot, 'vendor', 'version');
const gitCommit = spawnSync('git', ['-C', upstreamRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' });

mkdirSync(versionDir, { recursive: true });

const versionPayload = {
  productName: manifest.productName,
  appId: manifest.appId,
  appVersion: appPackage.version,
  buildTime: new Date().toISOString(),
  upstream: {
    repo: manifest.upstreamRepo,
    url: `https://github.com/${manifest.upstreamRepo}`,
    version: upstreamPackage.version,
    commit: gitCommit.stdout.trim()
  },
  defaults: {
    port: manifest.defaultPort,
    frontendRoute: manifest.defaultFrontendRoute,
    themes: manifest.themes
  },
  updateFeed: manifest.updateFeed
};

writeFileSync(join(versionDir, 'VERSION.json'), JSON.stringify(versionPayload, null, 2), 'utf8');
cpSync(join(projectRoot, 'docs', 'README-更新说明.md'), join(versionDir, 'README-更新说明.md'));
