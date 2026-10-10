import { sourceLines, splitLabel, splitTag } from './lines';
import { slug } from './slug';
import type { Graph, GraphEdge, GraphNode, NodeVariant, ParseIssue } from './types';

// "Student -- Enrolls -- Course". "==" marks total participation (a double line).
const CONNECTOR = /\s+(--|==)\s+/;

const ATTRIBUTE_TAGS: Record<string, NodeVariant | undefined> = {
  key: 'key',
  pk: 'key',
  'primary key': 'key',
  'partial key': 'partial-key',
  partial: 'partial-key',
  multivalued: 'multivalued',
  'multi-valued': 'multivalued',
  multi: 'multivalued',
  derived: 'derived',
};

type CoreKind = 'entity' | 'relationship';

const CORE_TAGS: Record<string, { kind: CoreKind; variant?: NodeVariant }> = {
  entity: { kind: 'entity' },
  weak: { kind: 'entity', variant: 'weak' },
  'weak entity': { kind: 'entity', variant: 'weak' },
  relationship: { kind: 'relationship' },
  identifying: { kind: 'relationship', variant: 'identifying' },
  'identifying relationship': { kind: 'relationship', variant: 'identifying' },
  'weak relationship': { kind: 'relationship', variant: 'identifying' },
};

interface Chain {
  line: number;
  ids: string[];
  labels: string[];
  connectors: string[];
  cardinality: (string | undefined)[];
}

/**
 * Entity-relationship diagrams in Chen notation:
 *
 *   Student
 *     Roll no (key)
 *     Name
 *       First name          ← indented again: composite attribute
 *     Phone (multivalued)
 *     Age (derived)
 *   Dependent (weak)
 *     Name (partial key)
 *   Student -- Enrolls -- Course: M:N
 *   Student -- Has == Dependent: 1:N
 *
 * Unindented lines declare entities (tag "(relationship)" for a relationship with
 * attributes); lines with "--" connect them. Names in the middle of a chain are
 * relationships unless declared otherwise.
 */
export function parseEr(source: string): Graph {
  const issues: ParseIssue[] = [];
  const cores = new Map<string, GraphNode & { declared: boolean }>();
  const attributes: GraphNode[] = [];
  const edges = new Map<string, GraphEdge>();
  const chains: Chain[] = [];
  const usedIds = new Set<string>();
  let stack: { indent: number; id: string }[] = [];

  const core = (label: string, line: number) => {
    const id = slug(label);
    let node = cores.get(id);
    if (!node) {
      node = { id, label, shape: 'entity', depth: 0, line, declared: false };
      cores.set(id, node);
      usedIds.add(id);
    }
    return node;
  };

  for (const { line, indent, text } of sourceLines(source)) {
    if (indent === 0) {
      stack = [];
      if (CONNECTOR.test(text)) {
        const chain = readChain(text, line, issues);
        if (chain) {
          chain.ids = chain.labels.map((label) => core(label, line).id);
          chains.push(chain);
        }
        continue;
      }

      const [name, tag] = splitTag(text);
      const info = tag ? CORE_TAGS[tag] : { kind: 'entity' as const };
      if (!info) issues.push({ line, message: `Unknown tag "(${tag})". Use (weak) for a weak entity or (relationship).` });
      const node = core(name, line);
      node.declared = true;
      node.shape = info?.kind ?? 'entity';
      node.variant = info?.variant;
      stack = [{ indent: 0, id: node.id }];
      continue;
    }

    if (stack.length === 0) {
      issues.push({ line, message: 'Indent attributes under an entity, and write relationships without indentation.' });
      continue;
    }
    if (CONNECTOR.test(text)) {
      issues.push({ line, message: 'Relationships like "A -- R -- B" must not be indented.' });
      continue;
    }

    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1];

    const [name, tag] = splitTag(text);
    const variant = tag ? ATTRIBUTE_TAGS[tag] : undefined;
    if (tag && !variant) {
      issues.push({ line, message: `Unknown tag "(${tag})". Use (key), (partial key), (multivalued) or (derived).` });
    }
    const label = variant || !tag ? name : text;

    const base = `${parent.id}/${slug(label)}`;
    let id = base;
    for (let n = 2; usedIds.has(id); n += 1) id = `${base}~${n}`;
    usedIds.add(id);

    attributes.push({ id, label, shape: 'attribute', variant, depth: stack.length, line, parent: parent.id });
    edges.set(`${parent.id}--${id}`, { id: `${parent.id}--${id}`, source: parent.id, target: id, kind: 'line' });
    stack.push({ indent, id });
  }

  resolveKinds(chains, cores, issues);

  for (const chain of chains) {
    for (let i = 0; i < chain.ids.length - 1; i += 1) {
      const [a, b] = [chain.ids[i], chain.ids[i + 1]];
      if (a === b) {
        issues.push({ line: chain.line, message: `"${chain.labels[i]}" is connected to itself` });
        continue;
      }
      const id = `${a}--${b}`;
      if (!edges.has(id)) {
        edges.set(id, { id, source: a, target: b, kind: 'line', total: chain.connectors[i] === '==', label: chain.cardinality[i] });
      }
    }
  }

  // A relationship that identifies a weak entity is drawn as a double diamond.
  for (const edge of edges.values()) {
    const [a, b] = [cores.get(edge.source), cores.get(edge.target)];
    if (!a || !b) continue;
    const rel = a.shape === 'relationship' ? a : b;
    const other = rel === a ? b : a;
    if (rel.shape === 'relationship' && other.variant === 'weak' && !rel.variant) rel.variant = 'identifying';
  }

  const nodes: GraphNode[] = [...cores.values()].map(({ declared: _declared, ...node }) => node);
  return { nodes: [...nodes, ...attributes], edges: [...edges.values()], issues };
}

function readChain(text: string, line: number, issues: ParseIssue[]): Chain | null {
  const [body, cardinalityText] = splitLabel(text);
  const parts = body.split(CONNECTOR);
  const labels = parts.filter((_, i) => i % 2 === 0).map((s) => s.trim());
  const connectors = parts.filter((_, i) => i % 2 === 1);
  if (labels.some((label) => !label)) {
    issues.push({ line, message: 'A connection is missing a name on one side' });
    return null;
  }

  const edgeCount = labels.length - 1;
  let cardinality: (string | undefined)[] = [];
  if (cardinalityText) {
    const values = cardinalityText.split(/\s*:\s*|\s+to\s+/i).map((v) => v.trim());
    if (values.length === edgeCount) cardinality = values;
    else issues.push({ line, message: `Expected ${edgeCount} cardinalities like "1:N", found "${cardinalityText}"` });
  }
  return { line, ids: [], labels, connectors, cardinality };
}

/** Names never declared on their own line take the kind implied by their position in a chain. */
function resolveKinds(chains: Chain[], cores: Map<string, GraphNode & { declared: boolean }>, issues: ParseIssue[]) {
  const opposite = (kind: CoreKind): CoreKind => (kind === 'entity' ? 'relationship' : 'entity');

  for (const chain of chains) {
    const anchor = chain.ids.findIndex((id) => cores.get(id)!.declared);
    const anchorKind: CoreKind = anchor >= 0 ? (cores.get(chain.ids[anchor])!.shape as CoreKind) : 'entity';
    const from = Math.max(anchor, 0);
    chain.ids.forEach((id, i) => {
      const node = cores.get(id)!;
      if (node.declared) return;
      node.shape = (i - from) % 2 === 0 ? anchorKind : opposite(anchorKind);
      node.declared = true;
    });
  }

  for (const chain of chains) {
    for (let i = 0; i < chain.ids.length - 1; i += 1) {
      const [a, b] = [cores.get(chain.ids[i])!, cores.get(chain.ids[i + 1])!];
      if (a.shape === 'entity' && b.shape === 'entity') {
        issues.push({ line: chain.line, message: `"${a.label}" and "${b.label}" are both entities. Put a relationship between them.` });
      }
    }
  }
}
