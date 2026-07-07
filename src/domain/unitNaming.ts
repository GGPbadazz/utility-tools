import type { UnitType } from './types';

const fallbackPrefixByType: Record<UnitType, string> = {
  vessel: 'V',
  pump: 'P',
  valve: 'XV',
  instrument: 'AI',
  junction: 'J',
  custom: 'U',
};

export function getUnitIdPrefix(type: UnitType): string {
  return fallbackPrefixByType[type];
}

export { fallbackPrefixByType };
