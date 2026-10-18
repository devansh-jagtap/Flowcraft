import { env } from '../config/env.js';
import { HttpError } from '../lib/HttpError.js';
import { parseJsonText, postJson, providerError, type AiCredentials, type GenerateJsonOptions } from './llm.js';

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
 * Calls an OpenAI-compatible chat completions endpoint (Vercel AI Gateway or OpenAI) with structured output.
 * Errors are translated into user-friendly HttpErrors; API keys are never logged or returned.
 */
export async function generateWithChatCompletions(
  { system, messages, schema, temperature = 0.4, onUsage }: GenerateJsonOptions,
  credentials: AiCredentials
): Promise<unknown> {
  const res = await postJson(
    `${credentials.baseUrl}/chat/completions`,
    { Authorization: `Bearer ${credentials.apiKey}` },
    {
      model: credentials.model,
      // Newer OpenAI models (gpt-5, o-series) reject any temperature but the default.
      ...(credentials.provider !== 'openai' && { temperature }),
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
    if (!env.isTest && !credentials.own) console.error(`${credentials.provider} error ${res.status}: ${detail.slice(0, 500)}`);
    throw providerError(credentials, res.status, detail);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  onUsage?.({ inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 });

  const choice = data.choices?.[0];
  if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') {
    throw HttpError.badRequest('That request was blocked by the AI safety filter. Try describing it differently.');
  }

  return parseJsonText(choice?.message?.content ?? '');
}
