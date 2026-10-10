import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useReactFlow,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { layoutGraph, withOverrides } from '../../lib/diagram/layout';
import { THEMES } from '../../lib/diagram/themes';
import type { DiagramType, Direction, Graph, Point, ThemeName } from '../../lib/diagram/types';
import { exportDiagram, type ExportFormat } from './exportImage';
import { ShapeNode, type ShapeFlowNode } from './ShapeNode';

const nodeTypes: NodeTypes = { shape: ShapeNode };

// Must be a stable reference: a fresh `{}` default on every render would re-run the
// layout memo, reset React Flow's nodes and loop forever.
const NO_POSITIONS: Record<string, Point> = {};

export interface DiagramCanvasProps {
  graph: Graph;
  type: DiagramType;
  direction: Direction;
  theme: ThemeName;
  positions?: Record<string, Point>;
  /** When provided, nodes can be dragged and the new position is reported. */
  onNodeMove?: (id: string, position: Point) => void;
  /** Shows export buttons; the value is used as the file name. */
  exportName?: string;
  showMiniMap?: boolean;
}

function Canvas({ graph, type, direction, theme: themeName, positions = NO_POSITIONS, onNodeMove, exportName, showMiniMap }: DiagramCanvasProps) {
  const theme = THEMES[themeName];
  const editable = Boolean(onNodeMove);
  // Parents usually pass an inline callback; keep it out of the layout memo's dependencies.
  const onNodeMoveRef = useRef(onNodeMove);
  onNodeMoveRef.current = onNodeMove;
  const { fitView, getNodes } = useReactFlow();
  const toast = useToast();
  const [exporting, setExporting] = useState(false);

  // Layout depends only on structure + direction; text edits that keep the structure are cheap.
  const layoutNodes = useMemo<ShapeFlowNode[]>(() => {
    const boxes = withOverrides(layoutGraph(graph, type, direction), positions);
    return graph.nodes.map((node) => {
      const box = boxes.get(node.id)!;
      return {
        id: node.id,
        type: 'shape',
        position: { x: box.x, y: box.y },
        width: box.width,
        height: box.height,
        draggable: editable,
        data: { node, theme, diagramType: type, direction },
      };
    });
  }, [graph, type, direction, positions, theme, editable]);

  const edges = useMemo<Edge[]>(
    () =>
      graph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: type === 'flowchart' ? 'smoothstep' : type === 'orgchart' ? 'step' : 'default',
        style: { stroke: theme.edge, strokeWidth: type === 'mindmap' ? 2.5 : 1.8 },
        markerEnd: type === 'flowchart' ? { type: MarkerType.ArrowClosed, color: theme.edge, width: 18, height: 18 } : undefined,
        labelStyle: { fill: theme.step.fg, fontWeight: 600, fontSize: 12 },
        labelBgStyle: { fill: theme.canvas },
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 6,
      })),
    [graph.edges, type, theme]
  );

  // Local node state lets React Flow animate drags smoothly; it resyncs whenever the layout changes.
  const [nodes, setNodes, onNodesChange] = useNodesState<ShapeFlowNode>(layoutNodes);
  useEffect(() => setNodes(layoutNodes), [layoutNodes, setNodes]);

  // Re-fit when the structure changes (not on every keystroke inside a label).
  const structureKey = `${type}|${direction}|${graph.nodes.length}|${graph.edges.length}`;
  useEffect(() => {
    const id = requestAnimationFrame(() => fitView({ padding: 0.15, duration: 300, maxZoom: 1.4 }));
    return () => cancelAnimationFrame(id);
  }, [structureKey, fitView]);

  async function handleExport(format: ExportFormat) {
    setExporting(true);
    try {
      await exportDiagram(getNodes(), format, exportName ?? 'diagram', theme.canvas);
      toast(`Downloaded ${format.toUpperCase()}`, 'success');
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStop={(_, node) => onNodeMoveRef.current?.(node.id, { x: Math.round(node.position.x), y: Math.round(node.position.y) })}
      nodesConnectable={false}
      edgesFocusable={false}
      elementsSelectable={editable}
      minZoom={0.1}
      maxZoom={2.5}
      style={{ background: theme.canvas }}
      fitView
    >
      <Background color={theme.grid} gap={22} size={1.6} />
      <Controls showInteractive={false} />
      {showMiniMap && graph.nodes.length > 8 && <MiniMap pannable zoomable nodeColor={theme.edge} maskColor="rgba(0,0,0,0.06)" />}
      {exportName !== undefined && (
        <Panel position="top-right" className="export-panel">
          <button className="btn btn-secondary btn-sm" disabled={exporting} onClick={() => handleExport('png')}>
            PNG
          </button>
          <button className="btn btn-secondary btn-sm" disabled={exporting} onClick={() => handleExport('svg')}>
            SVG
          </button>
        </Panel>
      )}
      {graph.nodes.length === 0 && (
        <Panel position="top-center" className="canvas-empty">
          Your diagram appears here as you type
        </Panel>
      )}
    </ReactFlow>
  );
}

export default function DiagramCanvas(props: DiagramCanvasProps) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
