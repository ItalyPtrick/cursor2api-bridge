import { ipcRenderer } from 'electron';
import type { ThemeUpdatePayload } from '../shared/contracts';

function applyTheme(theme: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('cursor2api_theme', theme);
}

window.addEventListener('DOMContentLoaded', () => {
  const currentTheme = localStorage.getItem('cursor2api_theme');
  if (currentTheme === 'light' || currentTheme === 'dark') {
    applyTheme(currentTheme);
  }
});

const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
window.localStorage.setItem = ((key: string, value: string) => {
  originalSetItem(key, value);
  if (key === 'cursor2api_theme' && (value === 'light' || value === 'dark')) {
    ipcRenderer.sendToHost('guest-theme-requested', value);
  }
}) as Storage['setItem'];

ipcRenderer.on('desktop-theme:update', (_event, payload: ThemeUpdatePayload) => {
  applyTheme(payload.resolvedTheme);
  localStorage.setItem('cursor2api_theme_mode', payload.mode);
});

