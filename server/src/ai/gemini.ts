import { env } from '../config/env.js';
import { HttpError } from '../lib/HttpError.js';

export interface GenerateJsonOptions {
  system: string;
  /** Conversation turns, oldest first. */
  messages: { role: 'user' | 'model'; text: string }[];
  /** OpenAPI-style schema Gemini must follow for its JSON answer. */
  schema: Record<string, unknown>;
  temperature?: number;
}

export const isAiConfigured = () => Boolean(env.gemini.apiKey);

/**
 * Calls Gemini's generateContent REST endpoint in JSON mode and returns the parsed object.
 * Errors are translated into user-friendly HttpErrors; the API key never leaves the server.
 */
export async function generateJson({ system, messages, schema, temperature = 0.4 }: GenerateJsonOptions): Promise<unknown> {
  if (!isAiConfigured()) {
    throw new HttpError(503, 'AI generation is not set up yet. Add GEMINI_API_KEY to server/.env and restart the server.');
  }

  let res: Response;
  try {
    res = await fetch(`${env.gemini.baseUrl}/models/${env.gemini.model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.gemini.apiKey },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema },
      }),
    });
  } catch (err) {
    const timedOut = (err as Error).name === 'TimeoutError';
    throw new HttpError(504, timedOut ? 'The AI took too long to answer. Please try again.' : 'Could not reach the AI service.');
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (!env.isTest) console.error(`Gemini error ${res.status}: ${detail.slice(0, 500)}`);
    if (res.status === 429) throw new HttpError(429, 'The AI is getting too many requests right now. Wait a minute and try again.');
    if (res.status === 400 && /API key/i.test(detail)) throw new HttpError(503, 'The Gemini API key is invalid. Check GEMINI_API_KEY.');
    if (res.status === 403) throw new HttpError(503, 'The Gemini API key does not have access to this model.');
    throw new HttpError(502, 'The AI service returned an error. Please try again.');
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  if (data.promptFeedback?.blockReason) {
    throw HttpError.badRequest('That request was blocked by the AI safety filter. Try describing it differently.');
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  try {
    // JSON mode should return pure JSON, but strip accidental ```json fences just in case.
    return JSON.parse(text.replace(/^\s*```(?:json)?|```\s*$/g, ''));
  } catch {
    throw new HttpError(502, 'The AI returned an unreadable answer. Please try again.');
  }
}
