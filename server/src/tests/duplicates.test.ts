import { describe, expect, it } from 'vitest';
import {
  CoinTransaction, FunPost, FunPostLike, FunPostReport, Prediction, QuizAttempt, Referral,
  Reminder, SponsorEvent, Squad, TransferOffer, User
} from '../models/index.js';

function hasUniqueIndex(indexes: ReturnType<typeof Prediction.schema.indexes>, keys: string[]) {
  return indexes.some(([fields, options]) => keys.every((key) => key in fields) && options.unique === true);
}

describe('database duplicate prevention', () => {
  it('has one user per Telegram account', () => expect(hasUniqueIndex(User.schema.indexes(), ['telegramId'])).toBe(true));
  it('has one prediction per user and match', () => expect(hasUniqueIndex(Prediction.schema.indexes(), ['userId','matchId'])).toBe(true));
  it('has one quiz attempt per user and quiz', () => expect(hasUniqueIndex(QuizAttempt.schema.indexes(), ['userId','quizId'])).toBe(true));
  it('rewards each invited user once', () => expect(hasUniqueIndex(Referral.schema.indexes(), ['invitedUserId'])).toBe(true));
  it('deduplicates sponsor events', () => expect(hasUniqueIndex(SponsorEvent.schema.indexes(), ['sponsorId','userId','kind','entityKey'])).toBe(true));
  it('deduplicates scheduled jobs', () => expect(hasUniqueIndex(Reminder.schema.indexes(), ['idempotencyKey'])).toBe(true));
  it('allows one match reminder per user and match', () => expect(hasUniqueIndex(Reminder.schema.indexes(), ['userId','type','entityId'])).toBe(true));
  it('deduplicates fun post submissions', () => expect(hasUniqueIndex(FunPost.schema.indexes(), ['ownerId','clientRequestId'])).toBe(true));
  it('allows one like per user and fun post', () => expect(hasUniqueIndex(FunPostLike.schema.indexes(), ['postId','userId'])).toBe(true));
  it('allows one report per user and fun post', () => expect(hasUniqueIndex(FunPostReport.schema.indexes(), ['postId','reporterId'])).toBe(true));
  it('deduplicates coin purchase requests per user', () => expect(hasUniqueIndex(CoinTransaction.schema.indexes(), ['userId','idempotencyKey'])).toBe(true));
  it('deduplicates payment provider confirmations', () => expect(hasUniqueIndex(CoinTransaction.schema.indexes(), ['provider','providerReference'])).toBe(true));
  it('allows only one squad per user', () => expect(hasUniqueIndex(Squad.schema.indexes(), ['userId'])).toBe(true));
  it('deduplicates transfer offer requests', () => expect(hasUniqueIndex(TransferOffer.schema.indexes(), ['senderId','clientRequestId'])).toBe(true));
});
