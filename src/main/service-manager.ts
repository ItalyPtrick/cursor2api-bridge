import { EventEmitter } from 'node:events';
import { copyFileSync, existsSync, readFileSync, watch, type FSWatcher, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import type { RuntimePaths } from './paths';
import type { ServiceSnapshot } from '../shared/contracts';
import { getConfiguredModelFromYaml, getVisionEnabledFromYaml, setVisionEnabledInYaml } from '../shared/service-config';

const MAX_LOG_LINES = 18;
const STARTUP_TIMEOUT_MS = 30000;
const STOP_TIMEOUT_MS = 8000;

function appendLine(target: string[], chunk: string): void {
  const lines = chunk
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  for (const line of lines) {
    target.push(line);
  }

  while (target.length > MAX_LOG_LINES) {
    target.shift();
  }
}

function createDefaultConfigYaml(): string {
  return [
    'port: 3011',
    'timeout: 120',
    'cursor_model: anthropic/claude-sonnet-4.6',
    'auth_tokens: []',
    'logging:',
    '  file_enabled: true',
    '  db_enabled: true',
    '  dir: ./logs',
    '  db_path: ./logs/cursor2api.db',
    'vision:',
    '  enabled: false',
    'thinking:',
    '  enabled: true'
  ].join('\n');
}

export class ServiceManager extends EventEmitter {
  private readonly paths: RuntimePaths;
  private readonly port: number;
  private child?: ChildProcess;
  private configMirrorWatcher?: FSWatcher;
  private stopRequested = false;
  private snapshot: ServiceSnapshot;

  constructor(paths: RuntimePaths, port: number) {
    super();
    this.paths = paths;
    this.port = port;
    this.snapshot = this.createSnapshot('stopped');
  }

  getSnapshot(): ServiceSnapshot {
    return this.snapshot;
  }

  async start(): Promise<ServiceSnapshot> {
    if (this.snapshot.phase === 'running' || this.snapshot.phase === 'starting') {
      return this.snapshot;
    }

    this.stopRequested = false;
    this.updateSnapshot({
      ...this.createSnapshot('starting'),
      stdoutTail: this.snapshot.stdoutTail,
      stderrTail: this.snapshot.stderrTail
    });

    this.ensureConfigReady();
    const nodeExecutable = this.resolveNodeExecutable();

    try {
      this.child = spawn(nodeExecutable, [this.paths.serviceEntry], {
        cwd: this.paths.serviceDir,
        env: {
          ...process.env,
          PORT: String(this.port),
          LOG_FILE_ENABLED: 'true',
          LOG_DB_ENABLED: 'true',
          LOG_DIR: this.paths.logsDir,
          LOG_DB_PATH: join(this.paths.logsDir, 'cursor2api.db')
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.updateSnapshot({
        ...this.createSnapshot('error'),
        lastError: `启动服务失败：${message}`
      });
      return this.snapshot;
    }

    const child = this.child;
    if (!child.stdout || !child.stderr) {
      this.updateSnapshot({
        ...this.createSnapshot('error'),
        lastError: '服务进程输出流不可用。'
      });
      return this.snapshot;
    }

    child.stdout.on('data', (chunk: Buffer) => {
      appendLine(this.snapshot.stdoutTail, chunk.toString('utf8'));
      this.emitChange();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      appendLine(this.snapshot.stderrTail, chunk.toString('utf8'));
      this.emitChange();
    });

    child.once('exit', (code) => {
      this.configMirrorWatcher?.close();
      this.configMirrorWatcher = undefined;

      if (this.stopRequested) {
        this.updateSnapshot(this.createSnapshot('stopped'));
        return;
      }

      this.updateSnapshot({
        ...this.createSnapshot('error'),
        lastError: `服务进程异常退出，exit code ${code ?? 'unknown'}`,
        stdoutTail: this.snapshot.stdoutTail,
        stderrTail: this.snapshot.stderrTail
      });
    });

    try {
      const version = await this.waitForHealth();
      this.startConfigMirror();
      this.updateSnapshot({
        ...this.createSnapshot('running'),
        pid: child.pid,
        nodeExecutable,
        serviceVersion: version,
        stdoutTail: this.snapshot.stdoutTail,
        stderrTail: this.snapshot.stderrTail
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.stop(true);
      this.updateSnapshot({
        ...this.createSnapshot('error'),
        lastError: message,
        stdoutTail: this.snapshot.stdoutTail,
        stderrTail: this.snapshot.stderrTail
      });
    }

    return this.snapshot;
  }

  async stop(force = false): Promise<ServiceSnapshot> {
    if (!this.child || this.snapshot.phase === 'stopped') {
      this.updateSnapshot(this.createSnapshot('stopped'));
      return this.snapshot;
    }

    const activeChild = this.child;
    this.stopRequested = true;
    this.updateSnapshot({
      ...this.createSnapshot('stopping'),
      pid: activeChild.pid,
      stdoutTail: this.snapshot.stdoutTail,
      stderrTail: this.snapshot.stderrTail
    });

    activeChild.kill('SIGTERM');

    const exitPromise = new Promise<void>((resolve) => {
      activeChild.once('exit', () => resolve());
    });

    const timeout = delay(STOP_TIMEOUT_MS).then(() => {
      if (!activeChild.killed) {
        spawn('taskkill', ['/PID', String(activeChild.pid), '/T', '/F'], { windowsHide: true });
      }
    });

    await Promise.race([exitPromise, timeout]);

    if (force && existsSync(this.paths.serviceConfigFile)) {
      copyFileSync(this.paths.serviceConfigFile, this.paths.dataConfigFile);
    }

    this.child = undefined;
    this.updateSnapshot(this.createSnapshot('stopped'));
    return this.snapshot;
  }

  async restart(): Promise<ServiceSnapshot> {
    await this.stop();
    return this.start();
  }

  async setVisionEnabled(enabled: boolean): Promise<ServiceSnapshot> {
    this.ensureConfigReady();

    const sourceConfig = readFileSync(this.paths.dataConfigFile, 'utf8');
    const nextConfig = setVisionEnabledInYaml(sourceConfig, enabled);

    writeFileSync(this.paths.dataConfigFile, nextConfig, 'utf8');
    copyFileSync(this.paths.dataConfigFile, this.paths.serviceConfigFile);
    this.refreshRuntimeConfig();
    return this.snapshot;
  }

  private createSnapshot(phase: ServiceSnapshot['phase']): ServiceSnapshot {
    const baseUrl = `http://127.0.0.1:${this.port}`;
    return {
      phase,
      port: this.port,
      nodeExecutable: this.resolveNodeExecutable(),
      configuredModel: this.readConfiguredModel(),
      visionEnabled: this.readVisionEnabled(),
      baseUrl,
      healthUrl: `${baseUrl}/health`,
      frontendUrl: `${baseUrl}/vuelogs`,
      fallbackFrontendUrl: `${baseUrl}/logs`,
      stdoutTail: phase === 'stopped' ? [] : this.snapshot?.stdoutTail ?? [],
      stderrTail: phase === 'stopped' ? [] : this.snapshot?.stderrTail ?? []
    };
  }

  private updateSnapshot(nextSnapshot: ServiceSnapshot): void {
    this.snapshot = nextSnapshot;
    this.emitChange();
  }

  private emitChange(): void {
    this.emit('change', this.snapshot);
  }

  private resolveNodeExecutable(): string {
    if (existsSync(this.paths.runtimeNodePath)) {
      return this.paths.runtimeNodePath;
    }

    return process.env.CURSOR2API_NODE_PATH || 'node';
  }

  private ensureConfigReady(): void {
    if (!existsSync(this.paths.dataConfigFile)) {
      writeFileSync(this.paths.dataConfigFile, createDefaultConfigYaml(), 'utf8');
    }

    copyFileSync(this.paths.dataConfigFile, this.paths.serviceConfigFile);
  }

  private startConfigMirror(): void {
    this.configMirrorWatcher?.close();
    this.configMirrorWatcher = watch(this.paths.serviceConfigFile, () => {
      try {
        copyFileSync(this.paths.serviceConfigFile, this.paths.dataConfigFile);
        this.refreshRuntimeConfig();
      } catch {
        // Ignore config mirror races while the service is writing.
      }
    });
  }

  private readConfiguredModel(): string {
    const exampleConfig = join(this.paths.serviceDir, 'config.yaml.example');
    const fallbackModel = existsSync(exampleConfig)
      ? getConfiguredModelFromYaml(readFileSync(exampleConfig, 'utf8'))
      : 'anthropic/claude-sonnet-4.6';

    for (const filePath of [this.paths.dataConfigFile, this.paths.serviceConfigFile]) {
      if (existsSync(filePath)) {
        return getConfiguredModelFromYaml(readFileSync(filePath, 'utf8'), fallbackModel);
      }
    }

    return fallbackModel;
  }

  private readVisionEnabled(): boolean {
    for (const filePath of [this.paths.dataConfigFile, this.paths.serviceConfigFile]) {
      if (existsSync(filePath)) {
        return getVisionEnabledFromYaml(readFileSync(filePath, 'utf8'), false);
      }
    }

    return false;
  }

  private refreshRuntimeConfig(): void {
    const configuredModel = this.readConfiguredModel();
    const visionEnabled = this.readVisionEnabled();
    if (configuredModel === this.snapshot.configuredModel && visionEnabled === this.snapshot.visionEnabled) {
      return;
    }

    this.snapshot = {
      ...this.snapshot,
      configuredModel,
      visionEnabled
    };
    this.emitChange();
  }

  private async waitForHealth(): Promise<string> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < STARTUP_TIMEOUT_MS) {
      try {
        const response = await fetch(`http://127.0.0.1:${this.port}/health`);
        if (response.ok) {
          const payload = await response.json() as { version?: string };
          return payload.version || 'unknown';
        }
      } catch {
        // Wait for service readiness.
      }

      await delay(700);
    }

    throw new Error('等待 cursor2api 服务就绪超时。');
  }
}
