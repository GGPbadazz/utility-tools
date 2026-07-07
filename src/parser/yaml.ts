import YAML from 'yaml';
import type { ProjectModel } from '../domain/types';
import { ensureProjectPortsHaveUid } from '../domain/portUid';

const SUPPORTED_UNIT_TYPES = new Set(['vessel', 'pump', 'valve', 'instrument', 'junction', 'custom']);

function isSupportedUnitType(type: unknown): type is 'vessel' | 'pump' | 'valve' | 'instrument' | 'junction' | 'custom' {
  return typeof type === 'string' && SUPPORTED_UNIT_TYPES.has(type);
}

function normalizeProjectTypes(raw: ProjectModel): ProjectModel {
  const originalUnits = raw.units || {};

  const units = Object.fromEntries(
    Object.entries(originalUnits).map(([unitId, unit]) => {
      const rawType = (unit as { type?: unknown }).type;
      const fallbackType = isSupportedUnitType(rawType) ? rawType : 'custom';
      const unknownTypeText = (typeof rawType === 'string' && rawType.trim()) ? rawType.trim() : '';

      const nextCustomType =
        typeof unit.customType === 'string'
          ? unit.customType
          : (!isSupportedUnitType(rawType) && unknownTypeText)
            ? `YAML:${unknownTypeText}`
            : unit.customType;

      return [
        unitId,
        {
          ...unit,
          type: fallbackType,
          ...(nextCustomType ? { customType: nextCustomType } : {}),
        },
      ];
    }),
  );

  return {
    ...raw,
    units,
  };
}

export function parseProjectYaml(source: string): ProjectModel {
  const raw = YAML.parse(source) as ProjectModel;
  if (!raw || !raw.units) {
    return raw;
  }

  const typed = normalizeProjectTypes(raw);
  const unitsWithPortUid = ensureProjectPortsHaveUid(typed.units);
  return {
    ...typed,
    units: unitsWithPortUid,
  };
}

export function projectToYaml(project: ProjectModel): string {
  return YAML.stringify(project);
}
