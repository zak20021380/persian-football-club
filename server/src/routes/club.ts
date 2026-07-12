import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { verifyLiveMembership } from '../middleware/auth.js';
import { ClubPlayer, Squad } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import { reassignSquadSlot } from '../services/squad.js';

const router = Router();
const formationSchema = z.enum(['4-3-3','4-4-2','4-2-3-1']);
router.use(verifyLiveMembership);

router.get('/squad', asyncHandler(async (req, res) => {
  const squad = await Squad.findOne({ userId: req.authUser!._id }).lean();
  res.json(await squadView(req.authUser!._id, squad ?? { formation: '4-3-3', starterIds: Array.from({ length: 11 }, () => null), substituteIds: [] }));
}));

router.patch('/squad/formation', asyncHandler(async (req, res) => {
  const formation = z.object({ formation: formationSchema }).parse(req.body).formation;
  const squad = await Squad.findOneAndUpdate(
    { userId: req.authUser!._id },
    { $set: { formation }, $setOnInsert: { starterIds: Array.from({ length: 11 }, () => null), substituteIds: [] } },
    { upsert: true, new: true, runValidators: true }
  ).lean();
  res.json(await squadView(req.authUser!._id, squad));
}));

router.patch('/squad/slot', asyncHandler(async (req, res) => {
  const input = z.object({
    slotIndex: z.number().int().min(0).max(10),
    playerId: z.string().refine(mongoose.isValidObjectId).nullable()
  }).parse(req.body);
  const userId = req.authUser!._id;
  const squad = await Squad.findOneAndUpdate(
    { userId },
    { $setOnInsert: { formation: '4-3-3', starterIds: Array.from({ length: 11 }, () => null), substituteIds: [] } },
    { upsert: true, new: true, runValidators: true }
  );
  if (!squad) throw new AppError(500, 'ترکیب ساخته نشد');
  while (squad.starterIds.length < 11) squad.starterIds.push(null);

  const nextPlayer = input.playerId ? await ClubPlayer.findOne({ _id: input.playerId, ownerId: userId }) : null;
  if (input.playerId && !nextPlayer) throw new AppError(404, 'بازیکن متعلق به این باشگاه نیست', 'PLAYER_NOT_OWNED');
  if (input.playerId && squad.starterIds.some((id, index) => index !== input.slotIndex && String(id) === input.playerId)) {
    throw new AppError(409, 'این بازیکن در ترکیب اصلی حضور دارد', 'PLAYER_ALREADY_STARTER');
  }

  const reassigned = reassignSquadSlot(squad.starterIds, squad.substituteIds, input.slotIndex, nextPlayer?._id ?? null);
  squad.starterIds = reassigned.starters;
  squad.substituteIds = reassigned.substitutes;
  await squad.save();
  res.json(await squadView(userId, squad.toObject()));
}));

export default router;

async function squadView(userId: mongoose.Types.ObjectId, squad: { formation: string; starterIds: Array<unknown|null>; substituteIds: unknown[] }) {
  const ids = [...squad.starterIds, ...squad.substituteIds].filter(Boolean);
  const players = await ClubPlayer.find({ ownerId: userId, _id: { $in: ids } }).lean();
  const byId = new Map(players.map(player => [String(player._id), player]));
  const starters = Array.from({ length: 11 }, (_, index) => {
    const id = squad.starterIds[index];
    return id ? byId.get(String(id)) ?? null : null;
  });
  const substitutes = squad.substituteIds.map(id => byId.get(String(id))).filter(Boolean);
  return { formation: squad.formation, starters, substitutes };
}
