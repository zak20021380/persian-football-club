import { Schema, model } from 'mongoose';

export interface IFunPostShare {
  postId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  preparedMessageId: string;
  completionTokenHash: string;
  status: 'pending' | 'completed';
  expiresAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFunPostShare>({
  postId: { type: Schema.Types.ObjectId, ref: 'FunPost', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  preparedMessageId: { type: String, required: true, unique: true, maxlength: 256 },
  completionTokenHash: { type: String, required: true, unique: true, select: false, minlength: 64, maxlength: 64 },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending', index: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  completedAt: Date
}, { timestamps: true });

schema.index({ userId: 1, createdAt: -1 });

export const FunPostShare = model<IFunPostShare>('FunPostShare', schema);
