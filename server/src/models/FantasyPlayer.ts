import { Schema, model, type Types } from 'mongoose';

export type FantasyPosition = 'GK'|'DEF'|'MID'|'FWD';

export interface IFantasyPlayer {
  externalApiId?: number;
  name: string;
  photoUrl?: string;
  position: FantasyPosition;
  realTeamId: Types.ObjectId;
  nationality: string;
  active: boolean;
  lastSyncedAt?: Date;
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IFantasyPlayer>({
  externalApiId: { type: Number, min: 1, validate: Number.isSafeInteger },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100, index: true },
  photoUrl: { type: String, trim: true, maxlength: 2_048 },
  position: { type: String, enum: ['GK','DEF','MID','FWD'], required: true, index: true },
  realTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  nationality: { type: String, required: true, trim: true, minlength: 2, maxlength: 80, index: true },
  active: { type: Boolean, default: true, index: true },
  lastSyncedAt: Date,
  syncError: { type: String, trim: true, maxlength: 1_000 }
}, { timestamps: true });

schema.index({ externalApiId: 1 }, { unique: true, sparse: true });
schema.index({ active: 1, realTeamId: 1, position: 1, name: 1 });
export const FantasyPlayer = model<IFantasyPlayer>('FantasyPlayer', schema);
