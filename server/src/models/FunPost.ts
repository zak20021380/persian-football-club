import { Schema, model } from 'mongoose';

export interface IFunPost {
  ownerId: Schema.Types.ObjectId;
  caption?: string;
  imageUrl?: string;
  imageKey?: string;
  clientRequestId: string;
  likeCount: number;
  reportCount: number;
  moderationStatus: 'published' | 'hidden';
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFunPost>({
  ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  caption: { type: String, trim: true, maxlength: 600 },
  imageUrl: String,
  imageKey: String,
  clientRequestId: { type: String, required: true },
  likeCount: { type: Number, default: 0, min: 0 },
  reportCount: { type: Number, default: 0, min: 0, index: true },
  moderationStatus: { type: String, enum: ['published', 'hidden'], default: 'published', index: true }
}, { timestamps: true });

schema.index({ ownerId: 1, clientRequestId: 1 }, { unique: true });
schema.index({ moderationStatus: 1, _id: -1 });

export const FunPost = model<IFunPost>('FunPost', schema);
