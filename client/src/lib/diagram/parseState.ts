import { sourceLines, splitLabel } from './lines';
import { slug } from './slug';
import type { Graph, GraphEdge, GraphNode, NodeShape, ParseIssue } from './types';

const ARROW = /\s*(?:-->|->|→)\s*/;
const START_END = /^\[\s*\*\s*\]$/;

/**
 * UML state machine diagrams:
 *
 *   [*] -> Idle                 ← [*] on the left is the initial state
 *   Idle -> Processing: submit  ← text after ": " is the event / trigger
 *   Processing -> Idle: error
 *   Valid? -> Done: yes         ← "?" makes a choice point
 *   Done -> [*]                 ← [*] on the right is the final state
 *
 * Unlike flowcharts a state may transition to itself ("Retrying -> Retrying: timeout").
 */
export function parseState(source: string): Graph {
  const issues: ParseIssue[] = [];
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  const addNode = (raw: string, position: 'source' | 'target', line: number) => {
    const text = raw.trim().replace(/^state\s+/i, '');
    if (START_END.test(text)) {
      const shape: NodeShape = position === 'source' ? 'initial' : 'final';
      const id = `~${shape}`;
      if (!nodes.has(id)) nodes.set(id, { id, label: shape === 'initial' ? 'Start' : 'End', shape, depth: 0, line });
      return id;
    }
    const id = slug(text) + (text.endsWith('?') ? '-q' : '');
    if (!nodes.has(id)) nodes.set(id, { id, label: text, shape: text.endsWith('?') ? 'decision' : 'state', depth: 0, line });
    return id;
  };

  for (const { line, text } of sourceLines(source)) {
    const [body, label] = ARROW.test(text) ? splitLabel(text) : [text, undefined];
    const parts = body.split(ARROW).map((s) => s.trim());
    if (parts.some((p) => !p)) {
      issues.push({ line, message: 'Arrow is missing a state on one side' });
      continue;
    }
    if (parts.length === 1) {
      addNode(parts[0], 'target', line);
      continue;
    }

    const ids = parts.map((part, i) => addNode(part, i === 0 ? 'source' : 'target', line));
    for (let i = 0; i < ids.length - 1; i += 1) {
      const edgeLabel = i === ids.length - 2 ? label : undefined;
      if (ids[i] === '~final' || ids[i + 1] === '~initial') {
        issues.push({ line, message: '[*] in the middle of a chain is ambiguous. Use it only at the very start or end.' });
        continue;
      }
      const id = `${ids[i]}->${ids[i + 1]}:${edgeLabel ?? ''}`;
      if (!edges.has(id)) edges.set(id, { id, source: ids[i], target: ids[i + 1], label: edgeLabel, kind: 'arrow' });
    }
  }

  return { nodes: [...nodes.values()], edges: [...edges.values()], issues };
}
