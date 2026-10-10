import { parseFlowchart } from './parseFlowchart';
import { parseTree } from './parseTree';
import type { DiagramType, Graph } from './types';

export const MAX_NODES = 300;

export function parseDiagram(type: DiagramType, source: string): Graph {
  const graph = type === 'flowchart' ? parseFlowchart(source) : parseTree(source, { subtitles: type === 'orgchart' });

  if (graph.nodes.length > MAX_NODES) {
    const kept = new Set(graph.nodes.slice(0, MAX_NODES).map((n) => n.id));
    return {
      nodes: graph.nodes.filter((n) => kept.has(n.id)),
      edges: graph.edges.filter((e) => kept.has(e.source) && kept.has(e.target)),
      issues: [...graph.issues, { line: 0, message: `Only the first ${MAX_NODES} items are drawn` }],
    };
  }
  return graph;
}
