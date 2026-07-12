import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { ClubPlayer, Squad } from '../models/index.js';
import { reassignSquadSlot } from '../services/squad.js';

describe('squad validation', () => {
  it.each(['4-3-3','4-4-2','4-2-3-1'])('accepts formation %s', formation => {
    const squad = new Squad({ userId: new mongoose.Types.ObjectId(), formation, starterIds: Array.from({ length: 11 }, () => null) });
    expect(squad.validateSync()).toBeUndefined();
  });

  it('requires exactly eleven starter slots', () => {
    const squad = new Squad({ userId: new mongoose.Types.ObjectId(), formation: '4-3-3', starterIds: [null] });
    expect(squad.validateSync()?.errors.starterIds).toBeTruthy();
  });

  it('validates player position and overall rating', () => {
    const invalid = new ClubPlayer({ ownerId: new mongoose.Types.ObjectId(), name: 'بازیکن تست', position: 'COACH', overall: 120 });
    expect(invalid.validateSync()).toBeTruthy();
  });

  it('places a substitute into an empty pitch position', () => {
    const substitute = new mongoose.Types.ObjectId();
    const result = reassignSquadSlot(Array.from({ length: 11 }, () => null), [substitute], 4, substitute);
    expect(result.starters[4]).toEqual(substitute);
    expect(result.substitutes).toHaveLength(0);
  });

  it('returns the replaced starter to the substitutes', () => {
    const starter = new mongoose.Types.ObjectId();
    const substitute = new mongoose.Types.ObjectId();
    const starters = Array.from({ length: 11 }, () => null) as Array<mongoose.Types.ObjectId|null>;
    starters[7] = starter;
    const result = reassignSquadSlot(starters, [substitute], 7, substitute);
    expect(result.starters[7]).toEqual(substitute);
    expect(result.substitutes).toEqual([starter]);
  });

  it('moves a removed starter to the bench', () => {
    const starter = new mongoose.Types.ObjectId();
    const starters = Array.from({ length: 11 }, () => null) as Array<mongoose.Types.ObjectId|null>;
    starters[2] = starter;
    const result = reassignSquadSlot(starters, [], 2, null);
    expect(result.starters[2]).toBeNull();
    expect(result.substitutes).toEqual([starter]);
  });
});
