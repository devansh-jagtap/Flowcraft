import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import { errorHandler, notFound } from './middleware/error.js';
import { aiRoutes } from './routes/ai.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { diagramRoutes } from './routes/diagrams.routes.js';
import { sharedRoutes } from './routes/shared.routes.js';

// In production the API also serves the built React app (single deployable unit).
const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');

export function createApp() {
  const app = express();

  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env.clientOrigins }));
  app.use(express.json({ limit: '200kb' }));
  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'up' : 'down' });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/diagrams', diagramRoutes);
  app.use('/api/shared', sharedRoutes);
  app.use('/api', notFound);

  if (env.isProduction && existsSync(clientDist)) {
    app.use(express.static(clientDist, { maxAge: '1h', index: false }));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
