import type { ZodTypeAny, z } from 'zod';
import { HttpError } from './HttpError.js';

/**
 * Parses untrusted input with a zod schema and returns fully typed data,
 * or throws a 400 with per-field messages the client can show next to inputs.
 */
export function parse<S extends ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const result = schema.safeParse(input ?? {});
  if (result.success) return result.data;

  const details = result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
  throw HttpError.badRequest(details[0]?.message ?? 'Invalid input', details);
}
