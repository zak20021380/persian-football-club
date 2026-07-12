import { Schema, model } from 'mongoose';

export interface IFunPostLike {
  postId: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  createdAt: Date;
}

const schema = new Schema<IFunPostLike>({
  postId: { type: Schema.Types.ObjectId, ref: 'FunPost', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

schema.index({ postId: 1, userId: 1 }, { unique: true });

export const FunPostLike = model<IFunPostLike>('FunPostLike', schema);
