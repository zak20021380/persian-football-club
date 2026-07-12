import { Schema, model } from 'mongoose';
export interface ISponsor { name: string; logo?: string; promotionalText: string; ctaText: string; destinationUrl: string; startsAt: Date; endsAt: Date; placement: string[]; active: boolean; relatedType?: 'competition'|'match'|'quiz'|'reward'; relatedId?: Schema.Types.ObjectId; impressions: number; uniqueImpressions: number; clicks: number; uniqueClicks: number; createdAt: Date; updatedAt: Date; }
const schema = new Schema<ISponsor>({
  name: { type: String, required: true }, logo: String, promotionalText: { type: String, required: true }, ctaText: { type: String, required: true }, destinationUrl: { type: String, required: true },
  startsAt: { type: Date, required: true }, endsAt: { type: Date, required: true, index: true }, placement: [{ type: String, required: true }], active: { type: Boolean, default: true, index: true },
  relatedType: { type: String, enum: ['competition','match','quiz','reward'] }, relatedId: Schema.Types.ObjectId,
  impressions: { type: Number, default: 0 }, uniqueImpressions: { type: Number, default: 0 }, clicks: { type: Number, default: 0 }, uniqueClicks: { type: Number, default: 0 }
}, { timestamps: true });
export const Sponsor = model<ISponsor>('Sponsor', schema);
