import { bot } from '../bot/index.js';
import { env } from '../config/env.js';
import { Broadcast, Competition, ImportantMatch, Quiz, Reminder, Reward, Sponsor, User } from '../models/index.js';
import { scoreMatch } from './matchScoring.js';
import { withTelegramRetry } from '../utils/telegram.js';
import { logger } from '../utils/logger.js';

export async function runCronCycle() {
  const now = new Date();
  const report = { competitionsActivated: 0, competitionsFinished: 0, quizzesActivated: 0, quizzesFinished: 0, matchesStarted: 0, matchesScored: 0, reminders: 0, broadcasts: 0, sponsorsExpired: 0, rewardsExpired: 0 };

  report.competitionsActivated = (await Competition.updateMany({ status: 'scheduled', startsAt: { $lte: now }, endsAt: { $gt: now } }, { $set: { status: 'active' } })).modifiedCount;
  report.competitionsFinished = (await Competition.updateMany({ status: { $in: ['scheduled','active'] }, endsAt: { $lte: now } }, { $set: { status: 'finished' } })).modifiedCount;
  report.quizzesActivated = (await Quiz.updateMany({ status: 'scheduled', startsAt: { $lte: now }, endsAt: { $gt: now } }, { $set: { status: 'active' } })).modifiedCount;
  report.quizzesFinished = (await Quiz.updateMany({ status: { $in: ['scheduled','active'] }, endsAt: { $lte: now } }, { $set: { status: 'finished' } })).modifiedCount;
  report.matchesStarted = (await ImportantMatch.updateMany({ status: 'scheduled', kickoffAt: { $lte: now } }, { $set: { status: 'live' } })).modifiedCount;
  report.sponsorsExpired = (await Sponsor.updateMany({ active: true, endsAt: { $lte: now } }, { $set: { active: false } })).modifiedCount;
  report.rewardsExpired = (await Reward.updateMany({ active: true, endsAt: { $lte: now } }, { $set: { active: false } })).modifiedCount;

  const finishedUnscored = await ImportantMatch.find({ status: 'finished', predictionsScored: false, homeScore: { $exists: true }, awayScore: { $exists: true } }).select('_id').limit(20);
  for (const match of finishedUnscored) {
    await scoreMatch(String(match._id));
    report.matchesScored += 1;
  }

  for (let i = 0; i < 100; i += 1) {
    const reminder = await Reminder.findOneAndUpdate({ status: 'pending', sendAt: { $lte: now } }, { $set: { status: 'processing' } }, { sort: { sendAt: 1 }, new: true });
    if (!reminder) break;
    try {
      await withTelegramRetry(() => bot.telegram.sendMessage(reminder.telegramId, reminder.message));
      reminder.status = 'sent'; reminder.sentAt = new Date(); report.reminders += 1;
    } catch (error) {
      reminder.status = 'failed';
      await User.updateOne({ telegramId: reminder.telegramId }, { $set: { blockedBot: true } });
      logger.warn({ err: error, reminderId: reminder._id }, 'Reminder delivery failed');
    }
    await reminder.save();
  }

  for (let i = 0; i < 10; i += 1) {
    const broadcast = await Broadcast.findOneAndUpdate({ status: 'scheduled', scheduledAt: { $lte: now } }, { $set: { status: 'sending' } }, { sort: { scheduledAt: 1 }, new: true });
    if (!broadcast) break;
    let success = 0; let failure = 0;
    if (broadcast.channelPost && !broadcast.channelPostedAt) {
      try {
        await withTelegramRetry(() => bot.telegram.sendMessage(env.CHANNEL_ID, broadcast.message));
        broadcast.channelPostedAt = new Date();
        await broadcast.save();
        success += 1;
      } catch { failure += 1; }
    }
    const userQuery = broadcast.audience === 'custom'
      ? { telegramId: { $in: broadcast.telegramIds } }
      : broadcast.audience === 'members'
        ? { membershipConfirmed: true, blockedBot: false }
        : broadcast.audience === 'active'
          ? { lastActiveAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) }, blockedBot: false }
          : { blockedBot: false };
    const cursor = User.find({ ...userQuery, telegramId: { ...(typeof (userQuery as { telegramId?: object }).telegramId === 'object' ? (userQuery as { telegramId?: object }).telegramId : {}), $nin: broadcast.sentTelegramIds } }).select('telegramId').cursor();
    for await (const user of cursor) {
      try {
        await withTelegramRetry(() => bot.telegram.sendMessage(user.telegramId, broadcast.message));
        broadcast.sentTelegramIds.push(user.telegramId);
        await broadcast.save();
        success += 1;
      } catch { failure += 1; await User.updateOne({ _id: user._id }, { $set: { blockedBot: true } }); }
    }
    broadcast.status = 'sent'; broadcast.sentAt = new Date(); broadcast.successCount = success; broadcast.failureCount = failure;
    await broadcast.save(); report.broadcasts += 1;
  }

  return report;
}
