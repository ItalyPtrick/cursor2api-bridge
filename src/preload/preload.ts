import { contextBridge, ipcRenderer } from 'electron';
import type { ExternalOpenRequest, RenderSnapshot, UpdateCommandResult } from '../shared/contracts';
import { getFrontendRouteCandidates } from '../shared/frontend';
import type { FrontendRoute, HomeTab } from '../shared/state';
import {
  aggregateRequestStats,
  estimateTokenUsage,
  getRangeLabel,
  getRangeSince,
  type StatsPayload,
  type StatsRange,
  type StatsRequestSummary
} from '../shared/stats';
import type { ThemeMode } from '../shared/theme';

contextBridge.exposeInMainWorld('cursor2apiDesktop', {
  getBootstrap: () => ipcRenderer.invoke('launcher:get-bootstrap'),
  setThemeMode: (themeMode: ThemeMode) => ipcRenderer.invoke('launcher:set-theme-mode', themeMode),
  setHomeTab: (tab: HomeTab) => ipcRenderer.invoke('launcher:set-home-tab', tab),
  setFrontendRoute: (route: FrontendRoute) => ipcRenderer.invoke('launcher:set-frontend-route', route),
  getFrontendRouteCandidates: (route: FrontendRoute) => getFrontendRouteCandidates(route),
  startService: () => ipcRenderer.invoke('launcher:start-service'),
  stopService: () => ipcRenderer.invoke('launcher:stop-service'),
  restartService: () => ipcRenderer.invoke('launcher:restart-service'),
  copyText: (text: string) => ipcRenderer.invoke('launcher:copy-text', text),
  openExternal: (request: ExternalOpenRequest) => ipcRenderer.invoke('launcher:open-external', request),
  createDesktopShortcut: (): Promise<UpdateCommandResult> => ipcRenderer.invoke('launcher:create-desktop-shortcut'),
  checkUpdates: () => ipcRenderer.invoke('launcher:check-updates'),
  downloadUpdate: (): Promise<UpdateCommandResult> => ipcRenderer.invoke('launcher:download-update'),
  applyStagedUpdate: (): Promise<UpdateCommandResult> => ipcRenderer.invoke('launcher:apply-staged-update'),
  getStatsRangeSince: (range: StatsRange, now?: number) => getRangeSince(range, now),
  getStatsRangeLabel: (range: StatsRange) => getRangeLabel(range),
  aggregateRequestStats: (summaries: StatsRequestSummary[]) => aggregateRequestStats(summaries),
  estimateTokenUsage: (summary: StatsRequestSummary, payload?: StatsPayload) => estimateTokenUsage(summary, payload),
  onState: (callback: (snapshot: RenderSnapshot) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, snapshot: RenderSnapshot) => callback(snapshot);
    ipcRenderer.on('launcher:state', handler);
    return () => ipcRenderer.removeListener('launcher:state', handler);
  }
});
