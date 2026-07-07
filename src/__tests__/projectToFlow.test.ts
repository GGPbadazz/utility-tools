import { describe, it, expect } from 'vitest';
import type { ProjectModel, DisplayMode } from '../domain/types';
import { getLabel } from '../domain/labels';

// Re-implement projectToFlow logic for testing (extracted from App.tsx)
function projectToFlow(project: ProjectModel, mode: DisplayMode) {
  const nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: unknown }> = [];
  const edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string }> = [];

  for (const [id, unit] of Object.entries(project.units)) {
    nodes.push({
      id,
      type: 'unit',
      position: { x: unit.layout?.x || 0, y: unit.layout?.y || 0 },
      data: { unitId: id, unit, displayMode: mode },
    });
  }

  for (const conn of project.connections) {
    const [sourceUnit, sourcePort] = conn.from.split('.');
    const [targetUnit, targetPort] = conn.to.split('.');
    edges.push({
      id: conn.id,
      source: sourceUnit,
      sourceHandle: sourcePort,
      target: targetUnit,
      targetHandle: targetPort,
      label: getLabel(conn.label, conn.id, mode),
    });
  }

  if (project.annotations) {
    for (const ann of project.annotations) {
      nodes.push({
        id: `ann-${ann.id}`,
        type: 'annotation',
        position: { x: ann.layout.x, y: ann.layout.y },
        data: { annotation: ann, displayMode: mode },
      });
    }
  }

  return { nodes, edges };
}

const testProject: ProjectModel = {
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
    { id: 'L-001', kind: 'pipe', from: 'V-101.outlet', to: 'P-101.inlet', label: { zh: '管线A', en: 'Line A' }, attrs: {} },
  ],
  annotations: [
    { id: 'T-001', target: 'V-101', text: { zh: '注释', en: 'Note' }, layout: { x: 50, y: 50 } },
  ],
};

describe('projectToFlow', () => {
  it('creates nodes for each unit', () => {
    const { nodes } = projectToFlow(testProject, 'zh');
    const unitNodes = nodes.filter(n => n.type === 'unit');
    expect(unitNodes).toHaveLength(2);
    expect(unitNodes.map(n => n.id).sort()).toEqual(['P-101', 'V-101']);
  });

  it('uses unit layout for node position', () => {
    const { nodes } = projectToFlow(testProject, 'zh');
    const v101 = nodes.find(n => n.id === 'V-101')!;
    expect(v101.position).toEqual({ x: 100, y: 200 });
  });

  it('defaults position to 0,0 when no layout', () => {
    const projectNoLayout: ProjectModel = {
      ...testProject,
      units: {
        'V-101': { type: 'vessel', label: { zh: '储罐' }, ports: {} },
      },
      connections: [],
      annotations: [],
    };
    const { nodes } = projectToFlow(projectNoLayout, 'zh');
    expect(nodes[0].position).toEqual({ x: 0, y: 0 });
  });

  it('creates edges for each connection', () => {
    const { edges } = projectToFlow(testProject, 'zh');
    expect(edges).toHaveLength(1);
    expect(edges[0].id).toBe('L-001');
    expect(edges[0].source).toBe('V-101');
    expect(edges[0].sourceHandle).toBe('outlet');
    expect(edges[0].target).toBe('P-101');
    expect(edges[0].targetHandle).toBe('inlet');
  });

  it('uses label in correct display mode for edges', () => {
    const { edges: zhEdges } = projectToFlow(testProject, 'zh');
    expect(zhEdges[0].label).toBe('管线A');

    const { edges: enEdges } = projectToFlow(testProject, 'en');
    expect(enEdges[0].label).toBe('Line A');
  });

  it('creates annotation nodes with ann- prefix', () => {
    const { nodes } = projectToFlow(testProject, 'zh');
    const annNodes = nodes.filter(n => n.type === 'annotation');
    expect(annNodes).toHaveLength(1);
    expect(annNodes[0].id).toBe('ann-T-001');
    expect(annNodes[0].position).toEqual({ x: 50, y: 50 });
  });

  it('handles project with no annotations', () => {
    const noAnn: ProjectModel = { ...testProject, annotations: undefined };
    const { nodes } = projectToFlow(noAnn, 'zh');
    const annNodes = nodes.filter(n => n.type === 'annotation');
    expect(annNodes).toHaveLength(0);
  });
});
