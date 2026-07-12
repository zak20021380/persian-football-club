import { Schema, model } from 'mongoose';

export interface ICoinPackage {
  title: string;
  coins: number;
  price: number;
  originalPrice?: number;
  badge?: string;
  active: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ICoinPackage>({
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  coins: { type: Number, required: true, min: 1, max: 10_000_000, validate: Number.isInteger },
  price: { type: Number, required: true, min: 0, max: 10_000_000_000, validate: Number.isInteger },
  originalPrice: { type: Number, min: 0, max: 10_000_000_000, validate: Number.isInteger },
  badge: { type: String, trim: true, maxlength: 30 },
  active: { type: Boolean, default: true, index: true },
  sortOrder: { type: Number, default: 0, min: -100_000, max: 100_000, validate: Number.isInteger, index: true }
}, { timestamps: true });

schema.index({ active: 1, sortOrder: 1, createdAt: 1 });
export const CoinPackage = model<ICoinPackage>('CoinPackage', schema);
