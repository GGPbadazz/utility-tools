import { describe, it, expect } from 'vitest';
import { getLabel } from '../domain/labels';
import type { LocalizedLabel } from '../domain/types';

describe('getLabel', () => {
  const label: LocalizedLabel = { zh: '酸液储罐', en: 'Acid Storage Tank' };

  it('zh mode returns zh label', () => {
    expect(getLabel(label, 'fallback', 'zh')).toBe('酸液储罐');
  });

  it('en mode returns en label', () => {
    expect(getLabel(label, 'fallback', 'en')).toBe('Acid Storage Tank');
  });

  it('returns fallback when label is undefined', () => {
    expect(getLabel(undefined, 'V-101', 'zh')).toBe('V-101');
  });

  it('zh mode falls back to en then fallback', () => {
    expect(getLabel({ en: 'Only English' }, 'fb', 'zh')).toBe('Only English');
    expect(getLabel({}, 'fb', 'zh')).toBe('fb');
  });

  it('en mode falls back to zh then fallback', () => {
    expect(getLabel({ zh: '仅中文' }, 'fb', 'en')).toBe('仅中文');
    expect(getLabel({}, 'fb', 'en')).toBe('fb');
  });
});
