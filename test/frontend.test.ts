import test from 'node:test';
import assert from 'node:assert/strict';
import { getFrontendRouteCandidates, getUpstreamRepoLabel, getUpstreamRepoUrl } from '../src/shared/frontend';

test('getFrontendRouteCandidates prefers vuelogs then falls back to logs', () => {
  assert.deepEqual(getFrontendRouteCandidates('/vuelogs'), ['/vuelogs', '/logs']);
});

test('getFrontendRouteCandidates prefers logs then falls back to vuelogs', () => {
  assert.deepEqual(getFrontendRouteCandidates('/logs'), ['/logs', '/vuelogs']);
});

test('getUpstreamRepoUrl normalizes a GitHub owner/repo string', () => {
  assert.equal(getUpstreamRepoUrl('7836246/cursor2api'), 'https://github.com/7836246/cursor2api');
  assert.equal(getUpstreamRepoUrl('https://github.com/7836246/cursor2api/'), 'https://github.com/7836246/cursor2api');
});

test('getUpstreamRepoLabel prefixes the repo with the expected Chinese label', () => {
  assert.equal(getUpstreamRepoLabel('7836246/cursor2api'), '原项目 · 7836246/cursor2api');
});
