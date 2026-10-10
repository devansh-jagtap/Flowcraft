import type { Request, Response } from 'express';
import { HttpError } from '../lib/HttpError.js';
import { parse } from '../lib/validate.js';
import { currentUser, signToken } from '../middleware/auth.js';
import { User } from '../models/index.js';
import { loginSchema, registerSchema } from '../validators/auth.schemas.js';

export async function register(req: Request, res: Response) {
  const input = parse(registerSchema, req.body);
  if (await User.exists({ email: input.email })) {
    throw HttpError.conflict('An account with that email already exists');
  }

  const user = await User.create(input);
  res.status(201).json({ user, token: signToken(user) });
}

export async function login(req: Request, res: Response) {
  const { email, password } = parse(loginSchema, req.body);
  const user = await User.findOne({ email }).select('+password');

  // One message for both cases so the API doesn't reveal which emails exist.
  if (!user || !(await user.comparePassword(password))) {
    throw HttpError.unauthorized('Invalid email or password');
  }

  res.json({ user, token: signToken(user) });
}

export function me(req: Request, res: Response) {
  res.json({ user: currentUser(req) });
}
