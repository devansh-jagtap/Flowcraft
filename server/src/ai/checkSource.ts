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
  } else {
    const indent = (l: string) => l.match(/^\s*/)![0].length;
    if (indent(lines[0]) !== 0) problems.push('The first line (the root) must not be indented.');
    const roots = lines.filter((l) => indent(l) === 0);
    if (roots.length > 1) problems.push(`There must be exactly one root line, found ${roots.length}: indent the others under it.`);
    if (lines.some((l) => ARROW.test(l))) problems.push('Mind maps and org charts use indentation, not "->" arrows.');
  }

  return problems.slice(0, 5);
}
