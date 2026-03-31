import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATE, sanitizeState } from '../src/shared/state';

test('sanitizeState restores defaults for incomplete state', () => {
  const state = sanitizeState({});
  assert.equal(state.themeMode, DEFAULT_STATE.themeMode);
  assert.equal(state.lastResolvedTheme, DEFAULT_STATE.lastResolvedTheme);
  assert.equal(state.preferredFrontendRoute, DEFAULT_STATE.preferredFrontendRoute);
  assert.equal(state.lastTab, DEFAULT_STATE.lastTab);
  assert.equal(state.hasPromptedDesktopShortcut, DEFAULT_STATE.hasPromptedDesktopShortcut);
  assert.equal(state.windowBounds.width, DEFAULT_STATE.windowBounds.width);
  assert.equal(state.windowBounds.height, DEFAULT_STATE.windowBounds.height);
});

test('sanitizeState preserves valid custom values', () => {
  const state = sanitizeState({
    themeMode: 'dark',
    preferredFrontendRoute: '/logs',
    lastTab: 'settings',
    hasPromptedDesktopShortcut: true,
    windowBounds: {
      width: 1200,
      height: 800,
      x: 100,
      y: 200
    }
  });

  assert.equal(state.themeMode, 'dark');
  assert.equal(state.preferredFrontendRoute, '/logs');
  assert.equal(state.lastTab, 'settings');
  assert.equal(state.hasPromptedDesktopShortcut, true);
  assert.equal(state.windowBounds.width, 1200);
  assert.equal(state.windowBounds.x, 100);
});

test('sanitizeState migrates legacy frontend tab to settings', () => {
  const state = sanitizeState({
    lastTab: 'frontend'
  });

  assert.equal(state.lastTab, 'settings');
});
