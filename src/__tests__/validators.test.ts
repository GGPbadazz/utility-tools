import { describe, it, expect } from 'vitest';
import { validateProject } from '../domain/validators';
import type { ProjectModel } from '../domain/types';

function makeProject(overrides?: Partial<ProjectModel>): ProjectModel {
  return {
    project: { id: 'test' },
    units: {
      'V-101': {
        type: 'vessel',
        label: { zh: '储罐', en: 'Tank' },
        ports: { inlet: { kind: 'pipe', DN: 50, side: 'left' }, outlet: { kind: 'pipe', DN: 50, side: 'right' } },
      },
      'P-101': {
        type: 'pump',
        label: { zh: '泵', en: 'Pump' },
        ports: { inlet: { kind: 'pipe', DN: 50, side: 'left' }, outlet: { kind: 'pipe', DN: 50, side: 'right' } },
      },
    },
      connections: [
      { id: 'L-001', kind: 'pipe', from: 'V-101.outlet', to: 'P-101.inlet', label: { zh: '管线1' }, attrs: { DN: 50, medium: 'PG', material: 'M1E', insulation: 'H' } },
    ],
    ...overrides,
  };
}

describe('validateProject', () => {
  it('returns no errors for valid project', () => {
    const issues = validateProject(makeProject());
    const errors = issues.filter(i => i.level === 'error');
    expect(errors).toHaveLength(0);
  });

  it('detects duplicate connection IDs', () => {
    const project = makeProject({
      connections: [
        { id: 'L-001', kind: 'pipe', from: 'V-101.outlet', to: 'P-101.inlet', attrs: {} },
        { id: 'L-001', kind: 'pipe', from: 'P-101.outlet', to: 'V-101.inlet', attrs: {} },
      ],
    });
    const issues = validateProject(project);
    expect(issues.some(i => i.level === 'error' && i.message.includes('ID 重复'))).toBe(true);
  });

  it('detects reference to non-existent unit', () => {
    const project = makeProject({
      connections: [
        { id: 'L-001', kind: 'pipe', from: 'MISSING.outlet', to: 'P-101.inlet', attrs: {} },
      ],
    });
    const issues = validateProject(project);
    expect(issues.some(i => i.level === 'error' && i.message.includes('不存在的设备'))).toBe(true);
  });

  it('detects reference to non-existent port', () => {
    const project = makeProject({
      connections: [
        { id: 'L-001', kind: 'pipe', from: 'V-101.nonexistent', to: 'P-101.inlet', attrs: {} },
      ],
    });
    const issues = validateProject(project);
    expect(issues.some(i => i.level === 'error' && i.message.includes('不存在的端口'))).toBe(true);
  });

  it('detects invalid from format', () => {
    const project = makeProject({
      connections: [
        { id: 'L-001', kind: 'pipe', from: 'badformat', to: 'P-101.inlet', attrs: {} },
      ],
    });
    const issues = validateProject(project);
    expect(issues.some(i => i.level === 'error' && i.message.includes('格式无效'))).toBe(true);
  });

  it('detects annotation with invalid target', () => {
    const project = makeProject();
    project.annotations = [
      { id: 'T-001', target: 'MISSING-UNIT', text: { zh: '注释' }, layout: { x: 0, y: 0 } },
    ];
    const issues = validateProject(project);
    expect(issues.some(i => i.level === 'error' && i.message.includes('target 不存在'))).toBe(true);
  });

  it('warns about missing labels on units', () => {
    const project = makeProject({
      units: {
        'V-101': { type: 'vessel', label: {}, ports: {} },
      },
      connections: [],
    });
    const issues = validateProject(project);
    expect(issues.some(i => i.level === 'warning' && i.message.includes('缺少中文名称'))).toBe(true);
    expect(issues.some(i => i.level === 'warning' && i.message.includes('缺少英文名称'))).toBe(true);
  });

  it('warns about pipe missing DN', () => {
    const project = makeProject({
      connections: [
        { id: 'L-001', kind: 'pipe', from: 'V-101.outlet', to: 'P-101.inlet', label: { zh: '管线' }, attrs: { medium: 'water' } },
      ],
    });
    const issues = validateProject(project);
    expect(issues.some(i => i.level === 'warning' && i.message.includes('缺少 DN'))).toBe(true);
  });

  it('warns about pipe missing medium', () => {
    const project = makeProject({
      connections: [
        { id: 'L-001', kind: 'pipe', from: 'V-101.outlet', to: 'P-101.inlet', label: { zh: '管线' }, attrs: { DN: 50 } },
      ],
    });
    const issues = validateProject(project);
    expect(issues.some(i => i.level === 'warning' && i.message.includes('缺少介质'))).toBe(true);
  });

  it('warns about connection missing labels', () => {
    const project = makeProject({
      connections: [
        { id: 'L-001', kind: 'pipe', from: 'V-101.outlet', to: 'P-101.inlet', attrs: { DN: 50, medium: 'acid' } },
      ],
    });
    const issues = validateProject(project);
    expect(issues.some(i => i.level === 'warning' && i.message.includes('缺少标签'))).toBe(true);
  });

  it('warns pipe label mismatch when attrs inconsistent', () => {
    const project = makeProject({
      connections: [
        {
          id: 'L-001',
          kind: 'pipe',
          from: 'V-101.outlet',
          to: 'P-101.inlet',
          attrs: {
            DN: 80,
            medium: 'PG',
            material: 'M1B',
            insulation: 'C',
            lineLabel: 'PG-V1101-01-50-M1B-H50',
          },
        },
      ],
    });
    const issues = validateProject(project);
    expect(issues.some(i => i.level === 'warning' && i.message.includes('DN 与管线编号不一致'))).toBe(true);
  });

});
