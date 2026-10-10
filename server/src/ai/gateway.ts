import { env } from '../config/env.js';
import { HttpError } from '../lib/HttpError.js';
import { parseJsonText, postJson, type GenerateJsonOptions } from './llm.js';

/**
 * Converts the Gemini-dialect schema (types like 'OBJECT', 'STRING') into standard JSON Schema
 * so one RESPONSE_SCHEMA serves both providers. Strict mode needs additionalProperties: false.
 */
export function toJsonSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const { type, properties, items, propertyOrdering: _ordering, ...rest } = schema;
  const out: Record<string, unknown> = { ...rest };
  if (typeof type === 'string') out.type = type.toLowerCase();
  if (items && typeof items === 'object') out.items = toJsonSchema(items as Record<string, unknown>);
  if (properties && typeof properties === 'object') {
    out.properties = Object.fromEntries(
      Object.entries(properties as Record<string, Record<string, unknown>>).map(([k, v]) => [k, toJsonSchema(v)])
    );
    out.additionalProperties = false;
  }
  return out;
}

/**
 * Calls Vercel AI Gateway's OpenAI-compatible chat completions endpoint with structured output.
 * Errors are translated into user-friendly HttpErrors; the API key never leaves the server.
 */
export async function generateWithGateway({ system, messages, schema, temperature = 0.4 }: GenerateJsonOptions): Promise<unknown> {
  const res = await postJson(
    `${env.aiGateway.baseUrl}/chat/completions`,
    { Authorization: `Bearer ${env.aiGateway.apiKey}` },
    {
      model: env.aiGateway.model,
      temperature,
      messages: [
        { role: 'system', content: system },
        ...messages.map((m) => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'diagram', strict: true, schema: toJsonSchema(schema) },
      },
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (!env.isTest) console.error(`AI Gateway error ${res.status}: ${detail.slice(0, 500)}`);
    if (res.status === 429) throw new HttpError(429, 'The AI is getting too many requests right now. Wait a minute and try again.');
    if (res.status === 401) throw new HttpError(503, 'The AI Gateway key is invalid. Check AI_GATEWAY_API_KEY.');
    if (res.status === 402) throw new HttpError(503, 'The AI Gateway account is out of credits.');
    if (res.status === 403) throw new HttpError(503, 'The AI Gateway key does not have access to this model.');
    throw new HttpError(502, 'The AI service returned an error. Please try again.');
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
  };

  const choice = data.choices?.[0];
  if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') {
    throw HttpError.badRequest('That request was blocked by the AI safety filter. Try describing it differently.');
  }

  return parseJsonText(choice?.message?.content ?? '');
}
