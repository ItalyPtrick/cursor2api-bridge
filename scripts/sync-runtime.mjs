import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import extract from 'extract-zip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const manifest = JSON.parse(readFileSync(join(projectRoot, 'app.manifest.json'), 'utf8'));
const runtimeVersion = manifest.privateNodeVersion || '20.20.1';
const downloadsDir = join(projectRoot, '..', '..', 'downloads');
const archiveName = `node-v${runtimeVersion}-win-x64.zip`;
const archivePath = join(downloadsDir, archiveName);
const runtimeRoot = join(projectRoot, 'vendor', 'runtime');
const nodeTarget = join(runtimeRoot, 'node');
const tempExtractDir = join(runtimeRoot, '__extract__');

rmSync(runtimeRoot, { force: true, recursive: true });
mkdirSync(runtimeRoot, { recursive: true });

if (!existsSync(archivePath)) {
  mkdirSync(nodeTarget, { recursive: true });
  writeFileSync(
    join(nodeTarget, 'README.txt'),
    [
      `Missing private Node runtime archive: ${archiveName}`,
      `Expected location: ${archivePath}`,
      '',
      'Place the official Node 20 Windows x64 zip in C:\\GIT-TEST\\downloads and rebuild.'
    ].join('\n'),
    'utf8'
  );
  process.exit(0);
}

mkdirSync(tempExtractDir, { recursive: true });
await extract(archivePath, { dir: tempExtractDir });

const extractedRoot = readdirSync(tempExtractDir, { withFileTypes: true }).find((entry) => entry.isDirectory());
if (!extractedRoot) {
  throw new Error(`No extracted directory found in ${archivePath}`);
}

const extractedPath = join(tempExtractDir, extractedRoot.name);
cpSync(extractedPath, nodeTarget, { recursive: true });
rmSync(tempExtractDir, { force: true, recursive: true });
