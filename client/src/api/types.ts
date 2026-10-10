import type { DiagramType, Direction, Point, ThemeName } from '../lib/diagram/types';

export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Diagram {
  _id: string;
  title: string;
  type: DiagramType;
  source: string;
  theme: ThemeName;
  direction: Direction;
  positions?: Record<string, Point>;
  starred: boolean;
  isPublic: boolean;
  shareId?: string;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface SharedDiagram
  extends Pick<Diagram, 'title' | 'type' | 'source' | 'theme' | 'direction' | 'positions' | 'views' | 'updatedAt' | 'shareId'> {
  author: string;
}

export interface DiagramStats {
  byType: Record<DiagramType, number>;
  diagrams: number;
  shared: number;
  views: number;
}

export type DiagramDraft = Pick<Diagram, 'title' | 'type' | 'source' | 'theme' | 'direction'> & {
  positions: Record<string, Point>;
};
