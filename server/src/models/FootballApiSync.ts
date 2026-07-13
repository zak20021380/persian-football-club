import { Schema, model, type Types } from 'mongoose';

export interface IFootballApiSync {
  type: 'players'|'statistics';
  status: 'running'|'completed'|'failed';
  requestedBy: Types.ObjectId;
  processed: number;
  errorMessages: string[];
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFootballApiSync>({
  type: { type: String, enum: ['players','statistics'], required: true, index: true },
  status: { type: String, enum: ['running','completed','failed'], required: true, index: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  processed: { type: Number, default: 0, min: 0 },
  errorMessages: { type: [String], default: [] },
  startedAt: { type: Date, required: true, index: true },
  completedAt: Date
}, { timestamps: true });

schema.index({ type: 1, startedAt: -1 });
export const FootballApiSync = model<IFootballApiSync>('FootballApiSync', schema);
