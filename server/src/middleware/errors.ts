import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export const notFound: RequestHandler = (_req, _res, next) => next(new AppError(404, 'مسیر موردنظر پیدا نشد', 'NOT_FOUND'));

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: 'اطلاعات واردشده معتبر نیست', code: 'VALIDATION_ERROR', details: error.flatten() });
    return;
  }
  if ((error as { code?: number }).code === 11000) {
    res.status(409).json({ error: 'این عملیات قبلاً ثبت شده است', code: 'DUPLICATE' });
    return;
  }
  const status = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof AppError ? error.message : 'خطای غیرمنتظره سرور';
  logger.error({ err: error, path: req.path, method: req.method }, 'Request failed');
  res.status(status).json({ error: message, code: error instanceof AppError ? error.code : 'INTERNAL_ERROR' });
};
