import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getConfiguredModelFromYaml,
  getVisionEnabledFromYaml,
  setVisionEnabledInYaml
} from '../src/shared/service-config';

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

test('getVisionEnabledFromYaml reads vision.enabled from config', () => {
  const enabled = getVisionEnabledFromYaml(`
vision:
  enabled: true
`);

  assert.equal(enabled, true);
});

test('getVisionEnabledFromYaml falls back when vision config is missing', () => {
  const enabled = getVisionEnabledFromYaml('port: 3011', false);

  assert.equal(enabled, false);
});

test('setVisionEnabledInYaml updates existing vision.enabled value', () => {
  const next = setVisionEnabledInYaml(`
port: 3011
vision:
  enabled: false
`, true);

  assert.match(next, /enabled: true/);
});

test('setVisionEnabledInYaml creates a vision block when it is missing', () => {
  const next = setVisionEnabledInYaml('port: 3011', false);

  assert.match(next, /vision:/);
  assert.match(next, /enabled: false/);
});
