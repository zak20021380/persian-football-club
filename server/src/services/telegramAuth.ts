import crypto from 'node:crypto';
import { AppError } from '../utils/errors.js';

export interface TelegramInitUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface ValidatedInitData {
  user: TelegramInitUser;
  authDate: number;
  queryId?: string;
  startParam?: string;
  raw: URLSearchParams;
}

export function validateTelegramInitData(initData: string, botToken: string, maxAgeSeconds = 86_400): ValidatedInitData {
  if (!initData) throw new AppError(401, 'اطلاعات ورود تلگرام ارسال نشده است', 'INIT_DATA_MISSING');
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash || !/^[a-f0-9]{64}$/i.test(receivedHash)) {
    throw new AppError(401, 'امضای تلگرام نامعتبر است', 'INIT_DATA_HASH_INVALID');
  }
  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const valid = crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), Buffer.from(receivedHash, 'hex'));
  if (!valid) throw new AppError(401, 'اعتبارسنجی تلگرام ناموفق بود', 'INIT_DATA_SIGNATURE_INVALID');

  const authDate = Number(params.get('auth_date'));
  if (!Number.isSafeInteger(authDate)) throw new AppError(401, 'زمان ورود نامعتبر است', 'AUTH_DATE_INVALID');
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age < -60 || age > maxAgeSeconds) throw new AppError(401, 'نشست تلگرام منقضی شده است', 'INIT_DATA_EXPIRED');

  const rawUser = params.get('user');
  if (!rawUser) throw new AppError(401, 'کاربر تلگرام یافت نشد', 'TELEGRAM_USER_MISSING');
  let user: TelegramInitUser;
  try { user = JSON.parse(rawUser) as TelegramInitUser; } catch { throw new AppError(401, 'اطلاعات کاربر نامعتبر است', 'TELEGRAM_USER_INVALID'); }
  if (!Number.isSafeInteger(user.id) || !user.first_name) throw new AppError(401, 'شناسه کاربر نامعتبر است', 'TELEGRAM_USER_INVALID');

  return { user, authDate, queryId: params.get('query_id') ?? undefined, startParam: params.get('start_param') ?? undefined, raw: params };
}

export function createSignedInitDataForTest(user: TelegramInitUser, botToken: string, authDate = Math.floor(Date.now() / 1000)): string {
  const params = new URLSearchParams({ auth_date: String(authDate), query_id: 'test-query', user: JSON.stringify(user) });
  const dataCheckString = [...params.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex'));
  return params.toString();
}
