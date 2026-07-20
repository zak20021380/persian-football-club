import { Schema, model } from 'mongoose';
import type { SubscriptionCycle } from './Subscription.js';

export type SubscriptionTransactionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ISubscriptionTransaction {
  userId: Schema.Types.ObjectId;
  planId: 'premium';
  planTitle: string;
  cycle: SubscriptionCycle;
  status: SubscriptionTransactionStatus;
  price: number;
  currency: 'IRT';
  bonusCoins: number;
  balanceAfter?: number;
  provider: 'test' | 'none';
  providerReference?: string;
  idempotencyKey: string;
  failureReason?: string;
  periodStart?: Date;
  periodEnd?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ISubscriptionTransaction>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: String, enum: ['premium'], required: true, default: 'premium' },
  planTitle: { type: String, required: true, trim: true, maxlength: 60 },
  cycle: { type: String, enum: ['monthly', 'annual'], required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], required: true, default: 'pending', index: true },
  price: { type: Number, required: true, min: 0, validate: Number.isInteger },
  currency: { type: String, enum: ['IRT'], required: true, default: 'IRT' },
  bonusCoins: { type: Number, required: true, min: 0, validate: Number.isInteger },
  balanceAfter: { type: Number, min: 0, validate: Number.isInteger },
  provider: { type: String, enum: ['test', 'none'], required: true },
  providerReference: { type: String, trim: true, maxlength: 160 },
  idempotencyKey: { type: String, required: true, maxlength: 220 },
  failureReason: { type: String, trim: true, maxlength: 300 },
  periodStart: Date,
  periodEnd: Date,
  completedAt: Date
}, { timestamps: true });

schema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ provider: 1, providerReference: 1 }, { unique: true, sparse: true });

export const SubscriptionTransaction = model<ISubscriptionTransaction>('SubscriptionTransaction', schema);
