import { Schema, model } from 'mongoose';

export interface IFunPostReport {
  postId: Schema.Types.ObjectId;
  reporterId: Schema.Types.ObjectId;
  reason: 'spam' | 'abuse' | 'inappropriate' | 'other';
  createdAt: Date;
}

const schema = new Schema<IFunPostReport>({
  postId: { type: Schema.Types.ObjectId, ref: 'FunPost', required: true, index: true },
  reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reason: { type: String, enum: ['spam', 'abuse', 'inappropriate', 'other'], required: true },
  createdAt: { type: Date, default: Date.now }
});

schema.index({ postId: 1, reporterId: 1 }, { unique: true });

export const FunPostReport = model<IFunPostReport>('FunPostReport', schema);
