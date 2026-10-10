import { sourceLines, splitLabel } from './lines';
import { slug } from './slug';
import type { EdgeKind, Graph, GraphEdge, GraphNode, ParseIssue } from './types';

/**
 * Relationship operators (Mermaid-compatible). `atSource` means the written arrow points
 * left ("A <|-- B"), so the ends are swapped to keep one direction per kind.
 */
const OPERATORS: Record<string, { kind: EdgeKind; atSource?: boolean }> = {
  '--|>': { kind: 'inherit' },
  '<|--': { kind: 'inherit', atSource: true },
  '..|>': { kind: 'realize' },
  '<|..': { kind: 'realize', atSource: true },
  // Composition and aggregation keep the diamond on the "whole" side.
  '*--': { kind: 'compose' },
  '--*': { kind: 'compose', atSource: true },
  'o--': { kind: 'aggregate' },
  '--o': { kind: 'aggregate', atSource: true },
  '-->': { kind: 'open' },
  '<--': { kind: 'open', atSource: true },
  '..>': { kind: 'depend' },
  '<..': { kind: 'depend', atSource: true },
  '--': { kind: 'line' },
  '..': { kind: 'depend' },
};

const OPERATOR_PATTERN = Object.keys(OPERATORS)
  .sort((a, b) => b.length - a.length)
  .map((op) => op.replace(/[|*.<>]/g, '\\$&'))
  .join('|');

// Customer "1" -- "*" Order: places
const RELATION = new RegExp(`^(.+?)\\s+(?:"([^"]*)"\\s+)?(${OPERATOR_PATTERN})\\s+(?:"([^"]*)"\\s+)?(.+)$`);
const DECLARATION = /^(?:(abstract\s+class|abstract|interface|enum|class)\s+)?(.+?)\s*(\{)?$/i;
// "User : +login()" adds a member from outside the class block (Mermaid style).
const MEMBER_LINE = /^([^\s:]+)\s+:\s+(.+)$/;

const STEREOTYPES: Record<string, string> = { interface: 'interface', enum: 'enumeration', abstract: 'abstract', 'abstract class': 'abstract' };

/**
 * UML class diagrams:
 *
 *   class User
 *     - id: int
 *     + login(): bool          ← contains "(" so it's a method
 *   interface Payable
 *   Admin --|> User            ← inheritance
 *   Customer "1" -- "*" Order: places
 *
 * `class X { ... }` blocks are accepted too, since that's how most people write Mermaid.
 */
export function parseClass(source: string): Graph {
  const issues: ParseIssue[] = [];
  const classes = new Map<string, GraphNode & { compartments: string[][] }>();
  const edges = new Map<string, GraphEdge>();
  let current: (GraphNode & { compartments: string[][] }) | null = null;
  let inBraces = false;

  const ensure = (label: string, line: number) => {
    const id = slug(label);
    let node = classes.get(id);
    if (!node) {
      node = { id, label, shape: 'class', depth: 0, line, compartments: [[], []] };
      classes.set(id, node);
    }
    return node;
  };

  const addMember = (node: GraphNode & { compartments: string[][] }, text: string) => {
    const member = text.replace(/[;,]$/, '').trim();
    const stereotype = member.match(/^(?:<<|«)\s*(\w+)\s*(?:>>|»)$/);
    if (stereotype) node.stereotype = STEREOTYPES[stereotype[1].toLowerCase()] ?? stereotype[1].toLowerCase();
    else if (member) node.compartments[member.includes('(') ? 1 : 0].push(member);
  };

  for (const { line, indent, text } of sourceLines(source)) {
    if (text === '}') {
      inBraces = false;
      current = null;
      continue;
    }
    if ((indent > 0 || inBraces) && current) {
      addMember(current, text);
      continue;
    }

    const [body, label] = splitLabel(text);
    const relation = body.match(RELATION);
    if (relation) {
      current = null;
      const [, left, leftMult, op, rightMult, right] = relation;
      const { kind, atSource } = OPERATORS[op];
      const [from, fromMult, to, toMult] = atSource ? [right, rightMult, left, leftMult] : [left, leftMult, right, rightMult];
      const a = ensure(from.trim(), line);
      const b = ensure(to.trim(), line);
      if (a === b) {
        issues.push({ line, message: `"${a.label}" is connected to itself` });
        continue;
      }
      const id = `${a.id}${op}${b.id}`;
      if (!edges.has(id)) {
        edges.set(id, { id, source: a.id, target: b.id, kind, label, sourceLabel: fromMult || undefined, targetLabel: toMult || undefined });
      }
      continue;
    }

    const memberLine = text.match(MEMBER_LINE);
    if (memberLine) {
      addMember(ensure(memberLine[1], line), memberLine[2]);
      continue;
    }

    if (/(--|\.\.)/.test(text)) {
      issues.push({ line, message: 'Put a space on both sides of the arrow, e.g. "Admin --|> User"' });
      continue;
    }

    const [, keyword, name, brace] = text.match(DECLARATION)!;
    current = ensure(name.replace(/^["`]|["`]$/g, ''), line);
    const stereotype = keyword && STEREOTYPES[keyword.toLowerCase().replace(/\s+/g, ' ')];
    if (stereotype) current.stereotype = stereotype;
    inBraces = Boolean(brace);
  }

  return { nodes: [...classes.values()], edges: [...edges.values()], issues };
}
