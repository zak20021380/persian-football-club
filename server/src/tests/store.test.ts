import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { CoinPackage, CoinTransaction, Subscription, SubscriptionTransaction, User } from '../models/index.js';
import { paymentService } from '../services/payment.js';
import { subscriptionPeriodEnd } from '../services/subscription.js';

describe('coin store safety', () => {
  it('rejects invalid coin packages', () => {
    const invalid = new CoinPackage({ title: 'x', coins: 0, price: -1, active: true, sortOrder: 0 });
    expect(invalid.validateSync()).toBeTruthy();
  });

  it('accepts a valid coin-only package', () => {
    const valid = new CoinPackage({ title: 'بسته سکه', coins: 100, price: 49_000, active: true, sortOrder: 1 });
    expect(valid.validateSync()).toBeUndefined();
  });

  it('requires positive ledger coin amounts and an idempotency key', () => {
    const invalid = new CoinTransaction({ userId: new mongoose.Types.ObjectId(), type: 'purchase', status: 'pending', coins: 0, currency: 'IRT', provider: 'none' });
    expect(invalid.validateSync()).toBeTruthy();
  });

  it('keeps coin balance non-negative at model validation', () => {
    const user = new User({ telegramId: 1, displayName: 'تست', referralCode: 'store-test', coinBalance: -1 });
    expect(user.validateSync()?.errors.coinBalance).toBeTruthy();
  });

  it('uses an explicitly labeled test intent outside production', async () => {
    await expect(paymentService().createIntent({ transactionId: 'test', amountRials: 100_000, currency: 'IRR', description: 'سکه' })).resolves.toMatchObject({ mode: 'test', provider: 'test', reference: 'test_test' });
  });

  it('requires a valid paid subscription period', () => {
    const invalid = new Subscription({
      userId: new mongoose.Types.ObjectId(),
      planId: 'premium',
      planTitle: 'پریمیوم',
      status: 'active',
      cycle: 'weekly',
      price: -1,
      bonusCoins: -1,
      currency: 'IRT',
      startedAt: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(),
      latestTransactionId: new mongoose.Types.ObjectId()
    });
    expect(invalid.validateSync()).toBeTruthy();
  });

  it('accepts a complete premium subscription transaction', () => {
    const valid = new SubscriptionTransaction({
      userId: new mongoose.Types.ObjectId(),
      planId: 'premium',
      planTitle: 'عضویت پریمیوم',
      cycle: 'annual',
      status: 'pending',
      price: 1_190_000,
      bonusCoins: 4_200,
      currency: 'IRT',
      provider: 'test',
      idempotencyKey: 'subscription:test:request'
    });
    expect(valid.validateSync()).toBeUndefined();
  });

  it('keeps month-end subscription periods on the last valid calendar day', () => {
    expect(subscriptionPeriodEnd(new Date('2027-01-31T12:30:00.000Z'), 'monthly').toISOString()).toBe('2027-02-28T12:30:00.000Z');
    expect(subscriptionPeriodEnd(new Date('2028-02-29T12:30:00.000Z'), 'annual').toISOString()).toBe('2029-02-28T12:30:00.000Z');
  });
});
