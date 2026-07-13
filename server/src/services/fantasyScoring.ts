import type { Types } from 'mongoose';
import { FantasyScoringConfig, PlayerMatchStat, type FantasyPosition, type FantasyScoringRules, type FantasyStatValues } from '../models/index.js';
import { AppError } from '../utils/errors.js';

export const DEFAULT_FANTASY_SCORING_RULES: FantasyScoringRules = {
  minutesPlayed: 0.03,
  goalGoalkeeper: 10,
  goalDefender: 6,
  goalMidfielder: 5,
  goalForward: 4,
  assist: 3,
  cleanSheet: 4,
  save: 0.5,
  yellowCard: -1,
  redCard: -3,
  ownGoal: -2,
  missedPenalty: -2
};

export function calculateFantasyPoints(values: FantasyStatValues, position: FantasyPosition, rules: FantasyScoringRules): number {
  const goalRule = position === 'GK' ? rules.goalGoalkeeper : position === 'DEF' ? rules.goalDefender : position === 'MID' ? rules.goalMidfielder : rules.goalForward;
  const total = values.minutes * rules.minutesPlayed
    + values.goals * goalRule
    + values.assists * rules.assist
    + Number(values.cleanSheet) * rules.cleanSheet
    + values.saves * rules.save
    + values.yellowCards * rules.yellowCard
    + values.redCards * rules.redCard
    + values.ownGoals * rules.ownGoal
    + values.missedPenalties * rules.missedPenalty;
  return Math.round(total * 100) / 100;
}

export async function getFantasyScoringConfig() {
  return FantasyScoringConfig.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default', version: 1, rules: DEFAULT_FANTASY_SCORING_RULES, history: [] } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function updateFantasyScoringRules(rules: FantasyScoringRules, reason: string, changedBy: Types.ObjectId) {
  const current = await getFantasyScoringConfig();
  if (!current) throw new AppError(500, 'تنظیمات امتیازدهی ایجاد نشد');
  const version = current.version + 1;
  const changedAt = new Date();
  const updated = await FantasyScoringConfig.findOneAndUpdate(
    { _id: current._id, version: current.version },
    {
      $set: { rules },
      $inc: { version: 1 },
      $push: { history: { $each: [{ version, rules, reason, changedBy, changedAt }], $slice: -100 } }
    },
    { new: true, runValidators: true }
  );
  if (!updated) throw new AppError(409, 'تنظیمات هم‌زمان تغییر کرده است؛ دوباره تلاش کنید', 'FANTASY_SCORING_CONFLICT');
  const recalculated = await recalculateFantasyStats(updated.rules, updated.version);
  return { config: updated, recalculated };
}

export async function recalculateFantasyStats(rules?: FantasyScoringRules, version?: number, matchId?: Types.ObjectId): Promise<number> {
  const config = rules && version ? null : await getFantasyScoringConfig();
  const activeRules = rules ?? config?.rules;
  const activeVersion = version ?? config?.version;
  if (!activeRules || !activeVersion) throw new AppError(500, 'تنظیمات امتیازدهی در دسترس نیست');
  const cursor = PlayerMatchStat.find(matchId ? { matchId } : {}).cursor();
  let count = 0;
  let operations: Array<{ updateOne: { filter: { _id: Types.ObjectId }; update: { $set: { fantasyPoints: number; scoringVersion: number } } } }> = [];
  for await (const stat of cursor) {
    operations.push({ updateOne: { filter: { _id: stat._id }, update: { $set: { fantasyPoints: calculateFantasyPoints(stat, stat.position, activeRules), scoringVersion: activeVersion } } } });
    count += 1;
    if (operations.length === 500) { await PlayerMatchStat.bulkWrite(operations); operations = []; }
  }
  if (operations.length) await PlayerMatchStat.bulkWrite(operations);
  return count;
}

export function statValuesFrom(input: FantasyStatValues): FantasyStatValues {
  return {
    minutes: input.minutes,
    goals: input.goals,
    assists: input.assists,
    yellowCards: input.yellowCards,
    redCards: input.redCards,
    saves: input.saves,
    cleanSheet: input.cleanSheet,
    ownGoals: input.ownGoals,
    missedPenalties: input.missedPenalties
  };
}
