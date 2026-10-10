import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: { message: 'Too many attempts, please try again in a few minutes' } },
});

export const authRoutes = Router()
  .post('/register', limiter, auth.register)
  .post('/login', limiter, auth.login)
  .get('/me', requireAuth, auth.me);
