import crypto from 'node:crypto';
import { User, type IUser } from '../models/index.js';
import type { TelegramInitUser } from './telegramAuth.js';
import type { HydratedDocument } from 'mongoose';

export function referralCodeFor(telegramId: number): string {
  return `${telegramId.toString(36)}${crypto.createHash('sha1').update(String(telegramId)).digest('hex').slice(0, 6)}`;
}

export async function recoverTelegramUser(telegramUser: TelegramInitUser): Promise<{ user: HydratedDocument<IUser>; created: boolean }> {
  const update = {
    $set: { lastActiveAt: new Date() },
    $setOnInsert: { telegramId: telegramUser.id, referralCode: referralCodeFor(telegramUser.id) },
    $unset: { firstName: 1, lastName: 1, username: 1, photoUrl: 1 }
  };
  try {
    const result = await User.findOneAndUpdate(
      { telegramId: telegramUser.id },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, includeResultMetadata: true, strict: false }
    );
    if (!result.value) throw new Error('Atomic user recovery returned no document');
    return { user: result.value, created: result.lastErrorObject?.updatedExisting === false || Boolean(result.lastErrorObject?.upserted) };
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const user = await User.findOne({ telegramId: telegramUser.id });
    if (!user) throw error;
    return { user, created: false };
  }
}
