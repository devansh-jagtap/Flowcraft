import dagre from '@dagrejs/dagre';
import { measureNode, type Box } from './layout';
import type { Graph, GraphNode, Point } from './types';

const GAP_X = 12;
/** Distance between a shape and its first ring of attributes. */
const GAP_Y = 30;
/** Distance between an attribute and its composite parts. */
const SUB_GAP_Y = 22;
/** How much further out the middle of an attribute row sits than its ends. */
const ARC = 14;

/**
 * Chen diagrams: entities and relationships are laid out left to right by dagre, and each
 * one reserves room above and below for its attribute ovals, so lines between entities
 * and relationships never cut through attributes.
 */
export function layoutEr(graph: Graph): Map<string, Box> {
  const sizes = new Map(graph.nodes.map((n) => [n.id, measureNode(n)]));
  const children = new Map<string, GraphNode[]>();
  for (const node of graph.nodes) {
    if (node.parent) children.set(node.parent, [...(children.get(node.parent) ?? []), node]);
  }

  const columnWidth = (node: GraphNode): number => Math.max(sizes.get(node.id)!.width, rowWidth(children.get(node.id) ?? []));
  const rowWidth = (row: GraphNode[]) => row.reduce((sum, n) => sum + columnWidth(n), 0) + GAP_X * Math.max(row.length - 1, 0);

  const cores = graph.nodes.filter((n) => !n.parent);
  const offsets = new Map<string, Point>();
  const extents = new Map<string, { halfWidth: number; halfHeight: number }>();

  for (const core of cores) {
    const own = sizes.get(core.id)!;
    let halfWidth = own.width / 2;
    let halfHeight = own.height / 2;

    // Places a row of attributes centred on `cx`, then their composite parts further out.
    const placeRow = (row: GraphNode[], cx: number, edge: number, side: 1 | -1, arc: boolean) => {
      const total = rowWidth(row);
      let x = cx - total / 2;
      for (const node of row) {
        const width = columnWidth(node);
        const size = sizes.get(node.id)!;
        const ax = x + width / 2;
        const spread = total > 0 ? (ax - cx) / (total / 2) : 0;
        const y = edge + side * (size.height / 2 + (arc ? ARC * (1 - spread * spread) : 0));
        offsets.set(node.id, { x: ax, y });
        halfWidth = Math.max(halfWidth, Math.abs(ax) + size.width / 2);
        halfHeight = Math.max(halfHeight, Math.abs(y) + size.height / 2);

        const parts = children.get(node.id);
        if (parts?.length) placeRow(parts, ax, y + side * (size.height / 2 + SUB_GAP_Y), side, false);
        x += width + GAP_X;
      }
    };

    const attributes = children.get(core.id) ?? [];
    const half = Math.ceil(attributes.length / 2);
    placeRow(attributes.slice(0, half), 0, -(own.height / 2 + GAP_Y), -1, true);
    placeRow(attributes.slice(half), 0, own.height / 2 + GAP_Y, 1, true);
    extents.set(core.id, { halfWidth, halfHeight });
  }

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  const coreIds = new Set(cores.map((n) => n.id));
  for (const id of coreIds) {
    // Symmetric reservations keep each shape centred in its slot, so connections stay level.
    const { halfWidth, halfHeight } = extents.get(id)!;
    g.setNode(id, { width: halfWidth * 2, height: halfHeight * 2 });
  }
  for (const edge of graph.edges) {
    if (coreIds.has(edge.source) && coreIds.has(edge.target)) g.setEdge(edge.source, edge.target);
  }
  dagre.layout(g);

  const boxes = new Map<string, Box>();
  const place = (id: string, cx: number, cy: number) => {
    const { width, height } = sizes.get(id)!;
    boxes.set(id, { x: cx - width / 2, y: cy - height / 2, width, height });
  };
  for (const core of cores) {
    const { x, y } = g.node(core.id);
    place(core.id, x, y);
    const visit = (id: string) => {
      for (const child of children.get(id) ?? []) {
        const offset = offsets.get(child.id)!;
        place(child.id, x + offset.x, y + offset.y);
        visit(child.id);
      }
    };
    visit(core.id);
  }
  return boxes;
}
