import { Schema, model, type Types } from 'mongoose';

export type TransferOfferStatus = 'active'|'accepted'|'rejected'|'cancelled'|'countered'|'expired';

export interface ITransferOffer {
  playerId: Types.ObjectId;
  buyerId: Types.ObjectId;
  sellerId: Types.ObjectId;
  senderId: Types.ObjectId;
  recipientId: Types.ObjectId;
  amount: number;
  status: TransferOfferStatus;
  expiresAt: Date;
  parentOfferId?: Types.ObjectId;
  rootOfferId?: Types.ObjectId;
  clientRequestId: string;
  note?: string;
  feeAmount?: number;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITransferOffer>({
  playerId: { type: Schema.Types.ObjectId, ref: 'ClubPlayer', required: true, index: true },
  buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recipientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
  status: { type: String, enum: ['active','accepted','rejected','cancelled','countered','expired'], default: 'active', required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  parentOfferId: { type: Schema.Types.ObjectId, ref: 'TransferOffer' },
  rootOfferId: { type: Schema.Types.ObjectId, ref: 'TransferOffer' },
  clientRequestId: { type: String, required: true, trim: true, maxlength: 80 },
  note: { type: String, trim: true, maxlength: 240 },
  feeAmount: { type: Number, min: 0, validate: Number.isInteger },
  resolvedAt: Date
}, { timestamps: true });

schema.pre('validate', function(next) {
  if (String(this.buyerId) === String(this.sellerId)) return next(new Error('خریدار و فروشنده باید متفاوت باشند'));
  if (String(this.senderId) === String(this.recipientId)) return next(new Error('فرستنده و گیرنده باید متفاوت باشند'));
  if (![String(this.buyerId), String(this.sellerId)].includes(String(this.senderId))) return next(new Error('فرستنده باید یکی از طرفین معامله باشد'));
  if (![String(this.buyerId), String(this.sellerId)].includes(String(this.recipientId))) return next(new Error('گیرنده باید یکی از طرفین معامله باشد'));
  next();
});

schema.index({ senderId: 1, clientRequestId: 1 }, { unique: true });
schema.index({ playerId: 1, buyerId: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });
schema.index({ recipientId: 1, status: 1, createdAt: -1 });
schema.index({ senderId: 1, status: 1, createdAt: -1 });

export const TransferOffer = model<ITransferOffer>('TransferOffer', schema);
