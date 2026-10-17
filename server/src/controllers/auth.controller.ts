import type { Request, Response } from 'express';
import { userJson } from '../db/serialize.js';
import { currentUser } from '../middleware/auth.js';

export function me(req: Request, res: Response) {
  res.json({ user: userJson(currentUser(req)) });
}
