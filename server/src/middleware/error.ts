import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
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
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = details[0]?.message ?? 'Invalid input';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (isDuplicateKey(err)) {
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

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;
const isBodyParseError = (err: unknown) => (err as { type?: string })?.type === 'entity.parse.failed';
