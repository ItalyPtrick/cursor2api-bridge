import { app } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface RuntimePaths {
  installRoot: string;
  resourcesRoot: string;
  dataDir: string;
  logsDir: string;
  updatesDir: string;
  sourceDir: string;
  versionFile: string;
  readmeFile: string;
  stateFile: string;
  serviceDir: string;
  serviceEntry: string;
  serviceConfigFile: string;
  dataConfigFile: string;
  runtimeNodePath: string;
  rendererIndexFile: string;
  preloadFile: string;
  guestPreloadFile: string;
  guestPreloadUrl: string;
  iconDir: string;
  desktopShortcutFile: string;
}

export function getRuntimePaths(): RuntimePaths {
  const appRoot = app.getAppPath();
  const installRoot = app.isPackaged ? dirname(process.execPath) : appRoot;
  const resourcesRoot = app.isPackaged ? process.resourcesPath : appRoot;
  const dataDir = join(installRoot, 'data');
  const serviceDir = app.isPackaged ? join(resourcesRoot, 'service') : join(appRoot, 'vendor', 'service');
  const runtimeNodePath = app.isPackaged
    ? join(resourcesRoot, 'runtime', 'node', 'node.exe')
    : join(appRoot, 'vendor', 'runtime', 'node', 'node.exe');
  const guestPreloadFile = join(appRoot, 'dist', 'preload', 'webview-preload.js');

  return {
    installRoot,
    resourcesRoot,
    dataDir,
    logsDir: join(dataDir, 'logs'),
    updatesDir: join(installRoot, 'updates'),
    sourceDir: join(installRoot, 'source'),
    versionFile: join(installRoot, 'VERSION.json'),
    readmeFile: join(installRoot, 'README-更新说明.md'),
    stateFile: join(dataDir, 'launcher-state.json'),
    serviceDir,
    serviceEntry: join(serviceDir, 'dist', 'index.js'),
    serviceConfigFile: join(serviceDir, 'config.yaml'),
    dataConfigFile: join(dataDir, 'config.yaml'),
    runtimeNodePath,
    rendererIndexFile: join(appRoot, 'dist', 'renderer', 'index.html'),
    preloadFile: join(appRoot, 'dist', 'preload', 'preload.js'),
    guestPreloadFile,
    guestPreloadUrl: pathToFileURL(guestPreloadFile).toString(),
    iconDir: join(appRoot, 'assets', 'generated'),
    desktopShortcutFile: join(app.getPath('desktop'), 'Cursor2API Bridge.lnk')
  };
}

export function ensurePortableDirectories(paths: RuntimePaths): void {
  for (const dir of [paths.dataDir, paths.logsDir, paths.updatesDir]) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}
