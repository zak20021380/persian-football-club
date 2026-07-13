import { describe, expect, it } from 'vitest';
import { createSessionToken, verifySessionToken } from '../services/session.js';

const subject = '507f1f77bcf86cd799439011';
const secret = 'unit-test-session-secret-at-least-32-characters';

describe('short-lived authenticated sessions', () => {
  it('round-trips the verified identity and temporary Telegram profile', () => {
    const session = createSessionToken(subject, { id: 42, first_name: 'علی', last_name: 'رضایی', photo_url: 'https://example.com/avatar.jpg', username: 'not-persisted' }, 1_000, secret);
    const claims = verifySessionToken(session.token, 1_001, secret);
    expect(claims.subject).toBe(subject);
    expect(claims.telegramId).toBe(42);
    expect(claims.telegramUser).toEqual({ id: 42, first_name: 'علی', last_name: 'رضایی', photo_url: 'https://example.com/avatar.jpg' });
    expect(claims.telegramUser).not.toHaveProperty('username');
  });

  it('rejects modified tokens', () => {
    const { token } = createSessionToken(subject, { id: 42, first_name: 'علی' }, 1_000, secret);
    const [payload, signature] = token.split('.');
    const changed = `${payload.slice(0, -1)}${payload.endsWith('a') ? 'b' : 'a'}.${signature}`;
    expect(() => verifySessionToken(changed, 1_001, secret)).toThrow(/امضای نشست/);
  });

  it('rejects expired sessions', () => {
    const session = createSessionToken(subject, { id: 42, first_name: 'علی' }, 1_000, secret);
    expect(() => verifySessionToken(session.token, 4_601, secret)).toThrow(/منقضی/);
  });

  it('keeps different verified accounts in separate sessions', () => {
    const first = verifySessionToken(createSessionToken(subject, { id: 42, first_name: 'علی' }, 1_000, secret).token, 1_001, secret);
    const second = verifySessionToken(createSessionToken('507f191e810c19729de860ea', { id: 43, first_name: 'رضا' }, 1_000, secret).token, 1_001, secret);
    expect(first.telegramId).not.toBe(second.telegramId);
    expect(first.subject).not.toBe(second.subject);
  });
});
