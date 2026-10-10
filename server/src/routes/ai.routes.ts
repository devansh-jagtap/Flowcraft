import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import * as ai from '../controllers/ai.controller.js';

// Each generation costs AI quota, so keep a per-IP budget (guests can use it too).
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: { message: "You're generating very quickly — please wait a few minutes." } },
});

export const aiRoutes = Router().get('/status', ai.status).post('/generate', limiter, ai.generate);
