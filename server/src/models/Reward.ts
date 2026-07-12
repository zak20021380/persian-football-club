import { Schema, model } from 'mongoose';
export interface IReward { title: string; description: string; image?: string; type: 'points'|'rank'|'competition'|'sponsored'|'limited'; pointsRequired?: number; rankRequired?: number; competitionId?: Schema.Types.ObjectId; sponsorId?: Schema.Types.ObjectId; startsAt: Date; endsAt: Date; quantity?: number; active: boolean; createdAt: Date; updatedAt: Date; }
const schema = new Schema<IReward>({
  title: { type: String, required: true }, description: { type: String, required: true }, image: String, type: { type: String, enum: ['points','rank','competition','sponsored','limited'], required: true },
  pointsRequired: { type: Number, min: 0 }, rankRequired: { type: Number, min: 1 }, competitionId: { type: Schema.Types.ObjectId, ref: 'Competition' }, sponsorId: { type: Schema.Types.ObjectId, ref: 'Sponsor' },
  startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true, index: true }, quantity: { type: Number, min: 1 }, active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
export const Reward = model<IReward>('Reward', schema);
