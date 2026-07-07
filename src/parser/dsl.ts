/**
 * DSL Shorthand Parser
 * 
 * Supports quick text-based connection definitions:
 *   PIPE L-001 DN80 medium=水: V-101.outlet -> P-101.inlet
 *   SIGNAL S-001: AI-201.out -> XV-101.cmd
 *   CABLE C-001: MCC.port1 -> P-101.power
 * 
 * Grammar:
 *   <KIND> <ID> [DN<number>] [line=PG-.../..] [key=value ...]: <unit.port> -> <unit.port>
 */
import type { Connection, ConnectionKind } from '../domain/types';
import { formatPipeLabel, parsePipeLabel } from '../domain/piping';
import type { PipeLabel } from '../domain/piping';

export type DslParseResult = {
  connections: Connection[];
  errors: { line: number; message: string }[];
};

const LINE_REGEX = /^(PIPE|SIGNAL|CABLE)\s+(\S+)(?:\s+DN(\d+))?(.*):\s*(\S+)\s*->\s*(\S+)\s*$/;
const ATTR_REGEX = /(\w+)=(\S+)/g;

export function parseDsl(text: string): DslParseResult {
  const connections: Connection[] = [];
  const errors: { line: number; message: string }[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    const match = line.match(LINE_REGEX);
    if (!match) {
      errors.push({ line: i + 1, message: `语法错误: "${line}"` });
      continue;
    }

    const [, kindStr, id, dnStr, attrsStr, from, to] = match;
    const kind = kindStr.toLowerCase() as ConnectionKind;

    // Parse inline attributes
    const attrs: Record<string, unknown> = {};
    let medium: string | undefined;
    let pipeLabel: PipeLabel | undefined;
    if (dnStr) attrs.DN = parseInt(dnStr, 10);

    if (attrsStr) {
      let attrMatch: RegExpExecArray | null;
      ATTR_REGEX.lastIndex = 0;
      while ((attrMatch = ATTR_REGEX.exec(attrsStr)) !== null) {
        const [, key, value] = attrMatch;
        if (key === 'medium') {
          medium = value;
        } else if (key === 'line') {
          pipeLabel = parsePipeLabel(value) ?? undefined;
          if (!pipeLabel) {
            errors.push({ line: i + 1, message: `line 格式错误: "${value}"` });
          }
          attrs.lineLabel = value;
        } else {
          attrs[key] = isNaN(Number(value)) ? value : Number(value);
        }
      }
    }

    // Validate from/to format
    if (!from.includes('.') || !to.includes('.')) {
      errors.push({ line: i + 1, message: `端口格式错误，应为 unit.port: "${from} -> ${to}"` });
      continue;
    }

    if (pipeLabel && typeof attrs.DN === 'undefined') {
      (attrs.DN = pipeLabel.diameter);
    }
    if (pipeLabel && attrs.material === undefined) {
      (attrs.material = pipeLabel.pressureCode);
    }
    if (pipeLabel && !medium) {
      medium = pipeLabel.mediumCode;
    }

    if (medium) attrs.medium = medium;
    if (pipeLabel && typeof attrs.insulation === 'undefined') {
      attrs.insulation = pipeLabel.insulationCode;
    }

    const conn: Connection = {
      id,
      kind,
      from,
      to,
      pipeLabel,
      attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
    };
    if (medium) (conn as { medium?: string }).medium = medium;

    connections.push(conn);
  }

  return { connections, errors };
}

/**
 * Serialize connections to DSL shorthand format
 */
export function connectionsToDsl(connections: Connection[]): string {
  return connections.map((conn) => {
    const kind = conn.kind.toUpperCase();
    const parts = [kind, conn.id];

    const dn = conn.attrs?.DN;
    if (dn) parts.push(`DN${dn}`);

    const medium = (conn as { medium?: string }).medium;
    if (medium) parts.push(`medium=${medium}`);
    if (conn.pipeLabel) {
      parts.push(`line=${formatPipeLabel(conn.pipeLabel)}`);
    } else if (conn.attrs?.lineLabel) {
      parts.push(`line=${conn.attrs.lineLabel}`);
    }

    // Other attrs
    if (conn.attrs) {
      for (const [k, v] of Object.entries(conn.attrs)) {
        if (k === 'DN' || k === 'lineLabel' || k === 'line') continue;
        parts.push(`${k}=${v}`);
      }
    }

    return `${parts.join(' ')}: ${conn.from} -> ${conn.to}`;
  }).join('\n');
}
