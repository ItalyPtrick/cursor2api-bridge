import { app, BrowserWindow, Menu, Tray, clipboard, dialog, ipcMain, nativeImage, nativeTheme, shell } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getRuntimePaths, ensurePortableDirectories } from './paths';
import { StateStore } from './state-store';
import { ServiceManager } from './service-manager';
import { UpdateManager } from './update-manager';
import { normalizeThemeMode, resolveTheme, type ThemeMode } from '../shared/theme';
import type { BootstrapPayload, ExternalOpenRequest, RenderSnapshot, ServiceSnapshot, VersionInfo } from '../shared/contracts';
import { getFrontendRouteCandidates, getUpstreamRepoUrl } from '../shared/frontend';
import type { FrontendRoute, HomeTab } from '../shared/state';
import { getTrayMenuEntries } from '../shared/tray';

const paths = getRuntimePaths();
const manifestFallback = JSON.parse(readFileSync(join(app.getAppPath(), 'app.manifest.json'), 'utf8'));
const versionInfo = loadVersionInfo();
const stateStore = new StateStore(paths.stateFile);
const serviceManager = new ServiceManager(paths, versionInfo.defaults.port);
const updateManager = new UpdateManager(paths, versionInfo);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function loadVersionInfo(): VersionInfo {
  if (existsSync(paths.versionFile)) {
    return JSON.parse(readFileSync(paths.versionFile, 'utf8')) as VersionInfo;
  }

  return {
    productName: manifestFallback.productName,
    appId: manifestFallback.appId,
    appVersion: app.getVersion(),
    buildTime: new Date(0).toISOString(),
    upstream: {
      repo: manifestFallback.upstreamRepo,
      url: getUpstreamRepoUrl(manifestFallback.upstreamRepo),
      version: manifestFallback.upstreamVersion,
      commit: 'unknown'
    },
    defaults: {
      port: manifestFallback.defaultPort,
      frontendRoute: manifestFallback.defaultFrontendRoute,
      themes: manifestFallback.themes
    },
    updateFeed: manifestFallback.updateFeed
  };
}

function getResolvedTheme() {
  const state = stateStore.getSnapshot();
  return resolveTheme(state.themeMode, nativeTheme.shouldUseDarkColors);
}

function renderSnapshot(): RenderSnapshot {
  return {
    state: stateStore.getSnapshot(),
    resolvedTheme: getResolvedTheme(),
    service: serviceManager.getSnapshot(),
    update: updateManager.getSnapshot()
  };
}

function createBootstrapPayload(): BootstrapPayload {
  return {
    ...renderSnapshot(),
    versionInfo,
    paths: {
      installRoot: paths.installRoot,
      dataDir: paths.dataDir,
      sourceDir: paths.sourceDir,
      updatesDir: paths.updatesDir,
      versionFile: paths.versionFile,
      readmeFile: paths.readmeFile
    },
    guestPreloadUrl: paths.guestPreloadUrl
  };
}

function getWindowBackgroundColor(): string {
  return getResolvedTheme() === 'dark' ? '#09111d' : '#f6f2e8';
}

function broadcastState(): void {
  const snapshot = renderSnapshot();
  mainWindow?.webContents.send('launcher:state', snapshot);
  updateTray(snapshot.service);
}

function updateTray(service: ServiceSnapshot): void {
  if (!tray) return;

  const iconName = service.phase === 'running' ? 'tray-running.png' : service.phase === 'error' ? 'tray-error.png' : 'tray-stopped.png';
  tray.setImage(nativeImage.createFromPath(join(paths.iconDir, iconName)));
  tray.setToolTip(`Cursor2API Bridge · ${service.phase}`);
  tray.setContextMenu(buildTrayMenu());
}

function buildTrayMenu() {
  const actionMap = {
    'open-window': () => showWindow(),
    'restart-service': () => void serviceManager.restart(),
    'stop-service': () => void serviceManager.stop(),
    'start-service': () => void serviceManager.start(),
    'quit': () => void quitApplication()
  } as const;

  return Menu.buildFromTemplate(
    getTrayMenuEntries(serviceManager.getSnapshot().phase).map((entry) => ({
      label: entry.label,
      enabled: entry.enabled,
      click: actionMap[entry.id]
    }))
  );
}

async function quitApplication(): Promise<void> {
  isQuitting = true;
  await serviceManager.stop();
  app.quit();
}

function showWindow(): void {
  if (!mainWindow) return;

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.focus();
}

async function maybePromptDesktopShortcut(): Promise<void> {
  if (!app.isPackaged || stateStore.getSnapshot().hasPromptedDesktopShortcut) {
    return;
  }

  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['创建桌面快捷方式', '以后再说'],
    defaultId: 0,
    cancelId: 1,
    title: '创建快捷方式',
    message: '是否在桌面创建 Cursor2API Bridge 快捷方式？'
  });

  if (result.response === 0) {
    shell.writeShortcutLink(paths.desktopShortcutFile, 'create', {
      target: process.execPath,
      cwd: paths.installRoot,
      description: 'Cursor2API Bridge'
    });
  }

  stateStore.update({ hasPromptedDesktopShortcut: true });
  broadcastState();
}

async function resolveFrontendRoute(preferredRoute?: FrontendRoute): Promise<FrontendRoute> {
  const service = serviceManager.getSnapshot();
  const preferred = preferredRoute || stateStore.getSnapshot().preferredFrontendRoute;

  for (const candidate of getFrontendRouteCandidates(preferred)) {
    try {
      const response = await fetch(`${service.baseUrl}${candidate}`);
      if (response.ok) {
        return candidate;
      }
    } catch {
      // Ignore probe errors and keep falling back.
    }
  }

  return preferred === '/logs' ? '/logs' : '/vuelogs';
}

async function openExternal(request: ExternalOpenRequest): Promise<void> {
  switch (request.target) {
    case 'install':
      await shell.openPath(paths.installRoot);
      break;
    case 'data':
      await shell.openPath(paths.dataDir);
      break;
    case 'source':
      await shell.openPath(paths.sourceDir);
      break;
    case 'updates':
      await shell.openPath(paths.updatesDir);
      break;
    case 'readme':
      await shell.openPath(paths.readmeFile);
      break;
    case 'version':
      await shell.openPath(paths.versionFile);
      break;
    case 'frontend': {
      const route = await resolveFrontendRoute(request.route);
      await shell.openExternal(`${serviceManager.getSnapshot().baseUrl}${route}`);
      break;
    }
    case 'health':
      await shell.openExternal(serviceManager.getSnapshot().healthUrl);
      break;
    case 'upstreamRepo':
      await shell.openExternal(versionInfo.upstream.url);
      break;
  }
}

function createWindow(): BrowserWindow {
  const bounds = stateStore.getSnapshot().windowBounds;
  const browserWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 1120,
    minHeight: 760,
    backgroundColor: getWindowBackgroundColor(),
    title: versionInfo.productName,
    webPreferences: {
      preload: paths.preloadFile,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  browserWindow.loadFile(paths.rendererIndexFile);
  browserWindow.once('ready-to-show', () => browserWindow.show());

  browserWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      browserWindow.hide();
    }
  });

  const persistBounds = () => {
    const [x, y] = browserWindow.getPosition();
    const [width, height] = browserWindow.getSize();
    stateStore.update({ windowBounds: { x, y, width, height } });
  };

  browserWindow.on('move', persistBounds);
  browserWindow.on('resize', persistBounds);

  return browserWindow;
}

function registerIpc(): void {
  ipcMain.handle('launcher:get-bootstrap', () => createBootstrapPayload());
  ipcMain.handle('launcher:set-theme-mode', (_event, nextThemeMode: ThemeMode) => {
    const themeMode = normalizeThemeMode(nextThemeMode);
    stateStore.update({
      themeMode,
      lastResolvedTheme: resolveTheme(themeMode, nativeTheme.shouldUseDarkColors)
    });
    mainWindow?.setBackgroundColor(getWindowBackgroundColor());
    broadcastState();
    return renderSnapshot();
  });
  ipcMain.handle('launcher:set-home-tab', (_event, tab: HomeTab) => {
    stateStore.update({ lastTab: tab });
    broadcastState();
    return renderSnapshot();
  });
  ipcMain.handle('launcher:set-frontend-route', (_event, route: FrontendRoute) => {
    stateStore.update({ preferredFrontendRoute: route });
    broadcastState();
    return renderSnapshot();
  });
  ipcMain.handle('launcher:set-vision-enabled', async (_event, enabled: boolean) => {
    await serviceManager.setVisionEnabled(Boolean(enabled));
    broadcastState();
    return renderSnapshot();
  });
  ipcMain.handle('launcher:start-service', () => serviceManager.start());
  ipcMain.handle('launcher:stop-service', () => serviceManager.stop());
  ipcMain.handle('launcher:restart-service', () => serviceManager.restart());
  ipcMain.handle('launcher:copy-text', (_event, value: string) => {
    clipboard.writeText(value);
    return { ok: true };
  });
  ipcMain.handle('launcher:open-external', (_event, request: ExternalOpenRequest) => openExternal(request));
  ipcMain.handle('launcher:create-desktop-shortcut', () => {
    const created = shell.writeShortcutLink(paths.desktopShortcutFile, 'create', {
      target: process.execPath,
      cwd: paths.installRoot,
      description: 'Cursor2API Bridge'
    });
    return { ok: created, message: created ? '桌面快捷方式已创建。' : '创建桌面快捷方式失败。' };
  });
  ipcMain.handle('launcher:check-updates', () => updateManager.checkForUpdates());
  ipcMain.handle('launcher:download-update', () => updateManager.downloadAndStageUpdate());
  ipcMain.handle('launcher:apply-staged-update', () => updateManager.launchStagedBuild());
}

function bindEventForwarding(): void {
  serviceManager.on('change', broadcastState);
  updateManager.on('change', broadcastState);
  nativeTheme.on('updated', () => {
    const state = stateStore.getSnapshot();
    stateStore.update({
      lastResolvedTheme: resolveTheme(state.themeMode, nativeTheme.shouldUseDarkColors)
    });
    mainWindow?.setBackgroundColor(getWindowBackgroundColor());
    broadcastState();
  });
}

function maybeImportDataFromArgument(): void {
  const importArgument = process.argv.find((value) => value.startsWith('--import-data-from='));
  if (!importArgument) return;

  const importPath = importArgument.slice('--import-data-from='.length);
  updateManager.importDataFrom(importPath);
}

app.whenReady().then(async () => {
  ensurePortableDirectories(paths);
  maybeImportDataFromArgument();
  registerIpc();
  bindEventForwarding();
  mainWindow = createWindow();
  tray = new Tray(nativeImage.createFromPath(join(paths.iconDir, 'tray-stopped.png')));
  tray.on('double-click', showWindow);
  updateTray(serviceManager.getSnapshot());
  await serviceManager.start();
  await maybePromptDesktopShortcut();
  broadcastState();
});

app.on('activate', showWindow);
app.on('before-quit', () => {
  isQuitting = true;
});
app.on('window-all-closed', () => {
  // Keep the tray app alive until the user explicitly quits from the tray menu.
});
