import { Schema, model, type Types } from 'mongoose';
import type { FantasyPosition } from './FantasyPlayer.js';

export interface FantasyStatValues {
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  cleanSheet: boolean;
  ownGoals: number;
  missedPenalties: number;
}

export interface IPlayerMatchStat extends FantasyStatValues {
  playerId: Types.ObjectId;
  matchId: Types.ObjectId;
  position: FantasyPosition;
  fantasyPoints: number;
  scoringVersion: number;
  source: 'external'|'manual'|'corrected';
  lastSyncedAt?: Date;
  corrections: Array<{
    reason: string;
    correctedBy: Types.ObjectId;
    before: FantasyStatValues;
    after: FantasyStatValues;
    correctedAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const statValues = {
  minutes: { type: Number, required: true, min: 0, max: 200, validate: Number.isInteger },
  goals: { type: Number, required: true, min: 0, max: 30, validate: Number.isInteger },
  assists: { type: Number, required: true, min: 0, max: 30, validate: Number.isInteger },
  yellowCards: { type: Number, required: true, min: 0, max: 3, validate: Number.isInteger },
  redCards: { type: Number, required: true, min: 0, max: 2, validate: Number.isInteger },
  saves: { type: Number, required: true, min: 0, max: 100, validate: Number.isInteger },
  cleanSheet: { type: Boolean, required: true },
  ownGoals: { type: Number, required: true, min: 0, max: 10, validate: Number.isInteger },
  missedPenalties: { type: Number, required: true, min: 0, max: 10, validate: Number.isInteger }
} as const;

const valuesSchema = new Schema<FantasyStatValues>(statValues, { _id: false });
const correctionSchema = new Schema({
  reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
  correctedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  before: { type: valuesSchema, required: true },
  after: { type: valuesSchema, required: true },
  correctedAt: { type: Date, required: true }
}, { _id: false });

const schema = new Schema<IPlayerMatchStat>({
  playerId: { type: Schema.Types.ObjectId, ref: 'FantasyPlayer', required: true, index: true },
  matchId: { type: Schema.Types.ObjectId, ref: 'ImportantMatch', required: true, index: true },
  position: { type: String, enum: ['GK','DEF','MID','FWD'], required: true },
  ...statValues,
  fantasyPoints: { type: Number, required: true, default: 0 },
  scoringVersion: { type: Number, required: true, min: 1 },
  source: { type: String, enum: ['external','manual','corrected'], required: true, default: 'external' },
  lastSyncedAt: Date,
  corrections: { type: [correctionSchema], default: [] }
}, { timestamps: true });

schema.index({ playerId: 1, matchId: 1 }, { unique: true });
schema.index({ matchId: 1, fantasyPoints: -1 });
export const PlayerMatchStat = model<IPlayerMatchStat>('PlayerMatchStat', schema);
