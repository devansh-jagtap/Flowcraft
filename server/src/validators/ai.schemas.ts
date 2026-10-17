import { z } from 'zod';
import { AI_PROVIDERS } from '../ai/llm.js';
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

/** A visitor's own key, sent in X-AI-* headers so it never sits in a logged request body. */
export const ownKeySchema = z
  .object({
    provider: z.enum(AI_PROVIDERS, { message: 'Choose Gemini, OpenAI or Vercel AI Gateway for your key' }),
    apiKey: z
      .string()
      .trim()
      .min(10, 'That API key looks too short')
      .max(400, 'That API key looks too long')
      .regex(/^[\x21-\x7e]+$/, 'That API key has unexpected characters'),
    model: z
      .string()
      .trim()
      .max(100)
      .regex(/^[\w.:/-]*$/, 'That model name has unexpected characters')
      .optional(),
  })
  // Gemini model names go into the request URL, so they must not contain a path.
  .refine((key) => key.provider !== 'gemini' || !key.model?.includes('/'), { message: 'Gemini model names look like "gemini-2.5-flash"', path: ['model'] });
