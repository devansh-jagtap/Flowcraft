import dagre from '@dagrejs/dagre';
import type { DiagramType, Direction, Graph, GraphNode, Point } from './types';

export interface Box extends Point {
  width: number;
  height: number;
}

const CHAR_WIDTH = 7.4;
const LINE_HEIGHT = 20;
const MAX_TEXT_WIDTH = 200;

/** Estimates node size from its text; good enough for layout without measuring the DOM. */
export function measureNode(node: GraphNode): { width: number; height: number } {
  const scale = node.shape === 'topic' && node.depth === 0 ? 1.2 : 1;
  const textWidth = node.label.length * CHAR_WIDTH * scale;
  const lines = Math.max(1, Math.ceil(textWidth / MAX_TEXT_WIDTH)) + (node.subtitle ? 1 : 0);
  const width = Math.min(Math.max(textWidth, (node.subtitle?.length ?? 0) * 6.6), MAX_TEXT_WIDTH);

  if (node.shape === 'decision') {
    // A diamond needs roughly twice the room of its text box.
    const size = Math.max(width + 70, 120);
    return { width: size, height: Math.max(lines * LINE_HEIGHT + 60, 90) };
  }
  return { width: Math.max(width + 36, 90), height: lines * LINE_HEIGHT * scale + 24 };
}

export function layoutGraph(graph: Graph, type: DiagramType, direction: Direction): Map<string, Box> {
  const g = new dagre.graphlib.Graph();
  const rankdir = type === 'mindmap' ? 'LR' : type === 'orgchart' ? 'TB' : direction;
  g.setGraph({
    rankdir,
    nodesep: type === 'flowchart' ? 40 : 18,
    ranksep: type === 'mindmap' ? 70 : 55,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) g.setNode(node.id, measureNode(node));
  for (const edge of graph.edges) g.setEdge(edge.source, edge.target);

  dagre.layout(g);

  const boxes = new Map<string, Box>();
  for (const id of g.nodes()) {
    const { x, y, width, height } = g.node(id);
    // dagre returns centre points; React Flow positions are top-left corners.
    boxes.set(id, { x: x - width / 2, y: y - height / 2, width, height });
  }
  return boxes;
}

/** Applies manually dragged positions on top of the automatic layout. */
export function withOverrides(boxes: Map<string, Box>, overrides: Record<string, Point>): Map<string, Box> {
  const result = new Map(boxes);
  for (const [id, point] of Object.entries(overrides)) {
    const box = result.get(id);
    if (box) result.set(id, { ...box, ...point });
  }
  return result;
}
