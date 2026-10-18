import type { Request, Response } from 'express';
import { generateDiagram } from '../ai/diagramGenerator.js';
import {
  generateJson,
  isAiConfigured,
  missingKeyError,
  ownCredentials,
  PROVIDER_LABELS,
  serverCredentials,
  type AiCredentials,
  type GenerateJsonOptions,
  type TokenUsage,
} from '../ai/llm.js';
import { freeUsage, refundFreeGeneration, reserveFreeGeneration } from '../ai/quota.js';
import { recordUsage, usageSummary } from '../ai/usageLog.js';
import { HttpError } from '../lib/HttpError.js';
import { parse } from '../lib/validate.js';
import { generateSchema, ownKeySchema } from '../validators/ai.schemas.js';

/** Free generations and usage are counted per account when signed in, per IP address for guests. */
const quotaKey = (req: Request) => (req.user ? `user:${req.user.id}` : `ip:${req.ip}`);

/** The visitor's own key from the X-AI-* headers, or null to use the server's key and free quota. */
function ownKey(req: Request): AiCredentials | null {
  const apiKey = req.get('x-ai-key');
  if (!apiKey) return null;
  const key = parse(ownKeySchema, { provider: req.get('x-ai-provider'), apiKey, model: req.get('x-ai-model') || undefined });
  return ownCredentials(key.provider, key.apiKey, key.model);
}

/** Which provider and model the free tier runs on (never the key itself). */
function freeTier() {
  const credentials = serverCredentials();
  return credentials && { provider: credentials.provider, label: PROVIDER_LABELS[credentials.provider], model: credentials.model };
}

export async function status(req: Request, res: Response) {
  const enabled = isAiConfigured();
  res.json({ enabled, free: enabled ? await freeUsage(quotaKey(req)) : null, freeTier: freeTier() });
}

export async function usage(req: Request, res: Response) {
  const subject = quotaKey(req);
  const enabled = isAiConfigured();
  res.json({
    signedIn: Boolean(req.user),
    free: enabled ? await freeUsage(subject) : null,
    freeTier: freeTier(),
    ...(await usageSummary(subject)),
  });
}

/** Runs one generation and logs it (tokens, time, outcome) for the usage dashboard. */
async function generateLogged(req: Request, credentials: AiCredentials, request: Parameters<typeof generateDiagram>[0]) {
  const tokens: TokenUsage = { inputTokens: 0, outputTokens: 0 };
  let calls = 0;
  const started = performance.now();
  const generate = (options: GenerateJsonOptions) =>
    generateJson(
      {
        ...options,
        onUsage: (used) => {
          calls += 1;
          tokens.inputTokens += used.inputTokens;
          tokens.outputTokens += used.outputTokens;
        },
      },
      credentials
    );

  const log = (ok: boolean, errorCode?: string) =>
    recordUsage({
      subject: quotaKey(req),
      credentials,
      ok,
      errorCode,
      calls,
      tokens,
      durationMs: performance.now() - started,
      // Guests can share an IP address, so their prompts are not kept.
      prompt: req.user ? request.prompt : undefined,
    });

  try {
    const diagram = await generateDiagram(request, generate);
    await log(true);
    return { diagram, usage: { provider: credentials.provider, model: credentials.model, ...tokens } };
  } catch (err) {
    await log(false, err instanceof HttpError ? (err.code ?? `HTTP_${err.status}`) : 'ERROR');
    throw err;
  }
}

export async function generate(req: Request, res: Response) {
  const input = parse(generateSchema, req.body);
  // An empty current diagram is treated as a fresh request.
  const current = input.current?.source.trim() ? input.current : undefined;
  const request = { prompt: input.prompt, current };

  const credentials = ownKey(req);
  if (credentials) {
    res.json(await generateLogged(req, credentials, request));
    return;
  }

  // Server key: spend one of the visitor's free generations.
  const server = serverCredentials();
  if (!server) throw missingKeyError();
  const key = quotaKey(req);
  const free = await reserveFreeGeneration(key);
  try {
    res.json({ ...(await generateLogged(req, server, request)), free });
  } catch (err) {
    await refundFreeGeneration(key);
    throw err;
  }
}

const TEST_SCHEMA = { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } }, required: ['ok'] };

/** Checks a visitor's own key and model with a tiny request, so mistakes show up before they try to draw. */
export async function testKey(req: Request, res: Response) {
  const credentials = ownKey(req);
  if (!credentials) throw HttpError.badRequest('Send the key to test in the X-AI-Key header');
  const started = performance.now();
  await generateJson({ system: 'Answer with JSON only.', messages: [{ role: 'user', text: 'Reply with {"ok": true}' }], schema: TEST_SCHEMA }, credentials);
  res.json({
    ok: true,
    provider: credentials.provider,
    model: credentials.model,
    latencyMs: Math.round(performance.now() - started),
  });
}
