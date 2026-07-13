import { Schema, model, type Types } from 'mongoose';

export type MatchStatus = 'scheduled' | 'live' | 'finished' | 'cancelled';
export interface IImportantMatch {
  externalApiId?: number; homeTeamId: Types.ObjectId; awayTeamId: Types.ObjectId; competitionName: string; kickoffAt: Date;
  description?: string; status: MatchStatus;
  homeScore?: number; awayScore?: number; sponsorId?: Schema.Types.ObjectId;
  predictionDeadline: Date; reminderMinutes: number[]; published: boolean;
  predictionsScored: boolean; scoringLockedAt?: Date; createdAt: Date; updatedAt: Date;
}
const schema = new Schema<IImportantMatch>({
  externalApiId: { type: Number, min: 1, validate: Number.isSafeInteger },
  homeTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  awayTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  competitionName: { type: String, required: true, trim: true }, kickoffAt: { type: Date, required: true, index: true },
  description: { type: String, maxlength: 1200 },
  status: { type: String, enum: ['scheduled','live','finished','cancelled'], default: 'scheduled', index: true },
  homeScore: { type: Number, min: 0 }, awayScore: { type: Number, min: 0 },
  sponsorId: { type: Schema.Types.ObjectId, ref: 'Sponsor' }, predictionDeadline: { type: Date, required: true, index: true },
  reminderMinutes: [{ type: Number, min: 1 }], published: { type: Boolean, default: false, index: true },
  predictionsScored: { type: Boolean, default: false, index: true }, scoringLockedAt: { type: Date, index: true }
}, { timestamps: true });
schema.index({ status: 1, kickoffAt: 1 });
schema.index({ externalApiId: 1 }, { unique: true, sparse: true });
export const ImportantMatch = model<IImportantMatch>('ImportantMatch', schema);
