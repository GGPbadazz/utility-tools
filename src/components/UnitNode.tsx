import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Unit, DisplayMode, PortSide, PortDirection, ConnectionKind } from '../domain/types';
import { getLabel } from '../domain/labels';

export type UnitNodeData = {
  unitId: string;
  unit: Unit;
  displayMode: DisplayMode;
  selectedPortId?: string;
  onPortSelect?: (unitId: string, portId: string) => void;
};

const sideToPosition: Record<PortSide, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

const typeColors: Record<string, string> = {
  vessel: '#4a90d9',
  pump: '#e67e22',
  valve: '#27ae60',
  instrument: '#8e44ad',
  junction: '#7f8c8d',
  custom: '#2c3e50',
};

/** Port color by kind + direction */
function getPortColor(kind: ConnectionKind, direction: PortDirection): string {
  if (kind === 'signal') {
    return direction === 'input' ? '#9b59b6' : direction === 'output' ? '#8e44ad' : '#af7ac5';
  }
  if (kind === 'cable') {
    return direction === 'input' ? '#e67e22' : direction === 'output' ? '#d35400' : '#f39c12';
  }
  // pipe (default)
  return direction === 'input' ? '#2ecc71' : direction === 'output' ? '#e74c3c' : '#3498db';
}

/**
 * Determine the direction of a port.
 * If port.direction is set, use that.
 * Otherwise infer from side: left/top = input, right/bottom = output.
 */
function getPortDirection(port: { direction?: PortDirection; side?: PortSide }): PortDirection {
  if (port.direction) return port.direction;
  const side = port.side || 'right';
  if (side === 'left' || side === 'top') return 'input';
  return 'output';
}

function UnitNode({ data, selected }: NodeProps) {
  const { unitId, unit, displayMode, selectedPortId, onPortSelect } = data as unknown as UnitNodeData;
  const label = getLabel(unit.label, unitId, displayMode);
  const bgColor = typeColors[unit.type] || typeColors.custom;
  const isJunction = unit.type === 'junction';
  const isVessel = unit.type === 'vessel';

  const ports = unit.ports || {};
  const portEntries = Object.entries(ports);

  // Group ports by side for offset calculation
  const sideCounts: Record<string, number> = {};
  const sideIndexes: Record<string, number> = {};
  for (const [, p] of portEntries) {
    const s = p.side || 'right';
    sideCounts[s] = (sideCounts[s] || 0) + 1;
  }

  // Junction: small circle node
  if (isJunction) {
    return (
      <div
        style={{
          background: bgColor,
          color: '#fff',
          borderRadius: '50%',
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
          boxShadow: selected ? '0 0 0 3px #ffd700, 0 4px 12px rgba(255, 215, 0, 0.4)' : '0 2px 6px rgba(0,0,0,0.15)',
          transition: 'box-shadow 0.2s ease',
        }}
        title={`${unitId} (中间点/Junction)`}
      >
        <span style={{ fontSize: 8 }}>{unitId}</span>

        {portEntries.map(([portId, port]) => {
          const side = port.side || 'right';
          if (sideIndexes[side] === undefined) sideIndexes[side] = 0;
          const idx = sideIndexes[side]++;
          const total = sideCounts[side] || 1;
          const percent = ((idx + 1) / (total + 1)) * 100;
          const position = sideToPosition[side];
          const direction = getPortDirection(port);
          const color = getPortColor(port.kind, direction);
          const isSelectedPort = selectedPortId === portId;
          const selectedPortStyle: React.CSSProperties = isSelectedPort
            ? { boxShadow: '0 0 0 3px #ffd54f, 0 0 0 5px rgba(255, 213, 79, 0.45)' }
            : {};

          const handleStyle: React.CSSProperties = {
            background: color,
            border: '2px solid #fff',
            width: 9,
            height: 9,
            ...selectedPortStyle,
            ...(position === Position.Left || position === Position.Right
              ? { top: `${percent}%` }
              : { left: `${percent}%` }),
          };

          return (
            <Handle
              key={portId}
              type={direction === 'input' ? 'target' : 'source'}
              position={position}
              id={portId}
              isConnectable={true}
              isConnectableStart={true}
              isConnectableEnd={true}
              style={handleStyle}
              onMouseDown={() => onPortSelect?.(unitId, portId)}
              title={`${portId} (${port.kind}, ${direction})`}
            />
          );
        })}
        {/* Hidden target handle for annotation dashed edges */}
        <Handle
          type="target"
          position={Position.Top}
          id="ann-target"
          style={{ opacity: 0, width: 1, height: 1, pointerEvents: 'none', top: '50%', left: '50%' }}
        />
      </div>
    );
  }

  // Normal device node
  return (
      <div
      style={{
        background: bgColor,
        color: '#fff',
        borderRadius: 8,
        padding: isVessel ? '24px 32px' : '12px 16px',
        width: isVessel ? 224 : undefined,
        height: isVessel ? 420 : undefined,
        minHeight: isVessel ? 420 : undefined,
        minWidth: isVessel ? 224 : 140,
        textAlign: 'center',
        fontSize: isVessel ? 13 : 13,
        fontFamily: 'system-ui, sans-serif',
        position: 'relative',
        boxShadow: selected ? '0 0 0 3px #ffd700, 0 4px 12px rgba(255, 215, 0, 0.4)' : '0 2px 6px rgba(0,0,0,0.15)',
        transition: 'box-shadow 0.2s ease',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{unitId}</div>
      <div style={{ fontSize: 12, opacity: 0.9 }}>{label}</div>
      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 2 }}>
        {unit.customType || unit.type}
      </div>

      {portEntries.map(([portId, port]) => {
        const side = port.side || 'right';
        if (sideIndexes[side] === undefined) sideIndexes[side] = 0;
        const idx = sideIndexes[side]++;
        const total = sideCounts[side] || 1;
        const percent = ((idx + 1) / (total + 1)) * 100;
        const position = sideToPosition[side];
        const direction = getPortDirection(port);
        const color = getPortColor(port.kind, direction);
        const isSelectedPort = selectedPortId === portId;
        const selectedPortStyle: React.CSSProperties = isSelectedPort
          ? { boxShadow: '0 0 0 3px #ffd54f, 0 0 0 5px rgba(255, 213, 79, 0.45)' }
          : {};

        const handleStyle: React.CSSProperties = {
          background: color,
          border: '2px solid #fff',
          width: 10,
          height: 10,
          ...selectedPortStyle,
          ...(position === Position.Left || position === Position.Right
            ? { top: `${percent}%` }
            : { left: `${percent}%` }),
        };

        const title = `端口 ID: ${portId} | ${port.kind} | ${direction}${port.DN ? ` | DN${port.DN}` : ''}`;

        // For bidirectional ports, render as source but allow both directions
        if (direction === 'bidirectional') {
          return (
            <Handle
              key={portId}
              type="source"
              position={position}
              id={portId}
              isConnectable={true}
              isConnectableStart={true}
              isConnectableEnd={true}
              style={handleStyle}
              onMouseDown={() => onPortSelect?.(unitId, portId)}
              title={title}
            />
          );
        }

        // For input ports, render as target (can receive connections)
        if (direction === 'input') {
          return (
            <Handle
              key={portId}
              type="target"
              position={position}
              id={portId}
              isConnectable={true}
              isConnectableStart={true}
              isConnectableEnd={true}
              style={handleStyle}
              onMouseDown={() => onPortSelect?.(unitId, portId)}
              title={title}
            />
          );
        }

        // For output ports, render as source (can start connections)
        return (
          <Handle
            key={portId}
            type="source"
            position={position}
            id={portId}
            isConnectable={true}
            isConnectableStart={true}
            isConnectableEnd={true}
            style={handleStyle}
            onMouseDown={() => onPortSelect?.(unitId, portId)}
            title={title}
          />
        );
      })}
      {/* Hidden target handle for annotation dashed edges */}
      <Handle
        type="target"
        position={Position.Top}
        id="ann-target"
        style={{ opacity: 0, width: 1, height: 1, pointerEvents: 'none', top: '50%', left: '50%' }}
      />
    </div>
  );
}

export default memo(UnitNode);
