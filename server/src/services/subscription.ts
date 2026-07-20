import mongoose, { type ClientSession, type Types } from 'mongoose';
import { env } from '../config/env.js';
import { Subscription, SubscriptionTransaction, User, type SubscriptionCycle } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { paymentService, type PaymentIntent } from './payment.js';

export const premiumPlan = {
  id: 'premium' as const,
  title: 'عضویت پریمیوم',
  description: 'مزایای ویژه برای مدیران جدی باشگاه',
  cycles: {
    monthly: { price: 149_000, bonusCoins: 350 },
    annual: { price: 1_190_000, originalPrice: 1_788_000, bonusCoins: 4_200 }
  },
  benefits: [
    { id: 'daily-reward', title: 'جایزه روزانه دو برابر', description: 'هر روز دو برابر سکه رایگان دریافت کن.' },
    { id: 'coin-bonus', title: 'هدیه شروع هر دوره', description: 'با فعال‌شدن هر دوره، سکه هدیه بگیر.' },
    { id: 'premium-badge', title: 'نشان اختصاصی پریمیوم', description: 'عضویت ویژه در پروفایل تو نمایش داده می‌شود.' }
  ]
};

function transactionUnsupported(error: unknown): boolean {
  const candidate = error as { code?: number; message?: string };
  return candidate.code === 20 || /Transaction numbers are only allowed|replica set|mongos/i.test(candidate.message ?? '');
}

async function atomic<T>(work: (session: ClientSession | null) => Promise<T>): Promise<T> {
  try {
    return await mongoose.connection.transaction(async session => work(session));
  } catch (error) {
    if (env.NODE_ENV !== 'production' && transactionUnsupported(error)) return work(null);
    throw error;
  }
}

export function subscriptionPeriodEnd(start: Date, cycle: SubscriptionCycle): Date {
  const end = new Date(start);
  const originalDay = end.getUTCDate();
  const targetMonth = end.getUTCMonth() + (cycle === 'annual' ? 12 : 1);
  end.setUTCDate(1);
  end.setUTCFullYear(end.getUTCFullYear(), targetMonth, 1);
  const lastDayOfTargetMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(originalDay, lastDayOfTargetMonth));
  return end;
}

async function completeSubscriptionTransaction(transaction: InstanceType<typeof SubscriptionTransaction>, userId: Types.ObjectId, session: ClientSession|null) {
  const start = new Date();
  const end = subscriptionPeriodEnd(start, transaction.cycle);
  let subscription;
  try {
    subscription = await Subscription.findOneAndUpdate(
      { userId, $or: [{ status: { $ne: 'active' } }, { currentPeriodEnd: { $lte: start } }] },
      {
        $set: {
          planId: transaction.planId,
          planTitle: transaction.planTitle,
          status: 'active',
          cycle: transaction.cycle,
          price: transaction.price,
          currency: transaction.currency,
          bonusCoins: transaction.bonusCoins,
          autoRenew: true,
          cancelAtPeriodEnd: false,
          startedAt: start,
          currentPeriodStart: start,
          currentPeriodEnd: end,
          latestTransactionId: transaction._id
        },
        $unset: { canceledAt: 1 }
      },
      { upsert: true, new: true, runValidators: true, session, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new AppError(409, 'عضویت پریمیوم شما هنوز فعال است', 'SUBSCRIPTION_ALREADY_ACTIVE');
    throw error;
  }
  const user = await User.findByIdAndUpdate(userId, { $inc: { coinBalance: transaction.bonusCoins } }, { new: true, session });
  if (!user) throw new AppError(404, 'کاربر پیدا نشد');
  transaction.status = 'completed';
  transaction.balanceAfter = user.coinBalance;
  transaction.periodStart = start;
  transaction.periodEnd = end;
  transaction.completedAt = start;
  await transaction.save({ session: session ?? undefined });
  return { transaction, subscription, balance: user.coinBalance };
}

export async function currentSubscription(userId: Types.ObjectId) {
  const subscription = await Subscription.findOne({ userId });
  if (subscription?.status === 'active' && subscription.currentPeriodEnd.getTime() <= Date.now()) {
    subscription.status = 'expired';
    subscription.autoRenew = false;
    await subscription.save();
  }
  return subscription;
}

export async function hasActivePremiumSubscription(userId: Types.ObjectId, now = new Date()): Promise<boolean> {
  return Boolean(await Subscription.exists({ userId, status: 'active', currentPeriodEnd: { $gt: now } }));
}

export async function subscriptionOverview(userId: Types.ObjectId) {
  const [subscription, transactions] = await Promise.all([
    currentSubscription(userId),
    SubscriptionTransaction.find({ userId }).sort({ createdAt: -1 }).limit(12).select('-idempotencyKey -providerReference -failureReason').lean()
  ]);
  return {
    plan: premiumPlan,
    subscription,
    transactions,
    paymentMode: env.DEMO_DATA_ENABLED ? 'test' as const : 'unavailable' as const
  };
}

export async function createSubscriptionPurchase(userId: Types.ObjectId, cycle: SubscriptionCycle, clientRequestId: string): Promise<{ transaction: InstanceType<typeof SubscriptionTransaction>; payment: PaymentIntent }> {
  const active = await currentSubscription(userId);
  if (active?.status === 'active') throw new AppError(409, 'عضویت پریمیوم شما هنوز فعال است', 'SUBSCRIPTION_ALREADY_ACTIVE');

  const provider = paymentService();
  const option = premiumPlan.cycles[cycle];
  if (provider.provider === 'none') await provider.createIntent({ transactionId: 'unavailable', amountRials: option.price * 10, currency: 'IRR', description: premiumPlan.title });

  const idempotencyKey = `subscription:${userId}:${clientRequestId}`;
  let transaction = await SubscriptionTransaction.findOne({ userId, idempotencyKey });
  if (!transaction) {
    try {
      transaction = await SubscriptionTransaction.create({
        userId,
        planId: premiumPlan.id,
        planTitle: premiumPlan.title,
        cycle,
        status: 'pending',
        price: option.price,
        currency: 'IRT',
        bonusCoins: option.bonusCoins,
        provider: provider.provider,
        idempotencyKey
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
      transaction = await SubscriptionTransaction.findOne({ userId, idempotencyKey });
      if (!transaction) throw error;
    }
  }
  if (transaction.status === 'completed') throw new AppError(409, 'این پرداخت قبلاً تکمیل شده است', 'SUBSCRIPTION_PURCHASE_COMPLETED');
  const payment = await provider.createIntent({ transactionId: String(transaction._id), amountRials: transaction.price * 10, currency: 'IRR', description: `${transaction.planTitle} - ${cycle === 'annual' ? 'سالانه' : 'ماهانه'}` });
  transaction.providerReference = payment.reference;
  await transaction.save();
  return { transaction, payment };
}

export async function confirmTestSubscriptionPurchase(userId: Types.ObjectId, transactionId: string) {
  if (!env.DEMO_DATA_ENABLED) throw new AppError(404, 'مسیر پرداخت آزمایشی در دسترس نیست', 'TEST_PAYMENT_DISABLED');
  return atomic(async session => {
    if (!session) {
      const claimed = await SubscriptionTransaction.findOneAndUpdate(
        { _id: transactionId, userId, provider: 'test', status: 'pending' },
        { $set: { status: 'processing' } },
        { new: true }
      );
      if (!claimed) {
        const existing = await SubscriptionTransaction.findOne({ _id: transactionId, userId, provider: 'test' });
        if (!existing) throw new AppError(404, 'تراکنش اشتراک پیدا نشد', 'SUBSCRIPTION_TRANSACTION_NOT_FOUND');
        if (existing.status === 'completed') return { transaction: existing, subscription: await Subscription.findOne({ userId }) };
        throw new AppError(409, 'تراکنش قابل تکمیل نیست', 'SUBSCRIPTION_PURCHASE_NOT_PENDING');
      }
      try {
        return await completeSubscriptionTransaction(claimed, userId, null);
      } catch (error) {
        claimed.status = 'failed';
        claimed.failureReason = error instanceof Error ? error.message.slice(0, 300) : 'Subscription activation failed';
        await claimed.save();
        throw error;
      }
    }
    const transaction = await SubscriptionTransaction.findOne({ _id: transactionId, userId, provider: 'test' }).session(session);
    if (!transaction) throw new AppError(404, 'تراکنش اشتراک پیدا نشد', 'SUBSCRIPTION_TRANSACTION_NOT_FOUND');
    if (transaction.status === 'completed') {
      return { transaction, subscription: await Subscription.findOne({ userId }).session(session) };
    }
    if (transaction.status !== 'pending') throw new AppError(409, 'تراکنش قابل تکمیل نیست', 'SUBSCRIPTION_PURCHASE_NOT_PENDING');

    transaction.status = 'processing';
    await transaction.save({ session });
    return completeSubscriptionTransaction(transaction, userId, session);
  });
}

export async function updateAutoRenew(userId: Types.ObjectId, autoRenew: boolean) {
  const subscription = await currentSubscription(userId);
  if (!subscription || subscription.status !== 'active') throw new AppError(404, 'عضویت فعال پیدا نشد', 'ACTIVE_SUBSCRIPTION_NOT_FOUND');
  if (subscription.cancelAtPeriodEnd && !autoRenew) throw new AppError(409, 'لغو عضویت از قبل برای پایان دوره ثبت شده است', 'SUBSCRIPTION_CANCELLATION_SCHEDULED');
  subscription.autoRenew = autoRenew;
  await subscription.save();
  return subscription;
}

export async function cancelSubscription(userId: Types.ObjectId) {
  const subscription = await currentSubscription(userId);
  if (!subscription || subscription.status !== 'active') throw new AppError(404, 'عضویت فعال پیدا نشد', 'ACTIVE_SUBSCRIPTION_NOT_FOUND');
  if (subscription.cancelAtPeriodEnd) return subscription;
  subscription.autoRenew = false;
  subscription.cancelAtPeriodEnd = true;
  subscription.canceledAt = new Date();
  await subscription.save();
  return subscription;
}

export async function resumeSubscription(userId: Types.ObjectId) {
  const subscription = await currentSubscription(userId);
  if (!subscription || subscription.status !== 'active') throw new AppError(404, 'عضویت فعال پیدا نشد', 'ACTIVE_SUBSCRIPTION_NOT_FOUND');
  if (!subscription.cancelAtPeriodEnd) return subscription;
  subscription.autoRenew = true;
  subscription.cancelAtPeriodEnd = false;
  subscription.canceledAt = undefined;
  await subscription.save();
  return subscription;
}
