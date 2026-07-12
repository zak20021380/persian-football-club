import { Schema, model } from 'mongoose';
export interface IPrediction { userId: Schema.Types.ObjectId; matchId: Schema.Types.ObjectId; outcome: 'home'|'draw'|'away'; homeScore?: number; awayScore?: number; pointsAwarded: number; scored: boolean; createdAt: Date; updatedAt: Date; }
const schema = new Schema<IPrediction>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, matchId: { type: Schema.Types.ObjectId, ref: 'ImportantMatch', required: true, index: true },
  outcome: { type: String, enum: ['home','draw','away'], required: true }, homeScore: { type: Number, min: 0, max: 99 }, awayScore: { type: Number, min: 0, max: 99 },
  pointsAwarded: { type: Number, default: 0 }, scored: { type: Boolean, default: false, index: true }
}, { timestamps: true });
schema.index({ userId: 1, matchId: 1 }, { unique: true });
export const Prediction = model<IPrediction>('Prediction', schema);
