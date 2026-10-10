export type DiagramType = 'flowchart' | 'mindmap' | 'orgchart' | 'er' | 'class' | 'usecase' | 'sequence' | 'state';
export type Direction = 'LR' | 'TB';
export type ThemeName = 'ocean' | 'sunset' | 'forest' | 'grape' | 'mono';

/**
 * rect = step, terminal = start/end pill, decision = diamond, topic = mind-map/org node.
 * ER (Chen notation): entity, attribute, relationship.
 * UML: class, actor, usecase, state, initial / final pseudo-states, participant (sequence lifeline).
 * Containers drawn behind other nodes: boundary (use-case system), fragment (sequence loop / alt).
 */
export type NodeShape =
  | 'rect'
  | 'terminal'
  | 'decision'
  | 'topic'
  | 'entity'
  | 'attribute'
  | 'relationship'
  | 'class'
  | 'actor'
  | 'usecase'
  | 'state'
  | 'initial'
  | 'final'
  | 'participant'
  | 'boundary'
  | 'fragment';

/**
 * Notation details on top of the shape: weak entity, key / partial key / multivalued /
 * derived attribute, identifying relationship, and the kind of sequence participant.
 */
export type NodeVariant = 'weak' | 'key' | 'partial-key' | 'multivalued' | 'derived' | 'identifying' | 'actor' | 'database';

export interface GraphNode {
  id: string;
  label: string;
  /** Secondary line, e.g. the role in "Priya: Backend". */
  subtitle?: string;
  shape: NodeShape;
  variant?: NodeVariant;
  /** Distance from the root in tree diagrams; 0 for flowcharts. */
  depth: number;
  /** Source line (1-based) the node was first defined on, for error messages. */
  line: number;
  /** ER attributes: the entity, relationship or composite attribute they belong to. */
  parent?: string;
  /** UML class: «interface», «abstract» or «enumeration». */
  stereotype?: string;
  /** UML class: [attributes, methods]. */
  compartments?: string[][];
  /** Containers: ids of the nodes drawn inside. */
  members?: string[];
  /** Sequence fragments: first and last row covered, plus "else" dividers. */
  rows?: [number, number];
  branches?: { row: number; label: string }[];
}

/**
 * How a connection is drawn. Flowcharts and trees leave it unset.
 *   line        plain line (ER, use-case association)
 *   arrow       filled arrowhead (state transition, sync message)
 *   open        open arrowhead (directed association, async message)
 *   inherit     hollow triangle (generalisation)
 *   realize     dashed + hollow triangle (implements)
 *   compose     filled diamond at the source (whole)
 *   aggregate   hollow diamond at the source (whole)
 *   depend      dashed + open arrowhead (dependency, include / extend)
 *   reply       dashed + open arrowhead (sequence return)
 */
export type EdgeKind = 'line' | 'arrow' | 'open' | 'inherit' | 'realize' | 'compose' | 'aggregate' | 'depend' | 'reply';

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind?: EdgeKind;
  /** ER total participation: drawn as a double line. */
  total?: boolean;
  /** Multiplicities written next to each end, e.g. "1" and "*". */
  sourceLabel?: string;
  targetLabel?: string;
  /** Sequence diagrams: the row the message sits on. */
  row?: number;
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
