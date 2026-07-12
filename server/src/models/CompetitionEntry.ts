import { Schema, model } from 'mongoose';
export interface ICompetitionEntry { userId: Schema.Types.ObjectId; competitionId: Schema.Types.ObjectId; attemptNo: number; score: number; correctCount: number; durationMs: number; completedAt: Date; answers: { questionId: Schema.Types.ObjectId; option: number; correct: boolean; score: number }[]; createdAt: Date; updatedAt: Date; }
const schema = new Schema<ICompetitionEntry>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, competitionId: { type: Schema.Types.ObjectId, ref: 'Competition', required: true, index: true },
  attemptNo: { type: Number, required: true, min: 1 }, score: { type: Number, required: true, min: 0 }, correctCount: { type: Number, required: true, min: 0 }, durationMs: { type: Number, required: true, min: 0 }, completedAt: { type: Date, default: Date.now },
  answers: [{ questionId: { type: Schema.Types.ObjectId, ref: 'Question' }, option: Number, correct: Boolean, score: Number }]
}, { timestamps: true });
schema.index({ userId: 1, competitionId: 1, attemptNo: 1 }, { unique: true });
schema.index({ competitionId: 1, score: -1, durationMs: 1 });
export const CompetitionEntry = model<ICompetitionEntry>('CompetitionEntry', schema);
