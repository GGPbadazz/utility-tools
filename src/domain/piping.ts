import type { CodeDefinition } from './engineeringCodes';

export type PipeLabelType = 'standard' | 'jacketed';

export type PipeLabelCommon = {
  mediumCode: string;
  equipmentTag: string;
  sequenceNo: string;
  diameter: number;
  pressureCode: string;
  insulationCode: string;
};

export type StandardPipeLabel = PipeLabelCommon & {
  kind: 'standard';
};

export type JacketPipeLabel = PipeLabelCommon & {
  kind: 'jacketed';
  jacket: {
    jacketTypeCode: string;
    jacketMediumCode: string;
    jacketHeatCode: string;
    jacketDiameter: number;
    jacketPressureCode: string;
    jacketInsulationCode: string;
  };
};

export type PipeLabel = StandardPipeLabel | JacketPipeLabel;

export type PipeLabelLegacy = {
  mediumCode: string;
  equipmentTag: string;
  sequenceNo: string;
  diameter: number;
  pressureCode: string;
  insulationCode: string;
  kind: PipeLabelType;
};

const STANDARD_RE = /^([A-Z0-9]+)-([A-Z]+\d+)-(\d+)-(\d+)-([A-Z0-9]+)-([A-Z]\d*)$/;
const JACKET_RE = /^([A-Z0-9]+)-([A-Z]+\d+)-(\d+)-(\d+)-([A-Z0-9]+)\/([A-Z]{1})([A-Z]{1})([A-Z]{1})(\d+)-([A-Z0-9]+)-([A-Z]\d*)$/;
const COMPACT_JACKET_RE = /^([A-Z0-9]+)([A-Z]\d+)-(\d+)-(\d+)-([A-Z0-9]+)\/([A-Z]{1})([A-Z]{1})([A-Z]{1})(\d+)-([A-Z0-9]+)-([A-Z]\d*)$/;

function normalizeInput(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input.trim().toUpperCase();
  return text.length === 0 ? null : text;
}

export function parsePipeLabel(raw: string | null | undefined): PipeLabel | null {
  const text = normalizeInput(raw);
  if (!text) return null;

  const standardMatch = text.match(STANDARD_RE);
  if (standardMatch) {
    const [, mediumCode, equipmentTag, sequenceNo, diameter, pressureCode, insulationCode] = standardMatch;
    return {
      kind: 'standard',
      mediumCode,
      equipmentTag,
      sequenceNo,
      diameter: Number(diameter),
      pressureCode,
      insulationCode,
    };
  }

  const jacketMatch = text.match(JACKET_RE);
  if (jacketMatch) {
    const [, mediumCode, equipmentTag, sequenceNo, diameter, pressureCode, jacketTypeCode, jacketMediumCode, jacketHeatCode, jacketDiameter, jacketPressureCode, jacketInsulationCode] = jacketMatch;
    return {
      kind: 'jacketed',
      mediumCode,
      equipmentTag,
      sequenceNo,
      diameter: Number(diameter),
      pressureCode,
      insulationCode: jacketInsulationCode,
      jacket: {
        jacketTypeCode,
        jacketMediumCode,
        jacketHeatCode,
        jacketDiameter: Number(jacketDiameter),
        jacketPressureCode,
        jacketInsulationCode,
      },
    };
  }

  const compactJacketMatch = text.match(COMPACT_JACKET_RE);
  if (compactJacketMatch) {
    const [, mediumCode, equipmentTag, sequenceNo, diameter, pressureCode, jacketTypeCode, jacketMediumCode, jacketHeatCode, jacketDiameter, jacketPressureCode, jacketInsulationCode] = compactJacketMatch;
    return {
      kind: 'jacketed',
      mediumCode,
      equipmentTag,
      sequenceNo,
      diameter: Number(diameter),
      pressureCode,
      insulationCode: jacketInsulationCode,
      jacket: {
        jacketTypeCode,
        jacketMediumCode,
        jacketHeatCode,
        jacketDiameter: Number(jacketDiameter),
        jacketPressureCode,
        jacketInsulationCode,
      },
    };
  }

  return null;
}

export function formatPipeLineSegment(pressureCode: string, insulationCode: string): string {
  const p = pressureCode?.trim() || '';
  const i = insulationCode?.trim() || '';
  return `${p}${i ? `-${i}` : ''}`;
}

export function formatPipeLabel(label: PipeLabel): string {
  if (label.kind === 'standard') {
    return `${label.mediumCode}-${label.equipmentTag}-${label.sequenceNo}-${label.diameter}-${formatPipeLineSegment(label.pressureCode, label.insulationCode)}`;
  }

  const common = `${label.mediumCode}${label.equipmentTag}-${label.sequenceNo}-${label.diameter}-${label.pressureCode}`;
  return `${common}/${label.jacket.jacketTypeCode}${label.jacket.jacketMediumCode}${label.jacket.jacketHeatCode}${label.jacket.jacketDiameter}-${label.jacket.jacketPressureCode}-${label.jacket.jacketInsulationCode}`;
}

export function getPipeCodeCandidates(def: CodeDefinition[], code: string): boolean {
  const value = code.trim();
  if (!value) return false;
  return def.some((item) => item.code === value);
}
