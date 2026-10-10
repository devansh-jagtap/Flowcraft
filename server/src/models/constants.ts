export const DIAGRAM_TYPES = ['flowchart', 'mindmap', 'orgchart'] as const;
export const DIAGRAM_THEMES = ['ocean', 'sunset', 'forest', 'grape', 'mono'] as const;
export const DIRECTIONS = ['LR', 'TB'] as const;

export type DiagramType = (typeof DIAGRAM_TYPES)[number];
export type DiagramTheme = (typeof DIAGRAM_THEMES)[number];
export type Direction = (typeof DIRECTIONS)[number];

export const MAX_SOURCE_LENGTH = 20_000;
