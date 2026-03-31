import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const upstreamRoot = join(projectRoot, '..', 'cursor2api-upstream-v278');
const sourceDir = join(projectRoot, 'vendor', 'source');
const sourceZip = join(sourceDir, 'cursor2api-v2.7.8-src.zip');

if (!existsSync(join(upstreamRoot, '.git'))) {
  throw new Error(`Upstream git checkout not found at ${upstreamRoot}`);
}

rmSync(sourceDir, { force: true, recursive: true });
mkdirSync(sourceDir, { recursive: true });

const archiveResult = spawnSync('git', ['-C', upstreamRoot, 'archive', '--format=zip', `--output=${sourceZip}`, 'HEAD'], {
  stdio: 'inherit'
});

if (archiveResult.status !== 0) {
  throw new Error('Failed to package upstream source zip with git archive.');
}

