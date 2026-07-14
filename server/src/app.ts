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
import { imageStorage } from './services/storage.js';
import { AppError } from './utils/errors.js';

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
  app.get(/^\/uploads\/(.+)$/, (req, res, next) => {
    void (async () => {
      const value = req.params[0];
      const key = Array.isArray(value) ? value.join('/') : value;
      if (!key) throw new AppError(404, 'تصویر پیدا نشد', 'FUN_IMAGE_STORAGE_NOT_FOUND');
      const image = await imageStorage.open(key);
      res.set({
        'Cache-Control': 'public, max-age=2592000, immutable',
        'Content-Length': String(image.length),
        'Content-Type': image.contentType,
        'Cross-Origin-Resource-Policy': 'cross-origin',
        ETag: `"${image.etag}"`,
        'Last-Modified': image.uploadedAt.toUTCString()
      });
      image.stream.once('error', (error) => {
        if (res.headersSent) res.destroy(error as Error);
        else next(error);
      });
      image.stream.pipe(res);
    })().catch(next);
  });
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
