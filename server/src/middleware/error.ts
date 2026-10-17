import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { HttpError, type ErrorDetail } from '../lib/HttpError.js';

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(HttpError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let message = 'Something went wrong';
  let details: ErrorDetail[] | undefined;
  let code: string | undefined;

  if (err instanceof HttpError) {
    ({ status, message, details, code } = err);
  } else if (isUniqueViolation(err)) {
    status = 409;
    message = 'That value is already taken';
  } else if (isBodyParseError(err)) {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err instanceof Error && !env.isProduction) {
    message = err.message;
  }

  if (status >= 500 && !env.isTest) console.error(err);
  res.status(status).json({ error: { message, ...(code && { code }), ...(details && { details }) } });
}

/** Postgres error code, also when Drizzle wraps the driver error in `cause`. */
const pgCode = (err: unknown): string | undefined => {
  const e = err as { code?: unknown; cause?: { code?: unknown } } | undefined;
  const code = e?.code ?? e?.cause?.code;
  return typeof code === 'string' ? code : undefined;
};
const isUniqueViolation = (err: unknown) => pgCode(err) === '23505';
const isBodyParseError = (err: unknown) => (err as { type?: string })?.type === 'entity.parse.failed';
