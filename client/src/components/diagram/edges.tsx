import { BaseEdge, useInternalNode, type Edge, type EdgeProps, type InternalNode } from '@xyflow/react';
import { memo, type ReactNode } from 'react';
import { boundaryPoint, centre } from '../../lib/diagram/geometry';
import type { Box } from '../../lib/diagram/layout';
import { messageY } from '../../lib/diagram/layoutSequence';
import type { EdgeKind, NodeShape, Point } from '../../lib/diagram/types';
import type { ShapeFlowNode } from './ShapeNode';

type Head = 'arrow' | 'open' | 'triangle' | 'diamond' | 'hollow-diamond';

/** Line style and end decorations for each UML / ER connection kind. */
const STYLES: Record<EdgeKind, { dashed?: boolean; start?: Head; end?: Head }> = {
  line: {},
  arrow: { end: 'arrow' },
  open: { end: 'open' },
  inherit: { end: 'triangle' },
  realize: { dashed: true, end: 'triangle' },
  compose: { start: 'diamond' },
  aggregate: { start: 'hollow-diamond' },
  depend: { dashed: true, end: 'open' },
  reply: { dashed: true, end: 'open' },
};

export type DiagramEdgeData = {
  kind: EdgeKind;
  label?: string;
  sourceLabel?: string;
  targetLabel?: string;
  /** ER total participation. */
  total?: boolean;
  /** Bend for connections that share the same two nodes, in pixels. */
  curve?: number;
  /** Sequence diagrams: the message row. */
  row?: number;
  color: string;
  text: string;
  canvas: string;
};

type DiagramEdge = Edge<DiagramEdgeData>;

const STROKE = 1.6;

function boxOf(node: InternalNode<ShapeFlowNode>): Box {
  const { x, y } = node.internals.positionAbsolute;
  return { x, y, width: node.measured.width ?? node.width ?? 0, height: node.measured.height ?? node.height ?? 0 };
}

/** Draws an end decoration whose tip is at `tip`, pointing along `dir` (a unit vector). */
function drawHead(head: Head, tip: Point, dir: Point, color: string, canvas: string, key: string): ReactNode {
  const n = { x: -dir.y, y: dir.x };
  const at = (back: number, side: number) => `${tip.x - dir.x * back + n.x * side},${tip.y - dir.y * back + n.y * side}`;
  switch (head) {
    case 'arrow':
      return <polygon key={key} points={`${tip.x},${tip.y} ${at(11, 5.5)} ${at(11, -5.5)}`} fill={color} />;
    case 'open':
      return <polyline key={key} points={`${at(11, 6)} ${tip.x},${tip.y} ${at(11, -6)}`} fill="none" stroke={color} strokeWidth={STROKE} />;
    case 'triangle':
      return <polygon key={key} points={`${tip.x},${tip.y} ${at(15, 8)} ${at(15, -8)}`} fill={canvas} stroke={color} strokeWidth={STROKE} />;
    case 'diamond':
    case 'hollow-diamond':
      return (
        <polygon
          key={key}
          points={`${tip.x},${tip.y} ${at(9, 6)} ${at(18, 0)} ${at(9, -6)}`}
          fill={head === 'diamond' ? color : canvas}
          stroke={color}
          strokeWidth={STROKE}
        />
      );
  }
}

/** Labels get a halo in the canvas colour so they stay readable on top of lines. */
function EdgeLabel({ at, text, color, canvas, anchor = 'middle' }: { at: Point; text?: string; color: string; canvas: string; anchor?: 'start' | 'middle' }) {
  if (!text) return null;
  return (
    <text
      x={at.x}
      y={at.y}
      textAnchor={anchor}
      dominantBaseline="central"
      fill={color}
      stroke={canvas}
      strokeWidth={4}
      paintOrder="stroke"
      strokeLinejoin="round"
      className="edge-text"
    >
      {text}
    </text>
  );
}

const unit = (from: Point, to: Point): Point => {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
};

/**
 * A straight (or gently bent) line between the outlines of two nodes, wherever they are.
 * Used for ER, class, use-case and state diagrams, where connections are not tied to a
 * fixed side of the shape.
 */
function FloatingEdgeComponent({ id, source, target, data }: EdgeProps<DiagramEdge>) {
  const sourceNode = useInternalNode<ShapeFlowNode>(source);
  const targetNode = useInternalNode<ShapeFlowNode>(target);
  if (!sourceNode || !targetNode || !data) return null;

  const style = STYLES[data.kind];
  const sourceBox = boxOf(sourceNode);
  const targetBox = boxOf(targetNode);
  const sourceShape: NodeShape = sourceNode.data.node.shape;
  const targetShape: NodeShape = targetNode.data.node.shape;

  let path: string;
  let start: Point;
  let end: Point;
  let startDir: Point;
  let endDir: Point;
  let labelAt: Point;

  if (source === target) {
    // A transition back to the same state loops over the top-right corner.
    start = { x: sourceBox.x + sourceBox.width * 0.7, y: sourceBox.y };
    end = { x: sourceBox.x + sourceBox.width, y: sourceBox.y + sourceBox.height * 0.3 };
    path = `M ${start.x} ${start.y} C ${start.x} ${start.y - 44}, ${end.x + 44} ${end.y}, ${end.x} ${end.y}`;
    startDir = { x: 0, y: 1 };
    endDir = { x: -1, y: 0 };
    labelAt = { x: end.x + 22, y: start.y - 30 };
  } else {
    const a = centre(sourceBox);
    const b = centre(targetBox);
    const curve = data.curve ?? 0;
    const normal = { x: -(b.y - a.y), y: b.x - a.x };
    const length = Math.hypot(normal.x, normal.y) || 1;
    const control = { x: (a.x + b.x) / 2 + (normal.x / length) * curve * 2, y: (a.y + b.y) / 2 + (normal.y / length) * curve * 2 };
    start = boundaryPoint(sourceBox, sourceShape, curve ? control : b);
    end = boundaryPoint(targetBox, targetShape, curve ? control : a);
    startDir = unit(curve ? control : end, start);
    endDir = unit(curve ? control : start, end);
    path = curve ? `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}` : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    labelAt = curve
      ? { x: 0.25 * start.x + 0.5 * control.x + 0.25 * end.x, y: 0.25 * start.y + 0.5 * control.y + 0.25 * end.y }
      : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  }

  // Multiplicities sit just off the line, near each end.
  const offset = (p: Point, dir: Point): Point => ({ x: p.x - dir.x * 16 - dir.y * 11, y: p.y - dir.y * 16 + dir.x * 11 });

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: data.color, strokeWidth: data.total ? 5.2 : STROKE, strokeDasharray: style.dashed ? '6 4' : undefined }}
      />
      {data.total && <path d={path} fill="none" stroke={data.canvas} strokeWidth={1.8} />}
      {style.start && drawHead(style.start, start, startDir, data.color, data.canvas, 'start')}
      {style.end && drawHead(style.end, end, endDir, data.color, data.canvas, 'end')}
      <EdgeLabel at={labelAt} text={data.label} color={data.text} canvas={data.canvas} />
      <EdgeLabel at={offset(start, startDir)} text={data.sourceLabel} color={data.text} canvas={data.canvas} />
      <EdgeLabel at={offset(end, endDir)} text={data.targetLabel} color={data.text} canvas={data.canvas} />
    </>
  );
}

/** A horizontal message between two lifelines at its row, or a small loop for a self call. */
function MessageEdgeComponent({ id, source, target, data }: EdgeProps<DiagramEdge>) {
  const sourceNode = useInternalNode<ShapeFlowNode>(source);
  const targetNode = useInternalNode<ShapeFlowNode>(target);
  if (!sourceNode || !targetNode || !data) return null;

  const style = STYLES[data.kind];
  const from = centre(boxOf(sourceNode)).x;
  const to = centre(boxOf(targetNode)).x;
  const y = sourceNode.internals.positionAbsolute.y + messageY(data.row ?? 0);

  if (source === target) {
    const tip = { x: from + 2, y: y + 18 };
    return (
      <>
        <BaseEdge id={id} path={`M ${from} ${y} H ${from + 34} V ${tip.y} H ${tip.x}`} style={{ stroke: data.color, strokeWidth: STROKE, strokeDasharray: style.dashed ? '6 4' : undefined }} />
        {drawHead(style.end ?? 'arrow', tip, { x: -1, y: 0 }, data.color, data.canvas, 'end')}
        <EdgeLabel at={{ x: from + 42, y: y + 9 }} text={data.label} color={data.text} canvas={data.canvas} anchor="start" />
      </>
    );
  }

  const dir = to > from ? 1 : -1;
  const tip = { x: to - dir * 1.5, y };
  return (
    <>
      <BaseEdge id={id} path={`M ${from} ${y} L ${tip.x} ${y}`} style={{ stroke: data.color, strokeWidth: STROKE, strokeDasharray: style.dashed ? '6 4' : undefined }} />
      {drawHead(style.end ?? 'arrow', tip, { x: dir, y: 0 }, data.color, data.canvas, 'end')}
      <EdgeLabel at={{ x: (from + to) / 2, y: y - 10 }} text={data.label} color={data.text} canvas={data.canvas} />
    </>
  );
}

export const FloatingEdge = memo(FloatingEdgeComponent);
export const MessageEdge = memo(MessageEdgeComponent);
