import { Schema, model } from 'mongoose';
export interface IQuiz { title: string; description?: string; questionIds: Schema.Types.ObjectId[]; startsAt: Date; endsAt: Date; timerSeconds?: number; scoreMultiplier: number; sponsorId?: Schema.Types.ObjectId; status: 'draft'|'scheduled'|'active'|'finished'|'cancelled'; dailyKey?: string; published: boolean; createdAt: Date; updatedAt: Date; }
const schema = new Schema<IQuiz>({
  title: { type: String, required: true }, description: String, questionIds: [{ type: Schema.Types.ObjectId, ref: 'Question', required: true }],
  startsAt: { type: Date, required: true, index: true }, endsAt: { type: Date, required: true, index: true }, timerSeconds: { type: Number, min: 10 },
  scoreMultiplier: { type: Number, default: 1, min: 0.1, max: 20 }, sponsorId: { type: Schema.Types.ObjectId, ref: 'Sponsor' },
  status: { type: String, enum: ['draft','scheduled','active','finished','cancelled'], default: 'draft', index: true }, dailyKey: { type: String },
  published: { type: Boolean, default: false, index: true }
}, { timestamps: true });
schema.index({ dailyKey: 1 }, { unique: true, sparse: true });
export const Quiz = model<IQuiz>('Quiz', schema);
