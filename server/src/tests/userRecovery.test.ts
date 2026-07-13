import { afterEach, describe, expect, it, vi } from 'vitest';
import { User } from '../models/index.js';
import { recoverTelegramUser } from '../services/userRecovery.js';

afterEach(() => vi.restoreAllMocks());

describe('persistent Telegram user recovery', () => {
  it('does not define Telegram profile fields in the persistent schema', () => {
    expect(User.schema.path('displayName')).toBeDefined();
    expect(User.schema.path('clubName')).toBeDefined();
    expect(User.schema.path('firstName')).toBeUndefined();
    expect(User.schema.path('lastName')).toBeUndefined();
    expect(User.schema.path('username')).toBeUndefined();
    expect(User.schema.path('photoUrl')).toBeUndefined();
  });
  it('uses one atomic upsert keyed only by verified telegramId', async () => {
    const persisted = { _id: '507f1f77bcf86cd799439011', telegramId: 42, coinBalance: 900, points: 70 };
    const upsert = vi.spyOn(User, 'findOneAndUpdate').mockResolvedValue({ value: persisted, lastErrorObject: { updatedExisting: false } } as never);
    const result = await recoverTelegramUser({ id: 42, first_name: 'نام موقت', username: 'temporary', photo_url: 'https://example.com/a.jpg' });
    expect(result.created).toBe(true);
    expect(result.user).toBe(persisted);
    const [filter, update, options] = upsert.mock.calls[0];
    expect(filter).toEqual({ telegramId: 42 });
    expect(update).toMatchObject({ $setOnInsert: { telegramId: 42 }, $set: { lastActiveAt: expect.any(Date) }, $unset: { firstName: 1, lastName: 1, username: 1, photoUrl: 1 } });
    expect(update).not.toHaveProperty('$set.coinBalance');
    expect(JSON.stringify(update)).not.toContain('نام موقت');
    expect(options).toMatchObject({ upsert: true, new: true, setDefaultsOnInsert: true });
  });

  it('returns the same stored account for two concurrent first-login requests', async () => {
    const persisted = { _id: '507f1f77bcf86cd799439011', telegramId: 42, coinBalance: 500 };
    let call = 0;
    vi.spyOn(User, 'findOneAndUpdate').mockImplementation(async () => ({ value: persisted, lastErrorObject: { updatedExisting: call++ > 0 } }) as never);
    const [first, second] = await Promise.all([recoverTelegramUser({ id: 42, first_name: 'علی' }), recoverTelegramUser({ id: 42, first_name: 'علی' })]);
    expect(first.user._id).toBe(second.user._id);
    expect([first.created, second.created].filter(Boolean)).toHaveLength(1);
  });

  it('recovers the unique winner after a duplicate-key race', async () => {
    const persisted = { _id: '507f1f77bcf86cd799439011', telegramId: 42, points: 99 };
    vi.spyOn(User, 'findOneAndUpdate').mockRejectedValue(Object.assign(new Error('duplicate'), { code: 11000 }));
    vi.spyOn(User, 'findOne').mockResolvedValue(persisted as never);
    const result = await recoverTelegramUser({ id: 42, first_name: 'علی' });
    expect(result).toEqual({ user: persisted, created: false });
  });
});
