import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { verifyLiveMembership } from '../middleware/auth.js';
import { CoinPackage, CoinTransaction, User } from '../models/index.js';
import { claimDailyCoins, confirmTestPurchase, createPurchase } from '../services/coinStore.js';
import { hasActivePremiumSubscription } from '../services/subscription.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(verifyLiveMembership);

router.get('/', asyncHandler(async (req, res) => {
  const [user, packages, transactions, premiumActive] = await Promise.all([
    User.findById(req.authUser!._id).select('coinBalance dailyRewardAvailableAt').lean(),
    CoinPackage.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 }).lean(),
    CoinTransaction.find({ userId: req.authUser!._id }).sort({ createdAt: -1 }).limit(30).select('-idempotencyKey -providerReference -failureReason').lean(),
    hasActivePremiumSubscription(req.authUser!._id)
  ]);
  const nextClaimAt = user?.dailyRewardAvailableAt ?? null;
  res.json({
    balance: user?.coinBalance ?? 0,
    packages,
    dailyReward: { amount: env.DAILY_COIN_REWARD * (premiumActive ? 2 : 1), baseAmount: env.DAILY_COIN_REWARD, premiumMultiplier: premiumActive ? 2 : 1, claimable: !nextClaimAt || new Date(nextClaimAt).getTime() <= Date.now(), nextClaimAt },
    transactions,
    paymentMode: env.DEMO_DATA_ENABLED ? 'test' : 'unavailable'
  });
}));

router.post('/daily-reward', asyncHandler(async (req, res) => {
  res.status(201).json(await claimDailyCoins(req.authUser!._id));
}));

router.post('/purchases', asyncHandler(async (req, res) => {
  const input = z.object({
    packageId: z.string().refine(mongoose.isValidObjectId),
    clientRequestId: z.string().uuid()
  }).parse(req.body);
  res.status(201).json(await createPurchase(req.authUser!._id, input.packageId, input.clientRequestId));
}));

router.post('/purchases/:id/test-confirm', asyncHandler(async (req, res) => {
  const transactionId = z.string().refine(mongoose.isValidObjectId).parse(req.params.id);
  res.json(await confirmTestPurchase(req.authUser!._id, transactionId));
}));

export default router;
