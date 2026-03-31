import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateRequestStats, estimateTokenUsage, getRangeSince } from '../src/shared/stats';

test('getRangeSince returns undefined for all range', () => {
  assert.equal(getRangeSince('all', new Date('2026-03-31T12:00:00Z').getTime()), undefined);
});

test('getRangeSince calculates day, week, and month cutoffs from the same now value', () => {
  const now = new Date('2026-03-31T12:00:00Z').getTime();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  assert.equal(getRangeSince('day', now), now - day);
  assert.equal(getRangeSince('week', now), now - (7 * day));
  assert.equal(getRangeSince('month', now), now - (30 * day));
});

test('aggregateRequestStats totals requests and token usage by model', () => {
  const aggregated = aggregateRequestStats([
    {
      requestId: 'a',
      startTime: 10,
      model: 'claude-sonnet-4.6',
      status: 'success',
      inputTokens: 120,
      outputTokens: 30
    },
    {
      requestId: 'b',
      startTime: 20,
      model: 'claude-opus-4.6',
      status: 'error',
      inputTokens: 80,
      outputTokens: 0
    },
    {
      requestId: 'c',
      startTime: 30,
      model: 'claude-sonnet-4.6',
      status: 'degraded',
      inputTokens: 60,
      outputTokens: 15
    }
  ]);

  assert.equal(aggregated.totalRequests, 3);
  assert.equal(aggregated.inputTokens, 260);
  assert.equal(aggregated.outputTokens, 45);
  assert.equal(aggregated.totalTokens, 305);
  assert.equal(aggregated.activeModels, 2);
  assert.equal(aggregated.lastRequestAt, 30);
  assert.equal(aggregated.successRate, 33.3);
  assert.deepEqual(aggregated.statusCounts, {
    success: 1,
    degraded: 1,
    error: 1,
    intercepted: 0,
    processing: 0
  });
  assert.equal(aggregated.models.length, 2);
  assert.equal(aggregated.models[0]?.model, 'claude-sonnet-4.6');
  assert.equal(aggregated.models[0]?.requests, 2);
  assert.equal(aggregated.models[0]?.inputTokens, 180);
  assert.equal(aggregated.models[0]?.outputTokens, 45);
  assert.equal(aggregated.models[0]?.totalTokens, 225);
});

test('estimateTokenUsage falls back to payload and response size when summary tokens are missing', () => {
  const usage = estimateTokenUsage(
    {
      requestId: 'openai-1',
      startTime: 10,
      model: 'claude-sonnet-4.6',
      status: 'success',
      responseChars: 9
    },
    {
      messages: [
        { role: 'user', contentLength: 24, contentPreview: 'hello', hasImages: false },
        { role: 'assistant', contentLength: 6, contentPreview: 'ok', hasImages: false }
      ],
      systemPrompt: 'Follow the repo instructions',
      finalResponse: 'great job'
    }
  );

  assert.equal(usage.inputTokens, 15);
  assert.equal(usage.outputTokens, 3);
  assert.equal(usage.usedFallback, true);
});

test('estimateTokenUsage prefers original message sizes over injected cursor request size', () => {
  const usage = estimateTokenUsage(
    {
      requestId: 'openai-2',
      startTime: 20,
      model: 'claude-sonnet-4.6',
      status: 'success',
      responseChars: 2
    },
    {
      messages: [
        { role: 'user', contentLength: 22, contentPreview: 'Reply with exactly: ok', hasImages: false }
      ],
      cursorRequest: {
        totalChars: 304
      },
      finalResponse: 'ok'
    }
  );

  assert.equal(usage.inputTokens, 6);
  assert.equal(usage.outputTokens, 1);
});
