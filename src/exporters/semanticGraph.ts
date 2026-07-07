/**
 * Semantic Graph Exporter
 * 
 * Generates a semantic_graph.json for downstream 3D pipe routing systems.
 * Contains equipment nodes with port metadata, and edges representing
 * physical connections with DN, medium, and material attributes.
 */
import type { ProjectModel } from '../domain/types';
import { formatPipeLabel } from '../domain/piping';

export type SemanticNode = {
  id: string;
  type: string;
  label: string;
  ports: SemanticPort[];
  attrs: Record<string, unknown>;
  position?: { x: number; y: number };
};

export type SemanticPort = {
  id: string;
  uid?: string;
  kind: string;
  direction: string;
  DN?: number;
  side?: string;
  label?: string;
};

export type SemanticEdge = {
  id: string;
  kind: string;
  source: { unit: string; port: string };
  target: { unit: string; port: string };
  DN?: number;
  pipeLabel?: string;
  medium?: string;
  material?: string;
  insulation?: string;
  label?: string;
  attrs: Record<string, unknown>;
};

export type SemanticGraph = {
  version: string;
  project: { id: string; name?: string };
  nodes: SemanticNode[];
  edges: SemanticEdge[];
  metadata: {
    exportedAt: string;
    unitCount: number;
    connectionCount: number;
    portCount: number;
  };
};

export function exportSemanticGraph(project: ProjectModel): SemanticGraph {
  const nodes: SemanticNode[] = [];
  const edges: SemanticEdge[] = [];
  let totalPorts = 0;

  // Build nodes from units
  for (const [unitId, unit] of Object.entries(project.units)) {
    const ports: SemanticPort[] = [];
    if (unit.ports) {
      for (const [portId, port] of Object.entries(unit.ports)) {
        ports.push({
          id: portId,
          uid: port.uid,
          kind: port.kind,
          direction: port.direction || 'bidirectional',
          DN: port.DN,
          side: port.side,
          label: port.label?.en || port.label?.zh || portId,
        });
        totalPorts++;
      }
    }

    nodes.push({
      id: unitId,
      type: unit.type === 'custom' ? (unit.customType || 'custom') : unit.type,
      label: unit.label?.en || unit.label?.zh || unitId,
      ports,
      attrs: unit.attrs || {},
      position: unit.layout ? { x: unit.layout.x, y: unit.layout.y } : undefined,
    });
  }

  // Build edges from connections
  for (const conn of project.connections) {
    const [sourceUnit, sourcePort] = conn.from.split('.');
    const [targetUnit, targetPort] = conn.to.split('.');

    // Resolve DN from connection attrs or from ports
    let dn = conn.attrs?.DN as number | undefined;
    if (!dn) {
      const srcUnit = project.units[sourceUnit];
      const srcPort = srcUnit?.ports?.[sourcePort];
      if (srcPort?.DN) dn = srcPort.DN;
    }

    const medium = (conn as { medium?: string }).medium || (conn.attrs?.medium as string | undefined);
    const material = conn.attrs?.material as string | undefined;
    const insulation = conn.attrs?.insulation as string | undefined;
    const lineLabelForExport = conn.pipeLabel
      ? formatPipeLabel(conn.pipeLabel)
      : typeof conn.attrs?.lineLabel === 'string'
        ? conn.attrs.lineLabel
        : undefined;

    edges.push({
      id: conn.id,
      kind: conn.kind,
      source: { unit: sourceUnit, port: sourcePort },
      target: { unit: targetUnit, port: targetPort },
      DN: dn,
      pipeLabel: lineLabelForExport,
      medium,
      material,
      insulation,
      label: conn.label?.en || conn.label?.zh,
      attrs: conn.attrs || {},
    });
  }

  return {
    version: '1.0',
    project: {
      id: project.project?.id || 'unnamed',
      name: project.project?.name?.en || project.project?.name?.zh,
    },
    nodes,
    edges,
    metadata: {
      exportedAt: new Date().toISOString(),
      unitCount: nodes.length,
      connectionCount: edges.length,
      portCount: totalPorts,
    },
  };
}

export function downloadSemanticGraph(project: ProjectModel): void {
  const graph = exportSemanticGraph(project);
  const json = JSON.stringify(graph, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'semantic_graph.json';
  a.click();
  URL.revokeObjectURL(url);
}
