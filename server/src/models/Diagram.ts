import { Schema, Types, model, type HydratedDocument } from 'mongoose';
import { DIAGRAM_THEMES, DIAGRAM_TYPES, DIRECTIONS, MAX_SOURCE_LENGTH } from './constants.js';
import type { DiagramTheme, DiagramType, Direction } from './constants.js';

export interface Point {
  x: number;
  y: number;
}

export interface PromptEntry {
  text: string;
  createdAt: Date;
}

export interface IDiagram {
  owner: Types.ObjectId;
  title: string;
  type: DiagramType;
  /** The plain-text description the diagram is generated from. */
  source: string;
  theme: DiagramTheme;
  direction: Direction;
  /** Node positions the user dragged manually, keyed by node id. Auto-layout fills the rest. */
  positions: Map<string, Point>;
  /** The AI prompts that built this diagram, oldest first (shown as a chat history). */
  prompts: PromptEntry[];
  starred: boolean;
  isPublic: boolean;
  shareId?: string;
  views: number;
  forkedFrom?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type DiagramDocument = HydratedDocument<IDiagram>;

const pointSchema = new Schema<Point>({ x: Number, y: Number }, { _id: false });

const promptSchema = new Schema<PromptEntry>(
  { text: { type: String, required: true, maxlength: 600 }, createdAt: { type: Date, default: Date.now } },
  { _id: false }
);

const diagramSchema = new Schema<IDiagram>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 100, default: 'Untitled diagram' },
    type: { type: String, enum: DIAGRAM_TYPES, required: true },
    source: { type: String, maxlength: MAX_SOURCE_LENGTH, default: '' },
    theme: { type: String, enum: DIAGRAM_THEMES, default: 'ocean' },
    direction: { type: String, enum: DIRECTIONS, default: 'TB' },
    positions: { type: Map, of: pointSchema, default: () => new Map() },
    prompts: { type: [promptSchema], default: [] },
    starred: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: false },
    // Sparse so that the many private diagrams without a share id don't collide.
    shareId: { type: String, unique: true, sparse: true },
    views: { type: Number, default: 0 },
    forkedFrom: { type: Schema.Types.ObjectId, ref: 'Diagram' },
  },
  { timestamps: true }
);

diagramSchema.index({ owner: 1, updatedAt: -1 });
diagramSchema.index({ title: 'text', source: 'text' });

export const Diagram = model<IDiagram>('Diagram', diagramSchema);
