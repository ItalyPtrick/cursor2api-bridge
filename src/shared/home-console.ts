import type { ServicePhase } from './contracts';

export interface HomeServiceMetaInput {
  phase: ServicePhase;
  stderrTail: string[];
  lastError?: string;
}

export interface HomeServiceMeta {
  phaseLabel: string;
  phaseTone: 'running' | 'stopped' | 'error' | 'transition';
  summaryText: string;
  stderrSummary: string;
}

export function getHomeServiceMeta(input: HomeServiceMetaInput): HomeServiceMeta {
  const latestStderr = [...input.stderrTail]
    .reverse()
    .find((line) => line.trim().length > 0);
  const stderrSummary = latestStderr || input.lastError || '暂无错误输出';

  switch (input.phase) {
    case 'running':
      return {
        phaseLabel: '服务运行中',
        phaseTone: 'running',
        summaryText: '本地代理已就绪，可以直接复制地址或查看完整标准输出。',
        stderrSummary
      };
    case 'starting':
      return {
        phaseLabel: '服务启动中',
        phaseTone: 'transition',
        summaryText: '正在等待健康检查通过，标准输出会在这里持续刷新。',
        stderrSummary
      };
    case 'stopping':
      return {
        phaseLabel: '服务停止中',
        phaseTone: 'transition',
        summaryText: '正在优雅停止服务进程，请稍候。',
        stderrSummary
      };
    case 'error':
      return {
        phaseLabel: '服务异常',
        phaseTone: 'error',
        summaryText: '服务已退出，请查看下方错误窄栏并决定是否重新拉起。',
        stderrSummary
      };
    case 'stopped':
    default:
      return {
        phaseLabel: '服务已停止',
        phaseTone: 'stopped',
        summaryText: '服务未运行时，首页会保留控制入口和最近一段标准输出。',
        stderrSummary
      };
  }
}
