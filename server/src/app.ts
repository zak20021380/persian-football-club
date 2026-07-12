import path from 'node:path';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import apiRouter from './routes/api.js';
import cronRouter from './routes/cron.js';
import { errorHandler, notFound } from './middleware/errors.js';
import { logger } from './utils/logger.js';
import { uploadRoot } from './services/storage.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(dirname, '../../client/dist');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(pinoHttp({ logger }));
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: true, credentials: false }));
  app.use(compression());
  app.use(express.json({ limit: '3mb' }));
  app.use(express.urlencoded({ extended: true, limit: '3mb' }));
  app.use('/uploads', express.static(uploadRoot(), { index: false, maxAge: '30d', immutable: true }));
  app.use('/api/cron', rateLimit({ windowMs: 60_000, limit: 20 }), cronRouter);
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: 'draft-8', legacyHeaders: false }), apiRouter);
  app.use(express.static(clientDist, { maxAge: '1d', index: false }));
  app.use((req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) { res.sendFile(path.join(clientDist, 'index.html')); return; }
    next();
  });
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
