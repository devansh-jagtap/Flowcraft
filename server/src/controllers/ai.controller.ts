import type { Request, Response } from 'express';
import { activeCredentials, listKeys, markVerified, removeKey, savedCredentials, saveKey, setActive } from '../ai/accountKeys.js';
import { generateDiagram } from '../ai/diagramGenerator.js';
import {
  generateJson,
  missingKeyError,
  ownCredentials,
  PROVIDER_LABELS,
  serverCredentials,
  type AiCredentials,
  type GenerateJsonOptions,
  type TokenUsage,
} from '../ai/llm.js';
import { freeUsage, refundFreeGeneration, reserveFreeGeneration, type QuotaSubject } from '../ai/quota.js';
import { recordUsage, usageSummary } from '../ai/usageLog.js';
import { env } from '../config/env.js';
import { HttpError } from '../lib/HttpError.js';
import { canStoreSecrets } from '../lib/secretBox.js';
import { parse } from '../lib/validate.js';
import { currentUser } from '../middleware/auth.js';
import { activeKeySchema, generateSchema, ownKeySchema, providerParamSchema, saveKeySchema } from '../validators/ai.schemas.js';

/** Free generations are counted per account when signed in, per network address for guests. */
const quotaSubject = (req: Request): QuotaSubject =>
  req.user ? { key: `user:${req.user.id}`, guest: false } : { key: `ip:${req.ip}`, guest: true };

/** A key sent in the X-AI-* headers (guests keep their keys in the browser), or null. */
function headerKey(req: Request): AiCredentials | null {
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

const limits = () => ({ guest: env.freeAi.guestLimit, account: env.freeAi.limit, windowHours: env.freeAi.windowHours });

export async function status(req: Request, res: Response) {
  const enabled = Boolean(serverCredentials());
  res.json({
    enabled,
    free: enabled ? await freeUsage(quotaSubject(req)) : null,
    freeTier: freeTier(),
    limits: limits(),
    signedIn: Boolean(req.user),
    // Lets the client hide "save to account" when the server can't encrypt keys.
    accountKeys: canStoreSecrets(),
  });
}

/**
 * Usage history is private to an account. Guests are never shown it: many people can share one
 * network address (an office, a campus Wi-Fi, a mobile carrier), so it would show them each other's activity.
 */
export async function usage(req: Request, res: Response) {
  const user = currentUser(req);
  const subject = `user:${user.id}`;
  res.json({
    free: serverCredentials() ? await freeUsage({ key: subject, guest: false }) : null,
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

  // Only signed-in users have a usage history; guests' generations are not recorded.
  const user = req.user;
  const log = async (ok: boolean, errorCode?: string) => {
    if (!user) return;
    await recordUsage({
      subject: `user:${user.id}`,
      credentials,
      ok,
      errorCode,
      calls,
      tokens,
      durationMs: performance.now() - started,
      prompt: request.prompt,
    });
  };

  try {
    const diagram = await generateDiagram(request, generate);
    await log(true);
    return { diagram, usage: { provider: credentials.provider, model: credentials.model, source: credentials.own ? 'own' : 'free', ...tokens } };
  } catch (err) {
    await log(false, err instanceof HttpError ? (err.code ?? `HTTP_${err.status}`) : 'ERROR');
    throw err;
  }
}

/**
 * Picks the key for a generation: a key sent with the request, then the key the account chose
 * (saved encrypted on the server), then the free generations on the server's key.
 */
export async function generate(req: Request, res: Response) {
  const input = parse(generateSchema, req.body);
  // An empty current diagram is treated as a fresh request.
  const current = input.current?.source.trim() ? input.current : undefined;
  const request = { prompt: input.prompt, current };

  const own = headerKey(req) ?? (req.user ? await activeCredentials(req.user.id, req.user.aiProvider) : null);
  if (own) {
    res.json(await generateLogged(req, own, request));
    return;
  }

  const server = serverCredentials();
  if (!server) throw missingKeyError();
  const subject = quotaSubject(req);
  const free = await reserveFreeGeneration(subject);
  try {
    res.json({ ...(await generateLogged(req, server, request)), free });
  } catch (err) {
    await refundFreeGeneration(subject);
    throw err;
  }
}

const TEST_SCHEMA = { type: 'OBJECT', properties: { ok: { type: 'BOOLEAN' } }, required: ['ok'] };

/** One tiny request that proves a key (and its model) works. */
async function probe(credentials: AiCredentials) {
  const started = performance.now();
  await generateJson({ system: 'Answer with JSON only.', messages: [{ role: 'user', text: 'Reply with {"ok": true}' }], schema: TEST_SCHEMA }, credentials);
  return { ok: true as const, provider: credentials.provider, model: credentials.model, latencyMs: Math.round(performance.now() - started) };
}

/** Checks a key sent in the headers (a guest's browser key) before it's used for drawing. */
export async function testKey(req: Request, res: Response) {
  const credentials = headerKey(req);
  if (!credentials) throw HttpError.badRequest('Send the key to test in the X-AI-Key header');
  res.json(await probe(credentials));
}

// ---------- Keys saved to the account ----------

export async function listAccountKeys(req: Request, res: Response) {
  res.json(await listKeys(currentUser(req).id));
}

/** Saves a key (encrypted) or changes its model. With `test`, it is only saved if it works. */
export async function saveAccountKey(req: Request, res: Response) {
  const user = currentUser(req);
  const { provider } = parse(providerParamSchema, req.params);
  const { apiKey, model, test } = parse(saveKeySchema, { ...req.body, provider });

  let verified = false;
  if (test) {
    const credentials = apiKey ? ownCredentials(provider, apiKey, model ?? undefined) : await savedCredentials(user.id, provider, model);
    await probe(credentials);
    verified = true;
  }
  await saveKey(user.id, provider, { apiKey, model, verified });
  res.json(await listKeys(user.id));
}

export async function testAccountKey(req: Request, res: Response) {
  const user = currentUser(req);
  const { provider } = parse(providerParamSchema, req.params);
  const result = await probe(await savedCredentials(user.id, provider));
  await markVerified(user.id, provider);
  res.json(result);
}

export async function deleteAccountKey(req: Request, res: Response) {
  const user = currentUser(req);
  const { provider } = parse(providerParamSchema, req.params);
  await removeKey(user.id, provider);
  res.json(await listKeys(user.id));
}

export async function setActiveKey(req: Request, res: Response) {
  const user = currentUser(req);
  const { provider } = parse(activeKeySchema, req.body);
  await setActive(user.id, provider);
  res.json(await listKeys(user.id));
}
