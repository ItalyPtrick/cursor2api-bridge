import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfiguredModelFromYaml } from '../src/shared/service-config';

test('getConfiguredModelFromYaml reads cursor_model from config', () => {
  const model = getConfiguredModelFromYaml(`
port: 3011
cursor_model: "anthropic/claude-opus-4.6"
`);

  assert.equal(model, 'anthropic/claude-opus-4.6');
});

test('getConfiguredModelFromYaml falls back when cursor_model is missing', () => {
  const model = getConfiguredModelFromYaml(`
port: 3011
timeout: 120
`, 'anthropic/claude-sonnet-4.6');

  assert.equal(model, 'anthropic/claude-sonnet-4.6');
});

test('getConfiguredModelFromYaml falls back when yaml is invalid', () => {
  const model = getConfiguredModelFromYaml('cursor_model: [', 'anthropic/claude-sonnet-4.6');

  assert.equal(model, 'anthropic/claude-sonnet-4.6');
});
