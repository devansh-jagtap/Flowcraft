import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../lib/HttpError.js';
import { User, type UserDocument } from '../models/User.js';

export function signToken(user: UserDocument): string {
  return jwt.sign({ sub: user.id }, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);
}

function bearerToken(req: Request): string | null {
  const [scheme, token] = (req.headers.authorization ?? '').split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

async function userFromToken(token: string) {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    return payload.sub ? await User.findById(payload.sub) : null;
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (!token) throw HttpError.unauthorized();

  const user = await userFromToken(token);
  if (!user) throw HttpError.unauthorized('Your session has expired, please log in again');

  req.user = user;
  next();
}

/** Helper for handlers mounted behind requireAuth. */
export function currentUser(req: Request): UserDocument {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}
