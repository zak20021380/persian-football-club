import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { FantasyPlayer, ImportantMatch, PlayerMatchStat, Team } from '../models/index.js';
import { calculateFantasyPoints, DEFAULT_FANTASY_SCORING_RULES } from '../services/fantasyScoring.js';

const values = {
  minutes: 90,
  goals: 1,
  assists: 1,
  yellowCards: 1,
  redCards: 0,
  saves: 2,
  cleanSheet: true,
  ownGoals: 0,
  missedPenalties: 0
};

describe('fantasy scoring', () => {
  it('uses the stored-rule shape for every scoring event', () => {
    const rules = { ...DEFAULT_FANTASY_SCORING_RULES, minutesPlayed: 0.1, goalDefender: 7, assist: 4, cleanSheet: 5, save: 1, yellowCard: -2 };
    expect(calculateFantasyPoints(values, 'DEF', rules)).toBe(25);
  });

  it('uses position-specific goal rules without an OVR input', () => {
    const onlyGoal = { ...values, minutes: 0, assists: 0, yellowCards: 0, saves: 0, cleanSheet: false };
    expect(calculateFantasyPoints(onlyGoal, 'GK', DEFAULT_FANTASY_SCORING_RULES)).toBe(10);
    expect(calculateFantasyPoints(onlyGoal, 'FWD', DEFAULT_FANTASY_SCORING_RULES)).toBe(4);
  });

  it('applies own-goal, red-card and missed-penalty deductions', () => {
    const deductions = { ...values, minutes: 0, goals: 0, assists: 0, yellowCards: 0, redCards: 1, saves: 0, cleanSheet: false, ownGoals: 1, missedPenalties: 1 };
    expect(calculateFantasyPoints(deductions, 'MID', DEFAULT_FANTASY_SCORING_RULES)).toBe(-7);
  });
});

describe('fantasy model validation', () => {
  it('stores match teams as references instead of plain names', () => {
    expect(ImportantMatch.schema.path('homeTeam')).toBeUndefined();
    expect(ImportantMatch.schema.path('awayTeam')).toBeUndefined();
    expect(ImportantMatch.schema.path('homeTeamId')?.options.ref).toBe('Team');
    expect(ImportantMatch.schema.path('awayTeamId')?.options.ref).toBe('Team');
  });

  it('keeps real fantasy players separate from invented ratings', () => {
    expect(FantasyPlayer.schema.path('overall')).toBeUndefined();
    const player = new FantasyPlayer({ name: 'بازیکن تست', position: 'MID', realTeamId: new mongoose.Types.ObjectId(), nationality: 'ایران', active: true });
    expect(player.validateSync()).toBeUndefined();
  });

  it('validates team external IDs and required metadata', () => {
    const invalid = new Team({ externalApiId: -1, name: 'تیم', shortName: 'ت', country: 'ایران', league: 'لیگ', active: true });
    expect(invalid.validateSync()?.errors.externalApiId).toBeTruthy();
  });

  it('rejects invalid imported match statistics', () => {
    const stat = new PlayerMatchStat({ playerId: new mongoose.Types.ObjectId(), matchId: new mongoose.Types.ObjectId(), position: 'GK', minutes: -1, goals: 0, assists: 0, yellowCards: 0, redCards: 0, saves: 0, cleanSheet: false, ownGoals: 0, missedPenalties: 0, fantasyPoints: 0, scoringVersion: 1, source: 'external' });
    expect(stat.validateSync()?.errors.minutes).toBeTruthy();
  });
});
