import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
const tokenizerOutputPath = join(serviceRoot, 'dist', 'tokenizer.js');
const visionOutputPath = join(serviceRoot, 'dist', 'vision.js');

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

if (!existsSync(tokenizerOutputPath) || !existsSync(visionOutputPath)) {
  throw new Error('Missing vendor/service dist outputs (tokenizer.js or vision.js). Run upstream build sync before install-service-runtime.');
}

const slimTokenizerSource = [
  "export function estimateTokens(text) {",
  "  if (!text) return 0;",
  "  return Math.ceil(text.length / 4);",
  "}",
  ""
].join('\n');

const slimVisionSource = [
  "import { getConfig } from './config.js';",
  "import { getVisionProxyFetchOptions } from './proxy-agent.js';",
  "",
  "let cachedCreateWorker;",
  "const UNSUPPORTED_OCR_TYPES = new Set(['image/svg+xml']);",
  "",
  "async function resolveCreateWorker() {",
  "  if (cachedCreateWorker) return cachedCreateWorker;",
  "  try {",
  "    const mod = await import('tesseract.js');",
  "    if (typeof mod.createWorker !== 'function') {",
  "      throw new Error('createWorker export not found');",
  "    }",
  "    cachedCreateWorker = mod.createWorker;",
  "    return cachedCreateWorker;",
  "  } catch (error) {",
  "    const message = error instanceof Error ? error.message : String(error);",
  "    throw new Error(`OCR runtime was removed from this build. Leave vision.enabled=false, or install \\\"tesseract.js\\\" and \\\"tesseract.js-core\\\" manually. (${message})`);",
  "  }",
  "}",
  "",
  "export async function applyVisionInterceptor(messages) {",
  "  const config = getConfig();",
  "  if (!config.vision?.enabled) return;",
  "",
  "  let lastUserMsg = null;",
  "  for (let i = messages.length - 1; i >= 0; i--) {",
  "    if (messages[i].role === 'user') {",
  "      lastUserMsg = messages[i];",
  "      break;",
  "    }",
  "  }",
  "",
  "  if (!lastUserMsg || !Array.isArray(lastUserMsg.content)) return;",
  "",
  "  let hasImages = false;",
  "  const newContent = [];",
  "  const imagesToAnalyze = [];",
  "",
  "  for (const block of lastUserMsg.content) {",
  "    if (block.type === 'image') {",
  "      const mediaType = block.source?.media_type || '';",
  "      if (mediaType === 'image/svg+xml') {",
  "        newContent.push({",
  "          type: 'text',",
  "          text: '[SVG vector image was attached but cannot be processed by OCR/Vision. It likely contains a logo, icon, badge, or diagram.]'",
  "        });",
  "        continue;",
  "      }",
  "      hasImages = true;",
  "      imagesToAnalyze.push(block);",
  "    } else {",
  "      newContent.push(block);",
  "    }",
  "  }",
  "",
  "  if (hasImages && imagesToAnalyze.length > 0) {",
  "    try {",
  "      let descriptions = '';",
  "      if (config.vision.mode === 'ocr') {",
  "        descriptions = await processWithLocalOCR(imagesToAnalyze);",
  "      } else {",
  "        descriptions = await callVisionAPI(imagesToAnalyze);",
  "      }",
  "",
  "      newContent.push({",
  "        type: 'text',",
  "        text: `\\n\\n[System: The user attached ${imagesToAnalyze.length} image(s). Visual analysis/OCR extracted the following context:\\n${descriptions}]\\n\\n`",
  "      });",
  "",
  "      lastUserMsg.content = newContent;",
  "    } catch (error) {",
  "      const message = error instanceof Error ? error.message : String(error);",
  "      newContent.push({",
  "        type: 'text',",
  "        text: `\\n\\n[System: The user attached image(s), but the Vision interceptor failed to process them. Error: ${message}]\\n\\n`",
  "      });",
  "      lastUserMsg.content = newContent;",
  "    }",
  "  }",
  "}",
  "",
  "async function processWithLocalOCR(imageBlocks) {",
  "  const createWorker = await resolveCreateWorker();",
  "  const worker = await createWorker('eng+chi_sim');",
  "  let combinedText = '';",
  "",
  "  for (let i = 0; i < imageBlocks.length; i++) {",
  "    const img = imageBlocks[i];",
  "    let imageSource = '';",
  "",
  "    if (img.type === 'image' && img.source) {",
  "      if (UNSUPPORTED_OCR_TYPES.has(img.source.media_type || '')) {",
  "        combinedText += `--- Image ${i + 1} ---\\n(Skipped: ${img.source.media_type} format is not supported by OCR)\\n\\n`;",
  "        continue;",
  "      }",
  "",
  "      const sourceData = img.source.data || img.source.url;",
  "      if (img.source.type === 'base64' && sourceData) {",
  "        const mime = img.source.media_type || 'image/jpeg';",
  "        imageSource = `data:${mime};base64,${sourceData}`;",
  "      } else if (img.source.type === 'url' && sourceData) {",
  "        imageSource = sourceData;",
  "      }",
  "    }",
  "",
  "    if (!imageSource) continue;",
  "",
  "    try {",
  "      const { data: { text } } = await worker.recognize(imageSource);",
  "      combinedText += `--- Image ${i + 1} OCR Text ---\\n${text.trim() || '(No text detected in this image)'}\\n\\n`;",
  "    } catch {",
  "      combinedText += `--- Image ${i + 1} ---\\n(Failed to parse image with local OCR)\\n\\n`;",
  "    }",
  "  }",
  "",
  "  await worker.terminate();",
  "  return combinedText;",
  "}",
  "",
  "async function callVisionAPI(imageBlocks) {",
  "  const config = getConfig().vision;",
  "  const parts = [",
  "    { type: 'text', text: 'Please describe the attached images in detail. If they contain code, UI elements, or error messages, explicitly write them out.' }",
  "  ];",
  "",
  "  for (const img of imageBlocks) {",
  "    if (img.type === 'image' && img.source) {",
  "      const sourceData = img.source.data || img.source.url;",
  "      let url = '';",
  "      if (img.source.type === 'base64' && sourceData) {",
  "        const mime = img.source.media_type || 'image/jpeg';",
  "        url = `data:${mime};base64,${sourceData}`;",
  "      } else if (img.source.type === 'url' && sourceData) {",
  "        url = sourceData;",
  "      }",
  "      if (url) {",
  "        parts.push({ type: 'image_url', image_url: { url } });",
  "      }",
  "    }",
  "  }",
  "",
  "  const payload = {",
  "    model: config.model,",
  "    messages: [{ role: 'user', content: parts }],",
  "    max_tokens: 1500",
  "  };",
  "",
  "  const response = await fetch(config.baseUrl, {",
  "    method: 'POST',",
  "    headers: {",
  "      'Content-Type': 'application/json',",
  "      'Authorization': `Bearer ${config.apiKey}`",
  "    },",
  "    body: JSON.stringify(payload),",
  "    ...getVisionProxyFetchOptions()",
  "  });",
  "",
  "  if (!response.ok) {",
  "    throw new Error(`Vision API returned status ${response.status}: ${await response.text()}`);",
  "  }",
  "",
  "  const data = await response.json();",
  "  return data.choices?.[0]?.message?.content || 'No description returned.';",
  "}",
  ""
].join('\n');

writeFileSync(tokenizerOutputPath, slimTokenizerSource, 'utf8');
writeFileSync(visionOutputPath, slimVisionSource, 'utf8');

for (const packageName of ['tesseract.js-core', 'tesseract.js', 'js-tiktoken']) {
  rmSync(join(serviceRoot, 'node_modules', packageName), { recursive: true, force: true });
}
