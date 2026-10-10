import { slug } from './slug';
import type { Graph, GraphEdge, GraphNode, ParseIssue } from './types';

const BULLET = /^(?:[-*+•]|\d+[.)])\s+/;
const COMMENT = /^\s*(#|\/\/)/;
// "Priya — Backend" / "Priya - Backend" → title + subtitle (used by org charts).
const SUBTITLE = /\s+[—–-]\s+/;

const indentOf = (line: string) => {
  const leading = line.match(/^[\t ]*/)![0];
  return leading.replace(/\t/g, '    ').length;
};

/**
 * Turns an indented outline into a tree:
 *
 *   Goa Trip
 *     Travel
 *       Book tickets
 *
 * Markdown bullets ("- item") are accepted so people can paste notes directly.
 */
export function parseTree(source: string, { subtitles = false } = {}): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const issues: ParseIssue[] = [];
  const usedIds = new Set<string>();
  const stack: { indent: number; id: string; path: string }[] = [];

  source.split(/\r?\n/).forEach((rawLine, index) => {
    const line = index + 1;
    if (!rawLine.trim() || COMMENT.test(rawLine)) return;

    const indent = indentOf(rawLine);
    const text = rawLine.trim().replace(BULLET, '').trim();
    if (!text) return;

    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];

    if (!parent && nodes.length > 0) {
      issues.push({ line, message: 'Tip: indent this line to attach it to a parent — it starts a new tree' });
    }

    const [label, subtitle] = subtitles ? splitOnce(text, SUBTITLE) : [text, undefined];

    // Path-based ids keep the same node identity even when lines are added elsewhere.
    const path = parent ? `${parent.path}/${slug(label)}` : slug(label);
    let id = path;
    for (let n = 2; usedIds.has(id); n += 1) id = `${path}~${n}`;
    usedIds.add(id);

    nodes.push({ id, label, subtitle, shape: 'topic', depth: stack.length, line });
    if (parent) edges.push({ id: `${parent.id}->${id}`, source: parent.id, target: id });
    stack.push({ indent, id, path });
  });

  return { nodes, edges, issues };
}

function splitOnce(text: string, separator: RegExp): [string, string | undefined] {
  const match = text.match(separator);
  if (!match || match.index === undefined) return [text, undefined];
  return [text.slice(0, match.index).trim(), text.slice(match.index + match[0].length).trim() || undefined];
}
