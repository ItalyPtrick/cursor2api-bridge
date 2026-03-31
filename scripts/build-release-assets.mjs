import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const releaseDir = join(projectRoot, 'release');
const unpackedDir = join(releaseDir, 'win-unpacked');
const assetOutputDir = join(releaseDir, 'github-assets');
const manifest = JSON.parse(readFileSync(join(projectRoot, 'app.manifest.json'), 'utf8'));
const require = createRequire(import.meta.url);

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

function resolve7ZipBinary() {
  try {
    const sevenZip = require('7zip-bin');
    if (sevenZip?.path7za && existsSync(sevenZip.path7za)) {
      return sevenZip.path7za;
    }
  } catch {
    // Fallback to PATH detection below.
  }

  const detectResult = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', "(Get-Command 7z -ErrorAction SilentlyContinue).Source"],
    { encoding: 'utf8' }
  );
  const detected = detectResult.stdout?.trim();
  return detected || null;
}

function createZipWith7Zip() {
  const sevenZipPath = resolve7ZipBinary();
  if (!sevenZipPath) {
    return false;
  }

  console.log(`Using 7zip binary: ${sevenZipPath}`);
  const archiveResult = spawnSync(
    sevenZipPath,
    ['a', '-tzip', archivePath, '.\\*', '-mx=9', '-mfb=258', '-mpass=15'],
    {
      cwd: unpackedDir,
      stdio: 'inherit',
      shell: false
    }
  );

  return archiveResult.status === 0 && existsSync(archivePath);
}

function createZipWithCompressArchive() {
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

  return archiveResult.status === 0 && existsSync(archivePath);
}

const createdBy7Zip = createZipWith7Zip();
const archiveCreated = createdBy7Zip || createZipWithCompressArchive();

if (!archiveCreated) {
  throw new Error('Failed to create GitHub Release zip asset.');
}

const archiveBuffer = readFileSync(archivePath);
const hash = createHash('sha256').update(archiveBuffer).digest('hex');
writeFileSync(checksumPath, `${hash}  ${archiveName}\n`, 'utf8');

console.log(`Created release asset: ${archivePath}`);
console.log(`Created checksum: ${checksumPath}`);
