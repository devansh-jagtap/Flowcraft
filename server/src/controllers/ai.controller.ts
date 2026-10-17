import type { Request, Response } from 'express';
import { generateDiagram } from '../ai/diagramGenerator.js';
import { generateJson, isAiConfigured, missingKeyError, ownCredentials, type AiCredentials } from '../ai/llm.js';
import { freeUsage, refundFreeGeneration, reserveFreeGeneration } from '../ai/quota.js';
import { parse } from '../lib/validate.js';
import { generateSchema, ownKeySchema } from '../validators/ai.schemas.js';

/** Free generations are counted per account when signed in, per IP address for guests. */
const quotaKey = (req: Request) => (req.user ? `user:${req.user.id}` : `ip:${req.ip}`);

/** The visitor's own key from the X-AI-* headers, or null to use the server's key and free quota. */
function ownKey(req: Request): AiCredentials | null {
  const apiKey = req.get('x-ai-key');
  if (!apiKey) return null;
  const key = parse(ownKeySchema, { provider: req.get('x-ai-provider'), apiKey, model: req.get('x-ai-model') || undefined });
  return ownCredentials(key.provider, key.apiKey, key.model);
}

export async function status(req: Request, res: Response) {
  const enabled = isAiConfigured();
  res.json({ enabled, free: enabled ? await freeUsage(quotaKey(req)) : null });
}

export async function generate(req: Request, res: Response) {
  const input = parse(generateSchema, req.body);
  // An empty current diagram is treated as a fresh request.
  const current = input.current?.source.trim() ? input.current : undefined;
  const request = { prompt: input.prompt, current };

  const credentials = ownKey(req);
  if (credentials) {
    res.json({ diagram: await generateDiagram(request, (options) => generateJson(options, credentials)) });
    return;
  }

  // Server key: spend one of the visitor's free generations.
  if (!isAiConfigured()) throw missingKeyError();
  const key = quotaKey(req);
  const free = await reserveFreeGeneration(key);
  try {
    res.json({ diagram: await generateDiagram(request), free });
  } catch (err) {
    await refundFreeGeneration(key);
    throw err;
  }
}
