import type { DisplayMode, LocalizedLabel } from './types';

export function getLabel(label: LocalizedLabel | undefined, fallback: string, mode: DisplayMode): string {
  if (!label) return fallback;
  if (mode === 'zh') return label.zh || label.en || fallback;
  return label.en || label.zh || fallback;
}
