import { env } from '../config/env.js';
import { HttpError } from '../lib/HttpError.js';
import { parseJsonText, postJson, type GenerateJsonOptions } from './llm.js';

/**
 * Calls Gemini's generateContent REST endpoint in JSON mode and returns the parsed object.
 * Errors are translated into user-friendly HttpErrors; the API key never leaves the server.
 */
export async function generateWithGemini({ system, messages, schema, temperature = 0.4 }: GenerateJsonOptions): Promise<unknown> {
  const res = await postJson(
    `${env.gemini.baseUrl}/models/${env.gemini.model}:generateContent`,
    { 'x-goog-api-key': env.gemini.apiKey },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema },
    }
  );

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

  return parseJsonText(data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '');
}
