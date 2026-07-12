import mongoose from 'mongoose';
import { Referral, User } from '../models/index.js';

export function canCreateReferral(referrerTelegramId: number, invitedTelegramId: number, invitedIsNew: boolean): boolean {
  return invitedIsNew && referrerTelegramId !== invitedTelegramId;
}

export async function createPendingReferral(referrerCode: string, invitedUserId: mongoose.Types.ObjectId, invitedTelegramId: number): Promise<void> {
  const referrer = await User.findOne({ referralCode: referrerCode });
  if (!referrer || !canCreateReferral(referrer.telegramId, invitedTelegramId, true)) return;
  await Referral.updateOne(
    { invitedUserId },
    { $setOnInsert: { referrerId: referrer._id, invitedUserId, invitedTelegramId, rewardPoints: 25, status: 'pending' } },
    { upsert: true }
  ).catch((error: unknown) => {
    if ((error as { code?: number }).code !== 11000) throw error;
  });
  await User.updateOne({ _id: invitedUserId, referredBy: { $exists: false } }, { $set: { referredBy: referrer.telegramId } });
}

export async function rewardPendingReferral(invitedUserId: mongoose.Types.ObjectId): Promise<boolean> {
  const referral = await Referral.findOneAndUpdate(
    { invitedUserId, status: 'pending' },
    { $set: { status: 'rewarded', rewardedAt: new Date() } },
    { new: true }
  );
  if (!referral) return false;
  await User.updateOne(
    { _id: referral.referrerId },
    { $inc: { points: referral.rewardPoints, weeklyPoints: referral.rewardPoints, successfulReferrals: 1 }, $push: { activity: { type: 'referral', title: 'پاداش دعوت موفق', points: referral.rewardPoints, at: new Date() } } }
  );
  return true;
}
