import { Schema, model } from 'mongoose';
export interface IBadge { name: string; description: string; icon: string; category: 'quiz'|'prediction'|'referral'|'streak'|'special'; threshold: number; active: boolean; createdAt: Date; updatedAt: Date; }
const schema = new Schema<IBadge>({ name: { type: String, required: true, unique: true }, description: { type: String, required: true }, icon: { type: String, required: true }, category: { type: String, enum: ['quiz','prediction','referral','streak','special'], required: true }, threshold: { type: Number, required: true, min: 1 }, active: { type: Boolean, default: true } }, { timestamps: true });
export const Badge = model<IBadge>('Badge', schema);
