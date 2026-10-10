export type DiagramType = 'flowchart' | 'mindmap' | 'orgchart';
export type Direction = 'LR' | 'TB';
export type ThemeName = 'ocean' | 'sunset' | 'forest' | 'grape' | 'mono';

/** rect = step, terminal = start/end pill, decision = diamond, topic = mind-map/org node */
export type NodeShape = 'rect' | 'terminal' | 'decision' | 'topic';

export interface GraphNode {
  id: string;
  label: string;
  /** Secondary line, e.g. the role in "Priya — Backend". */
  subtitle?: string;
  shape: NodeShape;
  /** Distance from the root in tree diagrams; 0 for flowcharts. */
  depth: number;
  /** Source line (1-based) the node was first defined on, for error messages. */
  line: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ParseIssue {
  line: number;
  message: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  issues: ParseIssue[];
}

export interface Point {
  x: number;
  y: number;
}
