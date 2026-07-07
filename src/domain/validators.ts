import type { ProjectModel, ValidationIssue } from './types';
import { insulationCodes, materialCodes, pipeMaterialSpecs, valveTypeCodes } from './engineeringCodes';
import { parsePipeLabel, type PipeLabel } from './piping';

type CodeDefinition = { code: string };

function normalizeCode(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toUpperCase();
}

function splitCode(value: string): { prefix: string; index: number; suffix: string } | null {
  const matched = value.match(/^([A-Z]+)(\d+)([A-Z]*)$/);
  if (!matched) return null;
  return {
    prefix: matched[1],
    index: Number(matched[2]),
    suffix: matched[3],
  };
}

function isCodeRangeMatch(value: string, rangeCode: string): boolean {
  const m = rangeCode.match(/^([A-Z]+)(\d+)([A-Z]*)~([A-Z]+)(\d+)([A-Z]*)$/);
  if (!m) return false;

  const parsed = splitCode(value);
  if (!parsed) return false;

  const prefixStart = m[1];
  const start = Number(m[2]);
  const suffixStart = m[3];
  const prefixEnd = m[4];
  const end = Number(m[5]);
  const suffixEnd = m[6];

  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  if (prefixStart !== prefixEnd || suffixStart !== suffixEnd) return false;
  if (parsed.prefix !== prefixStart || parsed.suffix !== suffixStart) return false;

  return parsed.index >= start && parsed.index <= end;
}

function isCodeValid(code: string, defs: CodeDefinition[]): boolean {
  const normalized = normalizeCode(code);
  if (!normalized) return false;

  if (defs.some((item) => item.code === normalized)) {
    return true;
  }

  return defs.some((d) => d.code.includes('~') && isCodeRangeMatch(normalized, d.code));
}

type JacketLabelData = {
  jacketTypeCode: string;
  jacketMediumCode: string;
  jacketHeatCode: string;
  jacketDiameter: unknown;
  jacketPressureCode: string;
  jacketInsulationCode: string;
};

function isValidPipeLabel(value: unknown): value is PipeLabel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PipeLabel>;
  if (candidate.kind !== 'standard' && candidate.kind !== 'jacketed') return false;
  if (!normalizeCode(candidate.mediumCode)) return false;
  if (!candidate.equipmentTag || !candidate.sequenceNo || !Number.isFinite(Number(candidate.diameter))) return false;
  if (Number(candidate.diameter) <= 0) return false;
  if (!normalizeCode(candidate.pressureCode) || !normalizeCode(candidate.insulationCode)) return false;

  if (candidate.kind === 'standard') {
    return true;
  }

  const jacket = (candidate as { jacket?: JacketLabelData }).jacket;
  if (!jacket) return false;
  const jacketDiameter = Number(jacket.jacketDiameter);
  return !!(
    normalizeCode(jacket.jacketTypeCode) &&
    normalizeCode(jacket.jacketMediumCode) &&
    normalizeCode(jacket.jacketHeatCode) &&
    Number.isFinite(jacketDiameter) &&
    jacketDiameter > 0 &&
    normalizeCode(jacket.jacketPressureCode) &&
    normalizeCode(jacket.jacketInsulationCode)
  );
}

/**
 * Validate a ProjectModel and return a list of issues (errors and warnings).
 */
export function validateProject(project: ProjectModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const portUidSet = new Set<string>();

  // --- Hard checks (errors) ---

  // 1. Unit ID uniqueness is guaranteed by Record<string, Unit>, skip.

  // 2. Connection ID uniqueness
  const connIds = new Set<string>();
  for (const conn of project.connections) {
    if (connIds.has(conn.id)) {
      issues.push({ level: 'error', message: `连接 ID 重复: ${conn.id}`, path: `connections.${conn.id}` });
    }
    connIds.add(conn.id);
  }

  // 3. Connection from/to reference existing units and ports
  for (const conn of project.connections) {
    const fromParts = conn.from.split('.');
    const toParts = conn.to.split('.');

    if (fromParts.length !== 2) {
      issues.push({ level: 'error', message: `连接 ${conn.id} 的 from 格式无效: ${conn.from}`, path: `connections.${conn.id}.from` });
    } else {
      const [unitId, portId] = fromParts;
      if (!project.units[unitId]) {
        issues.push({ level: 'error', message: `连接 ${conn.id} 引用了不存在的设备: ${unitId}`, path: `connections.${conn.id}.from` });
      } else if (!project.units[unitId].ports?.[portId]) {
        issues.push({ level: 'error', message: `连接 ${conn.id} 引用了不存在的端口: ${conn.from}`, path: `connections.${conn.id}.from` });
      }
    }

    if (toParts.length !== 2) {
      issues.push({ level: 'error', message: `连接 ${conn.id} 的 to 格式无效: ${conn.to}`, path: `connections.${conn.id}.to` });
    } else {
      const [unitId, portId] = toParts;
      if (!project.units[unitId]) {
        issues.push({ level: 'error', message: `连接 ${conn.id} 引用了不存在的设备: ${unitId}`, path: `connections.${conn.id}.to` });
      } else if (!project.units[unitId].ports?.[portId]) {
        issues.push({ level: 'error', message: `连接 ${conn.id} 引用了不存在的端口: ${conn.to}`, path: `connections.${conn.id}.to` });
      }
    }
  }

  // 4. Annotation target must exist (if annotations present)
  if (project.annotations) {
    for (const ann of project.annotations) {
      if (ann.target) {
        const targetParts = ann.target.split('.');
        const unitId = targetParts[0];
        if (!project.units[unitId] && !project.connections.find((c) => c.id === ann.target)) {
          issues.push({ level: 'error', message: `注释 ${ann.id} 的 target 不存在: ${ann.target}`, path: `annotations.${ann.id}` });
        }
      }
    }
  }

  // --- Soft checks (warnings) ---

  // 5. Units missing labels and invalid engineering code
  for (const [id, unit] of Object.entries(project.units)) {
    if (!unit.label?.zh) {
      issues.push({ level: 'warning', message: `设备 ${id} 缺少中文名称`, path: `units.${id}.label.zh` });
    }
    if (!unit.label?.en) {
      issues.push({ level: 'warning', message: `设备 ${id} 缺少英文名称`, path: `units.${id}.label.en` });
    }
    if (unit.type === 'valve') {
      const valveType = normalizeCode(unit.attrs?.valveType);
      if (valveType && !isCodeValid(valveType, valveTypeCodes)) {
        issues.push({
          level: 'warning',
          message: `阀门 ${id} 阀门类型不在标准字典中: ${valveType}`,
          path: `units.${id}.attrs.valveType`,
        });
      }
    }
    if (unit.ports) {
      for (const [portId, port] of Object.entries(unit.ports)) {
        const uid = typeof port.uid === 'string' ? port.uid.trim() : '';
        if (!uid) {
          issues.push({
            level: 'warning',
            message: `设备 ${id} 端口 ${portId} 未配置 UID`,
            path: `units.${id}.ports.${portId}.uid`,
          });
          continue;
        }
        if (portUidSet.has(uid)) {
          issues.push({
            level: 'warning',
            message: `端口 UID 重复: ${uid}（重复于其他端口）`,
            path: `units.${id}.ports.${portId}.uid`,
          });
          continue;
        }
        portUidSet.add(uid);
      }
    }
  }

  // 6. Pipe connections
  for (const conn of project.connections) {
    if (conn.kind === 'pipe') {
      const medium = normalizeCode(conn.medium ?? conn.attrs?.medium);
      if (!medium) {
        issues.push({ level: 'warning', message: `管线 ${conn.id} 缺少介质(medium)属性`, path: `connections.${conn.id}.medium` });
      } else if (!isCodeValid(medium, materialCodes)) {
        issues.push({ level: 'warning', message: `管线 ${conn.id} 介质不在标准字典中: ${medium}`, path: `connections.${conn.id}.medium` });
      }

      const dn = Number(conn.attrs?.DN ?? conn.attrs?.dn);
      if (!Number.isFinite(dn) || dn <= 0) {
        issues.push({ level: 'warning', message: `管线 ${conn.id} 缺少 DN 属性`, path: `connections.${conn.id}.attrs.DN` });
      }

      const material = normalizeCode(conn.attrs?.material);
      if (!material) {
        issues.push({ level: 'warning', message: `管线 ${conn.id} 缺少管道等级(material)属性`, path: `connections.${conn.id}.attrs.material` });
      } else if (!isCodeValid(material, pipeMaterialSpecs)) {
        issues.push({ level: 'warning', message: `管线 ${conn.id} 管道等级不在标准字典中: ${material}`, path: `connections.${conn.id}.attrs.material` });
      }

      const insulation = normalizeCode(conn.attrs?.insulation);
      if (!insulation) {
        issues.push({ level: 'warning', message: `管线 ${conn.id} 缺少隔热(insulation)属性`, path: `connections.${conn.id}.attrs.insulation` });
      } else if (!isCodeValid(insulation, insulationCodes)) {
        issues.push({ level: 'warning', message: `管线 ${conn.id} 隔热/伴热不在标准字典中: ${insulation}`, path: `connections.${conn.id}.attrs.insulation` });
      }

      let labelForConsistency: PipeLabel | null = null;

      if (conn.attrs?.lineLabel && typeof conn.attrs.lineLabel === 'string' && !conn.pipeLabel) {
        const lineText = conn.attrs.lineLabel.trim();
        const parsedLineLabel = parsePipeLabel(lineText);
        if (lineText && !parsedLineLabel) {
          issues.push({ level: 'warning', message: `管线 ${conn.id} 管线编号格式不规范: ${lineText}`, path: `connections.${conn.id}.attrs.lineLabel` });
        } else if (parsedLineLabel) {
          labelForConsistency = parsedLineLabel;
        }
      }

      if (conn.pipeLabel) {
        if (!isValidPipeLabel(conn.pipeLabel)) {
          issues.push({ level: 'warning', message: `管线 ${conn.id} 的 pipeLabel 字段格式异常`, path: `connections.${conn.id}.pipeLabel` });
        } else {
          labelForConsistency = conn.pipeLabel;
        }
      }

      if (labelForConsistency) {
        if (dn && labelForConsistency.diameter !== dn) {
          issues.push({ level: 'warning', message: `管线 ${conn.id} DN 与管线编号不一致`, path: `connections.${conn.id}.attrs.DN` });
        }
        if (medium && labelForConsistency.mediumCode !== medium) {
          issues.push({ level: 'warning', message: `管线 ${conn.id} 介质与管线编号不一致`, path: `connections.${conn.id}.medium` });
        }
        if (material && labelForConsistency.pressureCode !== material) {
          issues.push({ level: 'warning', message: `管线 ${conn.id} 管道等级与管线编号不一致`, path: `connections.${conn.id}.attrs.material` });
        }
        if (insulation && labelForConsistency.insulationCode !== insulation) {
          issues.push({ level: 'warning', message: `管线 ${conn.id} 隔热与管线编号不一致`, path: `connections.${conn.id}.attrs.insulation` });
        }
      }
    }

    if (conn.kind === 'signal' && !conn.attrs?.signal_type) {
      issues.push({ level: 'warning', message: `信号连接 ${conn.id} 缺少 signal_type 属性`, path: `connections.${conn.id}.attrs.signal_type` });
    }
    if (conn.kind === 'cable' && !conn.attrs?.cable_type) {
      issues.push({ level: 'warning', message: `电缆连接 ${conn.id} 缺少 cable_type 属性`, path: `connections.${conn.id}.attrs.cable_type` });
    }
  }

  // 7. Port DN compatibility check — warn if connected ports have mismatched DN
  for (const conn of project.connections) {
    const fromParts = conn.from.split('.');
    const toParts = conn.to.split('.');
    if (fromParts.length === 2 && toParts.length === 2) {
      const fromUnit = project.units[fromParts[0]];
      const toUnit = project.units[toParts[0]];
      const fromPort = fromUnit?.ports?.[fromParts[1]];
      const toPort = toUnit?.ports?.[toParts[1]];
      if (fromPort?.DN && toPort?.DN && fromPort.DN !== toPort.DN) {
        issues.push({
          level: 'warning',
          message: `连接 ${conn.id} 两端 DN 不一致: ${conn.from}(DN${fromPort.DN}) ↔ ${conn.to}(DN${toPort.DN})`,
          path: `connections.${conn.id}`,
        });
      }
    }
  }

  // 8. Connection missing labels
  for (const conn of project.connections) {
    if (!conn.label?.zh && !conn.label?.en) {
      issues.push({ level: 'warning', message: `连接 ${conn.id} 缺少标签`, path: `connections.${conn.id}.label` });
    }
  }

  return issues;
}
