import { describe, expect, it, vi } from 'vitest';
import { env } from '../config/env.js';
import { premierLeagueSeason, premierLeagueStandings } from '../services/footballApi.js';

describe('Premier League standings season', () => {
  it('uses the season that starts in August', () => {
    expect(premierLeagueSeason(new Date('2026-08-01T00:00:00.000Z'))).toBe(2026);
    expect(premierLeagueSeason(new Date('2027-01-15T00:00:00.000Z'))).toBe(2026);
  });

  it('uses demo standings without making a provider request when the API is disabled', async () => {
    const previousApiEnabled = env.FOOTBALL_API_ENABLED;
    const previousDemoEnabled = env.DEMO_DATA_ENABLED;
    env.FOOTBALL_API_ENABLED = false;
    env.DEMO_DATA_ENABLED = true;
    const fetch = vi.spyOn(globalThis, 'fetch');
    try {
      const result = await premierLeagueStandings(new Date('2026-07-16T00:00:00.000Z'));
      expect(result.source).toBe('demo');
      expect(result.standings).toHaveLength(20);
      expect(fetch).not.toHaveBeenCalled();
    } finally {
      fetch.mockRestore();
      env.FOOTBALL_API_ENABLED = previousApiEnabled;
      env.DEMO_DATA_ENABLED = previousDemoEnabled;
    }
  });
});
