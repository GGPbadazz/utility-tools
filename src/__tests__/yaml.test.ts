import { describe, it, expect } from 'vitest';
import { parseProjectYaml, projectToYaml } from '../parser/yaml';

// Inline YAML for testing (same structure as examples/project.logic.yaml)
const demoYaml = `
project:
  id: generic-process-demo
  name:
    zh: 通用工艺逻辑图示例
    en: Generic Process Logic Diagram Demo
  language: zh-CN
  version: 0.1.0

units:
  V-101:
    type: vessel
    label:
      zh: 酸液储罐
      en: Acid Storage Tank
    attrs:
      medium: H2SO4
      material: FRP
      volume: 5m3
    layout:
      x: 80
      y: 180
      width: 200
      height: 120
    ports:
      outlet:
        label:
          zh: 出口
          en: Outlet
        kind: pipe
        DN: 80
        side: right
      vent:
        label:
          zh: 放空口
          en: Vent
        kind: pipe
        DN: 25
        side: top

  P-101:
    type: pump
    label:
      zh: 酸液输送泵
      en: Acid Transfer Pump
    attrs:
      flow_rate: 10m3/h
      head: 25m
      material: SS316
    layout:
      x: 420
      y: 180
    ports:
      inlet:
        label:
          zh: 入口
          en: Inlet
        kind: pipe
        DN: 80
        side: left
      outlet:
        label:
          zh: 出口
          en: Outlet
        kind: pipe
        DN: 50
        side: right

connections:
  - id: L-001A
    kind: pipe
    from: V-101.outlet
    to: P-101.inlet
    label:
      zh: 酸液入口管线
      en: Acid Suction Line
    attrs:
      DN: 80
      medium: H2SO4
      material: UPVC

annotations:
  - id: T-001
    target: P-101
    text:
      zh: 备用泵接口需确认
      en: Standby pump interface TBD
    layout:
      x: 440
      y: 80
      width: 180
      height: 48
`;

describe('parseProjectYaml', () => {
  it('parses demo YAML without throwing', () => {
    expect(() => parseProjectYaml(demoYaml)).not.toThrow();
  });

  it('returns correct project metadata', () => {
    const model = parseProjectYaml(demoYaml);
    expect(model.project.id).toBe('generic-process-demo');
    expect(model.project.name?.zh).toBe('通用工艺逻辑图示例');
    expect(model.project.version).toBe('0.1.0');
  });

  it('parses units correctly', () => {
    const model = parseProjectYaml(demoYaml);
    expect(Object.keys(model.units)).toContain('V-101');
    expect(Object.keys(model.units)).toContain('P-101');
    expect(model.units['V-101'].type).toBe('vessel');
    expect(model.units['V-101'].label.zh).toBe('酸液储罐');
    expect(model.units['V-101'].ports?.outlet?.DN).toBe(80);
  });

  it('falls back to custom unit type for unknown types', () => {
    const raw = `
project:
  id: unknown-type
units:
  X-01:
    type: not-real-type
    label:
      zh: 自定义设备
      en: Custom Device
    ports: {}
connections: []
`;
    const model = parseProjectYaml(raw);
    expect(model.units['X-01'].type).toBe('custom');
    expect(model.units['X-01'].customType).toBe('YAML:not-real-type');
  });

  it('parses connections correctly', () => {
    const model = parseProjectYaml(demoYaml);
    expect(model.connections).toHaveLength(1);
    expect(model.connections[0].id).toBe('L-001A');
    expect(model.connections[0].from).toBe('V-101.outlet');
    expect(model.connections[0].to).toBe('P-101.inlet');
  });

  it('parses annotations correctly', () => {
    const model = parseProjectYaml(demoYaml);
    expect(model.annotations).toHaveLength(1);
    expect(model.annotations![0].id).toBe('T-001');
    expect(model.annotations![0].target).toBe('P-101');
  });
});

describe('projectToYaml', () => {
  it('serializes project model to YAML string', () => {
    const model = parseProjectYaml(demoYaml);
    const yamlStr = projectToYaml(model);
    expect(typeof yamlStr).toBe('string');
    expect(yamlStr).toContain('generic-process-demo');
    expect(yamlStr).toContain('V-101');
  });

  it('round-trip: parse → serialize → parse produces same model', () => {
    const model1 = parseProjectYaml(demoYaml);
    const yamlStr = projectToYaml(model1);
    const model2 = parseProjectYaml(yamlStr);
    expect(model2.project.id).toBe(model1.project.id);
    expect(Object.keys(model2.units)).toEqual(Object.keys(model1.units));
    expect(model2.connections.length).toBe(model1.connections.length);
    expect(model2.connections[0].from).toBe(model1.connections[0].from);
  });

  it('round-trip preserves raw lineLabel attrs', () => {
    const raw = `
project:
  id: generic-line-round
units: {}
connections:
  - id: L-001
    kind: pipe
    from: V-101.out
    to: P-101.in
    attrs:
      lineLabel: PG-V1101-01-50-M1B-H50
`;
    const parsed = parseProjectYaml(raw);
    const round = parseProjectYaml(projectToYaml(parsed));
    expect(round.connections[0].attrs?.lineLabel).toBe('PG-V1101-01-50-M1B-H50');
  });
});
