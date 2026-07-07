import { useEffect, useRef } from 'react';
import type { UnitType } from '../domain/types';

export type ContextMenuTarget =
  | { type: 'node'; nodeId: string }
  | { type: 'edge'; edgeId: string }
  | { type: 'canvas' };

type MenuItem = {
  label: string;
  icon?: string;
  danger?: boolean;
  action: () => void;
  disabled?: boolean;
};

type Props = {
  x: number;
  y: number;
  target: ContextMenuTarget;
  onClose: () => void;
  pendingConnectionHint?: boolean;
  onAddUnit: (type: UnitType, position: { x: number; y: number }) => void;
  onAddAnnotation: (position: { x: number; y: number }, targetId?: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onCopyNode: (nodeId: string) => void;
  onRenameNode: (nodeId: string) => void;
  onCutNode: (nodeId: string) => void;
  onPasteNode: (position: { x: number; y: number }) => void;
  onCopyEdge: (edgeId: string) => void;
  onPasteEdge: () => void;
  onEditEdgeLabel: (edgeId: string) => void;
  onSplitEdge?: (edgeId: string, splitPosition?: { x: number; y: number }) => void;
  canvasPosition: { x: number; y: number };
  canPasteUnit?: boolean;
  canPasteEdge?: boolean;
};

export default function ContextMenu({
  x,
  y,
  target,
  onClose,
  onAddUnit,
  onAddAnnotation,
  onDeleteNode,
  onDeleteEdge,
  onCopyNode,
  onRenameNode,
  onCutNode,
  onPasteNode,
  onCopyEdge,
  onPasteEdge,
  onEditEdgeLabel,
  onSplitEdge,
  canvasPosition,
  pendingConnectionHint,
  canPasteUnit = false,
  canPasteEdge = false,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on any click outside menu (including canvas)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handler2 = () => onClose();
    // Delay to avoid closing from the triggering right-click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler, true);
      document.addEventListener('contextmenu', handler2, true);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler, true);
      document.removeEventListener('contextmenu', handler2, true);
    };
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  let items: MenuItem[] = [];

  if (target.type === 'node') {
    items = [
      { label: '添加注释/Add Note', icon: '📝', action: () => { onAddAnnotation(canvasPosition, target.nodeId); onClose(); } },
      ...(target.nodeId.startsWith('ann-') ? [] : [
        { label: '重命名/Rename', icon: '✏️', action: () => { onRenameNode(target.nodeId); onClose(); } },
      ]),
      { label: '复制设备/Copy', icon: '📋', action: () => { onCopyNode(target.nodeId); onClose(); } },
      ...(target.nodeId.startsWith('ann-') ? [] : [{ label: '剪切/Cut', icon: '✂️', action: () => { onCutNode(target.nodeId); onClose(); } }]),
      { label: '删除/Delete', icon: '🗑️', danger: true, action: () => { onDeleteNode(target.nodeId); onClose(); } },
    ];
  } else if (target.type === 'edge') {
    items = [
      { label: '添加注释/Add Note', icon: '📝', action: () => { onAddAnnotation(canvasPosition, target.edgeId); onClose(); } },
      { label: '复制连接/Copy', icon: '📋', action: () => { onCopyEdge(target.edgeId); onClose(); } },
      { label: '编辑标签/Edit Label', icon: '✏️', action: () => { onEditEdgeLabel(target.edgeId); onClose(); } },
      ...(canPasteEdge
        ? [{ label: '粘贴连接/Paste', icon: '📎', action: () => { onPasteEdge(); onClose(); } }]
        : []),
      ...(onSplitEdge
        ? [{
          label: '插入分叉点/Split',
          icon: '⑃',
          action: () => {
            onSplitEdge(target.edgeId, canvasPosition);
            onClose();
          },
        }]
        : []),
      { label: '删除连接/Delete', icon: '🗑️', danger: true, action: () => { onDeleteEdge(target.edgeId); onClose(); } },
    ];
  } else {
    // Canvas context menu - no annotation option (must belong to device)
    items = [
      { label: '+ 容器/Vessel', icon: '🏭', action: () => { onAddUnit('vessel', canvasPosition); onClose(); } },
      { label: '+ 泵/Pump', icon: '⚙️', action: () => { onAddUnit('pump', canvasPosition); onClose(); } },
      { label: '+ 阀门/Valve', icon: '🔧', action: () => { onAddUnit('valve', canvasPosition); onClose(); } },
      { label: '+ 仪表/Instrument', icon: '📊', action: () => { onAddUnit('instrument', canvasPosition); onClose(); } },
      { label: '+ 自定义/Custom', icon: '📦', action: () => { onAddUnit('custom', canvasPosition); onClose(); } },
      { label: '', icon: '', action: () => {} }, // separator
      { label: '+ 中间点/Junction', icon: '⊕', action: () => { onAddUnit('junction', canvasPosition); onClose(); } },
      { label: '', icon: '', action: () => {} }, // separator
      { label: '添加注释/Add Note', icon: '📝', action: () => { onAddAnnotation(canvasPosition); onClose(); } },
      { label: '', icon: '', action: () => {} }, // separator
      { label: '粘贴元件/Paste', icon: canPasteUnit ? '📎' : '🚫', action: () => { if (canPasteUnit) { onPasteNode(canvasPosition); } onClose(); }, disabled: !canPasteUnit },
    ];
  }

  return (
    <div ref={menuRef} className="context-menu" style={{ left: x, top: y, position: 'fixed', zIndex: 9999 }}>
      {pendingConnectionHint && target.type === 'canvas' && (
        <div className="context-menu-hint">拖拽连线到空白处后可直接在此处创建新设备并自动连线。</div>
      )}
      {items.map((item, i) => {
        if (!item.label) {
          return <div key={i} className="context-menu-separator" />;
        }
        return (
          <div
            key={i}
            className={`context-menu-item${item.danger ? ' danger' : ''}`}
            style={item.disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
            onClick={item.action}
          >
            {item.icon && <span>{item.icon}</span>}
            <span>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
