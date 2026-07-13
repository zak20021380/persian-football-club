import type { Telegram } from 'telegraf';
import type { HydratedDocument } from 'mongoose';
import { env } from '../config/env.js';
import { ImportantMatch, Prediction, Reminder, User, type IReminder, type MatchReminderMinutes } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { escapeTelegramHtml, withTelegramRetry } from '../utils/telegram.js';
import { presentMatch } from './matchPresentation.js';

export const MATCH_REMINDER_MINUTES = [15, 30, 60] as const;

type MatchForReminder = {
  _id: unknown;
  homeTeam: string;
  awayTeam: string;
  competitionName: string;
  kickoffAt: Date;
  status: 'scheduled'|'live'|'finished'|'cancelled';
  published: boolean;
};

type PredictionForReminder = {
  outcome: 'home'|'draw'|'away';
  homeScore?: number;
  awayScore?: number;
} | null;

export function matchReminderSendAt(kickoffAt: Date, minutes: MatchReminderMinutes): Date {
  return new Date(kickoffAt.getTime() - minutes * 60_000);
}

export function availableMatchReminderMinutes(kickoffAt: Date, now = new Date()): MatchReminderMinutes[] {
  return MATCH_REMINDER_MINUTES.filter((minutes) => matchReminderSendAt(kickoffAt, minutes).getTime() > now.getTime());
}

export function planMatchReminder(match: MatchForReminder | null, minutes: MatchReminderMinutes, now = new Date()) {
  if (!match || !match.published || match.status === 'cancelled') return { action: 'cancel' as const, reason: 'MATCH_CANCELLED' };
  if (match.status !== 'scheduled' || match.kickoffAt.getTime() <= now.getTime()) return { action: 'cancel' as const, reason: 'MATCH_STARTED' };
  const sendAt = matchReminderSendAt(match.kickoffAt, minutes);
  if (sendAt.getTime() > now.getTime()) return { action: 'wait' as const, sendAt };
  return { action: 'send' as const, sendAt: now };
}

export function buildMatchReminderMessage(match: MatchForReminder, prediction: PredictionForReminder): string {
  const kickoff = new Intl.DateTimeFormat('fa-IR', {
    timeZone: env.TIMEZONE,
    dateStyle: 'full',
    timeStyle: 'short'
  }).format(match.kickoffAt);
  const lines = [
    '<b>🔔 یادآوری مسابقه</b>',
    '',
    `⚽️ <b>${escapeTelegramHtml(match.homeTeam)} — ${escapeTelegramHtml(match.awayTeam)}</b>`,
    `🏆 ${escapeTelegramHtml(match.competitionName)}`,
    `🕒 شروع: ${escapeTelegramHtml(kickoff)}`
  ];
  if (prediction) lines.push(`🎯 پیش‌بینی شما: ${escapeTelegramHtml(predictionLabel(prediction, match))}`);
  return lines.join('\n');
}

export function matchReminderButton(matchId: string) {
  return {
    parse_mode: 'HTML' as const,
    reply_markup: {
      inline_keyboard: [[{ text: 'بازکردن مسابقه', web_app: { url: new URL(`/matches/${matchId}`, env.BASE_URL).toString() } }]]
    }
  };
}

export async function sendMatchReminderMessage(
  telegram: Pick<Telegram, 'sendMessage'>,
  telegramId: number,
  match: MatchForReminder,
  prediction: PredictionForReminder
): Promise<void> {
  await withTelegramRetry(() => telegram.sendMessage(
    telegramId,
    buildMatchReminderMessage(match, prediction),
    matchReminderButton(String(match._id))
  ));
}

export function isTelegramForbidden(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const response = (error as { response?: { error_code?: number } }).response;
  return response?.error_code === 403;
}

function telegramErrorCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  return (error as { response?: { error_code?: number } }).response?.error_code;
}

export async function ensureTelegramReminderAccess(telegram: Pick<Telegram, 'getChat'>, telegramId: number): Promise<void> {
  if (env.BOT_TOKEN === 'development-token') {
    throw new AppError(503, 'ربات تلگرام هنوز روی سرور تنظیم نشده است', 'BOT_UNAVAILABLE');
  }
  try {
    await telegram.getChat(telegramId);
    await User.updateOne({ telegramId, blockedBot: true }, { $set: { blockedBot: false } });
  } catch (error) {
    const code = telegramErrorCode(error);
    if (code === 400 || code === 403) {
      await User.updateOne({ telegramId }, { $set: { blockedBot: true } });
      throw new AppError(409, 'ربات به گفت‌وگوی شما دسترسی ندارد؛ ابتدا ربات را Start کنید', 'TELEGRAM_ACCESS_UNAVAILABLE');
    }
    if (code === 401) throw new AppError(503, 'توکن ربات تلگرام معتبر نیست؛ با پشتیبانی تماس بگیرید', 'BOT_UNAVAILABLE');
    throw new AppError(503, 'فعلاً امکان تأیید دسترسی تلگرام وجود ندارد؛ دوباره تلاش کنید', 'TELEGRAM_CHECK_FAILED');
  }
}

export async function synchronizePendingMatchReminders(now = new Date()): Promise<void> {
  const reminders = await Reminder.find({ type: 'match', status: 'pending' }).limit(2_000);
  if (!reminders.length) return;
  const matches = await ImportantMatch.find({ _id: { $in: reminders.map((item) => item.entityId) } }).populate('homeTeamId awayTeamId', 'name shortName logoUrl').lean();
  const matchMap = new Map(matches.map((match) => [String(match._id), presentMatch(match)]));
  await Promise.all(reminders.map(async (reminder) => {
    let changed = false;
    const minutes = reminder.reminderMinutes ?? 30;
    const match = matchMap.get(String(reminder.entityId)) ?? null;
    const plan = planMatchReminder(match, minutes, now);
    if (plan.action === 'cancel') {
      reminder.status = 'cancelled';
      reminder.lastErrorCode = plan.reason;
      changed = true;
    } else {
      if (reminder.sendAt.getTime() !== plan.sendAt.getTime()) { reminder.sendAt = plan.sendAt; changed = true; }
      if (match && reminder.matchKickoffAt?.getTime() !== match.kickoffAt.getTime()) { reminder.matchKickoffAt = match.kickoffAt; changed = true; }
    }
    if (changed) await reminder.save();
  }));
}

export async function deliverClaimedMatchReminder(reminder: HydratedDocument<IReminder>, telegram: Pick<Telegram, 'sendMessage'>, now = new Date()): Promise<'sent'|'rescheduled'|'cancelled'> {
  const rawMatch = await ImportantMatch.findById(reminder.entityId).populate('homeTeamId awayTeamId', 'name shortName logoUrl').lean();
  const match = rawMatch ? presentMatch(rawMatch) : null;
  const minutes = reminder.reminderMinutes ?? 30;
  const plan = planMatchReminder(match, minutes, now);
  if (plan.action === 'cancel') {
    reminder.status = 'cancelled';
    reminder.lastErrorCode = plan.reason;
    await reminder.save();
    return 'cancelled';
  }
  if (plan.action === 'wait') {
    reminder.status = 'pending';
    reminder.sendAt = plan.sendAt;
    reminder.matchKickoffAt = match!.kickoffAt;
    await reminder.save();
    return 'rescheduled';
  }
  if (env.BOT_TOKEN === 'development-token') throw new AppError(503, 'ربات تلگرام تنظیم نشده است', 'BOT_UNAVAILABLE');
  const prediction = await Prediction.findOne({ userId: reminder.userId, matchId: reminder.entityId }).lean();
  const stillClaimed = await Reminder.exists({ _id: reminder._id, status: 'processing' });
  if (!stillClaimed) return 'cancelled';
  const message = buildMatchReminderMessage(match!, prediction);
  await sendMatchReminderMessage(telegram, reminder.telegramId, match!, prediction);
  reminder.message = message;
  reminder.status = 'sent';
  reminder.sentAt = new Date();
  reminder.matchKickoffAt = match!.kickoffAt;
  reminder.lastErrorCode = undefined;
  await reminder.save();
  return 'sent';
}

function predictionLabel(prediction: NonNullable<PredictionForReminder>, match: MatchForReminder): string {
  const outcome = prediction.outcome === 'home' ? `برد ${match.homeTeam}` : prediction.outcome === 'away' ? `برد ${match.awayTeam}` : 'مساوی';
  if (prediction.homeScore === undefined || prediction.awayScore === undefined) return outcome;
  return `${outcome} (${new Intl.NumberFormat('fa-IR').format(prediction.homeScore)}–${new Intl.NumberFormat('fa-IR').format(prediction.awayScore)})`;
}
