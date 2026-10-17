import { env } from '../config/env.js';
import { HttpError } from '../lib/HttpError.js';
import { generateWithGateway } from './chatCompletions.js';
import { generateWithGemini } from './gemini.js';

export interface GenerateJsonOptions {
  system: string;
  /** Conversation turns, oldest first. */
  messages: { role: 'user' | 'model'; text: string }[];
  /** OpenAPI-style schema (Gemini dialect) the model must follow for its JSON answer. */
  schema: Record<string, unknown>;
  temperature?: number;
}

/** Vercel AI Gateway wins when both keys are set; Gemini direct is the fallback. */
export const aiProvider = (): 'gateway' | 'gemini' | null =>
  env.aiGateway.apiKey ? 'gateway' : env.gemini.apiKey ? 'gemini' : null;

export const isAiConfigured = () => aiProvider() !== null;

/** Asks the configured model for a JSON answer and returns the parsed object. */
export async function generateJson(options: GenerateJsonOptions): Promise<unknown> {
  const provider = aiProvider();
  if (!provider) {
    throw new HttpError(
      503,
      'AI generation is not set up yet. Add AI_GATEWAY_API_KEY (or GEMINI_API_KEY) to server/.env and restart the server.'
    );
  }
  return provider === 'gateway' ? generateWithGateway(options) : generateWithGemini(options);
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
