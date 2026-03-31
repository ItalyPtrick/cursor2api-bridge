import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeThemeMode, resolveTheme } from '../src/shared/theme';

test('normalizeThemeMode falls back to system', () => {
  assert.equal(normalizeThemeMode('mystery'), 'system');
  assert.equal(normalizeThemeMode(undefined), 'system');
});

test('resolveTheme respects explicit mode', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
});

test('resolveTheme follows system when mode is system', () => {
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});

