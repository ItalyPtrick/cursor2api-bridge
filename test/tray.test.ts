import test from 'node:test';
import assert from 'node:assert/strict';
import { getTrayMenuEntries } from '../src/shared/tray';

test('getTrayMenuEntries keeps the requested menu order', () => {
  const entries = getTrayMenuEntries('running');

  assert.deepEqual(entries.map((entry) => entry.label), [
    '打开主窗口',
    '重启服务',
    '停止服务',
    '启动服务',
    '退出程序'
  ]);
});

test('getTrayMenuEntries disables conflicting actions while running', () => {
  const entries = getTrayMenuEntries('running');

  assert.deepEqual(entries.map((entry) => entry.enabled), [
    true,
    true,
    true,
    false,
    true
  ]);
});

test('getTrayMenuEntries disables conflicting actions while stopped', () => {
  const entries = getTrayMenuEntries('stopped');

  assert.deepEqual(entries.map((entry) => entry.enabled), [
    true,
    true,
    false,
    true,
    true
  ]);
});

test('getTrayMenuEntries disables service actions while transitioning', () => {
  const entries = getTrayMenuEntries('starting');

  assert.deepEqual(entries.map((entry) => entry.enabled), [
    true,
    false,
    false,
    false,
    true
  ]);
});
