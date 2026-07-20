import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { verifyLiveMembership } from '../middleware/auth.js';
import {
  cancelSubscription,
  confirmTestSubscriptionPurchase,
  createSubscriptionPurchase,
  resumeSubscription,
  subscriptionOverview,
  updateAutoRenew
} from '../services/subscription.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(verifyLiveMembership);

router.get('/', asyncHandler(async (req, res) => {
  res.json(await subscriptionOverview(req.authUser!._id));
}));

router.post('/purchases', asyncHandler(async (req, res) => {
  const input = z.object({
    cycle: z.enum(['monthly', 'annual']),
    clientRequestId: z.string().uuid()
  }).strict().parse(req.body);
  res.status(201).json(await createSubscriptionPurchase(req.authUser!._id, input.cycle, input.clientRequestId));
}));

router.post('/purchases/:id/test-confirm', asyncHandler(async (req, res) => {
  const transactionId = z.string().refine(mongoose.isValidObjectId).parse(req.params.id);
  res.json(await confirmTestSubscriptionPurchase(req.authUser!._id, transactionId));
}));

router.patch('/auto-renew', asyncHandler(async (req, res) => {
  const { autoRenew } = z.object({ autoRenew: z.boolean() }).strict().parse(req.body);
  res.json(await updateAutoRenew(req.authUser!._id, autoRenew));
}));

router.post('/cancel', asyncHandler(async (req, res) => {
  res.json(await cancelSubscription(req.authUser!._id));
}));

router.post('/resume', asyncHandler(async (req, res) => {
  res.json(await resumeSubscription(req.authUser!._id));
}));

export default router;
