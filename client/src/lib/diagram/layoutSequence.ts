import { measureNode, type Box } from './layout';
import { sequenceRows } from './parseSequence';
import type { Graph } from './types';

/** Vertical rhythm of sequence diagrams, shared by the layout, the canvas and thumbnails. */
export const SEQUENCE = {
  /** Height of the participant boxes at the top of each lifeline. */
  header: 60,
  /** Space between the header and the first message. */
  top: 40,
  row: 44,
  /** Minimum space between neighbouring participant boxes. */
  gap: 44,
  /** How far a fragment's top edge sits above its first row. */
  frameLift: 26,
};

export const messageY = (row: number) => SEQUENCE.header + SEQUENCE.top + row * SEQUENCE.row;

const LABEL_CHAR = 6.8;

/**
 * Participants go left to right in a fixed order, messages top to bottom by row. The
 * space between two lifelines grows until every message label between them fits.
 */
export function layoutSequence(graph: Graph): Map<string, Box> {
  const participants = graph.nodes.filter((n) => n.shape === 'participant');
  const index = new Map(participants.map((p, i) => [p.id, i]));
  const widths = participants.map((p) => measureNode(p).width);
  const gaps = widths.slice(0, -1).map((w, i) => (w + widths[i + 1]) / 2 + SEQUENCE.gap);

  for (const edge of graph.edges) {
    const a = index.get(edge.source);
    const b = index.get(edge.target);
    if (a === undefined || b === undefined) continue;
    const labelWidth = (edge.label?.length ?? 0) * LABEL_CHAR;
    if (a === b) {
      // Self messages print their label to the right of the loop.
      if (a < gaps.length) gaps[a] = Math.max(gaps[a], labelWidth + 70);
      continue;
    }
    const [lo, hi] = a < b ? [a, b] : [b, a];
    const perGap = (labelWidth + 36) / (hi - lo);
    for (let k = lo; k < hi; k += 1) gaps[k] = Math.max(gaps[k], perGap);
  }

  const centres: number[] = [];
  participants.forEach((_, i) => centres.push(i === 0 ? widths[0] / 2 : centres[i - 1] + gaps[i - 1]));

  const height = messageY(sequenceRows(graph)) + 4;
  const boxes = new Map<string, Box>();
  participants.forEach((p, i) => boxes.set(p.id, { x: centres[i] - widths[i] / 2, y: 0, width: widths[i], height }));

  const fragments = graph.nodes.filter((n) => n.shape === 'fragment');
  for (const fragment of fragments) {
    const members = (fragment.members ?? []).map((id) => index.get(id)).filter((i): i is number => i !== undefined);
    if (members.length === 0) continue;
    const [start, end] = fragment.rows!;
    // Enclosing fragments get a wider margin than the ones nested inside them.
    const nested = fragments.filter((f) => f !== fragment && f.rows![0] > start && f.rows![1] <= end);
    const inset = 14 + 10 * (nested.length ? Math.max(...nested.map((f) => f.depth)) - fragment.depth : 0);
    const selfLoops = graph.edges.some((e) => e.source === e.target && e.row! > start && e.row! < end);

    let left = Math.min(...members.map((i) => centres[i] - widths[i] / 2)) - inset;
    let right = Math.max(...members.map((i) => centres[i] + widths[i] / 2)) + inset + (selfLoops ? 40 : 0);
    const minWidth = (fragment.label.length + fragment.subtitle!.length) * LABEL_CHAR + 70;
    if (right - left < minWidth) {
      const grow = (minWidth - (right - left)) / 2;
      left -= grow;
      right += grow;
    }
    const top = messageY(start) - SEQUENCE.frameLift;
    boxes.set(fragment.id, { x: left, y: top, width: right - left, height: messageY(end) - SEQUENCE.frameLift - top });
  }
  return boxes;
}
