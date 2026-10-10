import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo, type CSSProperties } from 'react';
import { swatchFor, type Theme } from '../../lib/diagram/themes';
import type { DiagramType, Direction, GraphNode } from '../../lib/diagram/types';

export type ShapeNodeData = {
  node: GraphNode;
  theme: Theme;
  diagramType: DiagramType;
  direction: Direction;
  /** Sequence fragments: "else" dividers, in pixels from the top of the frame. */
  dividers?: { y: number; label: string }[];
};

export type ShapeFlowNode = Node<ShapeNodeData>;

/** Invisible handles: every node needs them so React Flow can attach edges. */
export function Handles({ horizontal = false }: { horizontal?: boolean }) {
  return (
    <>
      <Handle type="target" position={horizontal ? Position.Left : Position.Top} className="hidden-handle" />
      <Handle type="source" position={horizontal ? Position.Right : Position.Bottom} className="hidden-handle" />
    </>
  );
}

/** A small UML stick figure. */
export function ActorFigure({ color, height = 58 }: { color: string; height?: number }) {
  return (
    <svg className="actor-figure" viewBox="0 0 40 60" height={height} aria-hidden>
      <g fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
        <circle cx="20" cy="9" r="7.5" />
        <path d="M20 16.5 V38 M5 25 H35 M20 38 L7 57 M20 38 L33 57" />
      </g>
    </svg>
  );
}

function ShapeNodeComponent({ data }: NodeProps<ShapeFlowNode>) {
  const { node, theme, diagramType, direction } = data;
  const swatch = swatchFor(theme, node);
  const horizontal = diagramType === 'mindmap' || (diagramType === 'flowchart' && direction === 'LR');
  const isRoot = node.shape === 'topic' && node.depth === 0;

  const classes = [
    'shape-node',
    `shape-${node.shape}`,
    node.variant && `variant-${node.variant}`,
    isRoot && 'is-root',
    diagramType === 'orgchart' && 'is-org',
  ]
    .filter(Boolean)
    .join(' ');

  // Double outlines (weak entity, multivalued attribute) are an inner ring in the text colour.
  const double = node.variant === 'weak' || node.variant === 'multivalued';
  const ringColor = node.shape === 'entity' ? swatch.fg : swatch.border;
  const bgStyle: CSSProperties = {
    background: swatch.bg,
    borderColor: swatch.border,
    borderStyle: node.variant === 'derived' ? 'dashed' : undefined,
    boxShadow: double ? `inset 0 0 0 3px ${swatch.bg}, inset 0 0 0 4.5px ${ringColor}` : undefined,
  };

  let body;
  switch (node.shape) {
    case 'decision':
    case 'relationship':
      body = (
        <svg className="diamond" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polygon points="50,2 98,50 50,98 2,50" fill={swatch.bg} stroke={swatch.border} strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {node.variant === 'identifying' && (
            <polygon points="50,11 89,50 50,89 11,50" fill="none" stroke={swatch.border} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
      );
      break;
    case 'actor':
      body = <ActorFigure color={theme.edge} />;
      break;
    case 'initial':
      return (
        <div className={classes} title="Start">
          <Handles />
          <div className="pseudo-state" style={{ background: swatch.bg }} />
        </div>
      );
    case 'final':
      return (
        <div className={classes} title="End">
          <Handles />
          <div className="pseudo-state" style={{ borderColor: swatch.bg }}>
            <div style={{ background: swatch.bg }} />
          </div>
        </div>
      );
    default:
      body = <div className="shape-bg" style={bgStyle} />;
  }

  return (
    <div className={classes} style={{ color: swatch.fg }}>
      <Handles horizontal={horizontal} />
      {body}
      <div className="shape-label">
        <span>{node.label}</span>
        {node.subtitle && <small>{node.subtitle}</small>}
      </div>
    </div>
  );
}

export const ShapeNode = memo(ShapeNodeComponent);
