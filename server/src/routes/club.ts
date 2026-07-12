import { Router } from 'express';
import mongoose, { type Types } from 'mongoose';
import { z } from 'zod';
import { verifyLiveMembership } from '../middleware/auth.js';
import { ClubPlayer, Squad } from '../models/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import { reassignSquadSlot, validateSquadPositions, type SquadPosition } from '../services/squad.js';

const router = Router();
const formationSchema = z.enum(['4-3-3','4-4-2','4-2-3-1','3-5-2','3-4-3','5-3-2','4-1-4-1','custom']);
const playerIdSchema = z.string().refine(mongoose.isValidObjectId, 'شناسه بازیکن نامعتبر است');
const positionSchema = z.object({
  role: z.string().trim().min(1).max(8),
  x: z.number().finite().min(5).max(95),
  y: z.number().finite().min(5).max(95),
});
const completeLineupSchema = z.object({
  starterIds: z.array(playerIdSchema.nullable()).length(11),
  positions: z.array(positionSchema).length(11),
});

router.use(verifyLiveMembership);

router.get('/squad', asyncHandler(async (req, res) => {
  const squad = await Squad.findOne({ userId: req.authUser!._id }).lean();
  res.json(await squadView(req.authUser!._id, squad ?? {
    formation: '4-3-3',
    starterIds: Array.from({ length: 11 }, () => null),
    substituteIds: [],
    customPositions: [],
    savedFormations: [],
  }));
}));

// Atomic save for the lineup builder. Intermediate client-side edits are allowed,
// but only a complete, football-valid eleven can become the persisted lineup.
router.put('/squad', asyncHandler(async (req, res) => {
  const input = completeLineupSchema.extend({ formation: formationSchema }).parse(req.body);
  const positionsError = validateSquadPositions(input.positions);
  if (positionsError) throw new AppError(422, positionsError, 'INVALID_FORMATION_POSITIONS');
  const starterIds = await validateCompleteLineup(req.authUser!._id, input.starterIds);

  let squad = await Squad.findOne({ userId: req.authUser!._id });
  if (!squad) squad = new Squad({ userId: req.authUser!._id });
  const selected = new Set(starterIds.map(String));
  const rosterPool = [...squad.starterIds, ...squad.substituteIds].filter(Boolean) as Types.ObjectId[];
  squad.formation = input.formation;
  squad.starterIds = starterIds;
  squad.substituteIds = uniqueIds(rosterPool.filter(id => !selected.has(String(id))));
  if (input.formation === 'custom') squad.customPositions = input.positions;
  await squad.save();
  res.json(await squadView(req.authUser!._id, squad.toObject()));
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
    playerId: playerIdSchema.nullable()
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

router.post('/squad/custom-formations', asyncHandler(async (req, res) => {
  const input = completeLineupSchema.extend({ name: z.string().trim().min(2).max(30) }).parse(req.body);
  const positionsError = validateSquadPositions(input.positions);
  if (positionsError) throw new AppError(422, positionsError, 'INVALID_FORMATION_POSITIONS');
  const starterIds = await validateCompleteLineup(req.authUser!._id, input.starterIds);
  let squad = await Squad.findOne({ userId: req.authUser!._id });
  if (!squad) squad = new Squad({ userId: req.authUser!._id });
  if (squad.savedFormations.some(item => item.name === input.name)) {
    throw new AppError(409, 'آرایشی با این نام قبلاً ذخیره شده است.', 'FORMATION_NAME_EXISTS');
  }
  squad.savedFormations.push({ _id: new mongoose.Types.ObjectId(), name: input.name, positions: input.positions, starterIds });
  await squad.save();
  res.status(201).json(await squadView(req.authUser!._id, squad.toObject()));
}));

router.patch('/squad/custom-formations/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(400, 'شناسه آرایش نامعتبر است.');
  const { name } = z.object({ name: z.string().trim().min(2).max(30) }).parse(req.body);
  const squad = await Squad.findOne({ userId: req.authUser!._id });
  if (!squad) throw new AppError(404, 'ترکیب پیدا نشد.');
  const saved = squad.savedFormations.find(item => String(item._id) === req.params.id);
  if (!saved) throw new AppError(404, 'آرایش ذخیره‌شده پیدا نشد.');
  if (squad.savedFormations.some(item => String(item._id) !== req.params.id && item.name === name)) {
    throw new AppError(409, 'آرایشی با این نام قبلاً ذخیره شده است.', 'FORMATION_NAME_EXISTS');
  }
  saved.name = name;
  await squad.save();
  res.json(await squadView(req.authUser!._id, squad.toObject()));
}));

router.delete('/squad/custom-formations/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(400, 'شناسه آرایش نامعتبر است.');
  const squad = await Squad.findOne({ userId: req.authUser!._id });
  if (!squad) throw new AppError(404, 'ترکیب پیدا نشد.');
  const before = squad.savedFormations.length;
  squad.savedFormations = squad.savedFormations.filter(item => String(item._id) !== req.params.id);
  if (squad.savedFormations.length === before) throw new AppError(404, 'آرایش ذخیره‌شده پیدا نشد.');
  await squad.save();
  res.json(await squadView(req.authUser!._id, squad.toObject()));
}));

export default router;

async function validateCompleteLineup(userId: Types.ObjectId, ids: Array<string|null>): Promise<Types.ObjectId[]> {
  if (ids.some(id => !id)) throw new AppError(422, 'ترکیب ناقص است؛ برای هر ۱۱ جایگاه یک بازیکن انتخاب کنید.', 'INCOMPLETE_LINEUP');
  const completeIds = ids as string[];
  if (new Set(completeIds).size !== 11) throw new AppError(422, 'هر بازیکن فقط می‌تواند یک‌بار در ترکیب باشد.', 'DUPLICATE_PLAYER');
  const players = await ClubPlayer.find({ ownerId: userId, _id: { $in: completeIds } }).select('_id position').lean();
  if (players.length !== 11) throw new AppError(422, 'یک یا چند بازیکن متعلق به این باشگاه نیستند.', 'PLAYER_NOT_OWNED');
  const goalkeeperCount = players.filter(player => player.position === 'GK').length;
  if (goalkeeperCount !== 1) throw new AppError(422, 'ترکیب باید دقیقاً یک دروازه‌بان و ۱۰ بازیکن غیر دروازه‌بان داشته باشد.', 'GOALKEEPER_RULE');
  return completeIds.map(id => new mongoose.Types.ObjectId(id));
}

function uniqueIds(ids: Types.ObjectId[]): Types.ObjectId[] {
  const seen = new Set<string>();
  return ids.filter(id => {
    const key = String(id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface SquadViewInput {
  formation: string;
  starterIds: Array<unknown|null>;
  substituteIds: unknown[];
  customPositions?: SquadPosition[];
  savedFormations?: Array<{ _id: unknown; name: string; positions: SquadPosition[]; starterIds: Array<unknown|null> }>;
  updatedAt?: Date;
}

async function squadView(userId: Types.ObjectId, squad: SquadViewInput) {
  const savedFormations = squad.savedFormations ?? [];
  const ids = [
    ...squad.starterIds,
    ...squad.substituteIds,
    ...savedFormations.flatMap(saved => saved.starterIds),
  ].filter(Boolean);
  const players = await ClubPlayer.find({ ownerId: userId, _id: { $in: ids } }).lean();
  const byId = new Map(players.map(player => [String(player._id), player]));
  const resolveStarters = (starterIds: Array<unknown|null>) => Array.from({ length: 11 }, (_, index) => {
    const id = starterIds[index];
    return id ? byId.get(String(id)) ?? null : null;
  });
  const starters = resolveStarters(squad.starterIds);
  const substitutes = squad.substituteIds.map(id => byId.get(String(id))).filter(Boolean);
  return {
    formation: squad.formation,
    starters,
    substitutes,
    customPositions: squad.customPositions ?? [],
    savedFormations: savedFormations.map(saved => ({
      _id: String(saved._id),
      name: saved.name,
      positions: saved.positions,
      starters: resolveStarters(saved.starterIds),
    })),
    updatedAt: squad.updatedAt?.toISOString(),
  };
}
