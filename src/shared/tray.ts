import type { ServicePhase } from './contracts';

export interface TrayMenuEntry {
  id: 'open-window' | 'restart-service' | 'stop-service' | 'start-service' | 'quit';
  label: string;
  enabled: boolean;
}

export function getTrayMenuEntries(phase: ServicePhase): TrayMenuEntry[] {
  const isTransitioning = phase === 'starting' || phase === 'stopping';
  const canStart = !isTransitioning && phase !== 'running';
  const canStop = !isTransitioning && phase !== 'stopped';
  const canRestart = !isTransitioning;

  return [
    { id: 'open-window', label: '打开主窗口', enabled: true },
    { id: 'restart-service', label: '重启服务', enabled: canRestart },
    { id: 'stop-service', label: '停止服务', enabled: canStop },
    { id: 'start-service', label: '启动服务', enabled: canStart },
    { id: 'quit', label: '退出程序', enabled: true }
  ];
}
