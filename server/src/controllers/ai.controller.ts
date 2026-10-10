import type { Request, Response } from 'express';
import { generateDiagram } from '../ai/diagramGenerator.js';
import { isAiConfigured } from '../ai/gemini.js';
import { parse } from '../lib/validate.js';
import { generateSchema } from '../validators/ai.schemas.js';

export function status(_req: Request, res: Response) {
  res.json({ enabled: isAiConfigured() });
}

export async function generate(req: Request, res: Response) {
  const input = parse(generateSchema, req.body);
  // An empty current diagram is treated as a fresh request.
  const current = input.current?.source.trim() ? input.current : undefined;
  res.json({ diagram: await generateDiagram({ prompt: input.prompt, current }) });
}
