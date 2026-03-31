import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const releaseDir = join(projectRoot, 'release');
const unpackedDir = join(releaseDir, 'win-unpacked');
const assetOutputDir = join(releaseDir, 'github-assets');
const manifest = JSON.parse(readFileSync(join(projectRoot, 'app.manifest.json'), 'utf8'));

if (!existsSync(unpackedDir)) {
  throw new Error(`Packaged app directory not found at ${unpackedDir}. Run "npm run dist:dir" first.`);
}

const updateHelpers = await import(pathToFileURL(join(projectRoot, 'dist', 'shared', 'update.js')).href);
const { isUpdateFeedConfigured, getReleaseAssetNames } = updateHelpers;

if (!isUpdateFeedConfigured(manifest.updateFeed)) {
  throw new Error('app.manifest.json 的 updateFeed.owner/repo 还没填，不能生成正式 GitHub Release 更新资产。');
}

const { archiveName, checksumName } = getReleaseAssetNames(manifest.updateFeed);
mkdirSync(assetOutputDir, { recursive: true });

const archivePath = join(assetOutputDir, archiveName);
const checksumPath = join(assetOutputDir, checksumName);

rmSync(archivePath, { force: true });
rmSync(checksumPath, { force: true });

const escapedSource = unpackedDir.replace(/'/g, "''");
const escapedArchive = archivePath.replace(/'/g, "''");
const archiveCommand = [
  `$source = '${escapedSource}'`,
  `$archive = '${escapedArchive}'`,
  `Compress-Archive -Path (Join-Path $source '*') -DestinationPath $archive -Force`
].join('; ');

const archiveResult = spawnSync('powershell', ['-NoProfile', '-Command', archiveCommand], {
  stdio: 'inherit'
});

if (archiveResult.status !== 0 || !existsSync(archivePath)) {
  throw new Error('Failed to create GitHub Release zip asset.');
}

const archiveBuffer = readFileSync(archivePath);
const hash = createHash('sha256').update(archiveBuffer).digest('hex');
writeFileSync(checksumPath, `${hash}  ${archiveName}\n`, 'utf8');

console.log(`Created release asset: ${archivePath}`);
console.log(`Created checksum: ${checksumPath}`);
