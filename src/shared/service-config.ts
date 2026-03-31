import { parse } from 'yaml';

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
