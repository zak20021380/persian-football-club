import { describe, expect, it } from 'vitest';
import { lineupFantasyTotal, rankingPeriodWindow } from '../services/rankings.js';

describe('fantasy rankings', () => {
  it('counts the selected captain twice without changing stored player points', () => {
    const players = [{ id: 'one', points: 7.25 }, { id: 'captain', points: 11.5 }, { id: 'three', points: -1 }];
    expect(lineupFantasyTotal(players, 'captain')).toBe(29.25);
    expect(players[1].points).toBe(11.5);
  });

  it('uses the current Saturday-based Tehran week', () => {
    const window = rankingPeriodWindow('week', new Date('2026-07-15T12:00:00.000Z'));
    expect(window.start?.toISOString()).toBe('2026-07-10T20:30:00.000Z');
    expect(window.previousStart?.toISOString()).toBe('2026-07-03T20:30:00.000Z');
  });

  it('uses Tehran calendar months and leaves the season unbounded', () => {
    expect(rankingPeriodWindow('month', new Date('2026-07-15T12:00:00.000Z')).start?.toISOString()).toBe('2026-06-30T20:30:00.000Z');
    expect(rankingPeriodWindow('season', new Date('2026-07-15T12:00:00.000Z')).start).toBeUndefined();
  });
});
