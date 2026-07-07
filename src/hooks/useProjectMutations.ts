import { useCallback } from 'react';
import type { ProjectModel, Unit, Port, Connection, ConnectionKind, UnitType, Annotation } from '../domain/types';
import { getUnitIdPrefix } from '../domain/unitNaming';
import { collectUsedPortUids, ensurePortHasUid, ensureUnitPortsHaveUid } from '../domain/portUid';

type SetProject = React.Dispatch<React.SetStateAction<ProjectModel>>;

type FlowPoint = { x: number; y: number };

type JunctionSide = 'N' | 'S' | 'E' | 'W';

const defaultUnitLabelsByType: Record<UnitType, { zh: string; en: string }> = {
  vessel: { zh: '容器', en: 'Vessel' },
  pump: { zh: '泵', en: 'Pump' },
  valve: { zh: '阀门', en: 'Valve' },
  instrument: { zh: '仪表', en: 'Instrument' },
  junction: { zh: '中间点', en: 'Junction' },
  custom: { zh: '自定义', en: 'Custom' },
};

const sideByDirection = (source: FlowPoint, target: FlowPoint): JunctionSide => {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'W' : 'E';
  }
  return dy >= 0 ? 'N' : 'S';
};

const junctionPortBySide: Record<JunctionSide, Port> = {
  N: { kind: 'pipe', side: 'top', direction: 'bidirectional', DN: 50 },
  S: { kind: 'pipe', side: 'bottom', direction: 'bidirectional', DN: 50 },
  W: { kind: 'pipe', side: 'left', direction: 'bidirectional', DN: 50 },
  E: { kind: 'pipe', side: 'right', direction: 'bidirectional', DN: 50 },
};

const sideOrder: JunctionSide[] = ['N', 'E', 'S', 'W'];

const oppositeSide = (side: JunctionSide): JunctionSide => {
  const idx = sideOrder.indexOf(side);
  return sideOrder[(idx + 2) % 4];
};

const portIdBySide = (ports: Record<string, Port> | undefined, side: JunctionSide): string | undefined => {
  if (!ports) return undefined;
  const expected = junctionPortBySide[side].side;
  for (const [portId, port] of Object.entries(ports)) {
    if ((port.side || 'right') === expected) return portId;
  }
  return ports[Object.keys(ports)[0]] ? Object.keys(ports)[0] : undefined;
};

const splitPortForSide = (ports: Record<string, Port> | undefined, side: JunctionSide): string | undefined => {
  const first = portIdBySide(ports, side);
  if (first) return first;
  const fallback = ports ? Object.keys(ports)[0] : undefined;
  return fallback;
};

/** Generate next ID like V-102, P-103, etc. */
function nextId(prefix: string, existing: string[]): string {
  let max = 100;
  for (const id of existing) {
    const match = id.match(new RegExp(`^${prefix}-(\\d+)$`));
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return `${prefix}-${max + 1}`;
}

export function useProjectMutations(setProject: SetProject) {
  const addUnit = useCallback((type: UnitType, position: { x: number; y: number }) => {
    let newUnitId = '';

    setProject((prev) => {
      const prefix = getUnitIdPrefix(type);
      const id = nextId(prefix, Object.keys(prev.units));
      const usedPortUids = collectUsedPortUids(prev.units);

      let ports: Record<string, Port>;
      if (type === 'junction') {
        // Junction: 4 bidirectional ports on all 4 sides
        ports = {
          N: { kind: 'pipe', side: 'top', direction: 'bidirectional', DN: 50 },
          S: { kind: 'pipe', side: 'bottom', direction: 'bidirectional', DN: 50 },
          W: { kind: 'pipe', side: 'left', direction: 'bidirectional', DN: 50 },
          E: { kind: 'pipe', side: 'right', direction: 'bidirectional', DN: 50 },
        };
      } else {
        // Standard device: inlet/outlet with proper IDs
        ports = {
          IN1: { kind: 'pipe', DN: 50, side: 'left', direction: 'input' },
          OUT1: { kind: 'pipe', DN: 50, side: 'right', direction: 'output' },
        };
      }

      const newUnitWithoutUid: Unit = {
        type,
        label: defaultUnitLabelsByType[type],
        attrs: {},
        ports,
        layout: {
          x: position.x,
          y: position.y,
          ...(type === 'vessel' ? { width: 224, height: 420 } : {}),
        },
      };
      const newUnit = ensureUnitPortsHaveUid(id, newUnitWithoutUid, usedPortUids);
      newUnitId = id;
      return { ...prev, units: { ...prev.units, [id]: newUnit } };
    });
    return newUnitId;
  }, [setProject]);

  const renameUnit = useCallback((oldId: string, newId: string) => {
    setProject((prev) => {
      if (!prev.units[oldId] || (newId !== oldId && prev.units[newId])) return prev;
      if (newId === oldId) return prev;
      const { [oldId]: unit, ...restUnits } = prev.units;
      // Update connection references
      const connections = prev.connections.map((c) => ({
        ...c,
        from: c.from.startsWith(oldId + '.') ? newId + c.from.slice(oldId.length) : c.from,
        to: c.to.startsWith(oldId + '.') ? newId + c.to.slice(oldId.length) : c.to,
      }));
      // Update annotation targets
      const annotations = (prev.annotations || []).map((a) => ({
        ...a,
        target: a.target === oldId ? newId : a.target,
      }));
      return { ...prev, units: { ...restUnits, [newId]: unit }, connections, annotations };
    });
  }, [setProject]);

  const deleteUnit = useCallback((unitId: string) => {
    setProject((prev) => {
      const { [unitId]: _, ...rest } = prev.units;
      // Also remove connections referencing this unit
      const connections = prev.connections.filter(
        (c) => !c.from.startsWith(unitId + '.') && !c.to.startsWith(unitId + '.')
      );
      return { ...prev, units: rest, connections };
    });
  }, [setProject]);

  const updateUnit = useCallback((unitId: string, updates: Partial<Unit>) => {
    setProject((prev) => {
      const unit = prev.units[unitId];
      if (!unit) return prev;
      if (!updates.ports) {
        return {
          ...prev,
          units: { ...prev.units, [unitId]: { ...unit, ...updates } },
        };
      }

      const otherUnits = { ...prev.units };
      delete otherUnits[unitId];
      const usedPortUids = collectUsedPortUids(otherUnits);
      const nextUnit = ensureUnitPortsHaveUid(unitId, { ...unit, ...updates }, usedPortUids);

      return {
        ...prev,
        units: { ...prev.units, [unitId]: nextUnit },
      };
    });
  }, [setProject]);

  const updateUnitLayout = useCallback((unitId: string, x: number, y: number) => {
    setProject((prev) => {
      const unit = prev.units[unitId];
      if (!unit) return prev;
      return {
        ...prev,
        units: {
          ...prev.units,
          [unitId]: { ...unit, layout: { ...unit.layout, x, y } },
        },
      };
    });
  }, [setProject]);

  const addPort = useCallback((unitId: string, portId: string, port: Port) => {
    setProject((prev) => {
      const unit = prev.units[unitId];
      if (!unit) return prev;
      // Generate proper port ID if user provided empty or generic name
      let finalPortId = portId.trim();
      if (!finalPortId) {
        // Auto-generate based on direction
        const existingPorts = Object.keys(unit.ports || {});
        const dir = port.direction || 'output';
        const prefix = dir === 'input' ? 'IN' : dir === 'output' ? 'OUT' : 'IO';
        let num = 1;
        while (existingPorts.includes(`${prefix}${num}`)) num++;
        finalPortId = `${prefix}${num}`;
      }
      const usedPortUids = collectUsedPortUids(prev.units);
      const hydratedPort = ensurePortHasUid(unitId, finalPortId, port, usedPortUids);

      const ports = { ...(unit.ports || {}), [finalPortId]: hydratedPort };
      return {
        ...prev,
        units: { ...prev.units, [unitId]: { ...unit, ports } },
      };
    });
  }, [setProject]);

  const deletePort = useCallback((unitId: string, portId: string) => {
    setProject((prev) => {
      const unit = prev.units[unitId];
      if (!unit || !unit.ports) return prev;
      const { [portId]: _, ...restPorts } = unit.ports;
      // Remove connections referencing this port
      const portPath = `${unitId}.${portId}`;
      const connections = prev.connections.filter(
        (c) => c.from !== portPath && c.to !== portPath
      );
      return {
        ...prev,
        units: { ...prev.units, [unitId]: { ...unit, ports: restPorts } },
        connections,
      };
    });
  }, [setProject]);

  const addConnection = useCallback((from: string, to: string, kind: ConnectionKind = 'pipe') => {
    setProject((prev) => {
      // Use categorized prefixes: L- pipe, S- signal, C- cable
      const prefixMap: Record<ConnectionKind, string> = { pipe: 'L', signal: 'S', cable: 'C' };
      const prefix = prefixMap[kind] || 'L';
      let max = 0;
      for (const c of prev.connections) {
        const match = c.id.match(new RegExp(`^${prefix}-(\\d+)$`));
        if (match) max = Math.max(max, parseInt(match[1], 10));
      }
      const id = `${prefix}-${String(max + 1).padStart(3, '0')}`;
      const conn: Connection = { id, kind, from, to, attrs: {} };
      return { ...prev, connections: [...prev.connections, conn] };
    });
  }, [setProject]);

  const deleteConnection = useCallback((connId: string) => {
    setProject((prev) => ({
      ...prev,
      connections: prev.connections.filter((c) => c.id !== connId),
    }));
  }, [setProject]);

  const updateConnection = useCallback((connId: string, updates: Partial<Connection>) => {
    setProject((prev) => ({
      ...prev,
      connections: prev.connections.map((c) =>
        c.id === connId ? { ...c, ...updates } : c
      ),
    }));
  }, [setProject]);

  const updateAnnotation = useCallback((annId: string, updates: Partial<Annotation>) => {
    setProject((prev) => ({
      ...prev,
      annotations: (prev.annotations || []).map((a) =>
        a.id === annId ? { ...a, ...updates } : a
      ),
    }));
  }, [setProject]);

  const deleteAnnotation = useCallback((annId: string) => {
    setProject((prev) => ({
      ...prev,
      annotations: (prev.annotations || []).filter((a) => a.id !== annId),
    }));
  }, [setProject]);

  /** Split a connection by inserting a Junction node in the middle */
  const splitConnectionWithJunction = useCallback((connId: string, splitPosition?: FlowPoint) => {
    setProject((prev) => {
      const connIdx = prev.connections.findIndex((c) => c.id === connId);
      if (connIdx === -1) return prev;
      const conn = prev.connections[connIdx];

      // Create junction unit
      const junctionId = nextId('J', Object.keys(prev.units));
      // Position junction between source and target
      const [sourceUnitId] = conn.from.split('.');
      const [targetUnitId] = conn.to.split('.');
      const sourceUnit = prev.units[sourceUnitId];
      const targetUnit = prev.units[targetUnitId];
      const sourcePoint = sourceUnit?.layout
        ? { x: sourceUnit.layout.x, y: sourceUnit.layout.y }
        : { x: 0, y: 0 };
      const targetPoint = targetUnit?.layout
        ? { x: targetUnit.layout.x, y: targetUnit.layout.y }
        : sourcePoint;
      const fallbackPoint = {
        x: ((sourcePoint.x || 0) + (targetPoint.x || 0)) / 2,
        y: ((sourcePoint.y || 0) + (targetPoint.y || 0)) / 2,
      };
      const splitPoint = splitPosition || fallbackPoint;

      const junctionUnit: Unit = {
        type: 'junction',
        label: { zh: '分叉点', en: 'Junction' },
        attrs: {},
        ports: {
          N: { kind: 'pipe', side: 'top', direction: 'bidirectional', DN: 50 },
          S: { kind: 'pipe', side: 'bottom', direction: 'bidirectional', DN: 50 },
          W: { kind: 'pipe', side: 'left', direction: 'bidirectional', DN: 50 },
          E: { kind: 'pipe', side: 'right', direction: 'bidirectional', DN: 50 },
        },
        layout: { x: splitPoint.x, y: splitPoint.y },
      };
      const usedPortUids = collectUsedPortUids(prev.units);
      const hydratedJunctionUnit = ensureUnitPortsHaveUid(junctionId, junctionUnit, usedPortUids);

      const sourceSide = sideByDirection(sourcePoint, splitPoint);
      const targetSide = oppositeSide(sideByDirection(splitPoint, targetPoint));
      let sourcePort = portIdBySide(hydratedJunctionUnit.ports, sourceSide);
      let targetPort = portIdBySide(hydratedJunctionUnit.ports, targetSide);

      if (!sourcePort) sourcePort = splitPortForSide(hydratedJunctionUnit.ports, 'W');
      if (!targetPort) targetPort = splitPortForSide(hydratedJunctionUnit.ports, 'E');

      if (sourcePort === targetPort) {
        const altSide = oppositeSide(targetSide);
        targetPort = portIdBySide(hydratedJunctionUnit.ports, altSide) || targetPort;
      }

      // Generate two new connection IDs
      const prefixMap: Record<ConnectionKind, string> = { pipe: 'L', signal: 'S', cable: 'C' };
      const prefix = prefixMap[conn.kind] || 'L';
      const allConnIds = prev.connections.map((c) => c.id);
      const newId1 = nextId(prefix, allConnIds);
      const newId2 = nextId(prefix, [...allConnIds, newId1]);

      // First half: original source → junction (nearest side)
      const conn1: Connection = { ...conn, id: newId1, from: conn.from, to: `${junctionId}.${sourcePort}` };
      // Second half: junction (opposite nearest side) → original target
      const conn2: Connection = { ...conn, id: newId2, from: `${junctionId}.${targetPort}`, to: conn.to };

      // Remove original connection, add two new ones
      const newConnections = [...prev.connections];
      newConnections.splice(connIdx, 1, conn1, conn2);

      return {
        ...prev,
        units: { ...prev.units, [junctionId]: hydratedJunctionUnit },
        connections: newConnections,
      };
    });
  }, [setProject]);

  return {
    addUnit,
    renameUnit,
    deleteUnit,
    updateUnit,
    updateUnitLayout,
    addPort,
    deletePort,
    addConnection,
    deleteConnection,
    updateConnection,
    updateAnnotation,
    deleteAnnotation,
    splitConnectionWithJunction,
  };
}
