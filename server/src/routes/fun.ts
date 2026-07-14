import type { NextFunction, Request, Response } from 'express';
import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAdmin, verifyLiveMembership } from '../middleware/auth.js';
import {
  createFunPost,
  deleteFunPost,
  funPostById,
  FUN_POST_SORTS,
  listFunModeration,
  listFunPosts,
  moderateFunPost,
  reportFunPost,
  setFunPostLike
} from '../services/fun.js';
import { FUN_IMAGE_MAX_BYTES, FUN_IMAGE_MIME_TYPES } from '../services/funImage.js';
import { completeFunPostShare, prepareFunPostShare } from '../services/funShare.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const sharePrepareLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => String(req.authUser?._id ?? 'unauthenticated'),
  message: { error: 'تعداد تلاش‌های اشتراک‌گذاری زیاد است؛ کمی بعد دوباره امتحان کنید', code: 'FUN_SHARE_RATE_LIMIT' }
});
const shareCompleteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => String(req.authUser?._id ?? 'unauthenticated'),
  message: { error: 'تعداد درخواست‌های ثبت اشتراک‌گذاری زیاد است', code: 'FUN_SHARE_RATE_LIMIT' }
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FUN_IMAGE_MAX_BYTES, files: 1, fields: 3 },
  fileFilter: (_req, file, callback) => {
    if (!FUN_IMAGE_MIME_TYPES.includes(file.mimetype as typeof FUN_IMAGE_MIME_TYPES[number])) return callback(new AppError(415, 'فقط تصویر JPG، PNG یا WEBP مجاز است', 'FUN_IMAGE_TYPE'));
    callback(null, true);
  }
});

function singleImage(req: Request, res: Response, next: NextFunction): void {
  upload.single('image')(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'حجم تصویر باید کمتر از ۵ مگابایت باشد', 'FUN_IMAGE_TOO_LARGE'));
    if (error instanceof multer.MulterError) return next(new AppError(400, 'آپلود تصویر معتبر نیست', 'FUN_UPLOAD_ERROR'));
    next(error);
  });
}

router.get('/posts', asyncHandler(async (req, res) => {
  const input = z.object({
    cursor: z.string().min(1).max(64).optional(),
    limit: z.coerce.number().int().min(5).max(20).default(10),
    sort: z.enum(FUN_POST_SORTS).default('newest')
  }).parse(req.query);
  res.json(await listFunPosts(req.authUser!._id, input.cursor, input.limit, input.sort));
}));

router.get('/posts/:postId', asyncHandler(async (req, res) => {
  res.json(await funPostById(objectId(req.params.postId), req.authUser!._id));
}));

router.post('/posts/:postId/share/prepare', sharePrepareLimiter, asyncHandler(async (req, res) => {
  const postId = objectId(req.params.postId);
  z.object({}).strict().parse(req.body ?? {});
  res.status(201).json(await prepareFunPostShare({
    postId,
    userId: req.authUser!._id,
    telegramUserId: req.authUser!.telegramId
  }));
}));

router.post('/posts/:postId/share/complete', shareCompleteLimiter, asyncHandler(async (req, res) => {
  const postId = objectId(req.params.postId);
  const { completionToken } = z.object({ completionToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict().parse(req.body);
  res.json(await completeFunPostShare({ postId, userId: req.authUser!._id, completionToken }));
}));

router.post('/posts', verifyLiveMembership, singleImage, asyncHandler(async (req, res) => {
  const input = z.object({ caption: z.string().max(1000).optional(), clientRequestId: z.string().uuid() }).parse(req.body);
  const result = await createFunPost({ ownerId: req.authUser!._id, caption: input.caption, file: req.file, clientRequestId: input.clientRequestId });
  const view = await funPostById(String(result.post._id), req.authUser!._id);
  res.status(result.created ? 201 : 200).json(view);
}));

router.put('/posts/:id/like', verifyLiveMembership, asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  const { liked } = z.object({ liked: z.boolean() }).parse(req.body);
  res.json(await setFunPostLike(id, req.authUser!._id, liked));
}));

router.post('/posts/:id/report', verifyLiveMembership, asyncHandler(async (req, res) => {
  const id = objectId(req.params.id);
  const { reason } = z.object({ reason: z.enum(['spam', 'abuse', 'inappropriate', 'other']).default('inappropriate') }).parse(req.body);
  await reportFunPost(id, req.authUser!._id, reason);
  res.status(201).json({ reported: true });
}));

router.delete('/posts/:id', asyncHandler(async (req, res) => {
  await deleteFunPost(objectId(req.params.id), req.authUser!._id);
  res.sendStatus(204);
}));

router.get('/moderation/posts', requireAdmin, asyncHandler(async (req, res) => {
  const input = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(5).max(50).default(20), reported: z.enum(['true', 'false']).default('false').transform((value) => value === 'true') }).parse(req.query);
  res.json(await listFunModeration(input.page, input.limit, input.reported));
}));

router.patch('/moderation/posts/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { moderationStatus } = z.object({ moderationStatus: z.enum(['published', 'hidden']) }).parse(req.body);
  res.json(await moderateFunPost(objectId(req.params.id), moderationStatus));
}));

router.delete('/moderation/posts/:id', requireAdmin, asyncHandler(async (req, res) => {
  await deleteFunPost(objectId(req.params.id), req.authUser!._id, true);
  res.sendStatus(204);
}));

function objectId(value: string | string[]): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'شناسه پست نامعتبر است', 'FUN_POST_ID');
  return id;
}

export default router;
