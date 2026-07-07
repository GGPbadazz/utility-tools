import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Annotation, DisplayMode } from '../domain/types';
import { getLabel } from '../domain/labels';

export type AnnotationNodeData = {
  annotation: Annotation;
  displayMode: DisplayMode;
};

function AnnotationNode({ data, selected }: NodeProps) {
  const { annotation, displayMode } = data as unknown as AnnotationNodeData;
  const text = getLabel(annotation.text, annotation.id, displayMode);

  return (
    <div
      style={{
        background: '#fffde7',
        border: selected ? '2px solid #ffd700' : '1px solid #f9a825',
        borderRadius: 6,
        padding: '8px 12px',
        fontSize: 12,
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 200,
        boxShadow: selected ? '0 0 0 2px #ffd700, 0 4px 12px rgba(255, 215, 0, 0.3)' : '0 1px 4px rgba(0,0,0,0.1)',
        transition: 'box-shadow 0.2s ease, border 0.2s ease',
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 10, color: '#f57f17', marginBottom: 2 }}>
        📝 {annotation.id}
        {annotation.target && (
          <span style={{ fontWeight: 400, color: '#999', marginLeft: 4 }}>→ {annotation.target}</span>
        )}
      </div>
      <div>{text}</div>
      {/* Hidden handle for annotation dashed edge connection */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="ann-out"
        style={{ opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
      />
    </div>
  );
}

export default memo(AnnotationNode);
