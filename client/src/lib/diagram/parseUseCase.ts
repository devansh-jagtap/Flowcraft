import { sourceLines, splitLabel } from './lines';
import { slug } from './slug';
import type { Graph, GraphEdge, GraphNode, ParseIssue } from './types';

const CONNECTOR = /\s+(--\|>|\.\.>|-->|->|--)\s+/;
const DECLARATION = /^(actor|use ?case|system)\s+(.+)$/i;

type Kind = 'actor' | 'usecase';

/**
 * UML use-case diagrams:
 *
 *   system Online shop          ← names the system boundary
 *   actor Payment gateway       ← optional; the left side of "->" is an actor anyway
 *   Customer -> Place order
 *   Place order -> Make payment: include
 *   Apply coupon -> Place order: extend
 *   Make payment -> Payment gateway
 *   Guest --|> Customer         ← generalisation
 */
export function parseUseCase(source: string): Graph {
  const issues: ParseIssue[] = [];
  const nodes = new Map<string, GraphNode>();
  const kinds = new Map<string, Kind>();
  const edges = new Map<string, GraphEdge & { relation: 'association' | 'include' | 'general' }>();
  let system: GraphNode | undefined;

  const ensure = (label: string, line: number) => {
    const id = slug(label);
    if (!nodes.has(id)) nodes.set(id, { id, label, shape: 'usecase', depth: 0, line });
    return id;
  };

  for (const { line, text } of sourceLines(source)) {
    const declaration = !CONNECTOR.test(text) && text.match(DECLARATION);
    if (declaration) {
      const keyword = declaration[1].toLowerCase();
      const name = declaration[2].trim();
      if (keyword === 'system') system = { id: '~system', label: name, shape: 'boundary', depth: 0, line, members: [] };
      else kinds.set(ensure(name, line), keyword === 'actor' ? 'actor' : 'usecase');
      continue;
    }

    const [body, rawLabel] = splitLabel(text);
    const parts = body.split(CONNECTOR);
    if (parts.length < 3) {
      // A use case on its own line, not connected to anyone yet.
      kinds.set(ensure(text, line), kinds.get(slug(text)) ?? 'usecase');
      continue;
    }
    const names = parts.filter((_, i) => i % 2 === 0).map((s) => s.trim());
    if (names.some((n) => !n)) {
      issues.push({ line, message: 'Arrow is missing a name on one side' });
      continue;
    }

    const label = rawLabel?.replace(/^(<<|«)\s*|\s*(>>|»)$/g, '');
    const ids = names.map((name) => ensure(name, line));
    for (let i = 0; i < ids.length - 1; i += 1) {
      const op = parts[i * 2 + 1];
      const isLast = i === ids.length - 2;
      const edgeLabel = isLast ? label : undefined;
      const include = edgeLabel && /^(include|extend)s?$/i.test(edgeLabel);
      const relation = op === '--|>' ? 'general' : include ? 'include' : 'association';
      if (ids[i] === ids[i + 1]) {
        issues.push({ line, message: `"${names[i]}" points to itself` });
        continue;
      }
      const id = `${ids[i]}${op}${ids[i + 1]}`;
      edges.set(id, {
        id,
        source: ids[i],
        target: ids[i + 1],
        relation,
        kind: relation === 'general' ? 'inherit' : relation === 'include' ? 'depend' : 'line',
        label: include ? `«${edgeLabel!.toLowerCase().replace(/s$/, '')}»` : edgeLabel,
      });
    }
  }

  inferKinds(edges, kinds);

  for (const node of nodes.values()) {
    if (kinds.get(node.id) === 'actor') node.shape = 'actor';
  }
  if (system) system.members = [...nodes.values()].filter((n) => n.shape === 'usecase').map((n) => n.id);

  const graphEdges = [...edges.values()].map(({ relation: _relation, ...edge }) => edge);
  return { nodes: system ? [system, ...nodes.values()] : [...nodes.values()], edges: graphEdges, issues };
}

/**
 * Include / extend always join use cases; an association joins an actor and a use case;
 * a generalisation joins two of the same kind. Whatever is still unknown after that
 * follows the usual reading: the left side of an arrow is the actor.
 */
function inferKinds(edges: Map<string, GraphEdge & { relation: string }>, kinds: Map<string, Kind>) {
  const opposite = (k: Kind): Kind => (k === 'actor' ? 'usecase' : 'actor');
  for (const e of edges.values()) {
    if (e.relation !== 'include') continue;
    if (!kinds.has(e.source)) kinds.set(e.source, 'usecase');
    if (!kinds.has(e.target)) kinds.set(e.target, 'usecase');
  }

  const propagate = () => {
    let changed = true;
    while (changed) {
      changed = false;
      for (const e of edges.values()) {
        if (e.relation === 'include') continue;
        const [a, b] = [kinds.get(e.source), kinds.get(e.target)];
        const same = e.relation === 'general';
        if (a && !b) kinds.set(e.target, same ? a : opposite(a));
        else if (b && !a) kinds.set(e.source, same ? b : opposite(b));
        else continue;
        changed = true;
      }
    }
  };

  propagate();
  for (const e of edges.values()) {
    if (e.relation === 'association' && !kinds.has(e.source) && !kinds.has(e.target)) {
      kinds.set(e.source, 'actor');
      propagate();
    }
  }
}
