import { describe, expect, it } from 'vitest';
import { premierLeagueSeason } from '../services/footballApi.js';

describe('Premier League standings season', () => {
  it('uses the season that starts in August', () => {
    expect(premierLeagueSeason(new Date('2026-08-01T00:00:00.000Z'))).toBe(2026);
    expect(premierLeagueSeason(new Date('2027-01-15T00:00:00.000Z'))).toBe(2026);
  });
});
