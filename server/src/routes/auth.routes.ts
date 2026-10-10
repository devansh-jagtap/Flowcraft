import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';

// Sign-up and sign-in are handled by Clerk in the browser; the API only verifies its session tokens.
export const authRoutes = Router().get('/me', requireAuth, auth.me);
