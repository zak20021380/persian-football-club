import crypto from 'node:crypto';
import { env } from '../config/env.js';
import type { TelegramInitUser } from './telegramAuth.js';
import { AppError } from '../utils/errors.js';

export interface SessionClaims {
  version: 1;
  subject: string;
  telegramId: number;
  issuedAt: number;
  expiresAt: number;
  telegramUser: Pick<TelegramInitUser, 'id'|'first_name'|'last_name'|'photo_url'>;
}

export function createSessionToken(subject: string, telegramUser: TelegramInitUser, nowSeconds = Math.floor(Date.now() / 1000), secret = env.SESSION_SECRET): { token: string; expiresAt: Date } {
  const claims: SessionClaims = {
    version: 1,
    subject,
    telegramId: telegramUser.id,
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + env.SESSION_TTL_SECONDS,
    telegramUser: {
      id: telegramUser.id,
      first_name: telegramUser.first_name,
      last_name: telegramUser.last_name,
      photo_url: telegramUser.photo_url
    }
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = sign(payload, secret);
  return { token: `${payload}.${signature}`, expiresAt: new Date(claims.expiresAt * 1000) };
}

export function verifySessionToken(token: string, nowSeconds = Math.floor(Date.now() / 1000), secret = env.SESSION_SECRET): SessionClaims {
  const [payload, receivedSignature, extra] = token.split('.');
  if (!payload || !receivedSignature || extra) throw unauthorized('نشست ورود نامعتبر است', 'SESSION_INVALID');
  const expectedSignature = sign(payload, secret);
  const received = Buffer.from(receivedSignature, 'base64url');
  const expected = Buffer.from(expectedSignature, 'base64url');
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) throw unauthorized('امضای نشست ورود نامعتبر است', 'SESSION_SIGNATURE_INVALID');
  let claims: SessionClaims;
  try { claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionClaims; }
  catch { throw unauthorized('نشست ورود نامعتبر است', 'SESSION_INVALID'); }
  if (claims.version !== 1 || !/^[a-f\d]{24}$/i.test(claims.subject) || !Number.isSafeInteger(claims.telegramId) || claims.telegramId <= 0 || claims.telegramUser?.id !== claims.telegramId || typeof claims.telegramUser.first_name !== 'string') {
    throw unauthorized('نشست ورود نامعتبر است', 'SESSION_INVALID');
  }
  if (!Number.isSafeInteger(claims.issuedAt) || !Number.isSafeInteger(claims.expiresAt) || claims.issuedAt > nowSeconds + 60 || claims.expiresAt <= nowSeconds) {
    throw unauthorized('نشست ورود منقضی شده است', 'SESSION_EXPIRED');
  }
  return claims;
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function unauthorized(message: string, code: string): AppError {
  return new AppError(401, message, code);
}
