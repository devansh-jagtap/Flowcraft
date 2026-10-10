import { parseClass } from './parseClass';
import { parseEr } from './parseEr';
import { parseFlowchart } from './parseFlowchart';
import { parseSequence } from './parseSequence';
import { parseState } from './parseState';
import { parseTree } from './parseTree';
import { parseUseCase } from './parseUseCase';
import type { DiagramType, Graph } from './types';

export const MAX_NODES = 300;

const PARSERS: Record<DiagramType, (source: string) => Graph> = {
  flowchart: parseFlowchart,
  mindmap: (source) => parseTree(source),
  orgchart: (source) => parseTree(source, { subtitles: true }),
  er: parseEr,
  class: parseClass,
  usecase: parseUseCase,
  sequence: parseSequence,
  state: parseState,
};

export function parseDiagram(type: DiagramType, source: string): Graph {
  const graph = (PARSERS[type] ?? parseFlowchart)(source);

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
