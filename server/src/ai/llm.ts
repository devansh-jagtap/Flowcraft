import { env } from '../config/env.js';
import { HttpError } from '../lib/HttpError.js';
import { generateWithChatCompletions } from './chatCompletions.js';
import { generateWithGemini } from './gemini.js';

export interface GenerateJsonOptions {
  system: string;
  /** Conversation turns, oldest first. */
  messages: { role: 'user' | 'model'; text: string }[];
  /** OpenAPI-style schema (Gemini dialect) the model must follow for its JSON answer. */
  schema: Record<string, unknown>;
  temperature?: number;
}

export const AI_PROVIDERS = ['gemini', 'openai', 'gateway'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  gateway: 'Vercel AI Gateway',
};

/** Which provider to call and with what key. */
export interface AiCredentials {
  provider: AiProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
  /** True for a visitor's own key (bring your own key), false for the server's key from .env. */
  own: boolean;
}

/** Vercel AI Gateway wins when both keys are set; Gemini direct is the fallback. */
export function serverCredentials(): AiCredentials | null {
  if (env.aiGateway.apiKey) return { provider: 'gateway', ...env.aiGateway, own: false };
  if (env.gemini.apiKey) return { provider: 'gemini', ...env.gemini, own: false };
  return null;
}

export const isAiConfigured = () => serverCredentials() !== null;

/** Credentials for a visitor's own key, filling in the provider's default model and endpoint. */
export function ownCredentials(provider: AiProvider, apiKey: string, model?: string): AiCredentials {
  const defaults = provider === 'gateway' ? env.aiGateway : provider === 'openai' ? env.openai : env.gemini;
  return { provider, apiKey, model: model || defaults.model, baseUrl: defaults.baseUrl, own: true };
}

export const missingKeyError = () =>
  new HttpError(
    503,
    'This server has no AI key. Add your own API key to generate diagrams, or set AI_GATEWAY_API_KEY (or GEMINI_API_KEY) in server/.env and restart the server.',
    undefined,
    'AI_KEY_REQUIRED'
  );

/** Asks the model for a JSON answer and returns the parsed object. */
export async function generateJson(options: GenerateJsonOptions, credentials = serverCredentials()): Promise<unknown> {
  if (!credentials) throw missingKeyError();
  return credentials.provider === 'gemini' ? generateWithGemini(options, credentials) : generateWithChatCompletions(options, credentials);
}

/**
 * Turns a provider's error response into a friendly HttpError. Problems with the server's key are the
 * operator's to fix (503); problems with a visitor's own key are theirs (400 with code AI_KEY_INVALID).
 */
export function providerError(credentials: AiCredentials, status: number, detail: string): HttpError {
  const name = PROVIDER_LABELS[credentials.provider];
  const { own } = credentials;
  const keyProblem = (message: string) =>
    own ? new HttpError(400, message, undefined, 'AI_KEY_INVALID') : new HttpError(503, message);

  const badKey = status === 401 || (status === 400 && /API key/i.test(detail));
  if (badKey) {
    return keyProblem(own ? `Your ${name} API key was rejected. Check it and try again.` : `The ${name} API key is invalid. Check ${envVar(credentials)}.`);
  }
  if (status === 402) return keyProblem(own ? `Your ${name} account is out of credits.` : `The ${name} account is out of credits.`);
  if (status === 403) return keyProblem(`${own ? 'Your' : `The ${name}`} API key does not have access to the model "${credentials.model}".`);
  if (status === 404 && own) return keyProblem(`${name} couldn't find the model "${credentials.model}". Check the model name.`);
  if (status === 429) {
    if (own && /quota|billing|credit/i.test(detail)) return keyProblem(`Your ${name} account has hit its usage quota.`);
    return new HttpError(429, 'The AI is getting too many requests right now. Wait a minute and try again.');
  }
  if (own && status === 400) {
    // Their own account, so the provider's explanation is safe and useful to show.
    return keyProblem(`${name} rejected the request: ${providerMessage(detail)}`);
  }
  return new HttpError(502, 'The AI service returned an error. Please try again.');
}

const envVar = (credentials: AiCredentials) => (credentials.provider === 'gateway' ? 'AI_GATEWAY_API_KEY' : 'GEMINI_API_KEY');

/** Pulls `error.message` out of a provider's JSON error body. */
function providerMessage(detail: string): string {
  try {
    const message = (JSON.parse(detail) as { error?: { message?: string } }).error?.message;
    if (message) return message.slice(0, 200);
  } catch {
    /* not JSON */
  }
  return 'unknown error';
}

/** POSTs JSON with a timeout, turning network failures into friendly HttpErrors. */
export async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify(body),
    });
  } catch (err) {
    const timedOut = (err as Error).name === 'TimeoutError';
    throw new HttpError(504, timedOut ? 'The AI took too long to answer. Please try again.' : 'Could not reach the AI service.');
  }
}

/** JSON mode should return pure JSON, but strip accidental ```json fences just in case. */
export function parseJsonText(text: string): unknown {
  try {
    return JSON.parse(text.replace(/^\s*```(?:json)?|```\s*$/g, ''));
  } catch {
    throw new HttpError(502, 'The AI returned an unreadable answer. Please try again.');
  }
}
