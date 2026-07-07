import { describe, it, expect } from 'vitest';
import { parseDsl, connectionsToDsl } from '../parser/dsl';
import type { Connection } from '../domain/types';

const sampleConnection = {
  id: 'L-001',
  kind: 'pipe' as const,
  from: 'V-101.out',
  to: 'P-101.in',
  attrs: {
    DN: 80,
  },
  label: {
    zh: '样例',
  },
};

describe('parseDsl', () => {
  it('parses line attribute and backfills attrs', () => {
    const text = 'PIPE L-001 line=PG-V1101-01-50-M1B-H50: V-101.out -> P-101.in';
    const { connections, errors } = parseDsl(text);
    expect(errors).toHaveLength(0);
    expect(connections).toHaveLength(1);
    expect(connections[0].pipeLabel?.kind).toBe('standard');
    expect(connections[0].medium).toBe('PG');
    expect(connections[0].attrs?.DN).toBe(50);
    expect(connections[0].attrs?.material).toBe('M1B');
    expect(connections[0].attrs?.insulation).toBe('H50');
  });
});

describe('connectionsToDsl', () => {
  it('serializes pipeLabel as line field', () => {
    const text = connectionsToDsl([
      {
        ...sampleConnection,
        pipeLabel: {
          kind: 'standard',
          mediumCode: 'PG',
          equipmentTag: 'V1101',
          sequenceNo: '01',
          diameter: 50,
          pressureCode: 'M1B',
          insulationCode: 'H50',
        },
      },
    ]);
    expect(text).toContain('line=PG-V1101-01-50-M1B-H50');
  });

  it('keeps line text output when no structured pipeLabel available', () => {
    const manualLineConnection: Connection = {
      ...sampleConnection,
      pipeLabel: undefined,
      attrs: {
        ...sampleConnection.attrs,
        lineLabel: 'PG-V1101-01-50-M1B-H50',
      },
    };
    const text = connectionsToDsl([manualLineConnection]);
    expect(text).toContain('line=PG-V1101-01-50-M1B-H50');
  });
});
