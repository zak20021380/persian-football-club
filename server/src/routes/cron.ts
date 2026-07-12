import { Router } from 'express';
import { env } from '../config/env.js';
import { runCronCycle } from '../services/cron.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.post('/run', asyncHandler(async (req, res) => {
  const supplied = req.header('x-cron-secret') ?? req.query.secret;
  if (supplied !== env.CRON_SECRET) throw new AppError(401, 'دسترسی کرون نامعتبر است');
  res.json({ ok: true, report: await runCronCycle() });
}));
export default router;
