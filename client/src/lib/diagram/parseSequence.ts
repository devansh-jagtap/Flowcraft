import { sourceLines, splitLabel } from './lines';
import { slug } from './slug';
import type { EdgeKind, Graph, GraphEdge, GraphNode, NodeVariant, ParseIssue } from './types';

// Longest first so "-->>" isn't read as "->". Mermaid's arrows are accepted as well.
const MESSAGE = /^(.+?)\s*(-->>|-->|->>|->|-\))\s*(.+)$/;
const ARROW_KINDS: Record<string, EdgeKind> = { '->': 'arrow', '->>': 'arrow', '-->': 'reply', '-->>': 'reply', '-)': 'open' };
const PARTICIPANT = /^(participant|actor|database)\s+(.+?)(?:\s+as\s+(.+))?$/i;
const FRAGMENT = /^(loop|alt|opt|par|break|critical)\b\s*(.*)$/i;
const BRANCH = /^(else|and)\b\s*(.*)$/i;
const IGNORED = /^(sequenceDiagram|autonumber|activate|deactivate|title)\b/i;

/** Extra rows taken by a message to oneself, which loops down below its own line. */
const SELF_ROWS = 1.5;

/**
 * UML sequence diagrams:
 *
 *   actor User                     ← optional: actor, participant or database
 *   User -> App: Log in            ← call
 *   App --> User: Welcome          ← reply (dashed)
 *   App -) Mailer: Send email      ← asynchronous
 *   alt password ok                ← also loop, opt, par, break, critical
 *     App --> User: Dashboard
 *   else wrong password
 *     App --> User: Error
 *   end
 *
 * Participants appear left to right in the order they are first mentioned.
 */
export function parseSequence(source: string): Graph {
  const issues: ParseIssue[] = [];
  const participants = new Map<string, GraphNode>();
  const aliases = new Map<string, string>();
  const edges: GraphEdge[] = [];
  const fragments: GraphNode[] = [];
  const open: GraphNode[] = [];
  let row = 0;

  const participant = (name: string, line: number, variant?: NodeVariant, label = name) => {
    const key = slug(name);
    const id = aliases.get(key) ?? key;
    let node = participants.get(id);
    if (!node) {
      node = { id, label, shape: 'participant', depth: 0, line };
      participants.set(id, node);
    }
    if (variant) node.variant = variant;
    return id;
  };

  for (const { line, text } of sourceLines(source)) {
    if (IGNORED.test(text)) continue;

    // "Database --> App" is a message from a participant called Database, not a declaration.
    const declared = !MESSAGE.test(splitLabel(text)[0]) && text.match(PARTICIPANT);
    if (declared) {
      const [, keyword, name, display] = declared;
      const variant = keyword.toLowerCase() === 'participant' ? undefined : (keyword.toLowerCase() as NodeVariant);
      const id = participant(name, line, variant, display?.trim() ?? name);
      if (display) aliases.set(slug(display), id);
      continue;
    }

    const fragment = text.match(FRAGMENT);
    if (fragment) {
      const node: GraphNode = {
        id: `~fragment-${fragments.length + 1}`,
        label: fragment[2].trim(),
        subtitle: fragment[1].toLowerCase(),
        shape: 'fragment',
        depth: open.length,
        line,
        rows: [row, row],
        branches: [],
      };
      fragments.push(node);
      open.push(node);
      row += 1;
      continue;
    }

    const branch = text.match(BRANCH);
    if (branch) {
      const current = open[open.length - 1];
      if (!current) issues.push({ line, message: `"${branch[1]}" must be inside an alt or par block` });
      else {
        current.branches!.push({ row, label: branch[2].trim() });
        row += 1;
      }
      continue;
    }

    if (/^end$/i.test(text)) {
      const current = open.pop();
      if (!current) issues.push({ line, message: '"end" without a matching loop, alt or opt' });
      else {
        current.rows![1] = row;
        row += 0.5;
      }
      continue;
    }

    if (/^note\b/i.test(text)) {
      issues.push({ line, message: 'Notes are not supported yet. Put the text in a message label instead.' });
      continue;
    }

    const [body, label] = splitLabel(text);
    const message = body.match(MESSAGE);
    if (!message) {
      issues.push({ line, message: 'Write a message as "A -> B: text", or declare "participant A"' });
      continue;
    }
    const [, from, arrow, to] = message;
    const source = participant(from.trim(), line);
    const target = participant(to.trim(), line);
    edges.push({ id: `m${edges.length + 1}`, source, target, label, kind: ARROW_KINDS[arrow], row });
    row += source === target ? SELF_ROWS : 1;
  }

  for (const node of open) {
    issues.push({ line: node.line, message: `"${node.subtitle}" block is missing its "end"` });
    node.rows![1] = row;
  }

  // A fragment spans the participants its messages touch (all of them if it has none).
  for (const node of fragments) {
    const [start, end] = node.rows!;
    const inside = edges.filter((e) => e.row! > start && e.row! < end);
    const touched = new Set(inside.flatMap((e) => [e.source, e.target]));
    node.members = touched.size ? [...participants.keys()].filter((id) => touched.has(id)) : [...participants.keys()];
  }

  return { nodes: [...participants.values(), ...fragments], edges, issues };
}

export const sequenceRows = (graph: Graph) =>
  Math.max(
    0,
    ...graph.edges.map((e) => (e.row ?? 0) + (e.source === e.target ? SELF_ROWS : 1)),
    ...graph.nodes.map((n) => (n.rows ? n.rows[1] + 0.5 : 0))
  );
