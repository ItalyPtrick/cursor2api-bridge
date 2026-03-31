export type StatsRange = 'day' | 'week' | 'month' | 'all';
export type RequestStatus = 'success' | 'degraded' | 'error' | 'intercepted' | 'processing';

export interface StatsRequestSummary {
  requestId: string;
  startTime: number;
  model?: string;
  status?: RequestStatus;
  inputTokens?: number;
  outputTokens?: number;
  responseChars?: number;
}

export interface StatsPayloadMessage {
  role?: string;
  contentPreview?: string;
  contentLength?: number;
  hasImages?: boolean;
}

export interface StatsPayload {
  systemPrompt?: string;
  messages?: StatsPayloadMessage[];
  finalResponse?: string;
  rawResponse?: string;
  cursorRequest?: {
    totalChars?: number;
  };
}

export interface EstimatedTokenUsage {
  inputTokens: number;
  outputTokens: number;
  usedFallback: boolean;
}

export interface AggregatedModelStats {
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  statusCounts: Record<RequestStatus, number>;
}

export interface AggregatedRequestStats {
  totalRequests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  activeModels: number;
  successRate: number;
  lastRequestAt?: number;
  statusCounts: Record<RequestStatus, number>;
  models: AggregatedModelStats[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function createStatusCounts(): Record<RequestStatus, number> {
  return {
    success: 0,
    degraded: 0,
    error: 0,
    intercepted: 0,
    processing: 0
  };
}

function normalizeModel(model?: string): string {
  return model && model.trim() ? model.trim() : 'unknown';
}

function normalizeStatus(status?: string): RequestStatus {
  if (status === 'success' || status === 'degraded' || status === 'error' || status === 'intercepted' || status === 'processing') {
    return status;
  }
  return 'processing';
}

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getRangeSince(range: StatsRange, now = Date.now()): number | undefined {
  switch (range) {
    case 'day':
      return now - DAY_MS;
    case 'week':
      return now - (7 * DAY_MS);
    case 'month':
      return now - (30 * DAY_MS);
    case 'all':
    default:
      return undefined;
  }
}

export function getRangeLabel(range: StatsRange): string {
  switch (range) {
    case 'day':
      return '最近 24 小时';
    case 'week':
      return '最近 7 天';
    case 'month':
      return '最近 30 天';
    case 'all':
    default:
      return '全部历史';
  }
}

export function aggregateRequestStats(summaries: StatsRequestSummary[]): AggregatedRequestStats {
  const byModel = new Map<string, AggregatedModelStats>();
  const statusCounts = createStatusCounts();
  let inputTokens = 0;
  let outputTokens = 0;
  let lastRequestAt: number | undefined;

  for (const summary of summaries) {
    const model = normalizeModel(summary.model);
    const status = normalizeStatus(summary.status);
    const itemInputTokens = summary.inputTokens ?? 0;
    const itemOutputTokens = summary.outputTokens ?? 0;
    const itemTotalTokens = itemInputTokens + itemOutputTokens;

    inputTokens += itemInputTokens;
    outputTokens += itemOutputTokens;
    statusCounts[status] += 1;
    lastRequestAt = lastRequestAt === undefined ? summary.startTime : Math.max(lastRequestAt, summary.startTime);

    const bucket = byModel.get(model) ?? {
      model,
      requests: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      statusCounts: createStatusCounts()
    };

    bucket.requests += 1;
    bucket.inputTokens += itemInputTokens;
    bucket.outputTokens += itemOutputTokens;
    bucket.totalTokens += itemTotalTokens;
    bucket.statusCounts[status] += 1;
    byModel.set(model, bucket);
  }

  const totalRequests = summaries.length;
  const models = [...byModel.values()].sort((left, right) => {
    if (right.requests !== left.requests) {
      return right.requests - left.requests;
    }
    if (right.totalTokens !== left.totalTokens) {
      return right.totalTokens - left.totalTokens;
    }
    return left.model.localeCompare(right.model);
  });

  return {
    totalRequests,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    activeModels: models.length,
    successRate: totalRequests > 0 ? roundToOneDecimal((statusCounts.success / totalRequests) * 100) : 0,
    lastRequestAt,
    statusCounts,
    models
  };
}

export function estimateTokenUsage(summary: StatsRequestSummary, payload?: StatsPayload): EstimatedTokenUsage {
  const inputFromSummary = summary.inputTokens;
  const outputFromSummary = summary.outputTokens;
  const estimatedInput = estimateInputTokens(payload);
  const estimatedOutput = estimateOutputTokens(summary, payload);

  return {
    inputTokens: inputFromSummary ?? estimatedInput,
    outputTokens: outputFromSummary ?? estimatedOutput,
    usedFallback: inputFromSummary == null || outputFromSummary == null
  };
}

function estimateInputTokens(payload?: StatsPayload): number {
  if (!payload) return 0;

  const messageChars = (payload.messages ?? []).reduce((total, message) => total + (message.contentLength ?? 0), 0);
  const systemChars = payload.systemPrompt?.length ?? 0;
  const totalChars = messageChars + systemChars;
  if (totalChars > 0) {
    return Math.max(1, Math.ceil(totalChars / 4));
  }

  if (typeof payload.cursorRequest?.totalChars === 'number' && payload.cursorRequest.totalChars > 0) {
    return Math.max(1, Math.ceil(payload.cursorRequest.totalChars / 4));
  }

  return 0;
}

function estimateOutputTokens(summary: StatsRequestSummary, payload?: StatsPayload): number {
  const responseText = payload?.finalResponse || payload?.rawResponse;
  const responseChars = responseText?.length ?? summary.responseChars ?? 0;
  if (responseChars <= 0) return 0;

  return Math.max(1, Math.ceil(responseChars / 3));
}
