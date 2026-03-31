import type { FrontendRoute, HomeTab, LauncherState } from './state';
import type { ResolvedTheme, ThemeMode } from './theme';

export type ServicePhase = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
export type UpdatePhase = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'unavailable' | 'error';

export interface VersionInfo {
  productName: string;
  appId: string;
  appVersion: string;
  buildTime: string;
  upstream: {
    repo: string;
    url: string;
    version: string;
    commit: string;
  };
  defaults: {
    port: number;
    frontendRoute: FrontendRoute;
    themes: ThemeMode[];
  };
  updateFeed: {
    owner: string;
    repo: string;
    assetName: string;
    checksumName: string;
  };
}

export interface ServiceSnapshot {
  phase: ServicePhase;
  port: number;
  pid?: number;
  nodeExecutable: string;
  configuredModel: string;
  baseUrl: string;
  healthUrl: string;
  frontendUrl: string;
  fallbackFrontendUrl: string;
  lastError?: string;
  serviceVersion?: string;
  stdoutTail: string[];
  stderrTail: string[];
}

export interface UpdateSnapshot {
  phase: UpdatePhase;
  currentVersion: string;
  remoteVersion?: string;
  releasePageUrl?: string;
  downloadUrl?: string;
  checksumUrl?: string;
  stagedDir?: string;
  integrity: 'not_configured' | 'pending' | 'verified' | 'failed';
  message?: string;
}

export interface BootstrapPayload {
  state: LauncherState;
  resolvedTheme: ResolvedTheme;
  versionInfo: VersionInfo;
  service: ServiceSnapshot;
  update: UpdateSnapshot;
  paths: {
    installRoot: string;
    dataDir: string;
    sourceDir: string;
    updatesDir: string;
    versionFile: string;
    readmeFile: string;
  };
  guestPreloadUrl: string;
}

export interface RenderSnapshot {
  state: LauncherState;
  resolvedTheme: ResolvedTheme;
  service: ServiceSnapshot;
  update: UpdateSnapshot;
}

export interface ThemeUpdatePayload {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
}

export interface UpdateCommandResult {
  ok: boolean;
  message: string;
}

export interface ExternalOpenRequest {
  target: 'install' | 'data' | 'source' | 'updates' | 'readme' | 'version' | 'frontend' | 'health' | 'upstreamRepo';
  route?: FrontendRoute;
}
