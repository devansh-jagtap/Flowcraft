import dagre from '@dagrejs/dagre';
import { layoutEr } from './layoutEr';
import { layoutSequence } from './layoutSequence';
import type { DiagramType, Direction, Graph, GraphNode, Point } from './types';

export interface Box extends Point {
  width: number;
  height: number;
}

const CHAR_WIDTH = 7.4;
const LINE_HEIGHT = 20;
const MAX_TEXT_WIDTH = 200;

/** UML class boxes: kept in sync with the class node styles. */
export const CLASS_BOX = { header: 32, stereotype: 16, line: 18, padding: 10, charWidth: 6.9 };

/** Containers (system boundary, sequence fragments) are sized around other nodes, never laid out. */
export const isContainer = (node: GraphNode) => node.shape === 'boundary' || node.shape === 'fragment';

function textSize(text: string, maxWidth = MAX_TEXT_WIDTH, scale = 1) {
  const textWidth = text.length * CHAR_WIDTH * scale;
  return { width: Math.min(textWidth, maxWidth), lines: Math.max(1, Math.ceil(textWidth / maxWidth)) };
}

/** Estimates node size from its text; good enough for layout without measuring the DOM. */
export function measureNode(node: GraphNode): { width: number; height: number } {
  const { width, lines } = textSize(node.label);

  switch (node.shape) {
    case 'decision': {
      // A diamond needs roughly twice the room of its text box.
      return { width: Math.max(width + 70, 120), height: Math.max(lines * LINE_HEIGHT + 60, 90) };
    }
    case 'relationship':
      return { width: Math.max(width + 72, 120), height: Math.max(lines * LINE_HEIGHT + 46, 70) };
    case 'attribute': {
      const t = textSize(node.label, 150);
      return { width: Math.max(t.width + 40, 84), height: t.lines * LINE_HEIGHT + 20 };
    }
    case 'entity':
      return { width: Math.max(width + 44, 110), height: lines * LINE_HEIGHT + 26 };
    case 'usecase': {
      const t = textSize(node.label, 170);
      return { width: Math.max(t.width + 60, 130), height: t.lines * LINE_HEIGHT + 34 };
    }
    case 'actor': {
      const t = textSize(node.label, 130);
      return { width: Math.max(t.width + 12, 70), height: 74 + t.lines * LINE_HEIGHT };
    }
    case 'state':
      return { width: Math.max(width + 40, 100), height: lines * LINE_HEIGHT + 22 };
    case 'initial':
      return { width: 26, height: 26 };
    case 'final':
      return { width: 32, height: 32 };
    case 'participant':
      return { width: Math.max(textSize(node.label, 160).width + 32, 96), height: 60 };
    case 'class':
      return measureClass(node);
    case 'boundary':
    case 'fragment':
      return { width: 0, height: 0 };
  }

  const scale = node.shape === 'topic' && node.depth === 0 ? 1.2 : 1;
  const scaled = textSize(node.label, MAX_TEXT_WIDTH, scale);
  const lineCount = scaled.lines + (node.subtitle ? 1 : 0);
  const boxWidth = Math.min(Math.max(scaled.width, (node.subtitle?.length ?? 0) * 6.6), MAX_TEXT_WIDTH);
  return { width: Math.max(boxWidth + 36, 90), height: lineCount * LINE_HEIGHT * scale + 24 };
}

function measureClass(node: GraphNode) {
  const { header, stereotype, line, padding, charWidth } = CLASS_BOX;
  const sections = node.compartments ?? [[], []];
  const longest = Math.max(node.label.length * charWidth * 1.15, ...sections.flat().map((m) => m.length * charWidth));
  const height =
    header + (node.stereotype ? stereotype : 0) + sections.reduce((sum, members) => sum + members.length * line + padding, 0);
  return { width: Math.min(Math.max(longest + 28, 140), 340), height };
}

export function layoutGraph(graph: Graph, type: DiagramType, direction: Direction): Map<string, Box> {
  if (type === 'er') return layoutEr(graph);
  if (type === 'sequence') return layoutSequence(graph);

  const g = new dagre.graphlib.Graph();
  const rankdir = type === 'mindmap' || type === 'usecase' ? 'LR' : type === 'orgchart' ? 'TB' : direction;
  const roomy = type === 'class' || type === 'state';
  g.setGraph({
    rankdir,
    nodesep: type === 'flowchart' ? 40 : roomy ? 50 : type === 'usecase' ? 24 : 18,
    ranksep: type === 'mindmap' || roomy ? 70 : type === 'usecase' ? 80 : 55,
    marginx: 20,
    marginy: 20,
  });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) if (!isContainer(node)) g.setNode(node.id, measureNode(node));
  for (const edge of graph.edges) {
    // Parents sit above their subclasses, and an extension sits after the use case it extends.
    const reversed = edge.kind === 'inherit' || edge.kind === 'realize' || (type === 'usecase' && edge.label === '«extend»');
    const label = roomy && edge.label ? { width: edge.label.length * 6.6 + 12, height: 18 } : {};
    if (reversed) g.setEdge(edge.target, edge.source, label);
    else g.setEdge(edge.source, edge.target, label);
  }

  dagre.layout(g);

  const boxes = new Map<string, Box>();
  for (const id of g.nodes()) {
    const { x, y, width, height } = g.node(id);
    // dagre returns centre points; React Flow positions are top-left corners.
    boxes.set(id, { x: x - width / 2, y: y - height / 2, width, height });
  }
  if (type === 'usecase') placeActors(graph, boxes);
  return boxes;
}

const BOUNDARY_PADDING = 28;
const BOUNDARY_TITLE = 34;

/**
 * Moves actors outside the system boundary: those who start interactions to the left,
 * the ones that are only ever called (payment gateways, mail servers) to the right.
 */
function placeActors(graph: Graph, boxes: Map<string, Box>) {
  const useCases = graph.nodes.filter((n) => n.shape === 'usecase').map((n) => boxes.get(n.id)!);
  if (useCases.length === 0) return;
  const left = Math.min(...useCases.map((b) => b.x)) - BOUNDARY_PADDING - 60;
  const right = Math.max(...useCases.map((b) => b.x + b.width)) + BOUNDARY_PADDING + 60;

  const primary: Box[] = [];
  const secondary: Box[] = [];
  for (const node of graph.nodes) {
    if (node.shape !== 'actor') continue;
    const box = boxes.get(node.id)!;
    const initiates = graph.edges.some((e) => e.source === node.id && e.kind === 'line');
    const called = graph.edges.some((e) => e.target === node.id && e.kind === 'line');
    if (called && !initiates) {
      box.x = Math.max(box.x, right);
      secondary.push(box);
    } else {
      box.x = Math.min(box.x, left - box.width);
      primary.push(box);
    }
  }

  // Actors pulled into the same column must not overlap.
  for (const column of [primary, secondary]) {
    column.sort((a, b) => a.y - b.y);
    for (let i = 1; i < column.length; i += 1) {
      const prev = column[i - 1];
      const overlapsX = column[i].x < prev.x + prev.width && prev.x < column[i].x + column[i].width;
      if (overlapsX) column[i].y = Math.max(column[i].y, prev.y + prev.height + 16);
    }
  }
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

/** Sizes system boundaries around their (possibly dragged) members. */
export function fitContainers(graph: Graph, boxes: Map<string, Box>): Map<string, Box> {
  for (const node of graph.nodes) {
    if (node.shape !== 'boundary') continue;
    const inside = (node.members ?? []).map((id) => boxes.get(id)).filter((b): b is Box => Boolean(b));
    if (inside.length === 0) {
      boxes.set(node.id, { x: 0, y: 0, width: Math.max(node.label.length * CHAR_WIDTH + 40, 160), height: 80 });
      continue;
    }
    const x = Math.min(...inside.map((b) => b.x)) - BOUNDARY_PADDING;
    const y = Math.min(...inside.map((b) => b.y)) - BOUNDARY_PADDING - BOUNDARY_TITLE;
    const right = Math.max(...inside.map((b) => b.x + b.width)) + BOUNDARY_PADDING;
    const bottom = Math.max(...inside.map((b) => b.y + b.height)) + BOUNDARY_PADDING;
    const width = Math.max(right - x, node.label.length * CHAR_WIDTH * 1.1 + 40);
    boxes.set(node.id, { x: x - (width - (right - x)) / 2, y, width, height: bottom - y });
  }
  return boxes;
}

/** Automatic layout, then the user's dragged positions, then containers around the result. */
export function layoutDiagram(graph: Graph, type: DiagramType, direction: Direction, positions: Record<string, Point>) {
  return fitContainers(graph, withOverrides(layoutGraph(graph, type, direction), positions));
}
