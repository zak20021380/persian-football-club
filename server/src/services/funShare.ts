import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { FunPost, FunPostShare } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { detectImage, FUN_IMAGE_MAX_BYTES, toTelegramShareJpeg } from './funImage.js';
import { imageStorage } from './storage.js';

type ObjectId = mongoose.Types.ObjectId;

interface TelegramPreparedMessage {
  id: string;
  expiration_date: number;
}

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

export function buildFunDeepLink(postId: string): string {
  const link = new URL(env.TELEGRAM_MINI_APP_DEEP_LINK_BASE);
  link.searchParams.set('startapp', `fun_${postId}`);
  return link.toString();
}

export function buildFunInlinePhotoResult(input: { postId: string; caption?: string; imageUrl: string; deepLink: string }) {
  const messageCaption = `${input.caption?.trim() || 'یک میم فوتبالی برای تو 😄'}\n\n⚽ از باشگاه فوتبالی`;
  return {
    type: 'photo' as const,
    id: `fun_${input.postId}_${crypto.randomBytes(12).toString('hex')}`,
    photo_url: input.imageUrl,
    thumbnail_url: input.imageUrl,
    caption: messageCaption,
    reply_markup: {
      inline_keyboard: [[{ text: 'مشاهده میم ⚽', url: input.deepLink }]]
    }
  };
}

export function buildSavePreparedMessageBody(userId: number, result: ReturnType<typeof buildFunInlinePhotoResult>) {
  return {
    user_id: userId,
    result,
    allow_user_chats: true,
    allow_bot_chats: false,
    allow_group_chats: true,
    allow_channel_chats: true
  };
}

export async function prepareFunPostShare(input: { postId: string; userId: ObjectId; telegramUserId: number }) {
  const post = await FunPost.findOne({ _id: input.postId, moderationStatus: 'published' });
  if (!post) throw new AppError(404, 'این میم پیدا نشد یا دیگر قابل نمایش نیست', 'FUN_POST_NOT_FOUND');
  if (!post.imageKey) throw new AppError(409, 'این پست تصویر قابل اشتراک در تلگرام ندارد', 'FUN_SHARE_IMAGE_REQUIRED');

  const [imageUrl, deepLink] = await Promise.all([
    ensurePublicShareJpeg(post),
    Promise.resolve(buildFunDeepLink(String(post._id)))
  ]);
  assertTelegramPublicHttpsUrl(imageUrl, 'آدرس عمومی HTTPS تصویر برای اشتراک‌گذاری تنظیم نشده است');
  assertTelegramPublicHttpsUrl(deepLink, 'لینک عمومی Mini App برای اشتراک‌گذاری تنظیم نشده است');

  const result = buildFunInlinePhotoResult({ postId: String(post._id), caption: post.caption, imageUrl, deepLink });
  const prepared = await savePreparedInlineMessage(input.telegramUserId, result);
  await FunPostShare.create({
    postId: post._id,
    userId: input.userId,
    preparedMessageId: prepared.id,
    status: 'pending',
    expiresAt: new Date(prepared.expiration_date * 1_000)
  });
  return { preparedMessageId: prepared.id, expiresAt: new Date(prepared.expiration_date * 1_000).toISOString(), shareUrl: deepLink };
}

export async function completeFunPostShare(input: { postId: string; userId: ObjectId; preparedMessageId: string }) {
  const completedAt = new Date();
  const share = await FunPostShare.findOneAndUpdate(
    {
      postId: input.postId,
      userId: input.userId,
      preparedMessageId: input.preparedMessageId,
      status: 'pending',
      expiresAt: { $gt: completedAt }
    },
    { $set: { status: 'completed', completedAt } },
    { new: true }
  );
  if (!share) {
    const existing = await FunPostShare.findOne({ postId: input.postId, userId: input.userId, preparedMessageId: input.preparedMessageId });
    if (!existing) throw new AppError(400, 'درخواست ثبت اشتراک‌گذاری معتبر نیست', 'FUN_SHARE_INVALID');
    if (existing.status !== 'completed') throw new AppError(410, 'زمان ثبت این اشتراک‌گذاری گذشته است', 'FUN_SHARE_EXPIRED');
    const post = await FunPost.findById(input.postId).select('shareCount').lean();
    if (!post) throw new AppError(404, 'این میم دیگر موجود نیست', 'FUN_POST_NOT_FOUND');
    return { shareCount: post.shareCount ?? 0, counted: false };
  }

  const post = await FunPost.findByIdAndUpdate(input.postId, { $inc: { shareCount: 1 } }, { new: true }).select('shareCount').lean();
  if (!post) throw new AppError(404, 'این میم دیگر موجود نیست', 'FUN_POST_NOT_FOUND');
  return { shareCount: post.shareCount ?? 0, counted: true };
}

async function ensurePublicShareJpeg(post: { _id: mongoose.Types.ObjectId; imageKey?: string; imageUrl?: string }): Promise<string> {
  const originalKey = post.imageKey!;
  let buffer: Buffer;
  try {
    buffer = await imageStorage.read(originalKey);
  } catch {
    throw new AppError(409, 'فایل تصویر این میم در دسترس نیست', 'FUN_SHARE_IMAGE_MISSING');
  }
  const detected = detectImage(buffer);
  if (detected?.mime === 'image/jpeg' && buffer.length <= FUN_IMAGE_MAX_BYTES) return publicUploadUrl(originalKey);

  let jpeg: Buffer;
  try {
    jpeg = await toTelegramShareJpeg(buffer);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(409, 'تبدیل تصویر این میم برای تلگرام ممکن نشد', 'FUN_SHARE_IMAGE_CONVERSION');
  }
  const stored = await imageStorage.save(jpeg, 'jpg');
  const updated = await FunPost.updateOne(
    { _id: post._id, imageKey: originalKey },
    { $set: { imageKey: stored.key, imageUrl: stored.url } }
  );
  if (updated.modifiedCount) {
    await imageStorage.delete(originalKey);
    return publicUploadUrl(stored.key);
  }
  await imageStorage.delete(stored.key);
  const current = await FunPost.findById(post._id).select('imageKey').lean();
  if (!current?.imageKey) throw new AppError(409, 'فایل تصویر این میم در دسترس نیست', 'FUN_SHARE_IMAGE_MISSING');
  return publicUploadUrl(current.imageKey);
}

function publicUploadUrl(key: string): string {
  const safePath = key.split('/').map(encodeURIComponent).join('/');
  return new URL(`/uploads/${safePath}`, env.BASE_URL).toString();
}

function assertTelegramPublicHttpsUrl(value: string, message: string): void {
  const url = new URL(value);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new AppError(503, message, 'FUN_SHARE_PUBLIC_URL_REQUIRED');
  }
}

async function savePreparedInlineMessage(userId: number, result: ReturnType<typeof buildFunInlinePhotoResult>): Promise<TelegramPreparedMessage> {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/savePreparedInlineMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildSavePreparedMessageBody(userId, result)),
      signal: AbortSignal.timeout(12_000)
    });
  } catch {
    throw new AppError(502, 'ارتباط با تلگرام برای آماده‌سازی پیام برقرار نشد', 'TELEGRAM_SHARE_UNAVAILABLE');
  }
  let payload: TelegramApiResponse<TelegramPreparedMessage>;
  try { payload = await response.json() as TelegramApiResponse<TelegramPreparedMessage>; }
  catch { throw new AppError(502, 'پاسخ تلگرام برای اشتراک‌گذاری معتبر نبود', 'TELEGRAM_SHARE_INVALID_RESPONSE'); }
  if (!response.ok || !payload.ok || !payload.result?.id || !Number.isSafeInteger(payload.result.expiration_date)) {
    throw new AppError(502, payload.description || 'تلگرام نتوانست پیام اشتراک‌گذاری را آماده کند', 'TELEGRAM_SHARE_PREPARE_FAILED');
  }
  return payload.result;
}
