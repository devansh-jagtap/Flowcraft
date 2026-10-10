import { memo, useMemo, type ReactNode } from 'react';
import { centre } from '../../lib/diagram/geometry';
import { layoutDiagram, type Box } from '../../lib/diagram/layout';
import { messageY, SEQUENCE } from '../../lib/diagram/layoutSequence';
import { parseDiagram } from '../../lib/diagram/parse';
import { swatchFor, THEMES, type Theme } from '../../lib/diagram/themes';
import type { DiagramType, Direction, GraphNode, Point, ThemeName } from '../../lib/diagram/types';

interface Props {
  type: DiagramType;
  source: string;
  theme: ThemeName;
  direction: Direction;
  positions?: Record<string, Point>;
}

const NO_POSITIONS: Record<string, Point> = {};

/** A simplified, static version of one node. */
function drawNode(n: GraphNode, b: Box, theme: Theme): ReactNode {
  const swatch = swatchFor(theme, n);
  const c = centre(b);
  const common = { fill: swatch.bg, stroke: swatch.border, strokeWidth: 3 };
  switch (n.shape) {
    case 'decision':
    case 'relationship':
      return <polygon key={n.id} points={`${c.x},${b.y} ${b.x + b.width},${c.y} ${c.x},${b.y + b.height} ${b.x},${c.y}`} {...common} />;
    case 'attribute':
    case 'usecase':
    case 'initial':
    case 'final':
      return <ellipse key={n.id} cx={c.x} cy={c.y} rx={b.width / 2} ry={b.height / 2} {...common} />;
    case 'actor':
      return (
        <g key={n.id} fill="none" stroke={theme.edge} strokeWidth={4}>
          <circle cx={c.x} cy={b.y + 10} r={9} />
          <path d={`M${c.x} ${b.y + 19} V${b.y + 44} M${c.x - 16} ${b.y + 28} H${c.x + 16} M${c.x} ${b.y + 44} L${c.x - 14} ${b.y + 64} M${c.x} ${b.y + 44} L${c.x + 14} ${b.y + 64}`} />
        </g>
      );
    case 'participant':
      return (
        <g key={n.id}>
          <line x1={c.x} y1={b.y + SEQUENCE.header} x2={c.x} y2={b.y + b.height} stroke={theme.edge} strokeWidth={3} strokeDasharray="8 6" />
          <rect x={b.x} y={b.y + 16} width={b.width} height={SEQUENCE.header - 16} rx={8} fill={swatch.bg} />
        </g>
      );
    case 'class':
      return (
        <g key={n.id}>
          <rect x={b.x} y={b.y} width={b.width} height={b.height} rx={6} fill={theme.step.bg} stroke={theme.step.border} strokeWidth={3} />
          <rect x={b.x} y={b.y} width={b.width} height={Math.min(34, b.height)} rx={6} fill={theme.terminal.bg} />
        </g>
      );
    case 'boundary':
    case 'fragment':
      return <rect key={n.id} x={b.x} y={b.y} width={b.width} height={b.height} rx={12} fill="none" stroke={theme.edge} strokeWidth={3} />;
    default:
      return (
        <rect
          key={n.id}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          rx={n.shape === 'terminal' ? b.height / 2 : 10}
          {...common}
        />
      );
  }
}

/** Lightweight static SVG preview for dashboard cards (no React Flow instance per card). */
function DiagramThumbnailComponent({ type, source, theme: themeName, direction, positions = NO_POSITIONS }: Props) {
  const theme = THEMES[themeName];

  const view = useMemo(() => {
    const graph = parseDiagram(type, source);
    const boxes = layoutDiagram(graph, type, direction, positions);
    const all = [...boxes.values()];
    if (all.length === 0) return null;

    const minX = Math.min(...all.map((b) => b.x)) - 20;
    const minY = Math.min(...all.map((b) => b.y)) - 20;
    const maxX = Math.max(...all.map((b) => b.x + b.width)) + 20;
    const maxY = Math.max(...all.map((b) => b.y + b.height)) + 20;
    return { graph, boxes, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` };
  }, [type, source, direction, positions]);

  if (!view) return <div className="thumb thumb-empty" style={{ background: theme.canvas }}>Empty diagram</div>;

  // Containers first so they sit behind everything else.
  const order = [...view.graph.nodes].sort((a, b) => Number(b.shape === 'boundary' || b.shape === 'fragment') - Number(a.shape === 'boundary' || a.shape === 'fragment'));

  return (
    <svg className="thumb" viewBox={view.viewBox} preserveAspectRatio="xMidYMid meet" style={{ background: theme.canvas }} aria-hidden>
      {view.graph.edges.map((e) => {
        const from = view.boxes.get(e.source);
        const to = view.boxes.get(e.target);
        if (!from || !to) return null;
        const a = centre(from);
        const b = centre(to);
        if (type === 'sequence') {
          const y = from.y + messageY(e.row ?? 0);
          return <line key={e.id} x1={a.x} y1={y} x2={e.source === e.target ? a.x + 30 : b.x} y2={y} stroke={theme.edge} strokeWidth={3} />;
        }
        return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.edge} strokeWidth={e.total ? 6 : 3} />;
      })}
      {order.map((n) => {
        const b = view.boxes.get(n.id);
        return b ? drawNode(n, b, theme) : null;
      })}
    </svg>
  );
}

export const DiagramThumbnail = memo(DiagramThumbnailComponent);
