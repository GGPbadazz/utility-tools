import { describe, it, expect } from 'vitest';
import { parsePipeLabel, formatPipeLabel } from '../domain/piping';

describe('parsePipeLabel', () => {
  it('parses standard line label', () => {
    const parsed = parsePipeLabel('PG-V1101-01-50-M1B-H50');
    expect(parsed).toMatchObject({
      kind: 'standard',
      mediumCode: 'PG',
      equipmentTag: 'V1101',
      sequenceNo: '01',
      diameter: 50,
      pressureCode: 'M1B',
      insulationCode: 'H50',
    });
  });

  it('parses jacketed line label', () => {
    const parsed = parsePipeLabel('PGV1101-01-50-M1B/WSJ80-M1B-H50');
    expect(parsed).toMatchObject({
      kind: 'jacketed',
      mediumCode: 'PG',
      equipmentTag: 'V1101',
      sequenceNo: '01',
      diameter: 50,
      pressureCode: 'M1B',
      insulationCode: 'H50',
    });
    if (parsed?.kind === 'jacketed') {
      expect(parsed.jacket.jacketTypeCode).toBe('W');
      expect(parsed.jacket.jacketMediumCode).toBe('S');
      expect(parsed.jacket.jacketHeatCode).toBe('J');
      expect(parsed.jacket.jacketDiameter).toBe(80);
      expect(parsed.jacket.jacketPressureCode).toBe('M1B');
      expect(parsed.jacket.jacketInsulationCode).toBe('H50');
    }
  });

  it('parses insulation single code without thickness', () => {
    const parsed = parsePipeLabel('PG-V1101-01-50-M1B-H');
    expect(parsed).toMatchObject({
      kind: 'standard',
      mediumCode: 'PG',
      equipmentTag: 'V1101',
      sequenceNo: '01',
      diameter: 50,
      pressureCode: 'M1B',
      insulationCode: 'H',
    });
  });

  it('returns null for invalid line label', () => {
    expect(parsePipeLabel('invalid-line')).toBeNull();
    expect(parsePipeLabel('')).toBeNull();
    expect(parsePipeLabel('PGV1101-50-M1B-H50')).toBeNull();
  });

  it('normalizes lower-case input', () => {
    expect(parsePipeLabel('pg-v1101-01-50-m1b-h50')?.kind).toBe('standard');
  });
});

describe('formatPipeLabel', () => {
  it('reformats parsed standard label', () => {
    const parsed = parsePipeLabel('PG-V1101-01-50-M1B-H50');
    expect(formatPipeLabel(parsed!)).toBe('PG-V1101-01-50-M1B-H50');
  });

  it('reformats parsed jacketed label', () => {
    const parsed = parsePipeLabel('PGV1101-01-50-M1B/WSJ80-M1B-H50');
    expect(formatPipeLabel(parsed!)).toBe('PGV1101-01-50-M1B/WSJ80-M1B-H50');
  });
});
