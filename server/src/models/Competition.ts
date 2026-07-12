import { Schema, model } from 'mongoose';
export interface ICompetition { title: string; coverImage?: string; description: string; type: 'daily'|'cup'|'speed'|'category'|'sponsored'; startsAt: Date; endsAt: Date; questionIds: Schema.Types.ObjectId[]; prize?: string; rewardId?: Schema.Types.ObjectId; sponsorId?: Schema.Types.ObjectId; attemptLimit: number; status: 'draft'|'scheduled'|'active'|'finished'|'cancelled'; published: boolean; winnersPublished: boolean; createdAt: Date; updatedAt: Date; }
const schema = new Schema<ICompetition>({
  title: { type: String, required: true }, coverImage: String, description: { type: String, required: true }, type: { type: String, enum: ['daily','cup','speed','category','sponsored'], required: true },
  startsAt: { type: Date, required: true, index: true }, endsAt: { type: Date, required: true, index: true }, questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
  prize: String, rewardId: { type: Schema.Types.ObjectId, ref: 'Reward' }, sponsorId: { type: Schema.Types.ObjectId, ref: 'Sponsor' }, attemptLimit: { type: Number, default: 1, min: 1, max: 20 },
  status: { type: String, enum: ['draft','scheduled','active','finished','cancelled'], default: 'draft', index: true }, published: { type: Boolean, default: false, index: true }, winnersPublished: { type: Boolean, default: false }
}, { timestamps: true });
export const Competition = model<ICompetition>('Competition', schema);
