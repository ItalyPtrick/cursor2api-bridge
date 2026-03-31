import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_STATE, sanitizeState, type LauncherState } from '../shared/state';

export class StateStore {
  private readonly filePath: string;
  private state: LauncherState;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.state = this.load();
  }

  getSnapshot(): LauncherState {
    return this.state;
  }

  update(patch: Partial<LauncherState>): LauncherState {
    this.state = sanitizeState({
      ...this.state,
      ...patch,
      windowBounds: patch.windowBounds ? { ...this.state.windowBounds, ...patch.windowBounds } : this.state.windowBounds
    });
    this.save();
    return this.state;
  }

  private load(): LauncherState {
    if (!existsSync(this.filePath)) {
      return DEFAULT_STATE;
    }

    try {
      const raw = JSON.parse(readFileSync(this.filePath, 'utf8'));
      return sanitizeState(raw);
    } catch {
      return DEFAULT_STATE;
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf8');
  }
}
