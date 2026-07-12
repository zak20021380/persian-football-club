import mongoose from 'mongoose';
import { Sponsor, SponsorEvent } from '../models/index.js';
import { AppError } from '../utils/errors.js';

export function assertSafeHttpUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new AppError(400, 'نشانی اسپانسر نامعتبر است'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new AppError(400, 'فقط نشانی HTTP یا HTTPS مجاز است');
  return url;
}

export async function trackSponsorEvent(sponsorId: string, userId: mongoose.Types.ObjectId, kind: 'impression'|'click', entityKey: string) {
  const sponsor = await Sponsor.findOne({ _id: sponsorId, active: true, startsAt: { $lte: new Date() }, endsAt: { $gte: new Date() } });
  if (!sponsor) throw new AppError(404, 'کمپین فعال نیست');
  let unique = false;
  try {
    await SponsorEvent.create({ sponsorId: sponsor._id, userId, kind, entityKey });
    unique = true;
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
  await Sponsor.updateOne({ _id: sponsor._id }, { $inc: kind === 'click' ? { clicks: 1, uniqueClicks: unique ? 1 : 0 } : { impressions: 1, uniqueImpressions: unique ? 1 : 0 } });
  return sponsor;
}

import crypto from 'node:crypto';
import { env } from '../config/env.js';

export function createSponsorRedirectToken(sponsorId: string, userId: string, ttlSeconds = 900): string {
  const payload = Buffer.from(JSON.stringify({ sponsorId, userId, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString('base64url');
  const signature = crypto.createHmac('sha256', env.WEBHOOK_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySponsorRedirectToken(token: string): { sponsorId: string; userId: string } {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) throw new AppError(401, 'توکن هدایت نامعتبر است');
  const expected = crypto.createHmac('sha256', env.WEBHOOK_SECRET).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new AppError(401, 'توکن هدایت نامعتبر است');
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sponsorId: string; userId: string; exp: number };
  if (parsed.exp < Math.floor(Date.now() / 1000)) throw new AppError(401, 'توکن هدایت منقضی شده است');
  return parsed;
}
