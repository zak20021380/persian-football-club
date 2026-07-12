import type { Express, Request, Response } from 'express';
import crypto from 'node:crypto';
import { Markup, Telegraf } from 'telegraf';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { checkChannelMembership } from '../services/membership.js';
import { createPendingReferral, rewardPendingReferral } from '../services/referral.js';
import { logger } from '../utils/logger.js';

export const bot = new Telegraf(env.BOT_TOKEN);

function referralCodeFor(telegramId: number): string {
  return `${telegramId.toString(36)}${crypto.createHash('sha1').update(String(telegramId)).digest('hex').slice(0, 6)}`;
}

async function upsertFromContext(ctx: Parameters<typeof bot.start>[0] extends never ? never : any) {
  const from = ctx.from;
  if (!from) return null;
  const existing = await User.findOne({ telegramId: from.id }).select('_id');
  const user = await User.findOneAndUpdate(
    { telegramId: from.id },
    { $set: { firstName: from.first_name, lastName: from.last_name, username: from.username, lastActiveAt: new Date() }, $setOnInsert: { referralCode: referralCodeFor(from.id) } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const startPayload = 'startPayload' in ctx ? ctx.startPayload as string : '';
  if (!existing && startPayload.startsWith('ref_')) await createPendingReferral(startPayload.slice(4), user._id, user.telegramId);
  return user;
}

async function sendEntryState(ctx: any): Promise<void> {
  const user = await upsertFromContext(ctx);
  if (!user || !ctx.from) return;
  const member = await checkChannelMembership(bot.telegram, ctx.from.id);
  await User.updateOne({ _id: user._id }, { $set: { membershipConfirmed: member } });
  if (!member) {
    await ctx.reply('برای ورود به باشگاه فوتبالی، ابتدا عضو کانال شوید و سپس عضویت را بررسی کنید.', Markup.inlineKeyboard([
      [Markup.button.url('عضویت در کانال', env.CHANNEL_JOIN_URL)],
      [Markup.button.callback('بررسی عضویت', 'check_membership')]
    ]));
    return;
  }
  await rewardPendingReferral(user._id);
  await ctx.reply('عضویت شما تأیید شد. آماده‌ای وارد باشگاه شوی؟ ⚽', Markup.inlineKeyboard([
    [Markup.button.webApp('⚽ ورود به باشگاه فوتبالی', env.BASE_URL)]
  ]));
}

bot.start(sendEntryState);
bot.action('check_membership', async (ctx) => {
  await ctx.answerCbQuery();
  await sendEntryState(ctx);
});
bot.catch((error, ctx) => logger.error({ err: error, updateId: ctx.update.update_id }, 'Bot update failed'));

export async function startTelegramBot(app: Express): Promise<void> {
  if (env.BOT_TOKEN === 'development-token') {
    logger.warn('BOT_TOKEN is not configured; Telegram bot startup skipped');
    return;
  }
  if (env.NODE_ENV === 'production') {
    const path = `/telegram/webhook/${encodeURIComponent(env.WEBHOOK_SECRET)}`;
    app.post(path, async (req: Request, res: Response) => {
      const secretHeader = req.header('x-telegram-bot-api-secret-token');
      if (secretHeader !== env.WEBHOOK_SECRET) { res.sendStatus(403); return; }
      await bot.handleUpdate(req.body);
      res.sendStatus(200);
    });
    await bot.telegram.setWebhook(`${env.BASE_URL}${path}`, { secret_token: env.WEBHOOK_SECRET, drop_pending_updates: false });
    logger.info({ path }, 'Telegram webhook configured');
  } else {
    await bot.launch({ dropPendingUpdates: false });
    logger.info('Telegram bot started with long polling');
  }
}

export async function stopTelegramBot(signal: string): Promise<void> {
  if (env.NODE_ENV !== 'production' && env.BOT_TOKEN !== 'development-token') bot.stop(signal);
}
