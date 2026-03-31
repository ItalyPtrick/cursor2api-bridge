import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const upstreamRoot = join(projectRoot, '..', 'cursor2api-upstream-v278');
const serviceTarget = join(projectRoot, 'vendor', 'service');
const runtimeReadme = join(projectRoot, 'vendor', 'runtime', 'node', 'README.txt');

const requiredFiles = [
  join(upstreamRoot, 'dist', 'index.js'),
  join(upstreamRoot, 'public', 'vue', 'index.html'),
  join(upstreamRoot, 'package.json'),
  join(upstreamRoot, 'config.yaml.example')
];

for (const file of requiredFiles) {
  if (!existsSync(file)) {
    throw new Error(`Upstream build artifact missing: ${file}`);
  }
}

rmSync(serviceTarget, { force: true, recursive: true });
mkdirSync(serviceTarget, { recursive: true });

for (const entry of ['dist', 'public']) {
  cpSync(join(upstreamRoot, entry), join(serviceTarget, entry), { recursive: true });
}

for (const file of ['package.json', 'config.yaml.example', 'README.md', 'CHANGELOG.md', 'LICENSE']) {
  cpSync(join(upstreamRoot, file), join(serviceTarget, file));
}

mkdirSync(join(projectRoot, 'vendor', 'runtime', 'node'), { recursive: true });

if (!existsSync(runtimeReadme)) {
  writeFileSync(
    runtimeReadme,
    [
      'Place a private Node 20 runtime here for packaged releases.',
      'Expected path:',
      'runtime/node/node.exe',
      '',
      'During local development the launcher can fall back to the system Node.'
    ].join('\n'),
    'utf8'
  );
}

