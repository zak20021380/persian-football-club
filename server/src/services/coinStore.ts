import mongoose, { type ClientSession, type Types } from 'mongoose';
import { env } from '../config/env.js';
import { CoinPackage, CoinTransaction, User } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { paymentService, type PaymentIntent } from './payment.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function transactionUnsupported(error: unknown): boolean {
  const candidate = error as { code?: number; message?: string };
  return candidate.code === 20 || /Transaction numbers are only allowed|replica set|mongos/i.test(candidate.message ?? '');
}

async function atomic<T>(work: (session: ClientSession | null) => Promise<T>): Promise<T> {
  try {
    return await mongoose.connection.transaction(async session => work(session));
  } catch (error) {
    // A standalone local MongoDB cannot run transactions. Production must retain full ACID behavior.
    if (env.NODE_ENV !== 'production' && transactionUnsupported(error)) return work(null);
    throw error;
  }
}

export async function claimDailyCoins(userId: Types.ObjectId) {
  const now = new Date();
  const nextClaimAt = new Date(now.getTime() + DAY_MS);
  return atomic(async session => {
    const user = await User.findOneAndUpdate(
      { _id: userId, $or: [{ dailyRewardAvailableAt: { $exists: false } }, { dailyRewardAvailableAt: { $lte: now } }] },
      { $inc: { coinBalance: env.DAILY_COIN_REWARD }, $set: { dailyRewardAvailableAt: nextClaimAt } },
      { new: true, session }
    );
    if (!user) {
      throw new AppError(409, 'جایزه روزانه هنوز آماده نیست', 'DAILY_REWARD_NOT_READY');
    }
    const [transaction] = await CoinTransaction.create([{
      userId,
      type: 'daily_reward',
      status: 'completed',
      coins: env.DAILY_COIN_REWARD,
      balanceAfter: user.coinBalance,
      currency: 'IRT',
      provider: 'none',
      idempotencyKey: `daily:${userId}:${now.toISOString()}`,
      completedAt: now
    }], session ? { session } : undefined);
    return { balance: user.coinBalance, nextClaimAt, transaction };
  });
}

export async function createPurchase(userId: Types.ObjectId, packageId: string, clientRequestId: string): Promise<{ transaction: InstanceType<typeof CoinTransaction>; payment: PaymentIntent }> {
  const coinPackage = await CoinPackage.findOne({ _id: packageId, active: true });
  if (!coinPackage) throw new AppError(404, 'بسته سکه فعال پیدا نشد', 'COIN_PACKAGE_NOT_FOUND');

  const provider = paymentService();
  if (provider.provider === 'none') await provider.createIntent({ transactionId: 'unavailable', amountRials: coinPackage.price * 10, currency: 'IRR', description: coinPackage.title });

  const idempotencyKey = `purchase:${userId}:${clientRequestId}`;
  let transaction = await CoinTransaction.findOne({ userId, idempotencyKey });
  if (!transaction) {
    try {
      transaction = await CoinTransaction.create({
        userId,
        type: 'purchase',
        status: 'pending',
        coins: coinPackage.coins,
        packageId: coinPackage._id,
        packageTitle: coinPackage.title,
        price: coinPackage.price,
        currency: 'IRT',
        provider: provider.provider,
        idempotencyKey
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      transaction = await CoinTransaction.findOne({ userId, idempotencyKey });
      if (!transaction) throw error;
    }
  }
  if (transaction.status === 'completed') throw new AppError(409, 'این خرید قبلاً تکمیل شده است', 'PURCHASE_ALREADY_COMPLETED');
  const payment = await provider.createIntent({ transactionId: String(transaction._id), amountRials: (transaction.price ?? 0) * 10, currency: 'IRR', description: transaction.packageTitle ?? 'خرید سکه' });
  transaction.providerReference = payment.reference;
  await transaction.save();
  return { transaction, payment };
}

export async function confirmTestPurchase(userId: Types.ObjectId, transactionId: string) {
  if (!env.DEMO_DATA_ENABLED) {
    throw new AppError(404, 'مسیر پرداخت آزمایشی در دسترس نیست', 'TEST_PAYMENT_DISABLED');
  }
  return atomic(async session => {
    if (!session) {
      const claimed = await CoinTransaction.findOneAndUpdate(
        { _id: transactionId, userId, provider: 'test', status: 'pending' },
        { $set: { status: 'processing' } },
        { new: true }
      );
      if (!claimed) {
        const existing = await CoinTransaction.findOne({ _id: transactionId, userId, provider: 'test' });
        if (!existing) throw new AppError(404, 'تراکنش پیدا نشد', 'TRANSACTION_NOT_FOUND');
        if (existing.status === 'completed') {
          const currentUser = await User.findById(userId).select('coinBalance');
          return { transaction: existing, balance: currentUser?.coinBalance ?? existing.balanceAfter ?? 0 };
        }
        throw new AppError(409, 'تراکنش قابل تکمیل نیست', 'PURCHASE_NOT_PENDING');
      }
      const updatedUser = await User.findByIdAndUpdate(userId, { $inc: { coinBalance: claimed.coins } }, { new: true });
      if (!updatedUser) throw new AppError(404, 'کاربر پیدا نشد');
      claimed.status = 'completed';
      claimed.balanceAfter = updatedUser.coinBalance;
      claimed.completedAt = new Date();
      await claimed.save();
      return { transaction: claimed, balance: updatedUser.coinBalance };
    }
    const transaction = await CoinTransaction.findOne({ _id: transactionId, userId, provider: 'test' }).session(session);
    if (!transaction) throw new AppError(404, 'تراکنش پیدا نشد', 'TRANSACTION_NOT_FOUND');
    if (transaction.status === 'completed') {
      const user = await User.findById(userId).select('coinBalance').session(session);
      return { transaction, balance: user?.coinBalance ?? transaction.balanceAfter ?? 0 };
    }
    if (transaction.status !== 'pending') throw new AppError(409, 'تراکنش قابل تکمیل نیست', 'PURCHASE_NOT_PENDING');

    transaction.status = 'processing';
    await transaction.save({ session: session ?? undefined });
    const user = await User.findByIdAndUpdate(userId, { $inc: { coinBalance: transaction.coins } }, { new: true, session });
    if (!user) throw new AppError(404, 'کاربر پیدا نشد');
    transaction.status = 'completed';
    transaction.balanceAfter = user.coinBalance;
    transaction.completedAt = new Date();
    await transaction.save({ session: session ?? undefined });
    return { transaction, balance: user.coinBalance };
  });
}
