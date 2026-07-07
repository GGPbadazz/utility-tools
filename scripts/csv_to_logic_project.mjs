#!/usr/bin/env node
/**
 * Convert equipment/connection tables to project.logic.yaml.
 *
 * Usage:
 *   node scripts/csv_to_logic_project.mjs \
 *     --units /path/units.csv \
 *     --connections /path/connections.csv \
 *     --out /tmp/project.logic.yaml
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const args = process.argv.slice(2);
function nextArg(flag) {
  const idx = args.indexOf(flag);
  if (idx < 0 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}
const unitsCsv = nextArg('--units');
const connCsv = nextArg('--connections');
const portsCsv = nextArg('--ports');
const outPath = nextArg('--out') || path.join(process.cwd(), 'project.logic.yaml');

if (!unitsCsv || !connCsv) {
  console.error('Usage: node scripts/csv_to_logic_project.mjs --units units.csv --connections connections.csv [--ports ports.csv] [--out out.yaml]');
  process.exit(1);
}

const unitTypeMap = new Map([
  ['vessel', 'vessel'],
  ['pump', 'pump'],
  ['valve', 'valve'],
  ['instrument', 'instrument'],
  ['junction', 'junction'],
  ['custom', 'custom'],
  ['容器', 'vessel'],
  ['设备', 'vessel'],
  ['泵', 'pump'],
  ['隔离阀', 'valve'],
  ['截止阀', 'valve'],
  ['阀门', 'valve'],
  ['电磁阀', 'valve'],
  ['仪表', 'instrument'],
  ['测量', 'instrument'],
  ['信号', 'instrument'],
  ['junction', 'junction'],
  ['中间点', 'junction'],
  ['中间', 'junction'],
]);

const PORT_DIRECTIONS = { input: 'input', output: 'output', bidirectional: 'bidirectional' };

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  function commitField() {
    row.push(cell);
    cell = '';
  }

  function commitRow(force = false) {
    if (!force && row.length === 1 && row[0] === '') {
      row = [];
      return;
    }
    rows.push(row);
    row = [];
  }

  const textWithoutBom = text.replace(/^\uFEFF/, '');
  for (let i = 0; i <= textWithoutBom.length; i++) {
    const ch = textWithoutBom[i];
    if (i === textWithoutBom.length || (!inQuotes && (ch === '\n' || ch === '\r'))) {
      commitField();
      commitRow();
      if (ch === '\r' && textWithoutBom[i + 1] === '\n') i += 1;
      continue;
    }

    if (ch === '"') {
      if (inQuotes && textWithoutBom[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ',') {
      commitField();
      continue;
    }

    cell += ch;
  }

  if (textWithoutBom.endsWith('\n') && rows.length > 0 && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.length === 1 && row[0].trim() === '') continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (row[idx] ?? '').trim();
    });
    out.push(obj);
  }
  return out;
}

function normalizePortName(name, unitType, role) {
  if (name) return name;
  return role === 'from' ? 'OUT1' : 'IN1';
}

function parseAttrs(row) {
  const attrs = {};
  for (const [k, v] of Object.entries(row)) {
    if (!v) continue;
    if (k.startsWith('attr_')) {
      const key = k.replace(/^attr_/, '');
      const num = Number(v);
      attrs[key] = Number.isFinite(num) && String(num) === v ? num : v;
    }
  }
  return attrs;
}

function parseProject(rowsUnits, rowsConns, rowsPorts) {
  const units = {};
  const connections = [];

  for (const row of rowsUnits) {
    const id = row.id || row.ID || row.unit_id || row.unitId;
    if (!id) continue;

    let type = (row.type || row.unit_type || row.unitType || 'custom').trim().toLowerCase();
    if (unitTypeMap.has(type)) type = unitTypeMap.get(type) || type;

    const customType = row.customType || row.custom_type || row.customTypeCn || '';
    const unitLabelZh = row.label_zh || row.zh || row.label || id;
    const unitLabelEn = row.label_en || row.en || '';

    const layout = {
      x: Number(row.x || row.layout_x || 0) || 0,
      y: Number(row.y || row.layout_y || 0) || 0,
    };

    if (row.width) layout.width = Number(row.width);
    if (row.height) layout.height = Number(row.height);

    const rowAttrs = parseAttrs(row);

    units[id] = {
      id,
      type,
      ...(type === 'custom' && customType ? { customType } : {}),
      label: {
        zh: unitLabelZh || id,
        en: unitLabelEn || unitLabelZh || id,
      },
      attrs: Object.keys(rowAttrs).length ? rowAttrs : {},
      layout,
      ports: {},
    };
  }

  // optional explicit ports
  const explicitPorts = {};
  for (const row of rowsPorts) {
    const unitId = row.unit_id || row.unitId || row.unit || '';
    if (!unitId || !units[unitId]) continue;
    explicitPorts[unitId] = explicitPorts[unitId] || {};

    const portId = row.port_id || row.portId || row.port || '';
    if (!portId) continue;

    const kind = (row.kind || 'pipe').trim() || 'pipe';
    const side = (row.side || '').trim() || undefined;
    const direction = PORT_DIRECTIONS[row.direction] || 'bidirectional';
    const DN = Number(row.DN || row.dn || 0) || undefined;

    explicitPorts[unitId][portId] = {
      kind,
      direction,
      ...(side ? { side } : {}),
      ...(DN ? { DN } : {}),
      label: {
        zh: row.label_zh || row.portLabelZh || portId,
        en: row.label_en || row.portLabelEn || row.label_zh || row.portLabelZh || portId,
      },
    };
  }

  for (const [unitId, ports] of Object.entries(explicitPorts)) {
    if (Object.keys(ports).length) {
      units[unitId].ports = ports;
    }
  }

  const portCounters = new Map();
  const nextInput = new Map();
  const nextOutput = new Map();

  function nextPort(unitId, sidePrefix) {
    const key = `${unitId}:${sidePrefix}`;
    const map = sidePrefix === 'in' ? nextInput : nextOutput;
    const n = map.get(unitId) || 1;
    map.set(unitId, n + 1);
    return `${sidePrefix.toUpperCase()}${n}`;
  }

  for (const row of rowsConns) {
    const id = row.id || row.conn_id || row.line_id || row.ID;
    if (!id) continue;

    const kind = (row.kind || 'pipe').toLowerCase();
    const fromId = row.from_unit || row.fromUnit || '';
    const toId = row.to_unit || row.toUnit || '';
    if (!fromId || !toId) continue;
    if (!units[fromId] || !units[toId]) continue;

    let fromPort = row.from_port || row.fromPort || '';
    let toPort = row.to_port || row.toPort || '';

    if (!fromPort) {
      fromPort = normalizePortName('', units[fromId].type, 'from');
      if (units[fromId].ports?.[fromPort] && units[fromId].ports[fromPort].direction !== 'output') {
        fromPort = nextPort(fromId, 'OUT');
      }
      if (units[fromId].ports[fromPort]) {
        if (fromPort === 'OUT1' && units[fromId].ports['OUT2']) fromPort = 'OUT2';
      }
    }

    if (!toPort) {
      toPort = normalizePortName('', units[toId].type, 'to');
      if (units[toId].ports?.[toPort] && units[toId].ports[toPort].direction !== 'input') {
        toPort = nextPort(toId, 'IN');
      }
      if (units[toId].ports[toPort]) {
        if (toPort === 'IN1' && units[toId].ports['IN2']) toPort = 'IN2';
      }
    }

    const medium = row.medium || row.Medium || row.Med || '';
    const DN = Number(row.DN || row.dn || row.dn_mm || 0);
    const material = row.material || row.grade || row.materialCode || '';

    const attrs = {};
    const addAttr = (k, v) => {
      if (!v && v !== 0) return;
      const num = Number(v);
      attrs[k] = Number.isFinite(num) && String(num) === String(v) ? num : v;
    };
    addAttr('medium', medium);
    if (DN) addAttr('DN', DN);
    if (material) addAttr('material', material);
    if (row.insulationCode || row.insulation || row.heat) addAttr('insulation', row.insulationCode || row.insulation || row.heat);
    if (row.lineLabel) addAttr('lineLabel', row.lineLabel);

    // keep extra key-value fields
    for (const [k, v] of Object.entries(row)) {
      if (!v) continue;
      if ([
        'id', 'conn_id', 'line_id', 'kind',
        'from_unit', 'fromUnit',
        'to_unit', 'toUnit',
        'from_port', 'fromPort',
        'to_port', 'toPort',
        'lineLabel', 'line_label', 'pipeLabel',
        'medium', 'DN', 'material',
        'insulation', 'insulationCode', 'heat',
        'label_zh', 'label_en', 'label',
      ].includes(k)) {
        continue;
      }
      attrs[k] = attrs[k] ?? (Number(v).toString() === v ? Number(v) : v);
    }

    const conn = {
      id,
      kind,
      from: `${fromId}.${fromPort}`,
      to: `${toId}.${toPort}`,
      attrs: Object.keys(attrs).length ? attrs : {},
      label: {
        zh: row.label_zh || row.label || `连接 ${id}`,
        en: row.label_en || row.label || `Conn ${id}`,
      },
    };

        // keep pipe line tag as structured field only when needed
    if (row.pipeLabel || row.line_label || row.lineLabel) {
      conn.attrs.lineLabel = row.pipeLabel || row.line_label || row.lineLabel;
    }

    connections.push(conn);
  }

  // fill missing ports only for units without explicit ports
  for (const [unitId, unit] of Object.entries(units)) {
    if (unit.ports && Object.keys(unit.ports).length) continue;

    const uses = Array.from(connections).flatMap((c) => [
      { unit: c.from.split('.')[0], port: c.from.split('.')[1] },
      { unit: c.to.split('.')[0], port: c.to.split('.')[1] },
    ]);

    const usedPorts = new Set();
    for (const u of uses) {
      if (u.unit === unitId && u.port) usedPorts.add(u.port);
    }

    if (usedPorts.size === 0) {
      unit.ports = {
        IN1: { kind: 'pipe', direction: 'input', side: 'left', DN: 50, label: { zh: '进口', en: 'IN' } },
        OUT1: { kind: 'pipe', direction: 'output', side: 'right', DN: 50, label: { zh: '出口', en: 'OUT' } },
      };
    } else {
      const autoPorts = {};
      for (const p of usedPorts) {
        autoPorts[p] = {
          kind: 'pipe',
          direction: p.toUpperCase().startsWith('IN') ? 'input' : p.toUpperCase().startsWith('OUT') ? 'output' : 'bidirectional',
          side: p.toUpperCase().startsWith('IN') ? 'left' : p.toUpperCase().startsWith('OUT') ? 'right' : 'left',
          DN: 50,
          label: { zh: p, en: p },
        };
      }
      unit.ports = autoPorts;
    }
  }

  return {
    project: {
      id: 'auto-generated',
      name: { zh: '语音/表格生成图', en: 'Generated Logic Diagram' },
      language: 'zh-CN',
      version: '0.1.0',
    },
    units: Object.fromEntries(Object.entries(units).map(([id, unit]) => [id, {
      type: unit.type,
      ...(unit.customType ? { customType: unit.customType } : {}),
      label: unit.label,
      attrs: Object.keys(unit.attrs).length ? unit.attrs : undefined,
      layout: unit.layout,
      ports: unit.ports,
    }])),
    connections,
    annotations: [],
  };
}

function readCsvSafe(file) {
  if (!file) return [];
  if (!fs.existsSync(file)) {
    console.error(`文件不存在: ${file}`);
    process.exit(1);
  }
  return parseCsv(fs.readFileSync(file, 'utf8'));
}

const rowsUnits = readCsvSafe(unitsCsv);
const rowsConns = readCsvSafe(connCsv);
const rowsPorts = readCsvSafe(portsCsv);

if (!rowsUnits.length || !rowsConns.length) {
  console.error('units 或 connections 为空，无法继续。');
  process.exit(1);
}

const project = parseProject(rowsUnits, rowsConns, rowsPorts);
const out = YAML.stringify(project);
fs.writeFileSync(outPath, out, 'utf8');
console.log(`已生成: ${outPath}`);
