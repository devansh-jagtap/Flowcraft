import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useNodesInitialized,
  useReactFlow,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '../../context/ToastContext';
import { isContainer, layoutDiagram } from '../../lib/diagram/layout';
import { messageY, SEQUENCE } from '../../lib/diagram/layoutSequence';
import { THEMES } from '../../lib/diagram/themes';
import type { DiagramType, Direction, Graph, GraphEdge, NodeShape, Point, ThemeName } from '../../lib/diagram/types';
import { FloatingEdge, MessageEdge, type DiagramEdgeData } from './edges';
import { exportDiagram, type ExportFormat } from './exportImage';
import { ShapeNode, type ShapeFlowNode } from './ShapeNode';
import { ClassNode, ContainerNode, ParticipantNode } from './UmlNodes';

const nodeTypes: NodeTypes = { shape: ShapeNode, classBox: ClassNode, participant: ParticipantNode, container: ContainerNode };
const edgeTypes: EdgeTypes = { floating: FloatingEdge, message: MessageEdge };

const NODE_TYPE: Partial<Record<NodeShape, string>> = {
  class: 'classBox',
  participant: 'participant',
  boundary: 'container',
  fragment: 'container',
};

/** ER and UML diagrams draw straight connections between outlines, with notation at the ends. */
const FLOATING: DiagramType[] = ['er', 'class', 'usecase', 'state'];

/** Connections between the same two nodes bend apart so they don't sit on top of each other. */
function curves(edges: GraphEdge[]): Map<string, number> {
  const groups = new Map<string, GraphEdge[]>();
  for (const edge of edges) {
    if (edge.source === edge.target) continue;
    const key = [edge.source, edge.target].sort().join('|');
    groups.set(key, [...(groups.get(key) ?? []), edge]);
  }
  const result = new Map<string, number>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    group.forEach((edge, i) => {
      const offset = (i - (group.length - 1) / 2) * 34;
      // The bend is relative to the edge's own direction, so flip it for reversed edges.
      result.set(edge.id, edge.source < edge.target ? offset : -offset);
    });
  }
  return result;
}

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
    const boxes = layoutDiagram(graph, type, direction, positions);
    return graph.nodes.flatMap((node) => {
      const box = boxes.get(node.id);
      if (!box) return [];
      // Frames follow their contents and sequence lifelines keep their order, so neither moves by hand.
      const fixed = isContainer(node) || node.shape === 'participant';
      const dividers = node.branches?.map((b) => ({ y: messageY(b.row) - SEQUENCE.frameLift - box.y, label: b.label }));
      return {
        id: node.id,
        type: NODE_TYPE[node.shape] ?? 'shape',
        position: { x: box.x, y: box.y },
        width: box.width,
        height: box.height,
        draggable: editable && !fixed,
        selectable: !fixed,
        className: fixed ? 'is-fixed' : undefined,
        zIndex: isContainer(node) ? -1 : undefined,
        data: { node, theme, diagramType: type, direction, dividers },
      };
    });
  }, [graph, type, direction, positions, theme, editable]);

  const edges = useMemo<Edge[]>(() => {
    if (type === 'sequence' || FLOATING.includes(type)) {
      const bends = curves(graph.edges);
      return graph.edges.map(
        (edge): Edge<DiagramEdgeData> => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: type === 'sequence' ? 'message' : 'floating',
          data: {
            kind: edge.kind ?? 'arrow',
            label: edge.label,
            sourceLabel: edge.sourceLabel,
            targetLabel: edge.targetLabel,
            total: edge.total,
            curve: bends.get(edge.id),
            row: edge.row,
            color: theme.edge,
            text: theme.step.fg,
            canvas: theme.canvas,
          },
        })
      );
    }
    return graph.edges.map((edge) => ({
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
      }));
  }, [graph.edges, type, theme]);

  // Local node state lets React Flow animate drags smoothly; it resyncs whenever the layout changes.
  const [nodes, setNodes, onNodesChange] = useNodesState<ShapeFlowNode>(layoutNodes);
  useEffect(() => setNodes(layoutNodes), [layoutNodes, setNodes]);

  // Re-fit when the structure changes (not on every keystroke inside a label), and once React Flow has
  // measured the nodes: fitting before that uses zero sizes and can leave the diagram cut off.
  const structureKey = `${type}|${direction}|${graph.nodes.length}|${graph.edges.length}`;
  const measured = useNodesInitialized();
  useEffect(() => {
    if (!measured) return;
    const id = requestAnimationFrame(() => fitView({ padding: 0.15, duration: 300, maxZoom: 1.4 }));
    return () => cancelAnimationFrame(id);
  }, [structureKey, measured, fitView]);

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
      edgeTypes={edgeTypes}
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
