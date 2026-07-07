import { useState, useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  type OnConnect,
  Position,
  type OnConnectStart,
  type OnConnectEnd,
  type IsValidConnection,
  type Connection as ReactFlowConnection,
  type KeyCode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './styles.css';

import type { ProjectModel, DisplayMode, Unit, Connection, Annotation, UnitType, PortDirection, ConnectionKind } from './domain/types';
import { getLabel } from './domain/labels';
import { parseProjectYaml, projectToYaml } from './parser/yaml';
import { useProjectMutations } from './hooks/useProjectMutations';
import { collectUsedPortUids, ensureProjectPortsHaveUid, ensureUnitPortsHaveUid } from './domain/portUid';
import { useUndoRedo } from './hooks/useUndoRedo';
import { applyDagreLayout } from './layout/dagre';
import UnitNode from './components/UnitNode';
import AnnotationNode from './components/AnnotationNode';
import PropertyPanel from './components/PropertyPanel';
import ValidationPanel from './components/ValidationPanel';
import ContextMenu, { type ContextMenuTarget } from './components/ContextMenu';
import SearchBar from './components/SearchBar';
import { exportAllCsv } from './exporters/csv';
import { downloadSemanticGraph } from './exporters/semanticGraph';
import { parseDsl } from './parser/dsl';
import YamlEditor from './components/YamlEditor';
import { getUnitIdPrefix } from './domain/unitNaming';
import { PipeEdge, getParallelOffset } from './components/PipeEdge';


const nodeTypes = { unit: UnitNode, annotation: AnnotationNode };
const edgeTypes = { smoothstep: PipeEdge };
const deleteKeyCode: KeyCode = 'Delete';
const STORAGE_KEY = 'logic-diagram-project-save';
const PIPE_LABEL_REPEAT_DISTANCE = 420;
const PROPERTY_PANEL_MIN_WIDTH = 260;
const PROPERTY_PANEL_MAX_WIDTH = 760;
const PROPERTY_PANEL_DEFAULT_WIDTH = 320;
const PROPERTY_PANEL_COLLAPSED_WIDTH = 34;
type CopyInteractionState = 'idle' | 'connecting' | 'dragging-node';
const sideToPosition: Record<string, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

type SelectedHandle = {
  nodeId: string;
  handleId: string;
};

type ConnectStartEndpoint = {
  nodeId: string;
  handleId: string;
  handleType: 'source' | 'target' | null;
};

type ClipboardPayload = {
  unit: Unit;
  sourceId: string;
  sourcePos?: { x: number; y: number };
};

type EdgeClipboardPayload = {
  connection: Connection;
};

const NEW_UNIT_PORTS: Record<UnitType, { input: string; output: string }> = {
  vessel: { input: 'IN1', output: 'OUT1' },
  pump: { input: 'IN1', output: 'OUT1' },
  valve: { input: 'IN1', output: 'OUT1' },
  instrument: { input: 'IN1', output: 'OUT1' },
  custom: { input: 'IN1', output: 'OUT1' },
  junction: { input: 'W', output: 'E' },
};

function getDefaultPort(unitType: UnitType, side: 'input' | 'output'): string {
  return NEW_UNIT_PORTS[unitType]?.[side] ?? (side === 'input' ? 'IN1' : 'OUT1');
}

function projectToFlow(
  project: ProjectModel,
  mode: DisplayMode,
  activePort: SelectedHandle | null,
  onPortSelect?: (unitId: string, handleId: string) => void
) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const pairIndex = new Map<string, number>();

  for (const [id, unit] of Object.entries(project.units)) {
    nodes.push({
      id,
      type: 'unit',
      position: { x: unit.layout?.x || 0, y: unit.layout?.y || 0 },
      data: {
        unitId: id,
        unit,
        displayMode: mode,
        selectedPortId: activePort?.nodeId === id ? activePort.handleId : undefined,
        onPortSelect,
      },
    });
  }

  for (const conn of project.connections) {
    const [sourceUnit, sourcePort] = conn.from.split('.');
    const [targetUnit, targetPort] = conn.to.split('.');
    const sourcePortSide = project.units[sourceUnit]?.ports?.[sourcePort]?.side;
    const targetPortSide = project.units[targetUnit]?.ports?.[targetPort]?.side;
    const sortedPair = [
      `${sourceUnit}.${sourcePort || ''}`,
      `${targetUnit}.${targetPort || ''}`,
    ].sort();
    const pairKey = `${sortedPair[0]}↔${sortedPair[1]}`;
    const serial = pairIndex.get(pairKey) || 0;
    pairIndex.set(pairKey, serial + 1);
    const pathOffset = getParallelOffset(serial);

    // Connection line styles by kind
    let stroke = '#3498db';
    let strokeDasharray: string | undefined;
    let strokeWidth = 2;
    let animated = false;
    let labelText = '';

    if (conn.kind === 'pipe') {
      stroke = '#3498db';
      strokeWidth = 2.5;
      // Build pipe label: 使用设备编号标识来源和去向，方便追踪
      const medium = conn.medium || conn.attrs?.medium;
      const material = conn.attrs?.material;
      const dn = conn.attrs?.DN;

      const parts: string[] = [];
      parts.push(`${sourceUnit} → ${targetUnit}`);
      if (medium) parts.push(String(medium));
      if (material) parts.push(String(material));
      if (dn) parts.push(`DN${dn}`);
      labelText = parts.join(' | ');
    } else if (conn.kind === 'signal') {
      stroke = '#9b59b6';
      strokeDasharray = '5 3';
      animated = true;
      labelText = getLabel(conn.label, conn.id, mode);
    } else if (conn.kind === 'cable') {
      stroke = '#e67e22';
      strokeDasharray = '8 4 2 4';
      strokeWidth = 2;
      labelText = getLabel(conn.label, conn.id, mode);
    }

    edges.push({
      id: conn.id,
      type: 'smoothstep',
      source: sourceUnit,
      sourceHandle: sourcePort,
      target: targetUnit,
      targetHandle: targetPort,
      label: labelText,
      style: { stroke, strokeWidth, strokeDasharray },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke, width: 5, height: 5 },
      animated,
      data: {
        kind: conn.kind,
        sourceHandlePosition: sourcePortSide ? sideToPosition[sourcePortSide] : undefined,
        targetHandlePosition: targetPortSide ? sideToPosition[targetPortSide] : undefined,
        repeatLabel: conn.kind === 'pipe',
        labelRepeatDistance: PIPE_LABEL_REPEAT_DISTANCE,
        parallelOffset: pathOffset,
      },
      zIndex: 2000,
    });
  }

  // Annotations as nodes + dashed lines to their targets
  if (project.annotations) {
    for (const ann of project.annotations) {
      nodes.push({
        id: `ann-${ann.id}`,
        type: 'annotation',
        position: { x: ann.layout.x, y: ann.layout.y },
        data: { annotation: ann, displayMode: mode },
        draggable: true,
      });
      // Add a subtle dashed edge from annotation to its target
      if (ann.target) {
        let targetNodeId: string | undefined;
        if (project.units[ann.target]) {
          // Target is a unit
          targetNodeId = ann.target;
        } else {
          // Target might be a connection ID — find source unit of that connection
          const targetConn = project.connections.find((c) => c.id === ann.target);
          if (targetConn) {
            const [srcUnit] = targetConn.from.split('.');
            if (project.units[srcUnit]) targetNodeId = srcUnit;
          }
        }
        if (targetNodeId) {
          edges.push({
            id: `ann-edge-${ann.id}`,
            source: `ann-${ann.id}`,
            sourceHandle: 'ann-out',
            target: targetNodeId,
            targetHandle: 'ann-target',
            type: 'straight',
            style: { stroke: '#bbb', strokeWidth: 1, strokeDasharray: '4 3' },
            animated: false,
            selectable: false,
            focusable: false,
            data: { isAnnotationEdge: true },
          });
        }
      }
    }
  }

  return { nodes, edges };
}

// Wrap in provider for useReactFlow
export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  );
}

function AppInner() {
  // Load initial state: prefer localStorage, fallback to empty project
  const loadInitial = (): ProjectModel => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as ProjectModel;
        if (parsed && parsed.units && parsed.connections) {
          return {
            ...parsed,
            units: ensureProjectPortsHaveUid(parsed.units),
          };
        }
      }
    } catch { /* ignore corrupted data */ }
    return { project: { id: 'new-project', name: { zh: '新项目', en: 'New Project' } }, units: {}, connections: [], annotations: [] };
  };

  const { project, setProject, undo, redo, canUndo, canRedo } = useUndoRedo(loadInitial());
  const [displayMode, setDisplayMode] = useState<DisplayMode>('zh');
  const [selectedUnit, setSelectedUnit] = useState<{ id: string; unit: Unit } | null>(null);
  const [selectedConn, setSelectedConn] = useState<Connection | null>(null);
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const [activePort, setActivePort] = useState<SelectedHandle | null>(null);
  const [quickConnectSource, setQuickConnectSource] = useState<SelectedHandle | null>(null);

  // YAML editor state
  const [showYamlEditor, setShowYamlEditor] = useState(false);
  const [yamlText, setYamlText] = useState(() => projectToYaml(project));
  const [yamlError, setYamlError] = useState<string | null>(null);
  const [isPropertyPanelCollapsed, setIsPropertyPanelCollapsed] = useState(false);
  const [propertyPanelWidth, setPropertyPanelWidth] = useState(PROPERTY_PANEL_DEFAULT_WIDTH);
  const yamlChangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const propertyPanelResizeStartRef = useRef({ x: 0, width: PROPERTY_PANEL_DEFAULT_WIDTH });
  const isYamlDriven = useRef(false); // prevent feedback loop

  // Context menu state
  type ContextMenuState = {
    x: number;
    y: number;
    target: import('./components/ContextMenu').ContextMenuTarget;
    canvasPos: { x: number; y: number };
    splitAt?: { x: number; y: number };
    pendingConnectionHint?: boolean;
  };
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  // Search bar state
  const [showSearch, setShowSearch] = useState(false);
  // Interaction mode: 'select' (drag to select) vs 'pan' (drag to pan)
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');
  const [interactionState, setInteractionState] = useState<CopyInteractionState>('idle');
  // Clipboard for copy/paste
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  const edgeClipboardRef = useRef<EdgeClipboardPayload | null>(null);
  const pendingConnectionRef = useRef<ConnectStartEndpoint | null>(null);
  const isPendingConnectionByDragRef = useRef(false);
  const [isPendingConnectionCreateUnit, setIsPendingConnectionCreateUnit] = useState(false);

  const reactFlowInstance = useReactFlow();
  const mutations = useProjectMutations(setProject);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [isResizingPropertyPanel, setIsResizingPropertyPanel] = useState(false);

  const handlePropertyPanelResizeStart = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    propertyPanelResizeStartRef.current = {
      x: event.clientX,
      width: propertyPanelWidth,
    };
    setIsResizingPropertyPanel(true);
  }, [propertyPanelWidth]);

  const handleTogglePropertyPanel = useCallback(() => {
    setIsPropertyPanelCollapsed((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isResizingPropertyPanel) return;

    const onMouseMove = (ev: globalThis.MouseEvent) => {
      const delta = propertyPanelResizeStartRef.current.x - ev.clientX;
      const nextWidth = Math.max(
        PROPERTY_PANEL_MIN_WIDTH,
        Math.min(PROPERTY_PANEL_MAX_WIDTH, propertyPanelResizeStartRef.current.width + delta),
      );
      setPropertyPanelWidth(nextWidth);
    };

    const onMouseUp = () => {
      setIsResizingPropertyPanel(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
    };
  }, [isResizingPropertyPanel]);

  const resetPendingConnection = useCallback(() => {
    pendingConnectionRef.current = null;
    setIsPendingConnectionCreateUnit(false);
    setActivePort(null);
    setQuickConnectSource(null);
    isPendingConnectionByDragRef.current = false;
  }, []);

  const handlePortSelect = useCallback((unitId: string, handleId: string) => {
    const next = { nodeId: unitId, handleId };
    setActivePort(next);
    setQuickConnectSource(next);
    const unit = project.units[unitId];
    if (unit) {
      setSelectedUnit({ id: unitId, unit });
      setSelectedConn(null);
      setSelectedAnnotation(null);
    }
  }, [project]);

  const getPointerFromEvent = useCallback((event: MouseEvent | TouchEvent) => {
    const touch = (event as TouchEvent).touches?.[0] || (event as TouchEvent).changedTouches?.[0];
    const x = touch?.clientX ?? (event as MouseEvent).clientX;
    const y = touch?.clientY ?? (event as MouseEvent).clientY;
    return { x, y };
  }, []);

  const isPaneBlankTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    if (!target.closest('.react-flow__pane')) return false;
    return !target.closest('.react-flow__node')
      && !target.closest('.react-flow__handle')
      && !target.closest('.react-flow__edge');
  }, []);

  const getFlowPositionFromEvent = useCallback((event: MouseEvent | TouchEvent) => {
    const { x, y } = getPointerFromEvent(event);
    const pane = (event.target instanceof Element ? event.target.closest('.react-flow__pane') : null) || document.querySelector('.react-flow__pane');
    const bounds = pane?.getBoundingClientRect();
    return reactFlowInstance.screenToFlowPosition({
      x: x - (bounds?.left || 0),
      y: y - (bounds?.top || 0),
    });
  }, [reactFlowInstance, getPointerFromEvent]);

  const isPrimaryMouseRelease = useCallback((event: MouseEvent | TouchEvent) => {
    if (event instanceof MouseEvent) {
      return event.button === 0;
    }
    return true;
  }, []);

  const isPrimaryMousePress = useCallback((event: MouseEvent | TouchEvent) => {
    if (event instanceof MouseEvent) {
      return event.button === 0;
    }
    return true;
  }, []);

  const flowCursorClass = interactionMode === 'pan'
    ? interactionState === 'dragging-node' ? 'flow-cursor-dragging' : 'flow-cursor-pan'
    : interactionState === 'connecting' ? 'flow-cursor-connecting' : interactionState === 'dragging-node' ? 'flow-cursor-dragging' : 'flow-cursor-select';

  const flowModeHint = interactionMode === 'pan'
    ? '当前模式: 平移'
    : interactionState === 'connecting'
      ? '当前模式: 连线中'
    : interactionState === 'dragging-node'
      ? '当前模式: 拖拽中'
      : '当前模式: 选择';
  const propertyPanelTitle = displayMode === 'zh' ? '属性面板' : 'Property Panel';
  const propertyPanelCollapseTitle = displayMode === 'zh' ? (isPropertyPanelCollapsed ? '展开属性面板' : '收起属性面板') : (isPropertyPanelCollapsed ? 'Expand Property Panel' : 'Collapse Property Panel');

  const panelWidth = isPropertyPanelCollapsed ? PROPERTY_PANEL_COLLAPSED_WIDTH : propertyPanelWidth;

  // Auto-save to localStorage (debounced 2s)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      } catch { /* quota exceeded, ignore */ }
    }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [project]);

  // Manual save to localStorage
  const handleManualSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch { /* ignore */ }
    // Also save as a named file download
    const name = prompt('请输入文件名 (不含扩展名):', project.project?.name?.zh || 'logic-diagram');
    if (!name) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${name}.logic.json`);
  };

  // Open/load a saved JSON file
  const openFileInputRef = useRef<HTMLInputElement>(null);
  const handleOpenFile = () => { openFileInputRef.current?.click(); };
  const handleOpenFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        let imported: ProjectModel;
        if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
          imported = parseProjectYaml(text);
        } else {
          const raw = JSON.parse(text) as ProjectModel;
          imported = { ...raw, units: ensureProjectPortsHaveUid(raw.units || {}) };
        }
        if (imported && imported.units && imported.connections) {
          setProject(imported);
          setSelectedUnit(null);
          setSelectedConn(null);
          setSelectedAnnotation(null);
        } else {
          alert('文件格式不正确：缺少 units 或 connections');
        }
      } catch (err) {
        alert(`文件解析失败: ${err instanceof Error ? err.message : err}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Sync project → YAML text (when project changes from canvas edits)
  useEffect(() => {
    if (isYamlDriven.current) {
      isYamlDriven.current = false;
      return;
    }
    if (showYamlEditor) {
      setYamlText(projectToYaml(project));
      setYamlError(null);
    }
  }, [project, showYamlEditor]);

  // YAML editor onChange: debounced parse → update project
  const handleYamlChange = useCallback((newText: string) => {
    setYamlText(newText);
    if (yamlChangeTimer.current) clearTimeout(yamlChangeTimer.current);
    yamlChangeTimer.current = setTimeout(() => {
      try {
        const parsed = parseProjectYaml(newText);
        if (parsed && parsed.units && parsed.connections) {
          setYamlError(null);
          isYamlDriven.current = true;
          setProject(parsed);
        } else {
          setYamlError('YAML 结构不完整: 缺少 units 或 connections');
        }
      } catch (err) {
        setYamlError(err instanceof Error ? err.message : String(err));
      }
    }, 600);
  }, [setProject]);

  // Sync flow state from project model
  useEffect(() => {
    const { nodes: n, edges: e } = projectToFlow(project, displayMode, activePort, handlePortSelect);
    setNodes(n);
    setEdges(e);
  }, [project, displayMode, activePort, handlePortSelect, setNodes, setEdges]);

  // Refresh selected data when project changes
  useEffect(() => {
    if (selectedUnit) {
      const unit = project.units[selectedUnit.id];
      if (unit) {
        setSelectedUnit({ id: selectedUnit.id, unit });
      } else {
        setSelectedUnit(null);
      }
    }
    if (selectedConn) {
      const conn = project.connections.find((c) => c.id === selectedConn.id);
      if (conn) {
        setSelectedConn(conn);
      } else {
        setSelectedConn(null);
      }
    }
    if (selectedAnnotation) {
      const ann = (project.annotations || []).find((a) => a.id === selectedAnnotation.id);
      if (ann) {
        setSelectedAnnotation(ann);
      } else {
        setSelectedAnnotation(null);
      }
    }
  }, [project]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        resetPendingConnection();
      }
      const isMeta = e.metaKey || e.ctrlKey;
      // Skip shortcuts when typing in input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Undo: Ctrl+Z / Cmd+Z
      if (isMeta && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      // Redo: Ctrl+Shift+Z / Cmd+Shift+Z or Ctrl+Y
      if ((isMeta && e.shiftKey && e.key === 'z') || (isMeta && e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }
      // Search: Ctrl+F / Cmd+F
      if (isMeta && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        return;
      }
      // Copy: Ctrl+C / Cmd+C
      if (isMeta && e.key === 'c' && selectedUnit) {
        e.preventDefault();
        clipboardRef.current = {
          unit: JSON.parse(JSON.stringify(selectedUnit.unit)),
          sourceId: selectedUnit.id,
          sourcePos: selectedUnit.unit.layout,
        };
        return;
      }
      // Cut: Ctrl+X / Cmd+X
      if (isMeta && e.key === 'x' && selectedUnit) {
        e.preventDefault();
        clipboardRef.current = {
          unit: JSON.parse(JSON.stringify(selectedUnit.unit)),
          sourceId: selectedUnit.id,
          sourcePos: selectedUnit.unit.layout,
        };
        mutations.deleteUnit(selectedUnit.id);
        setSelectedUnit(null);
        return;
      }
      // Paste: Ctrl+V / Cmd+V
      if (isMeta && e.key === 'v' && clipboardRef.current) {
        e.preventDefault();
        handlePasteUnit();
        return;
      }
      // Delete selected (Delete key or Backspace)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedUnit, selectedConn, selectedAnnotation, resetPendingConnection]);

  // Layout persistence - save position on drag stop
  const onNodeDragStart = useCallback((_event: unknown) => {
    setInteractionState('dragging-node');
  }, []);

  const onNodeDragStop = useCallback((_event: unknown, node: Node) => {
    // Check if it's an annotation node
    if (node.id.startsWith('ann-')) {
      const annId = node.id.replace('ann-', '');
      mutations.updateAnnotation(annId, { layout: { x: node.position.x, y: node.position.y } });
    } else {
      mutations.updateUnitLayout(node.id, node.position.x, node.position.y);
    }
    setInteractionState('idle');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, [mutations]) as any;

  // Connect handler - create connection from port drag
  const onConnect: OnConnect = useCallback((params) => {
    if (params.source && params.target && params.sourceHandle && params.targetHandle) {
      const from = `${params.source}.${params.sourceHandle}`;
      const to = `${params.target}.${params.targetHandle}`;
      mutations.addConnection(from, to, 'pipe');
      setActivePort(null);
      resetPendingConnection();
    }
  }, [mutations, resetPendingConnection]);

  const inferPortDirection = useCallback((unit: Unit | undefined, portId: string | null | undefined): PortDirection | null => {
    if (!unit || !portId) return null;
    const port = unit.ports?.[portId];
    if (!port) return null;
    if (port.direction) return port.direction;
    return null;
  }, []);

  const isValidPortDirectionConnection = useCallback((fromDirection: PortDirection | null, toDirection: PortDirection | null): boolean => {
    // Bidirectional ports can connect both ways. Input ports are sink-only, output ports are source-only.
    if (!fromDirection || !toDirection) return true;
    const sourceCanStart = fromDirection === 'output' || fromDirection === 'bidirectional';
    const targetCanAccept = toDirection === 'input' || toDirection === 'bidirectional';
    return sourceCanStart && targetCanAccept;
  }, []);

  const isValidConnection = useCallback((connection: ReactFlowConnection) => {
    const sourceHandle = connection.sourceHandle;
    const targetHandle = connection.targetHandle;
    if (!connection.source || !connection.target || !sourceHandle || !targetHandle) {
      return false;
    }
    const sourceUnit = project.units[connection.source];
    const targetUnit = project.units[connection.target];
    const sourceDirection = inferPortDirection(sourceUnit, sourceHandle);
    const targetDirection = inferPortDirection(targetUnit, targetHandle);
    return isValidPortDirectionConnection(sourceDirection, targetDirection);
  }, [inferPortDirection, isValidPortDirectionConnection, project.units]);

  const getPortByDirection = useCallback((unit: Unit | undefined, direction: PortDirection | null): string | null => {
    if (!unit?.ports) return null;
    if (!direction) {
      return Object.keys(unit.ports)[0] || null;
    }
    for (const [portId] of Object.entries(unit.ports)) {
      if (inferPortDirection(unit, portId) === direction) {
        return portId;
      }
    }
    return Object.keys(unit.ports)[0] || null;
  }, [inferPortDirection]);

  const focusFlowNode = useCallback((nodeId: string) => {
    const node = reactFlowInstance.getNode(nodeId);
    if (!node) return false;

    setNodes((prevNodes) => prevNodes.map((n) => ({
      ...n,
      selected: n.id === nodeId,
    })));
    setEdges((prevEdges) => prevEdges.map((edge) => ({
      ...edge,
      selected: false,
    })));
    reactFlowInstance.setCenter(
      node.position.x + 70,
      node.position.y + 30,
      { zoom: 1.2, duration: 550 },
    );
    return true;
  }, [reactFlowInstance, setEdges, setNodes]);

  const focusFlowEdge = useCallback((edgeId: string) => {
    const edge = reactFlowInstance.getEdges().find((e) => e.id === edgeId);
    if (!edge) return false;

    const sourceNode = edge.source ? reactFlowInstance.getNode(edge.source) : null;
    const targetNode = edge.target ? reactFlowInstance.getNode(edge.target) : null;

    const centerX = sourceNode && targetNode
      ? ((sourceNode.position.x + targetNode.position.x) / 2 + 70)
      : typeof sourceNode?.position.x === 'number'
        ? sourceNode.position.x + 70
        : typeof targetNode?.position.x === 'number'
          ? targetNode.position.x + 70
          : 0;
    const centerY = sourceNode && targetNode
      ? ((sourceNode.position.y + targetNode.position.y) / 2 + 30)
      : typeof sourceNode?.position.y === 'number'
        ? sourceNode.position.y + 30
        : typeof targetNode?.position.y === 'number'
          ? targetNode.position.y + 30
          : 0;

    reactFlowInstance.setCenter(centerX, centerY, { zoom: 1.2, duration: 550 });
    return true;
  }, [reactFlowInstance]);

  const onConnectStart: OnConnectStart = useCallback((event, params) => {
    if (!isPrimaryMousePress(event)) return;
    if (!params.nodeId || !params.handleId) return;
    setInteractionState('connecting');
    const source = { nodeId: params.nodeId, handleId: params.handleId };
    setActivePort(source);
    setQuickConnectSource(source);
    const unit = project.units[params.nodeId];
    if (unit) {
      setSelectedUnit({ id: params.nodeId, unit });
      setSelectedConn(null);
      setSelectedAnnotation(null);
    }
    pendingConnectionRef.current = {
      nodeId: params.nodeId,
      handleId: params.handleId,
      handleType: params.handleType || null,
    };
    isPendingConnectionByDragRef.current = true;
  }, [isPrimaryMousePress, project]);

  const onConnectEnd: OnConnectEnd = useCallback((event, connectionState) => {
    setInteractionState('idle');
    if (!pendingConnectionRef.current || !isPendingConnectionByDragRef.current) {
      resetPendingConnection();
      return;
    }
    if (!isPrimaryMouseRelease(event)) {
      resetPendingConnection();
      return;
    }

    const hasRealTarget = Boolean(connectionState.toNode && connectionState.toHandle);
    if (hasRealTarget) {
      resetPendingConnection();
      return;
    }
    const pointer = getPointerFromEvent(event);

    if (!isPaneBlankTarget(event.target)) {
      resetPendingConnection();
      return;
    }

    const flowPos = getFlowPositionFromEvent(event);
    setContextMenu({
      x: pointer.x,
      y: pointer.y,
      target: { type: 'canvas' },
      canvasPos: flowPos,
      pendingConnectionHint: true,
    });
    setIsPendingConnectionCreateUnit(true);
  }, [getFlowPositionFromEvent, getPointerFromEvent, isPaneBlankTarget, resetPendingConnection, isPrimaryMouseRelease]);

  const onPaneClick = useCallback(() => {
    setActivePort(null);
    setQuickConnectSource(null);
    if (isPendingConnectionByDragRef.current) {
      resetPendingConnection();
    }
  }, [resetPendingConnection]);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    // Annotation node clicked
    if (node.id.startsWith('ann-')) {
      const annId = node.id.replace('ann-', '');
      const ann = (project.annotations || []).find((a) => a.id === annId);
      if (ann) {
        setSelectedAnnotation(ann);
        setSelectedUnit(null);
        setSelectedConn(null);
        setQuickConnectSource(null);
        setActivePort(null);
        focusFlowNode(node.id);
      }
      return;
    }

    const eventTarget = _event.target as Element | null;
    if (eventTarget?.closest('.react-flow__handle')) {
      const unit = project.units[node.id];
      if (unit) {
        setSelectedUnit({ id: node.id, unit });
        setSelectedConn(null);
        setSelectedAnnotation(null);
        setQuickConnectSource(null);
        setActivePort(null);
      }
      return;
    }

    const unit = project.units[node.id];
    if (unit) {
      if (quickConnectSource && quickConnectSource.nodeId !== node.id) {
        const sourceUnit = project.units[quickConnectSource.nodeId];
        if (!sourceUnit) {
          resetPendingConnection();
          setSelectedUnit({ id: node.id, unit });
          setSelectedConn(null);
          setSelectedAnnotation(null);
          focusFlowNode(node.id);
          return;
        }

        const sourceDirection = inferPortDirection(sourceUnit, quickConnectSource.handleId) || 'output';
        const sourcePortKind = sourceUnit.ports?.[quickConnectSource.handleId]?.kind ?? 'pipe';
        const targetPreferredDirection: PortDirection = sourceDirection === 'input' ? 'output' : 'input';
        const targetPort = getPortByDirection(unit, targetPreferredDirection)
          || getPortByDirection(unit, 'bidirectional')
          || getPortByDirection(unit, null);

        if (targetPort) {
          const from = sourceDirection === 'input'
            ? `${node.id}.${targetPort}`
            : `${quickConnectSource.nodeId}.${quickConnectSource.handleId}`;
          const to = sourceDirection === 'input'
            ? `${quickConnectSource.nodeId}.${quickConnectSource.handleId}`
            : `${node.id}.${targetPort}`;

          mutations.addConnection(from, to, sourcePortKind);
        }

        setQuickConnectSource(null);
        setActivePort(null);
        setSelectedUnit({ id: node.id, unit });
        setSelectedConn(null);
        setSelectedAnnotation(null);
        focusFlowNode(node.id);
        return;
      }

      if (quickConnectSource && quickConnectSource.nodeId === node.id) {
        resetPendingConnection();
      }

      setSelectedUnit({ id: node.id, unit });
      setSelectedConn(null);
      setSelectedAnnotation(null);
      setActivePort(null);
      focusFlowNode(node.id);
    }
  }, [project, focusFlowNode, quickConnectSource, inferPortDirection, getPortByDirection, mutations, resetPendingConnection]);

  const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    const conn = project.connections.find((c) => c.id === edge.id);
    if (conn) {
      setSelectedConn(conn);
      setSelectedUnit(null);
      setSelectedAnnotation(null);
      focusFlowEdge(edge.id);
    }
  }, [project, focusFlowEdge]);

  // Double-click edge to edit label inline
  const onEdgeDoubleClick: EdgeMouseHandler = useCallback((_event, edge) => {
    const conn = project.connections.find((c) => c.id === edge.id);
    if (!conn) return;
    const currentLabel = conn.label?.zh || conn.label?.en || '';
    const newLabel = prompt('编辑连接线标签/Edit edge label:', currentLabel);
    if (newLabel !== null) {
      mutations.updateConnection(conn.id, { label: { ...conn.label, zh: newLabel } });
    }
  }, [project, mutations]);

  // Add unit
  const handleAddUnit = (type: UnitType) => {
    mutations.addUnit(type, { x: 200 + Math.random() * 200, y: 150 + Math.random() * 150 });
  };

  // Delete selected (with confirmation)
  const handleDeleteSelected = () => {
    if (selectedUnit) {
      if (!confirm(`确定删除设备 ${selectedUnit.id}？相关连接也将被删除。`)) return;
      mutations.deleteUnit(selectedUnit.id);
      setSelectedUnit(null);
    } else if (selectedConn) {
      if (!confirm(`确定删除连接 ${selectedConn.id}？`)) return;
      mutations.deleteConnection(selectedConn.id);
      setSelectedConn(null);
    } else if (selectedAnnotation) {
      if (!confirm(`确定删除注释 ${selectedAnnotation.id}？`)) return;
      mutations.deleteAnnotation(selectedAnnotation.id);
      setSelectedAnnotation(null);
    }
  };

  // Add annotation for a specific target (unit or connection)
  const handleAddAnnotation = (targetId?: string) => {
    const target = targetId || selectedUnit?.id || selectedConn?.id;
    if (!target) {
      alert('请先选中一个设备或管道，再添加注释');
      return;
    }
    setProject((prev) => {
      const annotations = prev.annotations || [];
      let max = 0;
      for (const a of annotations) {
        const match = a.id.match(/^T-(\d+)$/);
        if (match) max = Math.max(max, parseInt(match[1], 10));
      }
      const id = `T-${String(max + 1).padStart(3, '0')}`;
      // Position near the target unit if possible
      const targetUnit = prev.units[target];
      const baseX = targetUnit?.layout?.x ?? 300;
      const baseY = targetUnit?.layout?.y ?? 100;
      const newAnnotation: Annotation = {
        id,
        target,
        text: { zh: '新注释', en: 'New annotation' },
        layout: { x: baseX + 180, y: baseY + Math.random() * 60 },
      };
      return { ...prev, annotations: [...annotations, newAnnotation] };
    });
  };

  // SVG export
  const handleExportSvg = () => {
    const svgEl = document.querySelector('.react-flow__viewport');
    if (!svgEl) return;
    const flowContainer = document.querySelector('.react-flow');
    if (!flowContainer) return;
    const rect = flowContainer.getBoundingClientRect();
    const svgData = `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">
          ${flowContainer.innerHTML}
        </div>
      </foreignObject>
    </svg>`;
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    downloadBlob(blob, 'logic-diagram.svg');
  };

  // YAML file import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleImportYaml = () => {
    fileInputRef.current?.click();
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const imported = parseProjectYaml(text);
        setProject(imported);
        setSelectedUnit(null);
        setSelectedConn(null);
        setSelectedAnnotation(null);
      } catch (err) {
        alert(`YAML 解析失败: ${err instanceof Error ? err.message : err}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'project.logic.json');
  };

  const handleExportYaml = () => {
    const blob = new Blob([projectToYaml(project)], { type: 'text/yaml' });
    downloadBlob(blob, 'project.logic.yaml');
  };

  // DSL import: prompt for text, parse, append connections
  const handleImportDsl = () => {
    const example = '# 示例:\n# PIPE L-001 DN80 medium=水: V-101.outlet -> P-101.inlet\n# SIGNAL S-001: AI-201.out -> XV-101.cmd';
    const input = prompt(`输入 DSL 连接定义（每行一条）:\n\n${example}\n\n请输入:`);
    if (!input) return;
    const result = parseDsl(input);
    if (result.errors.length > 0) {
      alert(`DSL 解析错误:\n${result.errors.map((e) => `第${e.line}行: ${e.message}`).join('\n')}`);
    }
    if (result.connections.length > 0) {
      setProject((prev) => ({
        ...prev,
        connections: [...prev.connections, ...result.connections],
      }));
    }
  };

  // Paste unit (copy with offset)
  const handlePasteUnit = (position?: { x: number; y: number }) => {
    const clip = clipboardRef.current;
    if (!clip) return;
    const sourceX = clip.sourcePos?.x ?? clip.unit.layout?.x ?? 0;
    const sourceY = clip.sourcePos?.y ?? clip.unit.layout?.y ?? 0;
    const cursorX = position?.x ?? sourceX;
    const cursorY = position?.y ?? sourceY;
    const nextX = cursorX + 50;
    const nextY = cursorY + 50;
    let pastedUnit: Unit | null = null;
    let nextId = '';

    setProject((prev) => {
      const prefix = getUnitIdPrefix(clip.unit.type);
      let max = 100;
      for (const id of Object.keys(prev.units)) {
        const m = id.match(new RegExp(`^${prefix}-(\\d+)$`));
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
      const newId = `${prefix}-${max + 1}`;
      const usedPortUids = collectUsedPortUids(prev.units);
      const hydratedUnit = ensureUnitPortsHaveUid(newId, {
        ...clip.unit,
        layout: { x: nextX, y: nextY },
      }, usedPortUids);
      nextId = newId;
      pastedUnit = hydratedUnit;

      return { ...prev, units: { ...prev.units, [newId]: hydratedUnit } };
    });
    if (nextId && pastedUnit) {
      setSelectedUnit({ id: nextId, unit: pastedUnit });
      setSelectedConn(null);
      setSelectedAnnotation(null);
    }
  };

  const handlePasteEdge = () => {
    const clip = edgeClipboardRef.current;
    if (!clip) return;
    const sourceConnection = clip.connection;
    let pastedConnection: Connection | null = null;

    setProject((prev) => {
      const prefixMap: Record<ConnectionKind, string> = { pipe: 'L', signal: 'S', cable: 'C' };
      const prefix = prefixMap[sourceConnection.kind] || 'L';
      let max = 0;
      for (const c of prev.connections) {
        const m = c.id.match(new RegExp(`^${prefix}-(\\d+)$`));
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
      const nextId = `${prefix}-${String(max + 1).padStart(3, '0')}`;
      const copied = JSON.parse(JSON.stringify(sourceConnection)) as Connection;
      copied.id = nextId;
      pastedConnection = copied;
      return { ...prev, connections: [...prev.connections, copied] };
    });
    if (pastedConnection) {
      setSelectedConn(pastedConnection);
      setSelectedUnit(null);
      setSelectedAnnotation(null);
    }
  };

  // Context menu: right-click on node
  const onNodeContextMenu = useCallback((event: any, node: Node) => {
    if (isPendingConnectionCreateUnit || isPendingConnectionByDragRef.current) {
      resetPendingConnection();
    }
    setActivePort(null);
    event.preventDefault();
    const nodeId = node.id.startsWith('ann-') ? node.id : node.id;
    setContextMenu({ x: event.clientX, y: event.clientY, target: { type: 'node', nodeId }, canvasPos: node.position, pendingConnectionHint: false });
  }, [isPendingConnectionCreateUnit, resetPendingConnection]);

  // Context menu: right-click on edge
  const onEdgeContextMenu = useCallback((event: any, edge: Edge) => {
    if (isPendingConnectionCreateUnit || isPendingConnectionByDragRef.current) {
      resetPendingConnection();
    }
    setActivePort(null);
    event.preventDefault();
    const splitAt = getFlowPositionFromEvent(event);
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      target: { type: 'edge', edgeId: edge.id },
      canvasPos: splitAt,
      splitAt,
      pendingConnectionHint: false,
    });
  }, [getFlowPositionFromEvent, isPendingConnectionCreateUnit, resetPendingConnection]);

  // Context menu: right-click on canvas
  const onPaneContextMenu = useCallback((event: any) => {
    if (isPendingConnectionCreateUnit || isPendingConnectionByDragRef.current) {
      resetPendingConnection();
    }
    setActivePort(null);
    event.preventDefault();
    const rfEvent = event as React.MouseEvent;
    // Convert screen position to flow position
    const bounds = (rfEvent.currentTarget as HTMLElement)?.getBoundingClientRect?.();
    const position = reactFlowInstance.screenToFlowPosition({
      x: rfEvent.clientX - (bounds?.left || 0),
      y: rfEvent.clientY - (bounds?.top || 0),
    });
    setContextMenu({ x: rfEvent.clientX, y: rfEvent.clientY, target: { type: 'canvas' }, canvasPos: position, pendingConnectionHint: false });
  }, [reactFlowInstance, isPendingConnectionCreateUnit, resetPendingConnection]);

  // Context menu handlers
  const handleContextAddUnit = (type: UnitType, position: { x: number; y: number }) => {
    const newUnitId = mutations.addUnit(type, position);
    if (isPendingConnectionCreateUnit && newUnitId && pendingConnectionRef.current) {
      const sourceUnit = project.units[pendingConnectionRef.current.nodeId];
      if (!sourceUnit) {
        resetPendingConnection();
        return;
      }
      const sourcePortKind = sourceUnit.ports?.[pendingConnectionRef.current.handleId]?.kind ?? 'pipe';
      const from = pendingConnectionRef.current.handleType === 'target'
        ? `${newUnitId}.${getDefaultPort(type, 'output')}`
        : `${pendingConnectionRef.current.nodeId}.${pendingConnectionRef.current.handleId}`;
      const to = pendingConnectionRef.current.handleType === 'target'
        ? `${pendingConnectionRef.current.nodeId}.${pendingConnectionRef.current.handleId}`
        : `${newUnitId}.${getDefaultPort(type, 'input')}`;
      mutations.addConnection(from, to, sourcePortKind);
      resetPendingConnection();
    }
    if (!isPendingConnectionCreateUnit) {
      return;
    }
    resetPendingConnection();
  };
  const handleContextAddAnnotation = (position: { x: number; y: number }, targetId?: string) => {
    setProject((prev) => {
      const annotations = prev.annotations || [];
      let max = 0;
      for (const a of annotations) {
        const m = a.id.match(/^T-(\d+)$/);
        if (m) max = Math.max(max, parseInt(m[1], 10));
      }
      const id = `T-${String(max + 1).padStart(3, '0')}`;
      const ann: Annotation = {
        id,
        target: targetId ?? undefined,
        text: { zh: '新注释', en: 'New annotation' },
        layout: { x: position.x, y: position.y },
      };
      return { ...prev, annotations: [...annotations, ann] };
    });
  };
  const handleContextDeleteNode = (nodeId: string) => {
    if (nodeId.startsWith('ann-')) {
      mutations.deleteAnnotation(nodeId.replace('ann-', ''));
      setSelectedAnnotation(null);
    } else {
      mutations.deleteUnit(nodeId);
      setSelectedUnit(null);
    }
  };
  const handleContextDeleteEdge = (edgeId: string) => {
    mutations.deleteConnection(edgeId);
    setSelectedConn(null);
  };
  const handleContextRenameNode = (nodeId: string) => {
    if (nodeId.startsWith('ann-')) return;
    const unit = project.units[nodeId];
    if (!unit) return;
    const next = prompt('重命名设备 UID:', nodeId);
    if (!next || !next.trim()) return;
    const newId = next.trim();
    if (newId === nodeId) return;
    mutations.renameUnit(nodeId, newId);
    if (selectedUnit?.id === nodeId) {
      setSelectedUnit({ id: newId, unit });
    }
  };
  const handleContextCutNode = (nodeId: string) => {
    if (nodeId.startsWith('ann-')) return;
    const unit = project.units[nodeId];
    if (!unit) return;
    clipboardRef.current = {
      unit: JSON.parse(JSON.stringify(unit)),
      sourceId: nodeId,
      sourcePos: unit.layout,
    };
    mutations.deleteUnit(nodeId);
    setSelectedUnit(null);
  };
  const handleContextCopyNode = (nodeId: string) => {
    if (nodeId.startsWith('ann-')) return;
    const unit = project.units[nodeId];
    if (unit) {
      clipboardRef.current = { unit: JSON.parse(JSON.stringify(unit)), sourceId: nodeId, sourcePos: unit.layout };
    }
  };
  const handleContextCopyEdge = (edgeId: string) => {
    const connection = project.connections.find((c) => c.id === edgeId);
    if (connection) {
      edgeClipboardRef.current = { connection: JSON.parse(JSON.stringify(connection)) };
    }
  };
  const handleContextEditEdgeLabel = (edgeId: string) => {
    const connection = project.connections.find((c) => c.id === edgeId);
    if (!connection) return;
    const current = connection.label?.zh || connection.label?.en || '';
    const next = prompt('编辑连接线标签:', current);
    if (next === null) return;
    mutations.updateConnection(connection.id, { label: { ...connection.label, zh: next } });
  };

  // Search: locate node by ID
  const handleLocateNode = (nodeId: string) => {
    if (nodeId.startsWith('conn:')) {
      const edgeId = nodeId.slice(5);
      const conn = project.connections.find((c) => c.id === edgeId);
      if (conn && focusFlowEdge(edgeId)) {
        setSelectedConn(conn);
        setSelectedUnit(null);
        setSelectedAnnotation(null);
      }
      return;
    }

    if (nodeId.startsWith('ann-')) {
      const annId = nodeId.slice(4);
      const ann = (project.annotations || []).find((a) => a.id === annId);
      if (ann) {
        setSelectedAnnotation(ann);
        setSelectedUnit(null);
        setSelectedConn(null);
        focusFlowNode(nodeId);
      }
      return;
    }

    const unitNodeId = nodeId.startsWith('unit:') ? nodeId.slice(5) : nodeId;
    const unit = project.units[unitNodeId];
    if (unit && focusFlowNode(unitNodeId)) {
      setSelectedUnit({ id: unitNodeId, unit });
      setSelectedConn(null);
      setSelectedAnnotation(null);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* Main canvas */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Menu Bar */}
        <div style={{ borderBottom: '1px solid #ddd', background: '#f8f9fa' }}>
          {/* Top row: menu groups */}
          <div style={{ padding: '6px 12px', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ marginRight: 8, fontSize: 13 }}>Logic Diagram</strong>

            {/* File group */}
            <MenuGroup label="📁 文件">
              <MenuItem onClick={() => { if (confirm('新建空白文件将丢失未保存的更改，确定？')) { setProject({ project: { id: 'new-project', name: { zh: '新项目', en: 'New Project' } }, units: {}, connections: [], annotations: [] }); setSelectedUnit(null); setSelectedConn(null); setSelectedAnnotation(null); localStorage.removeItem(STORAGE_KEY); } }}>📄 新建空白文件</MenuItem>
              <MenuItem onClick={handleManualSave}>💾 保存为文件</MenuItem>
              <MenuItem onClick={handleOpenFile}>📂 打开文件</MenuItem>
              <MenuDivider />
              <MenuItem onClick={handleImportYaml}>导入 YAML</MenuItem>
              <MenuItem onClick={handleImportDsl}>导入 DSL</MenuItem>
              <MenuDivider />
              <MenuItem onClick={handleExportJson}>导出 JSON</MenuItem>
              <MenuItem onClick={handleExportYaml}>导出 YAML</MenuItem>
              <MenuItem onClick={handleExportSvg}>导出 SVG</MenuItem>
              <MenuItem onClick={() => exportAllCsv(project)}>导出 CSV</MenuItem>
              <MenuItem onClick={() => downloadSemanticGraph(project)}>导出语义图</MenuItem>
            </MenuGroup>

            {/* Add group */}
            <MenuGroup label="➕ 添加">
              <MenuItem onClick={() => handleAddUnit('vessel')}>容器/Vessel</MenuItem>
              <MenuItem onClick={() => handleAddUnit('pump')}>泵/Pump</MenuItem>
              <MenuItem onClick={() => handleAddUnit('valve')}>阀门/Valve</MenuItem>
              <MenuItem onClick={() => handleAddUnit('instrument')}>仪表/Instrument</MenuItem>
              <MenuItem onClick={() => handleAddUnit('custom')}>空白设备/Custom</MenuItem>
              <MenuItem onClick={() => handleAddUnit('junction')}>中间点/Junction</MenuItem>
              <MenuDivider />
              <MenuItem onClick={() => handleAddAnnotation()}>📝 注释/Annotation</MenuItem>
            </MenuGroup>

            <span style={separatorStyle} />

            {/* Quick actions */}
            <button onClick={undo} disabled={!canUndo} style={{ ...btnStyle, opacity: canUndo ? 1 : 0.4 }} title="撤销 (Ctrl+Z)">↩</button>
            <button onClick={redo} disabled={!canRedo} style={{ ...btnStyle, opacity: canRedo ? 1 : 0.4 }} title="重做 (Ctrl+Shift+Z)">↪</button>
            <button
              onClick={handleDeleteSelected}
              disabled={!selectedUnit && !selectedConn && !selectedAnnotation}
              style={{ ...btnStyle, color: selectedUnit || selectedConn || selectedAnnotation ? '#e74c3c' : '#999' }}
              title="删除选中 (Delete)"
            >🗑</button>
            <button onClick={() => setProject(applyDagreLayout(project))} style={btnStyle} title="自动整理布局">⚡ 布局</button>
            <button onClick={() => setShowSearch(true)} style={btnStyle} title="搜索 (Ctrl+F)">🔍</button>

            <span style={separatorStyle} />

            {/* Interaction mode toggle */}
            <button
              onClick={() => setInteractionMode('select')}
              style={{ ...btnStyle, background: interactionMode === 'select' ? '#e8f4fd' : '#fff', borderColor: interactionMode === 'select' ? '#3498db' : '#ccc' }}
              title="选择模式：拖动框选元件"
            >🖱️</button>
            <button
              onClick={() => setInteractionMode('pan')}
              style={{ ...btnStyle, background: interactionMode === 'pan' ? '#e8f4fd' : '#fff', borderColor: interactionMode === 'pan' ? '#3498db' : '#ccc' }}
              title="平移模式：拖动画布平移"
            >🖐️</button>

            <span style={separatorStyle} />

            <select value={displayMode} onChange={(e) => setDisplayMode(e.target.value as DisplayMode)} style={selectStyle}>
              <option value="zh">中文</option>
              <option value="en">English</option>
            </select>
            <span className="flow-mode-indicator" style={{ fontSize: 11, color: '#555', marginLeft: 6 }}>{flowModeHint}</span>

            <button
              onClick={() => { setShowYamlEditor((v) => !v); if (!showYamlEditor) setYamlText(projectToYaml(project)); }}
              style={{ ...btnStyle, background: showYamlEditor ? '#e8f4fd' : '#fff', borderColor: showYamlEditor ? '#3498db' : '#ccc' }}
              title="YAML 源码编辑器"
            >📝 YAML</button>
          </div>

          {/* Hidden file inputs */}
          <input ref={openFileInputRef} type="file" accept=".json,.yaml,.yml" style={{ display: 'none' }} onChange={handleOpenFileChange} />
          <input ref={fileInputRef} type="file" accept=".yaml,.yml" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        {/* React Flow Canvas */}
        <div style={{ flex: 1, position: 'relative' }} className={flowCursorClass}>
          {showSearch && (
            <SearchBar
              project={project}
              displayMode={displayMode}
              onLocateNode={handleLocateNode}
              onClose={() => setShowSearch(false)}
            />
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onEdgeDoubleClick={onEdgeDoubleClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            deleteKeyCode={deleteKeyCode}
            panOnDrag={interactionMode === 'pan'}
            selectionOnDrag={interactionMode === 'select'}
            isValidConnection={isValidConnection as IsValidConnection}
            fitView
          >
            <Controls />
            <MiniMap pannable zoomable />
            <Background />
          </ReactFlow>
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          target={contextMenu.target}
          canvasPosition={contextMenu.canvasPos}
          pendingConnectionHint={contextMenu.pendingConnectionHint}
          onClose={() => {
            setContextMenu(null);
            resetPendingConnection();
          }}
          onAddUnit={handleContextAddUnit}
          onAddAnnotation={handleContextAddAnnotation}
          onDeleteNode={handleContextDeleteNode}
          onDeleteEdge={handleContextDeleteEdge}
          onCopyNode={handleContextCopyNode}
          onRenameNode={handleContextRenameNode}
          onCutNode={handleContextCutNode}
          onCopyEdge={handleContextCopyEdge}
          onPasteNode={(position) => handlePasteUnit(position)}
          onEditEdgeLabel={handleContextEditEdgeLabel}
          onPasteEdge={handlePasteEdge}
          canPasteUnit={!!clipboardRef.current}
          canPasteEdge={!!edgeClipboardRef.current}
          onSplitEdge={(edgeId, splitAt) => {
            mutations.splitConnectionWithJunction(edgeId, splitAt ?? contextMenu.splitAt);
          }}
        />
      )}

      {/* YAML Editor Panel */}
      {showYamlEditor && (
        <div style={{ flex: '0 0 420px', width: 420, minWidth: 420, borderLeft: '1px solid #ddd', display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <div style={{ padding: '6px 12px', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8f9fa' }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>📝 YAML 源码</span>
            {yamlError && (
              <span style={{ fontSize: 11, color: '#e74c3c', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={yamlError}>
                ⚠️ {yamlError}
              </span>
            )}
            {!yamlError && <span style={{ fontSize: 11, color: '#27ae60' }}>✓ 有效</span>}
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <YamlEditor value={yamlText} onChange={handleYamlChange} />
          </div>
        </div>
      )}

      {/* Right panel */}
      <div
        style={{
          width: panelWidth,
          minWidth: isPropertyPanelCollapsed ? PROPERTY_PANEL_COLLAPSED_WIDTH : undefined,
          borderLeft: '1px solid #ddd',
          minHeight: 0,
          overflow: 'hidden',
          background: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
      >
        {!isPropertyPanelCollapsed && (
          <div
            onMouseDown={handlePropertyPanelResizeStart}
            title={displayMode === 'zh' ? '拖动调整宽度' : 'Drag to resize'}
            style={{
              position: 'absolute',
              left: -5,
              top: 0,
              bottom: 0,
              width: 10,
              cursor: 'col-resize',
              zIndex: 3,
            }}
          >
            <div style={{
              position: 'absolute',
              left: 4,
              top: 0,
              bottom: 0,
              width: 2,
              background: 'rgba(0,0,0,0.15)',
            }} />
          </div>
        )}
        <div style={{ padding: '6px 6px 4px', borderBottom: '1px solid #ddd', background: '#f8f9fa', display: 'flex', alignItems: 'center', justifyContent: isPropertyPanelCollapsed ? 'center' : 'space-between' }}>
          <button
            onClick={handleTogglePropertyPanel}
            title={propertyPanelCollapseTitle}
            style={{
              ...btnStyle,
              width: PROPERTY_PANEL_COLLAPSED_WIDTH - 8,
              minWidth: PROPERTY_PANEL_COLLAPSED_WIDTH - 8,
              height: 22,
              padding: 0,
              lineHeight: 1,
              fontSize: 14,
            }}
          >
            {isPropertyPanelCollapsed ? '◀' : '▶'}
          </button>
          {!isPropertyPanelCollapsed && (
            <span style={{ fontSize: 12, color: '#666', fontWeight: 600 }}>{propertyPanelTitle}</span>
          )}
        </div>
        {!isPropertyPanelCollapsed && (
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <PropertyPanel
                selectedUnit={selectedUnit}
                selectedConnection={selectedConn}
                selectedAnnotation={selectedAnnotation}
                selectedPortId={activePort?.nodeId === selectedUnit?.id ? activePort?.handleId : undefined}
                focusKey={selectedUnit ? `unit:${selectedUnit.id}` : selectedConn ? `conn:${selectedConn.id}` : selectedAnnotation ? `ann:${selectedAnnotation.id}` : ''}
                annotations={project.annotations || []}
                displayMode={displayMode}
                onUpdateUnit={mutations.updateUnit}
                onRenameUnit={(oldId, newId) => {
                  mutations.renameUnit(oldId, newId);
                  // Update selected unit to track the new ID
                  setSelectedUnit((prev) => prev && prev.id === oldId ? { ...prev, id: newId } : prev);
                }}
                onUpdateConnection={mutations.updateConnection}
                onUpdateAnnotation={mutations.updateAnnotation}
                onDeleteAnnotation={(id) => { mutations.deleteAnnotation(id); setSelectedAnnotation(null); }}
                onAddAnnotation={handleAddAnnotation}
                onAddPort={mutations.addPort}
                onDeletePort={mutations.deletePort}
              />
            </div>
            <div style={{ borderTop: '1px solid #ddd', overflow: 'auto', minHeight: 0, maxHeight: 280 }}>
              <ValidationPanel project={project} onLocate={handleLocateNode} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const btnStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid #ccc',
  borderRadius: 4,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 12,
};

const selectStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: 12,
};

const separatorStyle: React.CSSProperties = {
  borderLeft: '1px solid #ddd',
  height: 20,
  margin: '0 4px',
};

// --- Menu Components ---

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [isOpen]);

  return (
    <div ref={menuRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...btnStyle,
          background: isOpen ? '#e8f4fd' : '#fff',
          borderColor: isOpen ? '#3498db' : '#ccc',
        }}
      >
        {label}
      </button>
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 2,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            zIndex: 1000,
            minWidth: 160,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={() => {
        onClick();
        // Close menu by triggering outside click
        setTimeout(() => document.dispatchEvent(new MouseEvent('mousedown')), 0);
      }}
      style={{
        display: 'block',
        width: '100%',
        padding: '6px 12px',
        border: 'none',
        background: 'none',
        textAlign: 'left',
        cursor: 'pointer',
        fontSize: 12,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
    >
      {children}
    </button>
  );
}

function MenuDivider() {
  return <div style={{ height: 1, background: '#e0e0e0', margin: '4px 0' }} />;
}
