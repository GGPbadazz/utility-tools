import Dagre from '@dagrejs/dagre';
import type { ProjectModel } from '../domain/types';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 100;

/**
 * Apply dagre auto-layout to all units in the project.
 * Returns a new ProjectModel with updated layout positions.
 */
export function applyDagreLayout(project: ProjectModel): ProjectModel {
  const g = new Dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 160, edgesep: 40 });

  // Add unit nodes
  for (const [id, unit] of Object.entries(project.units)) {
    const w = unit.layout?.width || NODE_WIDTH;
    const h = unit.layout?.height || NODE_HEIGHT;
    g.setNode(id, { width: w, height: h });
  }

  // Add connection edges
  for (const conn of project.connections) {
    const [sourceUnit] = conn.from.split('.');
    const [targetUnit] = conn.to.split('.');
    if (g.hasNode(sourceUnit) && g.hasNode(targetUnit)) {
      g.setEdge(sourceUnit, targetUnit);
    }
  }

  Dagre.layout(g);

  // Build updated units with new positions
  const units = { ...project.units };
  for (const id of Object.keys(units)) {
    const node = g.node(id);
    if (node) {
      units[id] = {
        ...units[id],
        layout: {
          ...units[id].layout,
          x: node.x - (node.width || NODE_WIDTH) / 2,
          y: node.y - (node.height || NODE_HEIGHT) / 2,
        },
      };
    }
  }

  return { ...project, units };
}
