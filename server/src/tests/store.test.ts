import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { CoinPackage, CoinTransaction, User } from '../models/index.js';
import { paymentService } from '../services/payment.js';

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
});
