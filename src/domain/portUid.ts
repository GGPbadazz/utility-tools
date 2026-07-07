import type { Unit, Port } from './types';

function normalizeUid(uid: unknown): string | undefined {
  if (typeof uid !== 'string') return undefined;
  const normalized = uid.trim();
  return normalized.length ? normalized : undefined;
}

function pickUniquePortUid(unitId: string, portId: string, preferredUid: string | undefined, used: Set<string>): string {
  const preferred = normalizeUid(preferredUid);
  if (preferred && !used.has(preferred)) {
    return preferred;
  }

  const base = `${unitId}.${portId}`;
  if (!used.has(base)) {
    return base;
  }

  let idx = 2;
  while (used.has(`${base}-${idx}`)) idx++;
  return `${base}-${idx}`;
}

export function collectUsedPortUids(units: Record<string, Unit>): Set<string> {
  const used = new Set<string>();
  for (const unit of Object.values(units)) {
    if (!unit.ports) continue;
    for (const port of Object.values(unit.ports)) {
      const uid = normalizeUid(port.uid);
      if (uid) {
        used.add(uid);
      }
    }
  }
  return used;
}

export function ensurePortHasUid(unitId: string, portId: string, port: Port, usedPortUids: Set<string>): Port {
  const uid = pickUniquePortUid(unitId, portId, port.uid, usedPortUids);
  usedPortUids.add(uid);

  if (port.uid === uid) {
    return port;
  }
  return { ...port, uid };
}

export function ensureUnitPortsHaveUid(unitId: string, unit: Unit, usedPortUids: Set<string>): Unit {
  if (!unit.ports) return unit;

  const nextPorts: Record<string, Port> = {};
  let changed = false;

  for (const [portId, port] of Object.entries(unit.ports)) {
    const withUid = ensurePortHasUid(unitId, portId, port, usedPortUids);
    if (withUid !== port) changed = true;
    nextPorts[portId] = withUid;
  }

  if (!changed) {
    return unit;
  }
  return { ...unit, ports: nextPorts };
}

export function ensureProjectPortsHaveUid(units: Record<string, Unit>): Record<string, Unit> {
  const used = new Set<string>();
  const nextUnits: Record<string, Unit> = {};
  let changed = false;

  for (const [unitId, unit] of Object.entries(units)) {
    const nextUnit = ensureUnitPortsHaveUid(unitId, unit, used);
    if (nextUnit !== unit) changed = true;
    nextUnits[unitId] = nextUnit;
  }

  if (!changed) return units;
  return nextUnits;
}
