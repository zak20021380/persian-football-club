import { Schema, model } from 'mongoose';
export interface IQuestion { text: string; options: string[]; correctOption: number; explanation?: string; category: string; difficulty: 'easy'|'medium'|'hard'; score: number; active: boolean; createdAt: Date; updatedAt: Date; }
const schema = new Schema<IQuestion>({
  text: { type: String, required: true, trim: true }, options: { type: [String], required: true, validate: [(v:string[]) => v.length === 4, 'Exactly four options are required'] },
  correctOption: { type: Number, required: true, min: 0, max: 3 }, explanation: { type: String, maxlength: 800 },
  category: { type: String, required: true, index: true }, difficulty: { type: String, enum: ['easy','medium','hard'], default: 'medium' },
  score: { type: Number, default: 10, min: 1, max: 1000 }, active: { type: Boolean, default: true, index: true }
}, { timestamps: true });
export const Question = model<IQuestion>('Question', schema);
