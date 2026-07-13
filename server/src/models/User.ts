import { Schema, model } from 'mongoose';

export interface IUser {
  telegramId: number;
  displayName?: string;
  clubName?: string;
  favoriteTeam?: string;
  points: number;
  coinBalance: number;
  dailyRewardAvailableAt?: Date;
  weeklyPoints: number;
  streak: number;
  quizCorrect: number;
  quizTotal: number;
  correctPredictions: number;
  exactPredictions: number;
  successfulReferrals: number;
  referralCode: string;
  referredBy?: number;
  membershipConfirmed: boolean;
  blockedBot: boolean;
  badgeIds: Schema.Types.ObjectId[];
  activity: { type: string; title: string; points: number; at: Date }[];
  lastActiveAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IUser>({
  telegramId: { type: Number, required: true, unique: true, index: true },
  displayName: { type: String, trim: true, minlength: 2, maxlength: 50 },
  clubName: { type: String, trim: true, minlength: 2, maxlength: 80 },
  favoriteTeam: { type: String, trim: true, maxlength: 80 },
  points: { type: Number, default: 0, min: 0, index: true },
  coinBalance: { type: Number, default: 0, min: 0 },
  dailyRewardAvailableAt: { type: Date },
  weeklyPoints: { type: Number, default: 0, min: 0, index: true },
  streak: { type: Number, default: 0, min: 0 },
  quizCorrect: { type: Number, default: 0, min: 0 },
  quizTotal: { type: Number, default: 0, min: 0 },
  correctPredictions: { type: Number, default: 0, min: 0 },
  exactPredictions: { type: Number, default: 0, min: 0 },
  successfulReferrals: { type: Number, default: 0, min: 0 },
  referralCode: { type: String, required: true, unique: true, index: true },
  referredBy: { type: Number, index: true },
  membershipConfirmed: { type: Boolean, default: false, index: true },
  blockedBot: { type: Boolean, default: false },
  badgeIds: [{ type: Schema.Types.ObjectId, ref: 'Badge' }],
  activity: [{ type: { type: String }, title: String, points: Number, at: { type: Date, default: Date.now } }],
  lastActiveAt: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

schema.index({ weeklyPoints: -1, createdAt: 1 });
schema.index({ points: -1, createdAt: 1 });
export const User = model<IUser>('User', schema);
