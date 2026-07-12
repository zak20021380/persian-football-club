import { Schema, model } from 'mongoose';

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'cancelled';
export interface IImportantMatch {
  homeTeam: string; awayTeam: string; competitionName: string; kickoffAt: Date;
  homeLogo?: string; awayLogo?: string; description?: string; status: MatchStatus;
  homeScore?: number; awayScore?: number; sponsorId?: Schema.Types.ObjectId;
  predictionDeadline: Date; reminderMinutes: number[]; published: boolean;
  predictionsScored: boolean; scoringLockedAt?: Date; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<IImportantMatch>({
  homeTeam: { type: String, required: true, trim: true }, awayTeam: { type: String, required: true, trim: true },
  competitionName: { type: String, required: true, trim: true }, kickoffAt: { type: Date, required: true, index: true },
  homeLogo: String, awayLogo: String, description: { type: String, maxlength: 1200 },
  status: { type: String, enum: ['scheduled','live','finished','cancelled'], default: 'scheduled', index: true },
  homeScore: { type: Number, min: 0 }, awayScore: { type: Number, min: 0 },
  sponsorId: { type: Schema.Types.ObjectId, ref: 'Sponsor' }, predictionDeadline: { type: Date, required: true, index: true },
  reminderMinutes: [{ type: Number, min: 1 }], published: { type: Boolean, default: false, index: true },
  predictionsScored: { type: Boolean, default: false, index: true }, scoringLockedAt: { type: Date, index: true }
}, { timestamps: true });
schema.index({ status: 1, kickoffAt: 1 });
export const ImportantMatch = model<IImportantMatch>('ImportantMatch', schema);
