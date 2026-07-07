import type { UnitType, Port } from './types';

/**
 * Attribute presets for common equipment types.
 * Each preset defines default attributes and ports for a given unit type.
 */

export type UnitPreset = {
  label: string;
  type: UnitType;
  customType?: string;
  attrs: Record<string, string>;
  ports: Record<string, Port>;
};

export const unitPresets: Record<string, UnitPreset> = {
  // Vessel presets
  'vessel-tank': {
    label: '储罐/Tank',
    type: 'vessel',
    attrs: { volume: '', material: '304SS', design_pressure: '', design_temperature: '' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 100 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 100 },
      vent: { kind: 'pipe', direction: 'output', side: 'top', DN: 25 },
      drain: { kind: 'pipe', direction: 'output', side: 'bottom', DN: 50 },
    },
  },
  'vessel-reactor': {
    label: '反应器/Reactor',
    type: 'vessel',
    attrs: { volume: '', material: '316L', design_pressure: '', design_temperature: '', agitator: '' },
    ports: {
      feed: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      product: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
      jacket_in: { kind: 'pipe', direction: 'input', side: 'top', DN: 50 },
      jacket_out: { kind: 'pipe', direction: 'output', side: 'bottom', DN: 50 },
    },
  },
  'vessel-column': {
    label: '塔/Column',
    type: 'vessel',
    attrs: { diameter: '', height: '', trays: '', material: '304SS' },
    ports: {
      feed: { kind: 'pipe', direction: 'input', side: 'left', DN: 150 },
      overhead: { kind: 'pipe', direction: 'output', side: 'top', DN: 200 },
      bottoms: { kind: 'pipe', direction: 'output', side: 'bottom', DN: 150 },
      reflux: { kind: 'pipe', direction: 'input', side: 'right', DN: 100 },
    },
  },

  // Pump presets
  'pump-centrifugal': {
    label: '离心泵/Centrifugal',
    type: 'pump',
    attrs: { flow_rate: '', head: '', power: '', material: 'CS', rpm: '' },
    ports: {
      suction: { kind: 'pipe', direction: 'input', side: 'left', DN: 100 },
      discharge: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
    },
  },
  'pump-positive': {
    label: '容积泵/Positive Disp.',
    type: 'pump',
    attrs: { flow_rate: '', pressure: '', power: '', material: '316SS' },
    ports: {
      suction: { kind: 'pipe', direction: 'input', side: 'left', DN: 50 },
      discharge: { kind: 'pipe', direction: 'output', side: 'right', DN: 50 },
    },
  },

  // Valve presets
  'valve-gate': {
    label: '闸阀/Gate Valve',
    type: 'valve',
    attrs: { valveType: 'GL', pressure_class: '150#', body_material: 'CS', leakage_class: 'Ⅱ' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
    },
  },
  'valve-globe': {
    label: '截止阀/截止阀门/Globe Valve',
    type: 'valve',
    attrs: { valveType: 'CL', pressure_class: '150#', body_material: '316SS', leakage_class: 'Ⅰ' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
    },
  },
  'valve-ball': {
    label: '球阀/Ball Valve',
    type: 'valve',
    attrs: { valveType: 'BL', pressure_class: '150#', body_material: '316SS' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
    },
  },
  'valve-butterfly': {
    label: '蝶阀/Butterfly Valve',
    type: 'valve',
    attrs: { valveType: 'BB', pressure_class: 'PN16', body_material: 'CS', actuator: 'manual' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
    },
  },
  'valve-check': {
    label: '止回阀/Check Valve',
    type: 'valve',
    attrs: { valveType: 'SR', body_material: 'CS', leakage_class: 'Ⅱ' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
    },
  },
  'valve-safety': {
    label: '安全阀/Safety Valve',
    type: 'valve',
    attrs: { valveType: 'SV', spring_range: '', set_pressure: '', body_material: '316SS' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      outlet: { kind: 'pipe', direction: 'output', side: 'top', DN: 50 },
    },
  },
  'valve-regulating': {
    label: '调节阀/Control Valve',
    type: 'valve',
    attrs: { valveType: 'CH', action: 'FC', control_mode: 'pneumatic', cv: '', signal: '4-20mA' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 50 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 50 },
      signal_in: { kind: 'signal', direction: 'input', side: 'top' },
    },
  },
  'valve-reducing': {
    label: '减压阀/PRV',
    type: 'valve',
    attrs: { valveType: 'PS', outlet_pressure: '', set_point: '', body_material: 'CS' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
    },
  },
  'valve-solenoid': {
    label: '电磁阀/Solenoid Valve',
    type: 'valve',
    attrs: { valveType: 'CHC', winding: '24V', air_control: '', response_time: '' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 25 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 25 },
      signal_in: { kind: 'signal', direction: 'input', side: 'top' },
    },
  },
  'valve-control': {
    label: '调节阀/Control Valve',
    type: 'valve',
    attrs: { valveType: 'CH', cv: '', action: 'FC', signal: '4-20mA' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 50 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 50 },
      signal_in: { kind: 'signal', direction: 'input', side: 'top' },
    },
  },

  // Instrument presets
  'instrument-flow': {
    label: '流量计/Flowmeter',
    type: 'instrument',
    attrs: { range: '', signal: '4-20mA', accuracy: '' },
    ports: {
      process_in: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      process_out: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
      signal_out: { kind: 'signal', direction: 'output', side: 'top' },
    },
  },
  'instrument-pressure': {
    label: '压力变送器/PT',
    type: 'instrument',
    attrs: { range: '', signal: '4-20mA' },
    ports: {
      process: { kind: 'pipe', direction: 'input', side: 'left', DN: 15 },
      signal_out: { kind: 'signal', direction: 'output', side: 'right' },
    },
  },
  'instrument-temperature': {
    label: '温度变送器/TT',
    type: 'instrument',
    attrs: { range: '', signal: '4-20mA', element: 'RTD' },
    ports: {
      process: { kind: 'pipe', direction: 'input', side: 'left', DN: 15 },
      signal_out: { kind: 'signal', direction: 'output', side: 'right' },
    },
  },
  'instrument-level': {
    label: '液位计/LT',
    type: 'instrument',
    attrs: { range: '', signal: '4-20mA' },
    ports: {
      upper: { kind: 'pipe', direction: 'input', side: 'top', DN: 25 },
      lower: { kind: 'pipe', direction: 'input', side: 'bottom', DN: 25 },
      signal_out: { kind: 'signal', direction: 'output', side: 'right' },
    },
  },

  // Heat exchanger (custom type)
  'custom-heatex': {
    label: '换热器/Heat Exchanger',
    type: 'custom',
    customType: '换热器',
    attrs: { area: '', material_tube: '304SS', material_shell: 'CS', design_pressure_tube: '', design_pressure_shell: '' },
    ports: {
      tube_in: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      tube_out: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
      shell_in: { kind: 'pipe', direction: 'input', side: 'top', DN: 100 },
      shell_out: { kind: 'pipe', direction: 'output', side: 'bottom', DN: 100 },
    },
  },
  'custom-dryer': {
    label: '干燥器/Dryer',
    type: 'custom',
    customType: '干燥器',
    attrs: { capacity: '', material: '304SS', design_pressure: '', design_temperature: '' },
    ports: {
      feed: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      product: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
      vent: { kind: 'pipe', direction: 'output', side: 'top', DN: 50 },
      drain: { kind: 'pipe', direction: 'output', side: 'bottom', DN: 25 },
    },
  },
  'custom-filter': {
    label: '过滤器/Filter',
    type: 'custom',
    customType: '过滤器',
    attrs: { filter_area: '', element: '', material: 'CS' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
      drain: { kind: 'pipe', direction: 'output', side: 'bottom', DN: 25 },
    },
  },
  'custom-centrifuge': {
    label: '离心机/Centrifuge',
    type: 'custom',
    customType: '离心机',
    attrs: { capacity: '', rpm: '', power: '', material: '304SS' },
    ports: {
      feed: { kind: 'pipe', direction: 'input', side: 'left', DN: 50 },
      liquid_out: { kind: 'pipe', direction: 'output', side: 'right', DN: 50 },
      solids_out: { kind: 'pipe', direction: 'output', side: 'bottom', DN: 100 },
    },
  },
  'custom-conveyor': {
    label: '输送机/Conveyor',
    type: 'custom',
    customType: '输送机',
    attrs: { capacity: '', length: '', power: '' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 100 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 100 },
    },
  },
  'custom-package': {
    label: '机组/Package Unit',
    type: 'custom',
    customType: '机组',
    attrs: { duty: '', power: '', package_no: '' },
    ports: {
      inlet: { kind: 'pipe', direction: 'input', side: 'left', DN: 80 },
      outlet: { kind: 'pipe', direction: 'output', side: 'right', DN: 80 },
      signal: { kind: 'signal', direction: 'bidirectional', side: 'top' },
    },
  },
  'custom-other': {
    label: '其他设备/Other Equipment',
    type: 'custom',
    customType: '其他设备',
    attrs: { description: '' },
    ports: {
      IN1: { kind: 'pipe', direction: 'input', side: 'left', DN: 50 },
      OUT1: { kind: 'pipe', direction: 'output', side: 'right', DN: 50 },
    },
  },
};

/** Get presets filtered by unit type */
export function getPresetsForType(type?: UnitType): [string, UnitPreset][] {
  if (!type) return Object.entries(unitPresets);
  return Object.entries(unitPresets).filter(([, p]) => p.type === type);
}
