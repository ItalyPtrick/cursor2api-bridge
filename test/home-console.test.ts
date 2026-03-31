import test from 'node:test';
import assert from 'node:assert/strict';
import { getHomeServiceMeta } from '../src/shared/home-console';

test('getHomeServiceMeta returns running summary and stderr fallback', () => {
  const meta = getHomeServiceMeta({
    phase: 'running',
    stderrTail: [],
    lastError: undefined
  });

  assert.equal(meta.phaseLabel, '服务运行中');
  assert.equal(meta.phaseTone, 'running');
  assert.equal(meta.summaryText, '本地代理已就绪，可以直接复制地址或查看完整标准输出。');
  assert.equal(meta.stderrSummary, '暂无错误输出');
});

test('getHomeServiceMeta prefers the latest stderr line for the summary', () => {
  const meta = getHomeServiceMeta({
    phase: 'error',
    stderrTail: ['first line', '', 'latest line'],
    lastError: '服务进程异常退出，exit code 1'
  });

  assert.equal(meta.phaseLabel, '服务异常');
  assert.equal(meta.phaseTone, 'error');
  assert.equal(meta.stderrSummary, 'latest line');
});

test('getHomeServiceMeta falls back to lastError when stderr is empty', () => {
  const meta = getHomeServiceMeta({
    phase: 'stopped',
    stderrTail: [],
    lastError: '服务尚未启动'
  });

  assert.equal(meta.phaseLabel, '服务已停止');
  assert.equal(meta.phaseTone, 'stopped');
  assert.equal(meta.stderrSummary, '服务尚未启动');
});
