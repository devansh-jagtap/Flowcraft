import { z } from 'zod';
import { env } from '../config/env.js';
import { DIAGRAM_TYPES, DIRECTIONS, MAX_SOURCE_LENGTH, type DiagramType } from '../models/constants.js';
import { HttpError } from '../lib/HttpError.js';
import { checkSource } from './checkSource.js';
import { RESPONSE_SCHEMA, SYSTEM_PROMPT } from './diagramPrompt.js';
import { generateJson, type GenerateJsonOptions } from './llm.js';

const aiDiagramSchema = z.object({
  title: z.string().trim().min(1).max(100),
  type: z.enum(DIAGRAM_TYPES),
  direction: z.enum(DIRECTIONS),
  source: z.string().trim().min(1).max(MAX_SOURCE_LENGTH),
});

export type AiDiagram = z.infer<typeof aiDiagramSchema>;

export interface GenerateRequest {
  prompt: string;
  /** Present when refining an existing diagram. */
  current?: { type: DiagramType; source: string };
}

type JsonGenerator = (options: GenerateJsonOptions) => Promise<unknown>;

/**
 * Cleans up formatting quirks seen in real model output: Windows line endings, tabs,
 * and line breaks returned as the two characters "\n" instead of real newlines.
 */
export function normalise(source: string): string {
  let text = source.replace(/\r\n?/g, '\n');
  const escaped = (text.match(/\\n/g) ?? []).length;
  const real = (text.match(/\n/g) ?? []).length;
  if (escaped > real) text = text.replace(/\\n/g, '\n');
  return text.replace(/\t/g, '  ').trimEnd();
}

/**
 * Asks the model for a diagram, validates the shape of the answer and the syntax of
 * the diagram text, and gives the model one chance to fix its own mistakes.
 */
export async function generateDiagram(request: GenerateRequest, generate: JsonGenerator = generateJson): Promise<AiDiagram> {
  const userText = request.current
    ? `Current diagram type: ${request.current.type}\nCurrent diagram text:\n${request.current.source}\n\nRequested change: ${request.prompt}`
    : request.prompt;

  const messages: GenerateJsonOptions['messages'] = [{ role: 'user', text: userText }];

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const raw = await generate({ system: SYSTEM_PROMPT, messages, schema: RESPONSE_SCHEMA });
    const parsed = aiDiagramSchema.safeParse(raw);

    const problems = parsed.success
      ? checkSource(parsed.data.type, normalise(parsed.data.source))
      : ['The answer did not match the required JSON format (title, type, direction, source).'];

    if (parsed.success && problems.length === 0) {
      return { ...parsed.data, source: normalise(parsed.data.source) };
    }

    if (!env.isTest && !env.isProduction) {
      console.warn(`[ai] attempt ${attempt} rejected:\n- ${problems.join('\n- ')}\n${JSON.stringify(raw).slice(0, 1500)}`);
    }

    messages.push(
      { role: 'model', text: JSON.stringify(raw) },
      { role: 'user', text: `That diagram has problems:\n- ${problems.join('\n- ')}\nReturn the full corrected diagram.` }
    );
  }

  throw new HttpError(502, "The AI couldn't produce a valid diagram for that. Try rephrasing your request.");
}
