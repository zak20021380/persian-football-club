import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { env, adminIds } from '../config/env.js';
import { User } from '../models/index.js';
import { validateTelegramInitData } from '../services/telegramAuth.js';
import { createPendingReferral } from '../services/referral.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function referralCodeFor(telegramId: number): string {
  return `${telegramId.toString(36)}${crypto.createHash('sha1').update(String(telegramId)).digest('hex').slice(0, 6)}`;
}

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const initData = req.header('x-telegram-init-data') ?? '';
  req.telegramInitData = initData;
  let telegramUser: { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string };
  let startParam: string | undefined;

  if (env.NODE_ENV !== 'production' && !initData && req.header('x-dev-telegram-id')) {
    const id = Number(req.header('x-dev-telegram-id'));
    if (!Number.isSafeInteger(id)) throw new AppError(401, 'شناسه توسعه نامعتبر است');
    telegramUser = { id, first_name: 'کاربر آزمایشی', username: `dev_${id}` };
    startParam = req.header('x-dev-start-param') ?? undefined;
  } else {
    const validated = validateTelegramInitData(initData, env.BOT_TOKEN);
    telegramUser = validated.user;
    startParam = validated.startParam;
  }

  const existing = await User.findOne({ telegramId: telegramUser.id }).select('_id');
  const user = await User.findOneAndUpdate(
    { telegramId: telegramUser.id },
    {
      $set: {
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name,
        username: telegramUser.username,
        photoUrl: telegramUser.photo_url,
        lastActiveAt: new Date()
      },
      $setOnInsert: { referralCode: referralCodeFor(telegramUser.id) }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  if (!existing && startParam?.startsWith('ref_')) {
    await createPendingReferral(startParam.slice(4), user._id, user.telegramId);
  }
  req.authUser = user;
  next();
});

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.authUser || !adminIds.has(req.authUser.telegramId)) return next(new AppError(403, 'دسترسی مدیر لازم است', 'ADMIN_REQUIRED'));
  next();
}

export function requireConfirmedMembership(req: Request, _res: Response, next: NextFunction): void {
  if (!req.authUser?.membershipConfirmed) return next(new AppError(403, 'ابتدا عضویت کانال را تأیید کنید', 'CHANNEL_MEMBERSHIP_REQUIRED'));
  next();
}

export const verifyLiveMembership = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.authUser) throw new AppError(401, 'ورود لازم است');
  if (env.NODE_ENV !== 'production' && env.BOT_TOKEN === 'development-token') {
    if (!req.authUser.membershipConfirmed) throw new AppError(403, 'عضویت کانال تأیید نشده است', 'CHANNEL_MEMBERSHIP_REQUIRED');
    return next();
  }
  const { bot } = await import('../bot/index.js');
  const { checkChannelMembership } = await import('../services/membership.js');
  const member = await checkChannelMembership(bot.telegram, req.authUser.telegramId);
  if (!member) {
    req.authUser.membershipConfirmed = false;
    await req.authUser.save();
    throw new AppError(403, 'عضویت شما در کانال فعال نیست', 'CHANNEL_MEMBERSHIP_REQUIRED');
  }
  if (!req.authUser.membershipConfirmed) {
    req.authUser.membershipConfirmed = true;
    await req.authUser.save();
    const { rewardPendingReferral } = await import('../services/referral.js');
    await rewardPendingReferral(req.authUser._id);
  }
  next();
});
