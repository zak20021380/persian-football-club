import { Schema, model } from 'mongoose';

export interface ITeam {
  externalApiId?: number;
  name: string;
  shortName: string;
  logoUrl?: string;
  country: string;
  league: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<ITeam>({
  externalApiId: { type: Number, min: 1, validate: Number.isSafeInteger },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100, index: true },
  shortName: { type: String, required: true, trim: true, minlength: 1, maxlength: 20 },
  logoUrl: { type: String, trim: true, maxlength: 2_048 },
  country: { type: String, required: true, trim: true, minlength: 2, maxlength: 80, index: true },
  league: { type: String, required: true, trim: true, minlength: 2, maxlength: 120, index: true },
  active: { type: Boolean, default: true, index: true }
}, { timestamps: true });

schema.index({ externalApiId: 1 }, { unique: true, sparse: true });
schema.index({ active: 1, league: 1, name: 1 });
export const Team = model<ITeam>('Team', schema);
