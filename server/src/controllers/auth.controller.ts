import type { Request, Response } from 'express';
import { currentUser } from '../middleware/auth.js';

export function me(req: Request, res: Response) {
  res.json({ user: currentUser(req) });
}
