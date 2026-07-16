import type { NextFunction, Request, Response } from 'express';
import { env, adminIds } from '../config/env.js';
import { User } from '../models/index.js';
import { verifySessionToken } from '../services/session.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const authorization = req.header('authorization') ?? '';
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new AppError(401, 'برای ادامه ابتدا از طریق تلگرام وارد شوید', 'SESSION_MISSING');
  const claims = verifySessionToken(match[1]);
  const user = await User.findOne({ _id: claims.subject, telegramId: claims.telegramId });
  if (!user) throw new AppError(401, 'حساب کاربری این نشست پیدا نشد؛ دوباره وارد شوید', 'SESSION_USER_NOT_FOUND');
  req.authUser = user;
  req.telegramUser = claims.telegramUser;
  next();
});

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.authUser || !adminIds.has(req.authUser.telegramId)) return next(new AppError(403, 'دسترسی مدیر لازم است', 'ADMIN_REQUIRED'));
  next();
}

export function requireConfirmedMembership(req: Request, _res: Response, next: NextFunction): void {
  if (!env.CHANNEL_MEMBERSHIP_REQUIRED) return next();
  if (!req.authUser?.membershipConfirmed) return next(new AppError(403, 'ابتدا عضویت کانال را تأیید کنید', 'CHANNEL_MEMBERSHIP_REQUIRED'));
  next();
}

export const verifyLiveMembership = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  if (!env.CHANNEL_MEMBERSHIP_REQUIRED) return next();
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
