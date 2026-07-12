import { Schema, model } from 'mongoose';

export type CoinTransactionType = 'purchase' | 'daily_reward';
export type CoinTransactionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ICoinTransaction {
  userId: Schema.Types.ObjectId;
  type: CoinTransactionType;
  status: CoinTransactionStatus;
  coins: number;
  balanceAfter?: number;
  packageId?: Schema.Types.ObjectId;
  packageTitle?: string;
  price?: number;
  currency: 'IRT';
  provider: 'test' | 'none';
  providerReference?: string;
  idempotencyKey: string;
  failureReason?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ICoinTransaction>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['purchase', 'daily_reward'], required: true, index: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], required: true, default: 'pending', index: true },
  coins: { type: Number, required: true, min: 1, validate: Number.isInteger },
  balanceAfter: { type: Number, min: 0, validate: Number.isInteger },
  packageId: { type: Schema.Types.ObjectId, ref: 'CoinPackage' },
  packageTitle: { type: String, trim: true, maxlength: 60 },
  price: { type: Number, min: 0, validate: Number.isInteger },
  currency: { type: String, enum: ['IRT'], default: 'IRT' },
  provider: { type: String, enum: ['test', 'none'], required: true },
  providerReference: { type: String, trim: true, maxlength: 160 },
  idempotencyKey: { type: String, required: true, maxlength: 220 },
  failureReason: { type: String, trim: true, maxlength: 300 },
  completedAt: Date
}, { timestamps: true });

schema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
schema.index({ userId: 1, createdAt: -1 });
schema.index({ provider: 1, providerReference: 1 }, { unique: true, sparse: true });
export const CoinTransaction = model<ICoinTransaction>('CoinTransaction', schema);
