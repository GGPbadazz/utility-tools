import { describe, it, expect } from 'vitest';
import type { ProjectModel, Unit, Connection } from '../domain/types';
import { getUnitIdPrefix } from '../domain/unitNaming';

// We test the mutation logic by simulating the setProject updater function pattern
// Extract the core logic from useProjectMutations without React hooks

function makeProject(): ProjectModel {
  return {
    project: { id: 'test' },
    units: {
      'V-101': {
        type: 'vessel',
        label: { zh: '储罐', en: 'Tank' },
        ports: { inlet: { kind: 'pipe', DN: 50, side: 'left' }, outlet: { kind: 'pipe', DN: 50, side: 'right' } },
        layout: { x: 100, y: 200 },
      },
      'P-101': {
        type: 'pump',
        label: { zh: '泵', en: 'Pump' },
        ports: { inlet: { kind: 'pipe', DN: 50, side: 'left' }, outlet: { kind: 'pipe', DN: 50, side: 'right' } },
        layout: { x: 300, y: 200 },
      },
    },
    connections: [
      { id: 'L-001', kind: 'pipe', from: 'V-101.outlet', to: 'P-101.inlet', attrs: {} },
    ],
  };
}

// Simulate nextId logic
function nextId(prefix: string, existing: string[]): string {
  let max = 100;
  for (const id of existing) {
    const match = id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}-${max + 1}`;
}

describe('nextId', () => {
  it('generates V-101 when no existing V- IDs', () => {
    expect(nextId('V', ['P-101', 'XV-101'])).toBe('V-101');
  });

  it('increments from max existing ID', () => {
    expect(nextId('V', ['V-101', 'V-103', 'V-102'])).toBe('V-104');
  });

  it('handles empty list', () => {
    expect(nextId('P', [])).toBe('P-101');
  });
});

describe('addUnit mutation', () => {
  it('adds a new unit with correct ID', () => {
    const prev = makeProject();
    const prefix = 'V';
    const id = nextId(prefix, Object.keys(prev.units));
    const newUnit: Unit = {
      type: 'vessel',
      label: { zh: '', en: '' },
      attrs: {},
      ports: { inlet: { kind: 'pipe', DN: 50, side: 'left' }, outlet: { kind: 'pipe', DN: 50, side: 'right' } },
      layout: { x: 200, y: 150 },
    };
    const next = { ...prev, units: { ...prev.units, [id]: newUnit } };
    expect(next.units[id]).toBeDefined();
    expect(next.units[id].type).toBe('vessel');
    // V-101 already exists so next should be V-102
    expect(id).toBe('V-102');
  });

  it('prefix helper uses unit type mapping for new rule', () => {
    const prev = makeProject();
    const id = nextId(getUnitIdPrefix('pump'), Object.keys(prev.units));
    expect(id).toBe('P-102');
  });

  it('prefix helper returns mapped default for valve', () => {
    const prev = makeProject();
    const id = nextId(getUnitIdPrefix('valve'), Object.keys(prev.units));
    expect(id).toBe('XV-101');
  });
});

describe('deleteUnit mutation', () => {
  it('removes unit and cascades to connections', () => {
    const prev = makeProject();
    const unitId = 'V-101';
    const { [unitId]: _, ...rest } = prev.units;
    const connections = prev.connections.filter(
      (c) => !c.from.startsWith(unitId + '.') && !c.to.startsWith(unitId + '.')
    );
    const next = { ...prev, units: rest, connections };
    expect(next.units['V-101']).toBeUndefined();
    expect(next.connections).toHaveLength(0); // L-001 uses V-101.outlet
  });
});

describe('updateUnit mutation', () => {
  it('updates unit label', () => {
    const prev = makeProject();
    const unitId = 'V-101';
    const unit = prev.units[unitId];
    const updated = { ...unit, label: { ...unit.label, zh: '新名称' } };
    const next = { ...prev, units: { ...prev.units, [unitId]: updated } };
    expect(next.units['V-101'].label.zh).toBe('新名称');
  });
});

describe('updateUnitLayout mutation', () => {
  it('updates layout position', () => {
    const prev = makeProject();
    const unitId = 'V-101';
    const unit = prev.units[unitId];
    const next = {
      ...prev,
      units: { ...prev.units, [unitId]: { ...unit, layout: { ...unit.layout, x: 500, y: 600 } } },
    };
    expect(next.units['V-101'].layout?.x).toBe(500);
    expect(next.units['V-101'].layout?.y).toBe(600);
  });
});

describe('addPort mutation', () => {
  it('adds a port to a unit', () => {
    const prev = makeProject();
    const unitId = 'V-101';
    const unit = prev.units[unitId];
    const ports = { ...(unit.ports || {}), vent: { kind: 'pipe' as const, DN: 25, side: 'top' as const } };
    const next = { ...prev, units: { ...prev.units, [unitId]: { ...unit, ports } } };
    expect(next.units['V-101'].ports?.vent).toBeDefined();
    expect(next.units['V-101'].ports?.vent?.DN).toBe(25);
  });
});

describe('deletePort mutation', () => {
  it('removes port and cascades connection removal', () => {
    const prev = makeProject();
    const unitId = 'V-101';
    const portId = 'outlet';
    const unit = prev.units[unitId];
    const { [portId]: _, ...restPorts } = unit.ports!;
    const portPath = `${unitId}.${portId}`;
    const connections = prev.connections.filter(
      (c) => c.from !== portPath && c.to !== portPath
    );
    const next = { ...prev, units: { ...prev.units, [unitId]: { ...unit, ports: restPorts } }, connections };
    expect(next.units['V-101'].ports?.outlet).toBeUndefined();
    expect(next.connections).toHaveLength(0); // L-001 has from: V-101.outlet
  });
});

describe('addConnection mutation', () => {
  it('adds a new connection', () => {
    const prev = makeProject();
    const id = `L-${String(prev.connections.length + 1).padStart(3, '0')}`;
    const conn: Connection = { id, kind: 'pipe', from: 'P-101.outlet', to: 'V-101.inlet', attrs: {} };
    const next = { ...prev, connections: [...prev.connections, conn] };
    expect(next.connections).toHaveLength(2);
    expect(next.connections[1].id).toBe('L-002');
  });

  it('FIXED: connection ID uses max existing ID to avoid duplicates after deletion', () => {
    // Start with 2 connections, delete L-001, then add — should get L-003 not L-002
    const prev: ProjectModel = {
      ...makeProject(),
      connections: [
        { id: 'L-001', kind: 'pipe', from: 'V-101.outlet', to: 'P-101.inlet', attrs: {} },
        { id: 'L-002', kind: 'pipe', from: 'P-101.outlet', to: 'V-101.inlet', attrs: {} },
      ],
    };
    // Delete L-001
    const afterDeleteFirst = { ...prev, connections: prev.connections.filter(c => c.id !== 'L-001') };
    // Fixed logic: find max numeric suffix among existing IDs
    let max = 0;
    for (const c of afterDeleteFirst.connections) {
      const match = c.id.match(/^L-(\d+)$/);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    }
    const newId = `L-${String(max + 1).padStart(3, '0')}`;
    expect(newId).toBe('L-003'); // Correctly avoids collision with existing L-002
    expect(afterDeleteFirst.connections.some(c => c.id === newId)).toBe(false);
  });
});

describe('deleteConnection mutation', () => {
  it('removes connection by ID', () => {
    const prev = makeProject();
    const next = { ...prev, connections: prev.connections.filter(c => c.id !== 'L-001') };
    expect(next.connections).toHaveLength(0);
  });
});

describe('updateConnection mutation', () => {
  it('updates connection kind', () => {
    const prev = makeProject();
    const next = {
      ...prev,
      connections: prev.connections.map(c => c.id === 'L-001' ? { ...c, kind: 'signal' as const } : c),
    };
    expect(next.connections[0].kind).toBe('signal');
  });
});
