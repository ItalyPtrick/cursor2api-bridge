import { parse, stringify } from 'yaml';

export function getConfiguredModelFromYaml(configText: string | undefined, fallbackModel = 'anthropic/claude-sonnet-4.6'): string {
  if (!configText) {
    return fallbackModel;
  }

  try {
    const parsed = parse(configText);
    if (parsed && typeof parsed === 'object' && typeof parsed.cursor_model === 'string' && parsed.cursor_model.trim()) {
      return parsed.cursor_model.trim();
    }
  } catch {
    // Fall back to the bundled default when the YAML is invalid.
  }

  return fallbackModel;
}

export function getVisionEnabledFromYaml(configText: string | undefined, fallbackEnabled = false): boolean {
  if (!configText) {
    return fallbackEnabled;
  }

  try {
    const parsed = parse(configText) as { vision?: { enabled?: unknown } } | null;
    if (parsed?.vision && typeof parsed.vision === 'object' && typeof parsed.vision.enabled === 'boolean') {
      return parsed.vision.enabled;
    }
  } catch {
    // Fall back to defaults when the YAML is invalid.
  }

  return fallbackEnabled;
}

export function setVisionEnabledInYaml(configText: string | undefined, enabled: boolean): string {
  let parsed: Record<string, unknown> = {};

  if (configText) {
    try {
      const candidate = parse(configText);
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        parsed = candidate as Record<string, unknown>;
      }
    } catch {
      parsed = {};
    }
  }

  const currentVision = parsed.vision;
  const visionObject = currentVision && typeof currentVision === 'object' && !Array.isArray(currentVision)
    ? { ...(currentVision as Record<string, unknown>) }
    : {};

  visionObject.enabled = enabled;
  parsed.vision = visionObject;

  return `${stringify(parsed).trimEnd()}\n`;
}
