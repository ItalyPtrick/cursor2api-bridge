import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const serviceRoot = join(projectRoot, 'vendor', 'service');
const manifest = JSON.parse(readFileSync(join(projectRoot, 'app.manifest.json'), 'utf8'));
const runtimeVersion = manifest.privateNodeVersion || '20.20.1';
const nodeExecutable = join(projectRoot, 'vendor', 'runtime', 'node', 'node.exe');
const npmCli = join(projectRoot, 'vendor', 'runtime', 'node', 'node_modules', 'npm', 'bin', 'npm-cli.js');

if (!existsSync(nodeExecutable) || !existsSync(npmCli)) {
  throw new Error(`Missing bundled Node 20 runtime at ${nodeExecutable}`);
}

const npmEnv = {
  ...process.env,
  npm_config_runtime: 'node',
  npm_config_target: runtimeVersion,
  npm_config_target_arch: 'x64',
  npm_config_target_platform: 'win32',
  npm_config_build_from_source: 'false'
};

const installResult = spawnSync(nodeExecutable, [npmCli, 'install', '--omit=dev'], {
  cwd: serviceRoot,
  stdio: 'inherit',
  shell: false,
  env: npmEnv
});

if (installResult.status !== 0) {
  throw new Error('Failed to install vendor/service runtime dependencies with bundled Node 20.');
}

const rebuildResult = spawnSync(
  nodeExecutable,
  [npmCli, 'rebuild', 'better-sqlite3', `--target=${runtimeVersion}`, '--runtime=node', '--update-binary'],
  {
    cwd: serviceRoot,
    stdio: 'inherit',
    shell: false,
    env: npmEnv
  }
);

if (rebuildResult.status !== 0) {
  throw new Error('Failed to rebuild better-sqlite3 for the bundled Node 20 runtime.');
}
