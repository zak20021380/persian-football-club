import type { Telegram } from 'telegraf';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { withTelegramRetry } from '../utils/telegram.js';

export type MembershipStatus = 'creator'|'administrator'|'member'|'restricted'|'left'|'kicked';
export function isAcceptedMember(status: MembershipStatus, isMember?: boolean): boolean {
  return status === 'creator' || status === 'administrator' || status === 'member' || (status === 'restricted' && isMember === true);
}

export async function checkChannelMembership(telegram: Telegram, telegramId: number): Promise<boolean> {
  try {
    const member = await withTelegramRetry(() => telegram.getChatMember(env.CHANNEL_ID, telegramId));
    return isAcceptedMember(member.status as MembershipStatus, 'is_member' in member ? member.is_member : undefined);
  } catch (error) {
    logger.warn({ err: error, telegramId }, 'Unable to check channel membership');
    return false;
  }
}
