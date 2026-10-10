import { z } from 'zod';
import { DIAGRAM_TYPES, MAX_SOURCE_LENGTH } from '../models/constants.js';

export const generateSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, 'Describe your diagram in a few words')
    .max(600, 'Keep your description under 600 characters'),
  current: z
    .object({
      type: z.enum(DIAGRAM_TYPES),
      source: z.string().max(MAX_SOURCE_LENGTH),
    })
    .optional(),
});
