import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { memo } from 'react';
import { levelSwatch, type Theme } from '../../lib/diagram/themes';
import type { DiagramType, Direction, GraphNode } from '../../lib/diagram/types';

export type ShapeNodeData = {
  node: GraphNode;
  theme: Theme;
  diagramType: DiagramType;
  direction: Direction;
};

export type ShapeFlowNode = Node<ShapeNodeData, 'shape'>;

function swatchFor({ node, theme }: ShapeNodeData) {
  switch (node.shape) {
    case 'terminal':
      return theme.terminal;
    case 'decision':
      return theme.decision;
    case 'topic':
      return levelSwatch(theme, node.depth);
    default:
      return theme.step;
  }
}

function ShapeNodeComponent({ data }: NodeProps<ShapeFlowNode>) {
  const { node, diagramType, direction } = data;
  const swatch = swatchFor(data);
  const horizontal = diagramType === 'mindmap' || (diagramType === 'flowchart' && direction === 'LR');
  const isRoot = node.shape === 'topic' && node.depth === 0;

  const classes = ['shape-node', `shape-${node.shape}`, isRoot && 'is-root', diagramType === 'orgchart' && 'is-org']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} style={{ color: swatch.fg }}>
      <Handle type="target" position={horizontal ? Position.Left : Position.Top} className="hidden-handle" />

      {node.shape === 'decision' ? (
        <svg className="diamond" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polygon points="50,2 98,50 50,98 2,50" fill={swatch.bg} stroke={swatch.border} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <div className="shape-bg" style={{ background: swatch.bg, borderColor: swatch.border }} />
      )}

      <div className="shape-label">
        <span>{node.label}</span>
        {node.subtitle && <small>{node.subtitle}</small>}
      </div>

      <Handle type="source" position={horizontal ? Position.Right : Position.Bottom} className="hidden-handle" />
    </div>
  );
}

export const ShapeNode = memo(ShapeNodeComponent);
