import { z } from 'zod';
import { DIAGRAM_THEMES, DIAGRAM_TYPES, DIRECTIONS, MAX_SOURCE_LENGTH } from '../models/constants.js';

const point = z.object({ x: z.number().finite(), y: z.number().finite() });

const fields = {
  title: z.string().trim().min(1, 'Title cannot be empty').max(100),
  type: z.enum(DIAGRAM_TYPES),
  source: z.string().max(MAX_SOURCE_LENGTH, 'Diagram text is too long'),
  theme: z.enum(DIAGRAM_THEMES),
  direction: z.enum(DIRECTIONS),
  // Keys are node ids produced by the client-side parser; cap the size to keep documents small.
  positions: z
    .record(z.string().max(200), point)
    .refine((p) => Object.keys(p).length <= 500, 'Too many node positions'),
  starred: z.boolean(),
};

export const createDiagramSchema = z.object({
  type: fields.type,
  title: fields.title.optional(),
  source: fields.source.optional(),
  theme: fields.theme.optional(),
  direction: fields.direction.optional(),
  positions: fields.positions.optional(),
});

export const updateDiagramSchema = z
  .object(fields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, 'Nothing to update');

export const listDiagramsSchema = z.object({
  q: z.string().trim().max(100).optional(),
  type: z.enum([...DIAGRAM_TYPES, 'all']).default('all'),
  starred: z.enum(['true', 'false']).optional(),
  sort: z.enum(['updated', 'created', 'title']).default('updated'),
});

export const shareSchema = z.object({ isPublic: z.boolean() });
