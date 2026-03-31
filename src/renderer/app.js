const desktop = window.cursor2apiDesktop;

const state = {
  desktop,
  bootstrap: null,
  snapshot: null,
  bridgeReady: false,
  currentTab: 'home',
  banner: {
    message: '',
    tone: 'error'
  },
  toast: {
    message: '',
    tone: 'success'
  },
  toastTimer: null,
  stats: {
    range: 'day',
    loading: false,
    error: '',
    aggregated: createEmptyAggregatedStats(),
    lastUpdatedAt: null,
    estimatedCount: 0,
    requestToken: 0,
    lastLoadedKey: ''
  }
};

const elements = {};
const numberFormatter = new Intl.NumberFormat('zh-CN');
const percentFormatter = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

document.addEventListener('DOMContentLoaded', async () => {
  cacheElements();
  wireNavigation();
  wireControls();
  render();

  const bootstrapped = await bootstrapBridge();
  render();

  if (!bootstrapped) {
    return;
  }

  desktop.onState((snapshot) => {
    state.snapshot = snapshot;
    state.currentTab = normalizeTab(snapshot.state?.lastTab);
    render();
    if (state.currentTab === 'stats') {
      void loadStats();
    }
  });

  if (state.currentTab === 'stats') {
    await loadStats();
  }
});

function cacheElements() {
  const ids = [
    'globalBanner', 'toastHost',
    'homePanel', 'settingsPanel', 'statsPanel',
    'openUpstreamRepoButton',
    'heroStatus', 'heroSummary', 'serviceControlHint', 'serviceSpotlight', 'serviceSpotlightWord',
    'metricPort', 'metricAppVersion', 'metricUpstreamVersion', 'healthUrl',
    'nodePath', 'serviceVersion', 'serviceError', 'stdoutConsole', 'stderrConsole',
    'serviceToggleButton', 'restartButton', 'openHealthButton', 'openFrontendBrowserButton',
    'visionStatus', 'visionHint', 'visionToggleButton',
    'copyBaseUrlButton', 'copyPortButton', 'copyModelButton',
    'openInstallButton', 'openDataButton', 'openSourceButton', 'createShortcutButton',
    'checkUpdateButton', 'downloadUpdateButton', 'applyUpdateButton', 'openVersionButton', 'openReadmeButton',
    'updatePhaseChip', 'updateCurrentVersion', 'updateRemoteVersion', 'updateIntegrity', 'updateMessage',
    'upstreamRepo', 'upstreamCommit', 'versionFile', 'readmeFile',
    'accessBaseUrl', 'accessPort', 'accessModel',
    'statsBanner', 'statsRangeLabel', 'statsRequests', 'statsInputTokens', 'statsOutputTokens',
    'statsTotalTokens', 'statsActiveModels', 'statsSuccessRate', 'statsSuccessCount',
    'statsDegradedCount', 'statsErrorCount', 'statsInterceptedCount', 'statsProcessingCount',
    'statsModelRows', 'statsEmptyState', 'statsLastUpdated', 'statsLastRequestAt', 'statsRefreshButton'
  ];

  for (const id of ids) {
    elements[id] = document.getElementById(id);
  }
}

function wireNavigation() {
  document.querySelectorAll('.nav-tab').forEach((button) => {
    button.addEventListener('click', () => {
      const nextTab = normalizeTab(button.dataset.tab);
      state.currentTab = nextTab;
      renderTabs();

      if (state.bridgeReady) {
        void runAction(() => desktop.setHomeTab(nextTab), {
          silentSuccess: true,
          onResult: updateSnapshotFromResult
        });
      }

      if (nextTab === 'stats' && state.bridgeReady) {
        void loadStats();
      }
    });
  });
}

function wireControls() {
  document.querySelectorAll('.theme-pill').forEach((button) => {
    button.addEventListener('click', () => {
      void runAction(() => desktop.setThemeMode(button.dataset.themeMode), {
        silentSuccess: true,
        onResult: updateSnapshotFromResult
      });
    });
  });

  document.querySelectorAll('.route-pill').forEach((button) => {
    button.addEventListener('click', () => {
      const route = button.dataset.route;
      void runAction(() => desktop.setFrontendRoute(route), {
        silentSuccess: true,
        onResult: updateSnapshotFromResult
      });
    });
  });

  document.querySelectorAll('.range-pill').forEach((button) => {
    button.addEventListener('click', () => {
      state.stats.range = button.dataset.range;
      renderRangePills();
      void loadStats(true);
    });
  });

  bindAction('serviceToggleButton', async () => {
    const snapshot = requireSnapshot();
    const phase = snapshot.service.phase;
    if (phase === 'running' || phase === 'starting') {
      return desktop.stopService();
    }
    return desktop.startService();
  });

  bindAction('restartButton', () => desktop.restartService());
  bindAction('openHealthButton', () => desktop.openExternal({ target: 'health' }), { silentSuccess: true });
  bindAction('openUpstreamRepoButton', () => desktop.openExternal({ target: 'upstreamRepo' }), { silentSuccess: true });
  bindAction('openFrontendBrowserButton', () => openFrontendInBrowser(), { successMessage: '已在浏览器中打开原项目前端。' });
  const visionToggleButton = document.getElementById('visionToggleButton');
  if (visionToggleButton) {
    visionToggleButton.addEventListener('click', (event) => {
      event.preventDefault();
      const currentEnabled = Boolean(requireSnapshot().service.visionEnabled);
      const nextEnabled = !currentEnabled;
      void runAction(() => desktop.setVisionEnabled(nextEnabled), {
        button: visionToggleButton,
        onResult: updateSnapshotFromResult,
        successMessage: nextEnabled ? 'OCR 已开启。' : 'OCR 已关闭。'
      });
    });
  }
  bindAction('openInstallButton', () => desktop.openExternal({ target: 'install' }), { silentSuccess: true });
  bindAction('openDataButton', () => desktop.openExternal({ target: 'data' }), { silentSuccess: true });
  bindAction('openSourceButton', () => desktop.openExternal({ target: 'source' }), { silentSuccess: true });
  bindAction('createShortcutButton', () => desktop.createDesktopShortcut(), { useResultMessage: true });
  bindAction('checkUpdateButton', () => desktop.checkUpdates(), { silentSuccess: true });
  bindAction('downloadUpdateButton', () => desktop.downloadUpdate(), { useResultMessage: true });
  bindAction('applyUpdateButton', () => desktop.applyStagedUpdate(), { useResultMessage: true });
  bindAction('openVersionButton', () => desktop.openExternal({ target: 'version' }), { silentSuccess: true });
  bindAction('openReadmeButton', () => desktop.openExternal({ target: 'readme' }), { silentSuccess: true });
  bindAction('statsRefreshButton', () => loadStats(true), { silentSuccess: true });

  bindAction('copyBaseUrlButton', () => copyValue(() => requireSnapshot().service.baseUrl), { successMessage: '已复制本地地址。' });
  bindAction('copyPortButton', () => copyValue(() => String(requireSnapshot().service.port)), { successMessage: '已复制端口。' });
  bindAction('copyModelButton', () => copyValue(() => requireSnapshot().service.configuredModel), { successMessage: '已复制模型。' });
}

function bindAction(id, handler, options = {}) {
  const element = document.getElementById(id);
  if (!element) return;

  element.addEventListener('click', (event) => {
    event.preventDefault();
    void runAction(handler, { ...options, button: element });
  });
}

async function bootstrapBridge() {
  if (!desktop || typeof desktop.getBootstrap !== 'function') {
    state.bridgeReady = false;
    setBanner('桌面桥接没有正确注入，当前按钮已禁用。请重新启动软件，若仍失败再联系我继续排查。', 'error');
    render();
    return false;
  }

  try {
    const bootstrap = await desktop.getBootstrap();
    state.bootstrap = bootstrap;
    state.snapshot = bootstrap;
    state.bridgeReady = true;
    state.currentTab = normalizeTab(bootstrap.state?.lastTab);
    state.stats.aggregated = desktop.aggregateRequestStats([]);
    clearBanner();
    return true;
  } catch (error) {
    state.bridgeReady = false;
    setBanner(`桌面桥接初始化失败：${errorMessage(error)}`, 'error');
    return false;
  }
}

async function runAction(action, options = {}) {
  const button = options.button;
  const previousDisabled = button ? button.disabled : false;

  if (button) {
    button.disabled = true;
  }

  try {
    if (options.clearBanner !== false && state.banner.tone === 'error') {
      clearBanner();
    }

    const result = await action();
    if (typeof options.onResult === 'function') {
      options.onResult(result);
    }

    if (options.useResultMessage && result?.message) {
      if (result.ok === false) {
        setBanner(result.message, 'error');
      } else {
        showToast(result.message, 'success');
      }
    } else if (options.successMessage) {
      showToast(options.successMessage, 'success');
    } else if (!options.silentSuccess) {
      clearToast();
    }

    render();
    return result;
  } catch (error) {
    clearToast();
    setBanner(errorMessage(error), 'error');
    render();
    return undefined;
  } finally {
    if (button) {
      button.disabled = previousDisabled;
    }
    render();
  }
}

async function copyValue(getValue) {
  const value = getValue();
  if (!value) {
    throw new Error('当前没有可复制的内容。');
  }
  return desktop.copyText(String(value));
}

function updateSnapshotFromResult(result) {
  if (!result || typeof result !== 'object' || !('state' in result)) {
    return;
  }

  state.snapshot = result;
  state.currentTab = normalizeTab(result.state?.lastTab);
}

async function openFrontendInBrowser() {
  const snapshot = requireSnapshot();
  if (snapshot.service.phase !== 'running') {
    throw new Error('服务尚未运行，先启动服务再打开原项目前端。');
  }

  const preferredRoute = snapshot.state.preferredFrontendRoute;
  const route = await resolveFrontendRoute(snapshot.service.baseUrl, preferredRoute);
  return desktop.openExternal({ target: 'frontend', route });
}

async function resolveFrontendRoute(baseUrl, preferredRoute) {
  const candidates = desktop.getFrontendRouteCandidates(preferredRoute);

  for (const route of candidates) {
    try {
      const response = await fetch(`${baseUrl}${route}`);
      if (response.ok) {
        return route;
      }
    } catch {
      // Continue to fallback route.
    }
  }

  return candidates[candidates.length - 1];
}

function requireSnapshot() {
  if (!state.bridgeReady || !state.snapshot) {
    throw new Error('桌面桥接尚未就绪，当前操作不可用。');
  }
  return state.snapshot;
}

function render() {
  renderBanner();
  renderToast();
  renderTabs();
  renderRangePills();
  toggleBridgeActions(state.bridgeReady);

  const snapshot = state.snapshot;
  document.body.dataset.theme = snapshot?.resolvedTheme || 'light';

  if (!snapshot) {
    return;
  }

  renderThemeButtons(snapshot.state.themeMode);
  renderRoutePills(snapshot.state.preferredFrontendRoute);
  renderTopbar(snapshot);
  renderConsole(snapshot);
  renderSettings(snapshot);
  renderStats();
}

function renderTopbar(snapshot) {
  if (!elements.openUpstreamRepoButton) return;

  const repo = state.bootstrap?.versionInfo?.upstream?.repo || '7836246/cursor2api';
  const url = state.bootstrap?.versionInfo?.upstream?.url || `https://github.com/${repo}`;
  elements.openUpstreamRepoButton.textContent = `原项目 · ${repo}`;
  elements.openUpstreamRepoButton.title = url;
  elements.openUpstreamRepoButton.disabled = !state.bridgeReady;
}

function renderBanner() {
  if (!elements.globalBanner) return;

  if (!state.banner.message) {
    elements.globalBanner.hidden = true;
    elements.globalBanner.textContent = '';
    elements.globalBanner.dataset.tone = '';
    return;
  }

  elements.globalBanner.hidden = false;
  elements.globalBanner.textContent = state.banner.message;
  elements.globalBanner.dataset.tone = state.banner.tone;
}

function renderToast() {
  if (!elements.toastHost) return;

  if (!state.toast.message) {
    elements.toastHost.hidden = true;
    elements.toastHost.textContent = '';
    elements.toastHost.dataset.tone = '';
    return;
  }

  elements.toastHost.hidden = false;
  elements.toastHost.textContent = state.toast.message;
  elements.toastHost.dataset.tone = state.toast.tone;
}

function renderTabs() {
  document.querySelectorAll('.nav-tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === state.currentTab);
  });

  elements.homePanel.classList.toggle('active', state.currentTab === 'home');
  elements.settingsPanel.classList.toggle('active', state.currentTab === 'settings');
  elements.statsPanel.classList.toggle('active', state.currentTab === 'stats');
}

function renderThemeButtons(themeMode) {
  document.querySelectorAll('.theme-pill').forEach((button) => {
    button.classList.toggle('active', button.dataset.themeMode === themeMode);
  });
}

function renderRoutePills(route) {
  document.querySelectorAll('.route-pill').forEach((button) => {
    button.classList.toggle('active', button.dataset.route === route);
  });
}

function renderRangePills() {
  document.querySelectorAll('.range-pill').forEach((button) => {
    button.classList.toggle('active', button.dataset.range === state.stats.range);
  });
}

function renderConsole(snapshot) {
  const { versionInfo } = state.bootstrap;
  const { service } = snapshot;

  elements.heroStatus.textContent = readablePhase(service.phase);
  elements.heroSummary.textContent = service.phase === 'running'
    ? '当前本地代理已经可用，可以直接复制接入信息，或去设置页打开原项目前端。'
    : '服务停止时，本地 API 与浏览器前端入口都会保持待机。';

  elements.serviceControlHint.textContent = controlHintForPhase(service.phase);
  elements.metricPort.textContent = String(service.port);
  elements.metricAppVersion.textContent = versionInfo.appVersion;
  elements.metricUpstreamVersion.textContent = versionInfo.upstream.version;
  elements.serviceSpotlight.dataset.phase = service.phase;
  elements.serviceSpotlightWord.textContent = readablePhaseWord(service.phase);
  elements.healthUrl.textContent = service.healthUrl;
  elements.nodePath.textContent = service.nodeExecutable;
  elements.serviceVersion.textContent = service.serviceVersion || '-';
  elements.serviceError.textContent = service.lastError || '暂无';
  elements.accessBaseUrl.textContent = service.baseUrl;
  elements.accessPort.textContent = String(service.port);
  elements.accessModel.textContent = service.configuredModel || '-';
  elements.stdoutConsole.textContent = service.stdoutTail.length ? service.stdoutTail.join('\n') : '等待标准输出…';
  elements.stderrConsole.textContent = service.stderrTail.length ? service.stderrTail.join('\n') : '暂无错误输出';

  elements.serviceToggleButton.textContent = primaryActionLabel(service.phase);
  elements.serviceToggleButton.disabled = !state.bridgeReady || service.phase === 'starting' || service.phase === 'stopping';
  elements.serviceToggleButton.classList.toggle('action-danger', service.phase === 'running');
  elements.serviceToggleButton.classList.toggle('action-strong', service.phase !== 'running');
  elements.restartButton.disabled = !state.bridgeReady || service.phase === 'starting' || service.phase === 'stopping';
}

function renderSettings(snapshot) {
  const { versionInfo, paths } = state.bootstrap;
  const { update } = snapshot;

  elements.updatePhaseChip.textContent = update.phase;
  elements.updateCurrentVersion.textContent = update.currentVersion;
  elements.updateRemoteVersion.textContent = update.remoteVersion || '未检查';
  elements.updateIntegrity.textContent = update.integrity;
  elements.updateMessage.textContent = update.message || '更新会下载到新目录，不覆盖当前运行目录。';
  const visionEnabled = Boolean(snapshot.service.visionEnabled);
  elements.visionStatus.textContent = visionEnabled ? '已开启' : '已关闭';
  elements.visionHint.textContent = visionEnabled
    ? '当前已开启 OCR：图片请求会尝试走 OCR 识别链路。'
    : '默认关闭以减少资源占用。开启后会在图片请求场景尝试 OCR 识别。';
  elements.visionToggleButton.textContent = visionEnabled ? '关闭 OCR' : '开启 OCR';
  elements.visionToggleButton.disabled = !state.bridgeReady;
  elements.visionToggleButton.classList.toggle('action-danger', visionEnabled);
  elements.visionToggleButton.classList.toggle('action-strong', !visionEnabled);
  elements.upstreamRepo.textContent = versionInfo.upstream.repo;
  elements.upstreamCommit.textContent = versionInfo.upstream.commit || '-';
  elements.versionFile.textContent = paths.versionFile;
  elements.readmeFile.textContent = paths.readmeFile;

  elements.openFrontendBrowserButton.disabled = !state.bridgeReady || snapshot.service.phase !== 'running';
  elements.openHealthButton.disabled = !state.bridgeReady;
  elements.downloadUpdateButton.disabled = !state.bridgeReady || update.phase !== 'available';
  elements.applyUpdateButton.disabled = !state.bridgeReady || update.phase !== 'ready';
}

async function loadStats(forceReload = false) {
  if (!state.bridgeReady || !state.snapshot) {
    state.stats.error = '桌面桥接尚未就绪，无法读取统计。';
    state.stats.loading = false;
    state.stats.aggregated = createEmptyAggregatedStats();
    renderStats();
    return;
  }

  const service = state.snapshot.service;
  const cacheKey = `${state.stats.range}:${service.phase}:${service.port}`;
  const cacheFresh = state.stats.lastUpdatedAt && (Date.now() - state.stats.lastUpdatedAt < 45000);
  if (!forceReload && !state.stats.loading && state.stats.lastLoadedKey === cacheKey && cacheFresh) {
    return;
  }

  if (service.phase !== 'running') {
    state.stats.error = '服务尚未运行，无法读取统计数据。';
    state.stats.loading = false;
    state.stats.aggregated = desktop.aggregateRequestStats([]);
    state.stats.estimatedCount = 0;
    state.stats.lastLoadedKey = '';
    renderStats();
    return;
  }

  const requestToken = state.stats.requestToken + 1;
  state.stats.requestToken = requestToken;
  state.stats.loading = true;
  state.stats.error = '';
  renderStats();

  try {
    const since = desktop.getStatsRangeSince(state.stats.range, Date.now());
    const summaries = await fetchAllSummaries(service.baseUrl, since);
    const hydrated = await hydrateSummariesWithTokens(service.baseUrl, summaries);
    if (state.stats.requestToken !== requestToken) {
      return;
    }

    state.stats.aggregated = desktop.aggregateRequestStats(hydrated.summaries);
    state.stats.estimatedCount = hydrated.estimatedCount;
    state.stats.loading = false;
    state.stats.lastUpdatedAt = Date.now();
    state.stats.lastLoadedKey = cacheKey;
    renderStats();
  } catch (error) {
    if (state.stats.requestToken !== requestToken) {
      return;
    }
    state.stats.loading = false;
    state.stats.error = errorMessage(error);
    state.stats.aggregated = desktop.aggregateRequestStats([]);
    state.stats.estimatedCount = 0;
    renderStats();
  }
}

async function fetchAllSummaries(baseUrl, since) {
  const summaries = [];
  let before;

  while (true) {
    const url = new URL('/api/requests/more', baseUrl);
    url.searchParams.set('limit', '500');
    if (before !== undefined) {
      url.searchParams.set('before', String(before));
    }
    if (since !== undefined) {
      url.searchParams.set('since', String(since));
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`统计接口请求失败：HTTP ${response.status}`);
    }

    const payload = await response.json();
    const pageSummaries = Array.isArray(payload.summaries) ? payload.summaries : [];
    summaries.push(...pageSummaries);

    if (!payload.hasMore || pageSummaries.length === 0) {
      break;
    }

    before = pageSummaries[pageSummaries.length - 1]?.startTime;
    if (!before) {
      break;
    }
  }

  return summaries;
}

async function hydrateSummariesWithTokens(baseUrl, summaries) {
  const hydrated = summaries.map((summary) => ({ ...summary }));
  let estimatedCount = 0;
  const batchSize = 8;

  for (let start = 0; start < hydrated.length; start += batchSize) {
    const batch = hydrated.slice(start, start + batchSize);
    const batchResults = await Promise.all(batch.map(async (summary) => {
      let payload;
      if (summary.inputTokens == null || summary.outputTokens == null) {
        payload = await fetchSummaryPayload(baseUrl, summary.requestId);
      }
      const usage = desktop.estimateTokenUsage(summary, payload);
      return {
        ...summary,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        usedFallback: usage.usedFallback
      };
    }));

    batchResults.forEach((summary, index) => {
      hydrated[start + index] = summary;
      if (summary.usedFallback) {
        estimatedCount += 1;
      }
    });
  }

  return { summaries: hydrated, estimatedCount };
}

async function fetchSummaryPayload(baseUrl, requestId) {
  try {
    const response = await fetch(`${baseUrl}/api/payload/${encodeURIComponent(requestId)}`);
    if (!response.ok) return undefined;
    return await response.json();
  } catch {
    return undefined;
  }
}

function renderStats() {
  const aggregated = state.stats.aggregated || createEmptyAggregatedStats();

  elements.statsRangeLabel.textContent = desktop && state.bridgeReady
    ? desktop.getStatsRangeLabel(state.stats.range)
    : '最近 24 小时';
  elements.statsRequests.textContent = formatNumber(aggregated.totalRequests);
  elements.statsInputTokens.textContent = formatNumber(aggregated.inputTokens);
  elements.statsOutputTokens.textContent = formatNumber(aggregated.outputTokens);
  elements.statsTotalTokens.textContent = formatNumber(aggregated.totalTokens);
  elements.statsActiveModels.textContent = formatNumber(aggregated.activeModels);
  elements.statsSuccessRate.textContent = `${percentFormatter.format(aggregated.successRate)}%`;
  elements.statsSuccessCount.textContent = formatNumber(aggregated.statusCounts.success);
  elements.statsDegradedCount.textContent = formatNumber(aggregated.statusCounts.degraded);
  elements.statsErrorCount.textContent = formatNumber(aggregated.statusCounts.error);
  elements.statsInterceptedCount.textContent = formatNumber(aggregated.statusCounts.intercepted);
  elements.statsProcessingCount.textContent = formatNumber(aggregated.statusCounts.processing);
  elements.statsLastUpdated.textContent = state.stats.lastUpdatedAt ? `更新于 ${formatDateTime(state.stats.lastUpdatedAt)}` : '尚未加载';
  elements.statsLastRequestAt.textContent = aggregated.lastRequestAt ? formatDateTime(aggregated.lastRequestAt) : '-';

  if (state.stats.loading) {
    elements.statsBanner.textContent = '正在从本地日志数据库聚合请求与 Token，请稍候…';
  } else if (state.stats.error) {
    elements.statsBanner.textContent = state.stats.error;
  } else if (aggregated.totalRequests === 0) {
    elements.statsBanner.textContent = '当前范围内还没有可统计的请求记录。';
  } else if (state.stats.estimatedCount > 0) {
    elements.statsBanner.textContent = `已完成 ${desktop.getStatsRangeLabel(state.stats.range)} 的本地聚合，共 ${formatNumber(aggregated.totalRequests)} 条请求，其中 ${formatNumber(state.stats.estimatedCount)} 条请求的 Token 为本地估算。`;
  } else {
    elements.statsBanner.textContent = `已完成 ${desktop.getStatsRangeLabel(state.stats.range)} 的本地聚合，共 ${formatNumber(aggregated.totalRequests)} 条请求。`;
  }

  if (!aggregated.models.length) {
    elements.statsModelRows.innerHTML = '';
    elements.statsEmptyState.style.display = 'grid';
    elements.statsEmptyState.textContent = state.stats.loading ? '统计加载中…' : '当前范围内暂无模型统计数据。';
    return;
  }

  elements.statsEmptyState.style.display = 'none';
  elements.statsModelRows.innerHTML = aggregated.models.map((model) => {
    const successRate = model.requests > 0 ? (model.statusCounts.success / model.requests) * 100 : 0;
    return `
      <tr>
        <td class="model-name">${escapeHtml(model.model)}</td>
        <td>${formatNumber(model.requests)}</td>
        <td>${formatNumber(model.inputTokens)}</td>
        <td>${formatNumber(model.outputTokens)}</td>
        <td>${formatNumber(model.totalTokens)}</td>
        <td>${percentFormatter.format(successRate)}%</td>
      </tr>
    `;
  }).join('');
}

function toggleBridgeActions(enabled) {
  document.querySelectorAll('[data-bridge-action="true"]').forEach((button) => {
    button.disabled = !enabled;
  });
}

function normalizeTab(value) {
  if (value === 'settings' || value === 'stats') {
    return value;
  }
  return 'home';
}

function createEmptyAggregatedStats() {
  return {
    totalRequests: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    activeModels: 0,
    successRate: 0,
    lastRequestAt: undefined,
    statusCounts: {
      success: 0,
      degraded: 0,
      error: 0,
      intercepted: 0,
      processing: 0
    },
    models: []
  };
}

function setBanner(message, tone = 'error') {
  state.banner.message = message || '';
  state.banner.tone = tone;
}

function clearBanner() {
  setBanner('', 'error');
}

function showToast(message, tone = 'success') {
  if (!message) return;

  state.toast.message = message;
  state.toast.tone = tone;
  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
  }
  state.toastTimer = window.setTimeout(() => {
    clearToast();
    render();
  }, 2500);
}

function clearToast() {
  state.toast.message = '';
  state.toast.tone = 'success';
  if (state.toastTimer) {
    clearTimeout(state.toastTimer);
    state.toastTimer = null;
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function readablePhase(phase) {
  const labels = {
    stopped: '服务已停止',
    starting: '服务启动中',
    running: '服务运行中',
    stopping: '服务停止中',
    error: '服务异常'
  };
  return labels[phase] || phase;
}

function readablePhaseWord(phase) {
  const labels = {
    stopped: 'STOPPED',
    starting: 'STARTING',
    running: 'RUNNING',
    stopping: 'STOPPING',
    error: 'ERROR'
  };
  return labels[phase] || String(phase).toUpperCase();
}

function primaryActionLabel(phase) {
  if (phase === 'running') return '停止服务';
  if (phase === 'starting') return '启动中…';
  if (phase === 'stopping') return '停止中…';
  return '启动服务';
}

function controlHintForPhase(phase) {
  const labels = {
    stopped: '服务未运行时，本地 API、统计刷新和浏览器前端入口都会保持待机。',
    starting: '等待健康检查通过后，就可以打开浏览器前端和统计页。',
    running: '停止服务后，3011 端口会一起释放。',
    stopping: '正在优雅停止服务进程，请稍候。',
    error: '服务进入异常状态时，可以直接点“启动服务”重新拉起。'
  };
  return labels[phase] || '';
}

function formatNumber(value) {
  return numberFormatter.format(value || 0);
}

function formatDateTime(timestamp) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
