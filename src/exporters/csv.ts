import type { ProjectModel } from '../domain/types';
import type { PipeLabel } from '../domain/piping';
import { formatPipeLabel } from '../domain/piping';

/**
 * Export project data as CSV files (equipment, connections, ports).
 * Returns a zip-like structure or triggers individual downloads.
 */

function escapeCsv(value: string | undefined | null): string {
  if (value == null) return '';
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function arrayToCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsv).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCsv).join(','));
  }
  return lines.join('\n');
}

function toStringValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
}

export function exportEquipmentCsv(project: ProjectModel): string {
  const headers = ['ID', '类型/Type', '自定义类型/CustomType', '中文名/CN', '英文名/EN', '属性/Attrs'];
  const rows: string[][] = [];

  for (const [id, unit] of Object.entries(project.units)) {
    rows.push([
      id,
      unit.type,
      unit.customType || '',
      toStringValue(unit.label?.zh),
      toStringValue(unit.label?.en),
      unit.attrs ? JSON.stringify(unit.attrs) : '',
    ]);
  }

  return arrayToCsv(headers, rows);
}

export function exportConnectionsCsv(project: ProjectModel): string {
  const headers = ['ID', '类型/Kind', '从/From', '到/To', '介质/Medium', 'DN', '管道等级/Grade', '隔热/Insulation', '管线编号/LineLabel', '中文名/CN', '英文名/EN', '属性/Attrs'];
  const rows: string[][] = [];

  for (const conn of project.connections) {
    const dn = conn.attrs?.DN ?? conn.attrs?.dn ?? '';
    const material = conn.attrs?.material ?? '';
    const medium = conn.medium || conn.attrs?.medium || '';
    const insulation = conn.attrs?.insulation || '';
    const lineLabel = conn.pipeLabel
      ? formatPipeLabelForCsv(conn.pipeLabel)
      : typeof conn.attrs?.lineLabel === 'string'
        ? conn.attrs.lineLabel
        : '';
    const otherAttrs = { ...(conn.attrs || {}) };
    delete otherAttrs.DN;
    delete otherAttrs.dn;
    delete otherAttrs.material;
    delete otherAttrs.insulation;
    delete otherAttrs.medium;

    rows.push([
      conn.id,
      conn.kind,
      conn.from,
      conn.to,
      String(medium),
      toStringValue(dn),
      toStringValue(material),
      toStringValue(insulation),
      toStringValue(lineLabel),
      conn.label?.zh || '',
      conn.label?.en || '',
      Object.keys(otherAttrs).length > 0 ? JSON.stringify(otherAttrs) : '',
    ]);
  }

  return arrayToCsv(headers, rows);
}

export function exportPortsCsv(project: ProjectModel): string {
  const headers = ['设备ID/UnitID', '端口ID/PortID', '端口UID/PortUID', '类型/Kind', '方向/Direction', '位置/Side', 'DN', '中文名/CN', '英文名/EN'];
  const rows: string[][] = [];

  for (const [unitId, unit] of Object.entries(project.units)) {
    if (unit.ports) {
      for (const [portId, port] of Object.entries(unit.ports)) {
        rows.push([
          unitId,
          portId,
          port.uid || '',
          port.kind,
          port.direction || 'bidirectional',
          port.side || '',
          port.DN ? String(port.DN) : '',
          port.label?.zh || '',
          port.label?.en || '',
        ]);
      }
    }
  }

  return arrayToCsv(headers, rows);
}

function formatPipeLabelForCsv(pipeLabel: PipeLabel): string {
  return formatPipeLabel(pipeLabel);
}

/** Download a string as a file */
function downloadFile(content: string, filename: string, mimeType = 'text/csv;charset=utf-8;') {
  const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([bom + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Export all CSV files (triggers 3 downloads) */
export function exportAllCsv(project: ProjectModel) {
  const projectId = project.project.id || 'project';
  downloadFile(exportEquipmentCsv(project), `${projectId}_equipment.csv`);
  setTimeout(() => {
    downloadFile(exportConnectionsCsv(project), `${projectId}_connections.csv`);
  }, 100);
  setTimeout(() => {
    downloadFile(exportPortsCsv(project), `${projectId}_ports.csv`);
  }, 200);
}
