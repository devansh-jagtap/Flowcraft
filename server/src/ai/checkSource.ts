import type { DiagramType } from '../models/constants.js';

const ARROW = /\s*(?:-->|->|→|=>)\s*/;
const EDGE_LABEL = /:\s+([^:]+)$/;

/** Mirrors the client parser closely enough to know which lines refer to the same step. */
const stepKey = (raw: string) =>
  raw
    .trim()
    .replace(/^[([{](.*)[)\]}]$/, '$1')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

/**
 * Finds steps that can't be reached from the first step. With real model output this
 * catches typos like "Choose UPI" vs "Chose UPI", which silently split a flow in two.
 */
function unreachableSteps(lines: string[]): string[] {
  const edges = new Map<string, Set<string>>();
  const labels = new Map<string, string>();
  let first: string | undefined;

  for (const line of lines) {
    const parts = line.replace(EDGE_LABEL, '').split(ARROW).filter((p) => p.trim());
    const keys = parts.map((part) => {
      const key = stepKey(part);
      if (!labels.has(key)) labels.set(key, part.trim());
      first ??= key;
      return key;
    });
    keys.slice(0, -1).forEach((key, i) => {
      if (!edges.has(key)) edges.set(key, new Set());
      edges.get(key)!.add(keys[i + 1]);
    });
  }
  if (!first) return [];

  const seen = new Set([first]);
  const queue = [first];
  while (queue.length) {
    for (const next of edges.get(queue.shift()!) ?? []) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return [...labels.entries()].filter(([key]) => !seen.has(key)).map(([, label]) => label);
}

/**
 * A light server-side sanity check of AI output (the full parser lives in the client).
 * Returns a list of problems that can be fed back to the model for one retry.
 */
export function checkSource(type: DiagramType, source: string): string[] {
  const lines = source.split('\n').filter((l) => l.trim() && !/^\s*(#|\/\/)/.test(l));
  const problems: string[] = [];

  if (lines.length < 2) return ['The diagram needs at least 2 lines.'];

  if (type === 'flowchart') {
    const withArrows = lines.filter((l) => ARROW.test(l));
    if (withArrows.length === 0) problems.push('A flowchart must connect steps with "->" arrows.');
    const connected = new Set(withArrows.flatMap((l) => l.replace(EDGE_LABEL, '').split(ARROW).map(stepKey)));
    lines.forEach((line, i) => {
      if (!ARROW.test(line)) {
        // A lone "(Start)" line that only sets a shape is fine if the step is connected elsewhere;
        // a step that appears nowhere else would float as an unconnected box.
        if (!connected.has(stepKey(line))) {
          problems.push(`Line ${i + 1} "${line.trim()}" has no arrow, so it is not connected. Every line must be "A -> B".`);
        }
      } else if (line.split(ARROW).some((part) => !part.trim())) {
        problems.push(`Line ${i + 1} has an arrow with nothing on one side: "${line.trim()}"`);
      }
    });

    if (problems.length === 0) {
      const orphans = unreachableSteps(lines).slice(0, 3);
      if (orphans.length) {
        problems.push(
          `These steps can't be reached from the first step: ${orphans.map((o) => `"${o}"`).join(', ')}. ` +
            'Connect them, and reuse the exact same text (same spelling) when referring to an existing step.'
        );
      }
    }
  } else if (type === 'mindmap' || type === 'orgchart') {
    const indent = (l: string) => l.match(/^\s*/)![0].length;
    if (indent(lines[0]) !== 0) problems.push('The first line (the root) must not be indented.');
    const roots = lines.filter((l) => indent(l) === 0);
    if (roots.length > 1) problems.push(`There must be exactly one root line, found ${roots.length}: indent the others under it.`);
    if (lines.some((l) => ARROW.test(l))) problems.push('Mind maps and org charts use indentation, not "->" arrows.');
  } else {
    problems.push(...UML_CHECKS[type](lines));
  }

  return problems.slice(0, 5);
}

const indentOf = (l: string) => l.match(/^\s*/)![0].length;

const ER_TAGS = /\((key|pk|primary key|partial key|partial|multivalued|multi-valued|multi|derived|entity|weak|weak entity|relationship|identifying|identifying relationship|weak relationship)\)\s*$/i;
const ER_CONNECTOR = /\s(--|==)\s/;

function checkEr(lines: string[]): string[] {
  const problems: string[] = [];
  if (indentOf(lines[0]) !== 0) problems.push('The first line must be an unindented entity name.');
  const chains = lines.filter((l) => indentOf(l) === 0 && ER_CONNECTOR.test(l));
  if (chains.length === 0) problems.push('An ER diagram needs relationship lines like "Student -- Enrolls -- Course: M:N".');
  lines.forEach((line, i) => {
    const text = line.trim();
    if (indentOf(line) > 0 && ER_CONNECTOR.test(text)) problems.push(`Line ${i + 1}: relationship lines must not be indented.`);
    if (/->/.test(text)) problems.push(`Line ${i + 1}: use "--" (or "==" for total participation) instead of "->" arrows.`);
    if (/\([^()]+\)\s*$/.test(text) && !ER_TAGS.test(text)) {
      problems.push(`Line ${i + 1}: unknown tag in "${text}". Use (key), (partial key), (multivalued), (derived), (weak) or (relationship).`);
    }
    const cardinality = text.match(/:\s+(.+)$/);
    if (ER_CONNECTOR.test(text) && cardinality) {
      const edges = text.replace(/:\s+.+$/, '').split(ER_CONNECTOR).filter((_, k) => k % 2 === 0).length - 1;
      const values = cardinality[1].split(/\s*:\s*|\s+to\s+/i).length;
      if (values !== edges) problems.push(`Line ${i + 1}: write one cardinality per connection, e.g. "A -- R -- B: 1:N".`);
    }
  });
  return problems;
}

const CLASS_OPERATOR = /\s(<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|-->|<--|\.\.>|<\.\.|--|\.\.)\s/;

function checkClass(lines: string[]): string[] {
  const problems: string[] = [];
  let inBraces = false;
  lines.forEach((line, i) => {
    const text = line.trim();
    if (text.endsWith('{')) inBraces = true;
    if (text === '}') inBraces = false;
    if (inBraces || indentOf(line) > 0) return;
    if (/(^|[^-.])->/.test(text)) problems.push(`Line ${i + 1}: use "-->" for associations, "--|>" for inheritance, not "->".`);
    else if (/(--|\.\.)/.test(text) && !CLASS_OPERATOR.test(text)) problems.push(`Line ${i + 1}: put a space on both sides of the arrow.`);
  });
  if (!lines.some((l) => indentOf(l) === 0 && CLASS_OPERATOR.test(l)) && lines.filter((l) => indentOf(l) === 0).length > 1) {
    problems.push('Connect the classes with relationship lines like "Admin --|> User".');
  }
  return problems;
}

function checkUseCase(lines: string[]): string[] {
  if (!lines.some((l) => /\s(->|-->|--|--\|>)\s/.test(l))) return ['Connect actors to use cases with lines like "Customer -> Place order".'];
  return [];
}

const SEQUENCE_LINE =
  /^(participant|actor|database)\s|^(loop|alt|opt|par|break|critical|else|and)\b|^end$|^(sequenceDiagram|autonumber|activate|deactivate|title)\b|(-->>|-->|->>|->|-\))/i;

function checkSequence(lines: string[]): string[] {
  const problems: string[] = [];
  let open = 0;
  lines.forEach((line, i) => {
    const text = line.trim();
    if (/^(loop|alt|opt|par|break|critical)\b/i.test(text)) open += 1;
    else if (/^end$/i.test(text)) open -= 1;
    if (open < 0) {
      problems.push(`Line ${i + 1}: "end" without a matching loop, alt or opt.`);
      open = 0;
    }
    if (/^note\b/i.test(text)) problems.push(`Line ${i + 1}: notes are not supported; put the text in a message label.`);
    else if (!SEQUENCE_LINE.test(text)) problems.push(`Line ${i + 1}: "${text}" is not a message. Write "A -> B: text".`);
  });
  if (open > 0) problems.push('Every loop, alt or opt block needs a closing "end" line.');
  if (!lines.some((l) => /(-->>|-->|->>|->|-\))/.test(l))) problems.push('A sequence diagram needs messages like "User -> App: Log in".');
  return problems;
}

function checkState(lines: string[]): string[] {
  const problems: string[] = [];
  if (!lines.some((l) => /^\s*\[\*\]\s*->/.test(l))) problems.push('Start with the initial state: "[*] -> First state".');
  lines.forEach((line, i) => {
    if (!ARROW.test(line)) problems.push(`Line ${i + 1} "${line.trim()}" has no arrow. Every line must be "A -> B: event".`);
  });
  return problems;
}

const UML_CHECKS: Record<Exclude<DiagramType, 'flowchart' | 'mindmap' | 'orgchart'>, (lines: string[]) => string[]> = {
  er: checkEr,
  class: checkClass,
  usecase: checkUseCase,
  sequence: checkSequence,
  state: checkState,
};
