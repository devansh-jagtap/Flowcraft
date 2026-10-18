import { env } from '../config/env.js';
import { HttpError } from '../lib/HttpError.js';
import { parseJsonText, postJson, providerError, type AiCredentials, type GenerateJsonOptions } from './llm.js';

/**
 * Calls Gemini's generateContent REST endpoint in JSON mode and returns the parsed object.
 * Errors are translated into user-friendly HttpErrors; API keys are never logged or returned.
 */
export async function generateWithGemini(
  { system, messages, schema, temperature = 0.4, onUsage }: GenerateJsonOptions,
  credentials: AiCredentials
): Promise<unknown> {
  const res = await postJson(
    `${credentials.baseUrl}/models/${encodeURIComponent(credentials.model)}:generateContent`,
    { 'x-goog-api-key': credentials.apiKey },
    {
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
      generationConfig: { temperature, responseMimeType: 'application/json', responseSchema: schema },
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (!env.isTest && !credentials.own) console.error(`Gemini error ${res.status}: ${detail.slice(0, 500)}`);
    throw providerError(credentials, res.status, detail);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  };
  const meta = data.usageMetadata;
  // Gemini bills "thinking" tokens as output.
  onUsage?.({ inputTokens: meta?.promptTokenCount ?? 0, outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0) });

  if (data.promptFeedback?.blockReason) {
    throw HttpError.badRequest('That request was blocked by the AI safety filter. Try describing it differently.');
  }

  return parseJsonText(data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '');
}
