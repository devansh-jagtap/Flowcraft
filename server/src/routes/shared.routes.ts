import { Router } from 'express';
import * as shared from '../controllers/shared.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const sharedRoutes = Router()
  .get('/:shareId', shared.view)
  .post('/:shareId/fork', requireAuth, shared.fork);
