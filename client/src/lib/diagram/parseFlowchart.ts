import { slug } from './slug';
import type { Graph, GraphEdge, GraphNode, NodeShape, ParseIssue } from './types';

const ARROW = /\s*(?:-->|->|→|=>)\s*/;
// "A -> B: yes" — the edge label must follow ": " so times like "9:30" stay intact.
const EDGE_LABEL = /:\s+([^:]+)$/;
const COMMENT = /^\s*(#|\/\/)/;

interface Token {
  label: string;
  shape?: NodeShape;
}

/**
 * Reads one node token:
 *   (Start)      → terminal pill
 *   {Approved?}  → decision diamond
 *   Approved?    → decision diamond (question mark is enough)
 *   [Do thing]   → explicit step
 *   Do thing     → step
 */
export function readToken(raw: string): Token {
  const text = raw.trim();
  const wrapped = (open: string, close: string) => text.startsWith(open) && text.endsWith(close) && text.length > 2;

  if (wrapped('(', ')')) return { label: text.slice(1, -1).trim(), shape: 'terminal' };
  if (wrapped('{', '}')) return { label: text.slice(1, -1).trim(), shape: 'decision' };
  if (wrapped('[', ']')) return { label: text.slice(1, -1).trim(), shape: 'rect' };
  if (text.endsWith('?')) return { label: text, shape: 'decision' };
  return { label: text };
}

export function parseFlowchart(source: string): Graph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const issues: ParseIssue[] = [];

  const addNode = (token: Token, line: number): string => {
    const id = slug(token.label);
    const existing = nodes.get(id);
    if (!existing) {
      nodes.set(id, { id, label: token.label, shape: token.shape ?? 'rect', depth: 0, line });
    } else if (token.shape && existing.shape === 'rect') {
      // A later, more specific definition (e.g. "(End)") upgrades the shape.
      existing.shape = token.shape;
    }
    return id;
  };

  source.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    if (!rawLine.trim() || COMMENT.test(rawLine)) return;

    let text = rawLine.trim();
    let edgeLabel: string | undefined;

    const parts = text.split(ARROW);
    if (parts.length > 1) {
      const match = parts[parts.length - 1].match(EDGE_LABEL);
      if (match) {
        edgeLabel = match[1].trim();
        text = text.slice(0, text.length - match[0].length);
      }
    }

    const segments = text.split(ARROW).map((s) => s.trim());
    if (segments.some((s) => !s)) {
      issues.push({ line, message: 'Arrow is missing a step on one side' });
      return;
    }

    const ids = segments.map((segment) => addNode(readToken(segment), line));
    for (let i = 0; i < ids.length - 1; i += 1) {
      const isLast = i === ids.length - 2;
      const label = isLast ? edgeLabel : undefined;
      const key = `${ids[i]}->${ids[i + 1]}:${label ?? ''}`;
      if (ids[i] === ids[i + 1]) {
        issues.push({ line, message: `"${segments[i]}" points to itself` });
        continue;
      }
      if (!edges.has(key)) edges.set(key, { id: key, source: ids[i], target: ids[i + 1], label });
    }
  });

  return { nodes: [...nodes.values()], edges: [...edges.values()], issues };
}
