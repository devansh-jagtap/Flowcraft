import { memo, useMemo } from 'react';
import { layoutGraph, withOverrides } from '../../lib/diagram/layout';
import { parseDiagram } from '../../lib/diagram/parse';
import { levelSwatch, THEMES } from '../../lib/diagram/themes';
import type { DiagramType, Direction, Point, ThemeName } from '../../lib/diagram/types';

interface Props {
  type: DiagramType;
  source: string;
  theme: ThemeName;
  direction: Direction;
  positions?: Record<string, Point>;
}

const NO_POSITIONS: Record<string, Point> = {};

/** Lightweight static SVG preview for dashboard cards (no React Flow instance per card). */
function DiagramThumbnailComponent({ type, source, theme: themeName, direction, positions = NO_POSITIONS }: Props) {
  const theme = THEMES[themeName];

  const view = useMemo(() => {
    const graph = parseDiagram(type, source);
    const boxes = withOverrides(layoutGraph(graph, type, direction), positions);
    const all = [...boxes.values()];
    if (all.length === 0) return null;

    const minX = Math.min(...all.map((b) => b.x)) - 20;
    const minY = Math.min(...all.map((b) => b.y)) - 20;
    const maxX = Math.max(...all.map((b) => b.x + b.width)) + 20;
    const maxY = Math.max(...all.map((b) => b.y + b.height)) + 20;
    return { graph, boxes, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` };
  }, [type, source, direction, positions]);

  if (!view) return <div className="thumb thumb-empty" style={{ background: theme.canvas }}>Empty diagram</div>;

  const center = (id: string) => {
    const b = view.boxes.get(id)!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };

  return (
    <svg className="thumb" viewBox={view.viewBox} preserveAspectRatio="xMidYMid meet" style={{ background: theme.canvas }} aria-hidden>
      {view.graph.edges.map((e) => {
        const a = center(e.source);
        const b = center(e.target);
        return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={theme.edge} strokeWidth={3} />;
      })}
      {view.graph.nodes.map((n) => {
        const b = view.boxes.get(n.id)!;
        const swatch =
          n.shape === 'terminal' ? theme.terminal : n.shape === 'decision' ? theme.decision : n.shape === 'topic' ? levelSwatch(theme, n.depth) : theme.step;
        if (n.shape === 'decision') {
          const c = center(n.id);
          const points = `${c.x},${b.y} ${b.x + b.width},${c.y} ${c.x},${b.y + b.height} ${b.x},${c.y}`;
          return <polygon key={n.id} points={points} fill={swatch.bg} stroke={swatch.border} strokeWidth={3} />;
        }
        return (
          <rect
            key={n.id}
            x={b.x}
            y={b.y}
            width={b.width}
            height={b.height}
            rx={n.shape === 'terminal' ? b.height / 2 : 10}
            fill={swatch.bg}
            stroke={swatch.border}
            strokeWidth={3}
          />
        );
      })}
    </svg>
  );
}

export const DiagramThumbnail = memo(DiagramThumbnailComponent);
