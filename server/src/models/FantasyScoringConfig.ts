import { Schema, model, type Types } from 'mongoose';

export interface FantasyScoringRules {
  minutesPlayed: number;
  goalGoalkeeper: number;
  goalDefender: number;
  goalMidfielder: number;
  goalForward: number;
  assist: number;
  cleanSheet: number;
  save: number;
  yellowCard: number;
  redCard: number;
  ownGoal: number;
  missedPenalty: number;
}

export interface IFantasyScoringHistory {
  version: number;
  rules: FantasyScoringRules;
  reason: string;
  changedBy: Types.ObjectId;
  changedAt: Date;
}

export interface IFantasyScoringConfig {
  key: 'default';
  version: number;
  rules: FantasyScoringRules;
  history: IFantasyScoringHistory[];
  createdAt: Date;
  updatedAt: Date;
}

const numericRule = { type: Number, required: true, min: -100, max: 100 } as const;
const rulesSchema = new Schema<FantasyScoringRules>({
  minutesPlayed: numericRule,
  goalGoalkeeper: numericRule,
  goalDefender: numericRule,
  goalMidfielder: numericRule,
  goalForward: numericRule,
  assist: numericRule,
  cleanSheet: numericRule,
  save: numericRule,
  yellowCard: numericRule,
  redCard: numericRule,
  ownGoal: numericRule,
  missedPenalty: numericRule
}, { _id: false, suppressReservedKeysWarning: true });

const historySchema = new Schema<IFantasyScoringHistory>({
  version: { type: Number, required: true, min: 1 },
  rules: { type: rulesSchema, required: true },
  reason: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
  changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  changedAt: { type: Date, required: true }
}, { _id: false });

const schema = new Schema<IFantasyScoringConfig>({
  key: { type: String, enum: ['default'], default: 'default', unique: true },
  version: { type: Number, default: 1, min: 1 },
  rules: { type: rulesSchema, required: true },
  history: { type: [historySchema], default: [] }
}, { timestamps: true });

export const FantasyScoringConfig = model<IFantasyScoringConfig>('FantasyScoringConfig', schema);
