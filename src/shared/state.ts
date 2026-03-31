import { normalizeThemeMode, type ResolvedTheme, type ThemeMode } from './theme';

export type FrontendRoute = '/vuelogs' | '/logs';
export type HomeTab = 'home' | 'settings' | 'stats';

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export interface UpdateFeedConfig {
  owner: string;
  repo: string;
  assetName: string;
  checksumName: string;
}

export interface LauncherState {
  themeMode: ThemeMode;
  lastResolvedTheme: ResolvedTheme;
  preferredFrontendRoute: FrontendRoute;
  lastTab: HomeTab;
  hasPromptedDesktopShortcut: boolean;
  windowBounds: WindowBounds;
  updateFeed?: UpdateFeedConfig;
  lastStagedVersion?: string;
}

export const DEFAULT_STATE: LauncherState = {
  themeMode: 'system',
  lastResolvedTheme: 'light',
  preferredFrontendRoute: '/vuelogs',
  lastTab: 'home',
  hasPromptedDesktopShortcut: false,
  windowBounds: {
    width: 1380,
    height: 920
  }
};

function normalizeFrontendRoute(value: unknown): FrontendRoute {
  return value === '/logs' ? '/logs' : '/vuelogs';
}

function normalizeLastTab(value: unknown): HomeTab {
  if (value === 'frontend' || value === 'settings') {
    return 'settings';
  }
  if (value === 'stats') {
    return 'stats';
  }
  return 'home';
}

export function sanitizeState(candidate: unknown, defaults: LauncherState = DEFAULT_STATE): LauncherState {
  const raw = candidate && typeof candidate === 'object'
    ? candidate as Partial<LauncherState> & { windowBounds?: Partial<WindowBounds> }
    : {};
  const rawBounds: Partial<WindowBounds> = raw.windowBounds && typeof raw.windowBounds === 'object' ? raw.windowBounds : {};

  return {
    themeMode: normalizeThemeMode(raw.themeMode),
    lastResolvedTheme: raw.lastResolvedTheme === 'dark' ? 'dark' : defaults.lastResolvedTheme,
    preferredFrontendRoute: normalizeFrontendRoute(raw.preferredFrontendRoute),
    lastTab: normalizeLastTab(raw.lastTab),
    hasPromptedDesktopShortcut: raw.hasPromptedDesktopShortcut === true,
    windowBounds: {
      width: typeof rawBounds.width === 'number' ? rawBounds.width : defaults.windowBounds.width,
      height: typeof rawBounds.height === 'number' ? rawBounds.height : defaults.windowBounds.height,
      x: typeof rawBounds.x === 'number' ? rawBounds.x : undefined,
      y: typeof rawBounds.y === 'number' ? rawBounds.y : undefined
    },
    updateFeed: raw.updateFeed,
    lastStagedVersion: typeof raw.lastStagedVersion === 'string' ? raw.lastStagedVersion : undefined
  };
}
