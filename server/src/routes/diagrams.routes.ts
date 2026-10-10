import { Router } from 'express';
import * as diagrams from '../controllers/diagrams.controller.js';
import { requireAuth } from '../middleware/auth.js';

export const diagramRoutes = Router()
  .use(requireAuth)
  .get('/', diagrams.list)
  .post('/', diagrams.create)
  .get('/stats', diagrams.stats)
  .get('/:id', diagrams.getOne)
  .patch('/:id', diagrams.update)
  .delete('/:id', diagrams.remove)
  .post('/:id/duplicate', diagrams.duplicate)
  .post('/:id/share', diagrams.share);
