import { Schema, model } from 'mongoose';
export interface IQuizAttempt { userId: Schema.Types.ObjectId; quizId: Schema.Types.ObjectId; answers: { questionId: Schema.Types.ObjectId; option: number; correct: boolean; score: number }[]; score: number; correctCount: number; durationMs: number; completedAt: Date; createdAt: Date; updatedAt: Date; }
const schema = new Schema<IQuizAttempt>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true }, quizId: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
  answers: [{ questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true }, option: { type: Number, min: 0, max: 3 }, correct: Boolean, score: Number }],
  score: { type: Number, required: true, min: 0, index: true }, correctCount: { type: Number, required: true, min: 0 }, durationMs: { type: Number, required: true, min: 0, index: true }, completedAt: { type: Date, default: Date.now }
}, { timestamps: true });
schema.index({ userId: 1, quizId: 1 }, { unique: true });
schema.index({ quizId: 1, score: -1, durationMs: 1 });
export const QuizAttempt = model<IQuizAttempt>('QuizAttempt', schema);
