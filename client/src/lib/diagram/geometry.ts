import type { Box } from './layout';
import type { NodeShape, Point } from './types';

type Outline = 'rect' | 'ellipse' | 'diamond';

const OUTLINES: Partial<Record<NodeShape, Outline>> = {
  attribute: 'ellipse',
  usecase: 'ellipse',
  initial: 'ellipse',
  final: 'ellipse',
  relationship: 'diamond',
  decision: 'diamond',
};

/** Where a line from the centre of `box` towards `toward` crosses the shape's outline. */
export function boundaryPoint(box: Box, shape: NodeShape, toward: Point): Point {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };

  const a = box.width / 2;
  const b = box.height / 2;
  let t: number;
  switch (OUTLINES[shape] ?? 'rect') {
    case 'ellipse':
      t = 1 / Math.sqrt((dx * dx) / (a * a) + (dy * dy) / (b * b));
      break;
    case 'diamond':
      t = 1 / (Math.abs(dx) / a + Math.abs(dy) / b);
      break;
    default:
      t = Math.min(dx ? a / Math.abs(dx) : Infinity, dy ? b / Math.abs(dy) : Infinity);
  }
  return { x: cx + dx * t, y: cy + dy * t };
}

export const centre = (box: Box): Point => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });
