import { Schema, model } from 'mongoose';

export type SubscriptionStatus = 'active' | 'expired';
export type SubscriptionCycle = 'monthly' | 'annual';

export interface ISubscription {
  userId: Schema.Types.ObjectId;
  planId: 'premium';
  planTitle: string;
  status: SubscriptionStatus;
  cycle: SubscriptionCycle;
  price: number;
  currency: 'IRT';
  bonusCoins: number;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  startedAt: Date;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt?: Date;
  latestTransactionId: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISubscription>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  planId: { type: String, enum: ['premium'], required: true, default: 'premium' },
  planTitle: { type: String, required: true, trim: true, maxlength: 60 },
  status: { type: String, enum: ['active', 'expired'], required: true, default: 'active', index: true },
  cycle: { type: String, enum: ['monthly', 'annual'], required: true },
  price: { type: Number, required: true, min: 0, validate: Number.isInteger },
  currency: { type: String, enum: ['IRT'], required: true, default: 'IRT' },
  bonusCoins: { type: Number, required: true, min: 0, validate: Number.isInteger },
  autoRenew: { type: Boolean, required: true, default: true },
  cancelAtPeriodEnd: { type: Boolean, required: true, default: false },
  startedAt: { type: Date, required: true },
  currentPeriodStart: { type: Date, required: true },
  currentPeriodEnd: { type: Date, required: true, index: true },
  canceledAt: Date,
  latestTransactionId: { type: Schema.Types.ObjectId, ref: 'SubscriptionTransaction', required: true }
}, { timestamps: true });

schema.index({ status: 1, currentPeriodEnd: 1 });

export const Subscription = model<ISubscription>('Subscription', schema);
