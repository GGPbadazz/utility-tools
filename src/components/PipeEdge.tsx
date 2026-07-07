import React, { useMemo } from 'react';
import { BaseEdge, EdgeText, getSmoothStepPath, Position, type EdgeProps } from '@xyflow/react';

const MIN_PIPE_LABEL_DISTANCE = 420;
const LABEL_REPEAT_DISTANCE_SCALE = 3;

function getParallelOffset(index: number): number {
  if (index === 0) return 0;
  const magnitude = Math.ceil(index / 2) * 22;
  return index % 2 === 1 ? magnitude : -magnitude;
}

const LABEL_STROKE_FALLBACK = '#3498db';
const ARROW_SPACING = 180;
const ARROW_SIZE = 4;
const ARROW_MARGIN = 26;
const ARROW_SHAPE = `M 0 0 L -${ARROW_SIZE} ${ARROW_SIZE} L -${ARROW_SIZE} -${ARROW_SIZE} Z`;
const LABEL_OFFSET = 8;
const LABEL_BG_STYLE: React.CSSProperties = {
  fill: 'rgba(255, 255, 255, 0.88)',
  stroke: '#1c4f7a',
  strokeWidth: 1,
};

type PathGeometrySample = {
  x: number;
  y: number;
  length: number;
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number;
  angle: number;
};

type PathGeometry = {
  length: number;
  samples: PathGeometrySample[];
};

type LabelPlacement = {
  x: number;
  y: number;
  angle: number;
  length: number;
  normalX: number;
  normalY: number;
  sideSign: number;
};

function createPathElement(labelPath: string): SVGPathElement | null {
  if (typeof document === 'undefined') return null;
  try {
    const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathElement.setAttribute('d', labelPath);
    return pathElement;
  } catch {
    return null;
  }
}

function getSafePathLength(pathElement: SVGPathElement): number {
  try {
    const pathLength = pathElement.getTotalLength();
    return Number.isFinite(pathLength) ? pathLength : 0;
  } catch {
    return 0;
  }
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildPathGeometry(labelPath: string): PathGeometry {
  if (typeof document === 'undefined') {
    return { length: 0, samples: [] };
  }

  const pathElement = createPathElement(labelPath);
  if (!pathElement) {
    return { length: 0, samples: [] };
  }

  const length = getSafePathLength(pathElement);
  if (!Number.isFinite(length) || length <= 0) {
    return { length: 0, samples: [] };
  }

  const sampleCount = clampNumber(Math.floor(length / 5), 24, 320);
  const step = length / sampleCount;

  const samples: PathGeometrySample[] = [];
  const rawPoints = Array.from({ length: sampleCount + 1 }, (_, index) => {
    const sampleLength = step * index;
    const point = pathElement.getPointAtLength(sampleLength);
    return {
      x: point.x,
      y: point.y,
      length: sampleLength,
    };
  });

  for (let index = 0; index < rawPoints.length; index += 1) {
    const current = rawPoints[index];
    const next = rawPoints[Math.min(index + 1, rawPoints.length - 1)];
    const prev = rawPoints[Math.max(index - 1, 0)];
    const anchorA = index + 1 < rawPoints.length ? next : current;
    const anchorB = index > 0 ? prev : current;
    const useNext = index === rawPoints.length - 1 ? false : true;
    const dx = useNext ? anchorA.x - current.x : current.x - anchorB.x;
    const dy = useNext ? anchorA.y - current.y : current.y - anchorB.y;
    const segmentLength = Math.hypot(dx, dy) || 1;
    const tangentX = dx / segmentLength;
    const tangentY = dy / segmentLength;
    const normalX = -tangentY;
    const normalY = tangentX;
    const angle = Math.atan2(tangentY, tangentX) * (180 / Math.PI);
    samples.push({
      x: current.x,
      y: current.y,
      length: current.length,
      tangentX,
      tangentY,
      normalX,
      normalY,
      angle,
    });
  }

  return { length, samples };
}

function getSampleAngle(pathElement: SVGPathElement, length: number): number {
  try {
    const pathLength = getSafePathLength(pathElement);
    if (!pathLength) return 0;

    const eps = Math.min(4, pathLength * 0.002);
    const startLength = clampNumber(length - eps, 0, pathLength);
    const endLength = clampNumber(length + eps, 0, pathLength);
    if (startLength === endLength) {
      return 0;
    }

    const startPoint = pathElement.getPointAtLength(startLength);
    const endPoint = pathElement.getPointAtLength(endLength);

    return Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x) * (180 / Math.PI);
  } catch {
    return 0;
  }
}

function getPlacementAtLength(geometry: PathGeometry, targetLength: number): LabelPlacement | null {
  if (!geometry.samples.length) {
    return null;
  }

  const clampedLength = clampNumber(targetLength, 0, geometry.length);
  const samples = geometry.samples;

  if (clampedLength <= samples[0].length) {
    const sample = samples[0];
    return {
      x: sample.x,
      y: sample.y,
      angle: sample.angle,
      length: sample.length,
      normalX: sample.normalX,
      normalY: sample.normalY,
      sideSign: 1,
    };
  }

  for (let i = 0; i < samples.length - 1; i += 1) {
    const current = samples[i];
    const next = samples[i + 1];
    if (clampedLength <= next.length) {
      const segmentLength = next.length - current.length;
      if (segmentLength <= 0) {
        return {
          x: current.x,
          y: current.y,
          angle: current.angle,
          length: current.length,
          normalX: current.normalX,
          normalY: current.normalY,
          sideSign: 1,
        };
      }

      const t = (clampedLength - current.length) / segmentLength;
      return {
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
        angle: current.angle + (next.angle - current.angle) * t,
        length: clampedLength,
        normalX: current.normalX + (next.normalX - current.normalX) * t,
        normalY: current.normalY + (next.normalY - current.normalY) * t,
        sideSign: 1,
      };
    }
  }

  const last = samples[samples.length - 1];
  return {
    x: last.x,
    y: last.y,
    angle: last.angle,
    length: last.length,
    normalX: last.normalX,
    normalY: last.normalY,
    sideSign: 1,
  };
}

function getLabelPositions(
  geometry: PathGeometry,
  spacing = MIN_PIPE_LABEL_DISTANCE,
): LabelPlacement[] {
  if (!geometry.samples.length || geometry.length <= 0) {
    return [];
  }

  const count = Math.max(1, Math.floor(geometry.length / spacing));
  const safeCount = Math.min(count, 6);
  return Array.from({ length: safeCount }, (_, index) => {
    const targetLength = geometry.length * ((index + 1) / (safeCount + 1));
    const placement = getPlacementAtLength(geometry, targetLength) || {
      x: 0,
      y: 0,
      angle: 0,
      length: targetLength,
      normalX: 0,
      normalY: 0,
      sideSign: 1,
    };

    return {
      ...placement,
      sideSign: index % 2 === 0 ? 1 : -1,
    };
  });
}

function normalizeLabelRotation(angle: number): number {
  let normalized = ((angle % 360) + 360) % 360;
  if (normalized > 180) {
    normalized -= 360;
  }
  if (Math.abs(normalized) > 90) {
    normalized = normalized > 0 ? normalized - 180 : normalized + 180;
  }
  return normalized;
}

function getArrowPositions(
  labelPath: string
): Array<{ x: number; y: number; angle: number }> {
  if (typeof document === 'undefined') {
    return [];
  }

  const pathElement = createPathElement(labelPath);
  if (!pathElement) {
    return [];
  }

  const pathLength = getSafePathLength(pathElement);
  if (!Number.isFinite(pathLength) || pathLength <= ARROW_MARGIN * 2 + ARROW_SPACING) {
    return [];
  }

  const count = Math.max(1, Math.floor((pathLength - ARROW_MARGIN * 2) / ARROW_SPACING));
  const safeCount = Math.min(count, 6);

  return Array.from({ length: safeCount }, (_, index) => {
    const lengthPoint = ARROW_MARGIN + ((pathLength - ARROW_MARGIN * 2) * (index + 1)) / (safeCount + 1);

    try {
      const point = pathElement.getPointAtLength(lengthPoint);
      const angle = getSampleAngle(pathElement, lengthPoint);

      return {
        x: point.x,
        y: point.y,
        angle,
      };
    } catch {
      return null;
    }
  }).filter((arrow): arrow is { x: number; y: number; angle: number } => arrow !== null);
}

function getPathColor(pathStyle?: React.CSSProperties): string {
  const pathStroke = pathStyle?.stroke;
  if (typeof pathStroke === 'string' && pathStroke.trim()) {
    return pathStroke;
  }
  return LABEL_STROKE_FALLBACK;
}

const LABEL_STYLE: React.CSSProperties = {
  fill: '#1e4f72',
  fontSize: 11,
  fontWeight: 600,
  dominantBaseline: 'middle',
  textAnchor: 'middle',
  pointerEvents: 'none',
  paintOrder: 'stroke',
  stroke: 'none',
};

const MIN_PORT_STEM = 18;

function getPortNormal(position?: Position): { x: number; y: number } {
  switch (position) {
    case Position.Top:
      return { x: 0, y: -1 };
    case Position.Bottom:
      return { x: 0, y: 1 };
    case Position.Left:
      return { x: -1, y: 0 };
    case Position.Right:
    default:
      return { x: 1, y: 0 };
  }
}

const SVG_NUMBER = '[+-]?(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
const MOVE_COMMAND_REGEX = new RegExp(`^M\\s*${SVG_NUMBER}\\s+${SVG_NUMBER}\\s*`, 'i');

function removeLeadingMove(path: string): string {
  return path.replace(MOVE_COMMAND_REGEX, '');
}

type PipeEdgeData = {
  kind?: string;
  sourceHandlePosition?: Position;
  targetHandlePosition?: Position;
  repeatLabel?: boolean;
  labelRepeatDistance?: number;
  parallelOffset?: number;
};

export function PipeEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    label,
    style,
    markerStart,
    markerEnd,
    data,
    labelStyle,
    ...rest
  } = props;

  const edgeData = (data as PipeEdgeData) || {};

  const edgeLabel = typeof label === 'string' ? label : '';
  const resolvedSourcePosition = edgeData.sourceHandlePosition || sourcePosition;
  const resolvedTargetPosition = edgeData.targetHandlePosition || targetPosition;
  const sourceNormal = getPortNormal(resolvedSourcePosition);
  const targetNormal = getPortNormal(resolvedTargetPosition);
  const sourceStemX = sourceX + sourceNormal.x * MIN_PORT_STEM;
  const sourceStemY = sourceY + sourceNormal.y * MIN_PORT_STEM;
  const targetStemX = targetX + targetNormal.x * MIN_PORT_STEM;
  const targetStemY = targetY + targetNormal.y * MIN_PORT_STEM;

  const [smoothedPath] = getSmoothStepPath({
    sourceX: sourceStemX,
    sourceY: sourceStemY,
    sourcePosition,
    targetX: targetStemX,
    targetY: targetStemY,
    targetPosition,
    borderRadius: 0,
    offset: edgeData.parallelOffset ?? 0,
  });

  const smoothPathWithoutMove = (() => {
    const trimmed = removeLeadingMove(smoothedPath);
    return trimmed === smoothedPath ? smoothedPath.replace(/^M\s*/, '') : trimmed;
  })();
  const tailToTarget =
    targetStemX === targetX && targetStemY === targetY
      ? ''
      : ` L ${targetX} ${targetY}`;

  const path =
    `M ${sourceX} ${sourceY} L ${sourceStemX} ${sourceStemY} ${smoothPathWithoutMove}${tailToTarget}`;

  const shouldRepeat = Boolean(edgeData.repeatLabel) && Boolean(edgeLabel);
  const resolvedLabelDistance = (edgeData.labelRepeatDistance ?? MIN_PIPE_LABEL_DISTANCE) * LABEL_REPEAT_DISTANCE_SCALE;
  const geometry = useMemo(() => buildPathGeometry(path), [path]);
  const positions = shouldRepeat
    ? getLabelPositions(geometry, resolvedLabelDistance)
    : edgeLabel
      ? getLabelPositions(geometry, resolvedLabelDistance).slice(0, 1)
      : [];
  const pathOffset = LABEL_OFFSET + (typeof style?.strokeWidth === 'number' ? Math.max(style.strokeWidth, 1) * 0.8 : 2.2);

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={style}
        markerStart={markerStart}
        markerEnd={markerEnd}
        {...rest}
      />
      {getArrowPositions(path).map((arrow, index) => (
        <path
          key={`${id}-arrow-${index}`}
          d={ARROW_SHAPE}
          fill={getPathColor(style)}
          stroke={getPathColor(style)}
          transform={`translate(${arrow.x},${arrow.y}) rotate(${arrow.angle})`}
        />
      ))}
      {positions.map((point, index) => {
        const placement = getPlacementAtLength(geometry, point.length) || point;
        const normalizedTransformAngle = normalizeLabelRotation(placement.angle);
        const normalLength = Math.hypot(placement.normalX, placement.normalY) || 1;
        const normalizedNormalX = placement.normalX / normalLength;
        const normalizedNormalY = placement.normalY / normalLength;
        const normalSign = point.sideSign;
        const labelX =
          placement.x +
          normalizedNormalX * (pathOffset * normalSign);
        const labelY =
          placement.y +
          normalizedNormalY * (pathOffset * normalSign);
        const mergedLabelStyle = {
          ...LABEL_STYLE,
          ...(labelStyle ?? {}),
          transform: `rotate(${normalizedTransformAngle} ${labelX} ${labelY})`,
        };
        return (
          <EdgeText
            key={`${id}-pipe-label-${index}`}
            x={labelX}
            y={labelY}
            label={edgeLabel}
            labelStyle={mergedLabelStyle}
            labelShowBg
            labelBgStyle={LABEL_BG_STYLE}
            labelBgPadding={[2, 4]}
            labelBgBorderRadius={4}
            className="pipeline-edge-label"
          />
        );
      })}
    </>
  );
}

export { getParallelOffset };
