import type { DiagramType } from '../models/constants.js';

const ARROW = /\s*(?:-->|->|→|=>)\s*/;

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
    lines.forEach((line, i) => {
      if (ARROW.test(line) && line.split(ARROW).some((part) => !part.trim())) {
        problems.push(`Line ${i + 1} has an arrow with nothing on one side: "${line.trim()}"`);
      }
    });
  } else {
    const indent = (l: string) => l.match(/^\s*/)![0].length;
    if (indent(lines[0]) !== 0) problems.push('The first line (the root) must not be indented.');
    const roots = lines.filter((l) => indent(l) === 0);
    if (roots.length > 1) problems.push(`There must be exactly one root line, found ${roots.length}: indent the others under it.`);
    if (lines.some((l) => ARROW.test(l))) problems.push('Mind maps and org charts use indentation, not "->" arrows.');
  }

  return problems.slice(0, 5);
}
