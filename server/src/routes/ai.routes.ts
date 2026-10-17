import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import * as ai from '../controllers/ai.controller.js';
import { optionalAuth } from '../middleware/auth.js';

// A per-IP burst limit on top of the free quota. Visitors using their own key get more room.
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: (req) => (req.get('x-ai-key') ? 60 : 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: { message: "You're generating very quickly. Please wait a few minutes." } },
});

// optionalAuth lets signed-in users have their own free quota instead of sharing their IP's.
export const aiRoutes = Router().get('/status', optionalAuth, ai.status).post('/generate', limiter, optionalAuth, ai.generate);
