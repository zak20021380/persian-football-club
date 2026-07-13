import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { FantasyPlayer, FootballApiSync, ImportantMatch, PlayerMatchStat, Team } from '../models/index.js';
import { calculateFantasyPoints, getFantasyScoringConfig, statValuesFrom, updateFantasyScoringRules } from '../services/fantasyScoring.js';
import { synchronizeFantasyPlayers, synchronizeFixtureStats } from '../services/footballApi.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import { presentMatch } from '../services/matchPresentation.js';

const router = Router();
const objectId = z.string().refine(mongoose.isValidObjectId, 'شناسه معتبر نیست');
const externalApiId = z.number().int().positive().optional();
const optionalUrl = z.union([z.string().trim().url().max(2_048).refine(value => /^https?:\/\//i.test(value), 'آدرس باید با http یا https شروع شود'), z.literal('')]).optional().transform((value) => value || undefined);
const activeFilter = z.enum(['all','true','false']).default('all');
const teamInput = z.object({
  externalApiId,
  name: z.string().trim().min(2).max(100),
  shortName: z.string().trim().min(1).max(20),
  logoUrl: optionalUrl,
  country: z.string().trim().min(2).max(80),
  league: z.string().trim().min(2).max(120),
  active: z.boolean()
}).strict();
const playerInput = z.object({
  externalApiId,
  name: z.string().trim().min(2).max(100),
  photoUrl: optionalUrl,
  position: z.enum(['GK','DEF','MID','FWD']),
  realTeamId: objectId,
  nationality: z.string().trim().min(2).max(80),
  active: z.boolean()
}).strict();
const rulesSchema = z.object({
  minutesPlayed: z.number().finite().min(-100).max(100),
  goalGoalkeeper: z.number().finite().min(-100).max(100),
  goalDefender: z.number().finite().min(-100).max(100),
  goalMidfielder: z.number().finite().min(-100).max(100),
  goalForward: z.number().finite().min(-100).max(100),
  assist: z.number().finite().min(-100).max(100),
  cleanSheet: z.number().finite().min(-100).max(100),
  save: z.number().finite().min(-100).max(100),
  yellowCard: z.number().finite().min(-100).max(100),
  redCard: z.number().finite().min(-100).max(100),
  ownGoal: z.number().finite().min(-100).max(100),
  missedPenalty: z.number().finite().min(-100).max(100)
}).strict();
const statValuesSchema = z.object({
  minutes: z.number().int().min(0).max(200),
  goals: z.number().int().min(0).max(30),
  assists: z.number().int().min(0).max(30),
  yellowCards: z.number().int().min(0).max(3),
  redCards: z.number().int().min(0).max(2),
  saves: z.number().int().min(0).max(100),
  cleanSheet: z.boolean(),
  ownGoals: z.number().int().min(0).max(10),
  missedPenalties: z.number().int().min(0).max(10)
}).strict();

router.get('/options', asyncHandler(async (_req, res) => {
  const [teams, matches] = await Promise.all([
    Team.find({ active: true }).sort({ league: 1, name: 1 }).select('name shortName league logoUrl').limit(500).lean(),
    ImportantMatch.find().sort({ kickoffAt: -1 }).limit(200).populate('homeTeamId awayTeamId', 'name shortName logoUrl').lean()
  ]);
  res.json({ teams, matches: matches.map(presentMatch) });
}));

router.get('/teams', asyncHandler(async (req, res) => {
  const input = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(5).max(100).default(20), q: z.string().trim().max(100).optional(), active: activeFilter, league: z.string().trim().max(120).optional(), country: z.string().trim().max(80).optional() }).parse(req.query);
  const query: Record<string, unknown> = {};
  if (input.q) query.$or = ['name','shortName','league','country'].map(field => ({ [field]: { $regex: escapeRegex(input.q!), $options: 'i' } }));
  if (input.active !== 'all') query.active = input.active === 'true';
  if (input.league) query.league = { $regex: escapeRegex(input.league), $options: 'i' };
  if (input.country) query.country = { $regex: escapeRegex(input.country), $options: 'i' };
  const [items, total] = await Promise.all([Team.find(query).sort({ active: -1, league: 1, name: 1 }).skip((input.page - 1) * input.limit).limit(input.limit).lean(), Team.countDocuments(query)]);
  res.json(pageResult(items, total, input.page, input.limit));
}));

router.post('/teams', asyncHandler(async (req, res) => {
  res.status(201).json(await Team.create(teamInput.parse(req.body)));
}));

router.patch('/teams/:id', asyncHandler(async (req, res) => {
  const input = teamInput.partial().refine(value => Object.keys(value).length > 0).parse(req.body);
  const item = await Team.findByIdAndUpdate(objectId.parse(req.params.id), { $set: input }, { new: true, runValidators: true });
  if (!item) throw new AppError(404, 'تیم پیدا نشد');
  res.json(item);
}));

router.delete('/teams/:id', asyncHandler(async (req, res) => {
  const id = new mongoose.Types.ObjectId(objectId.parse(req.params.id));
  const [matches, players] = await Promise.all([ImportantMatch.countDocuments({ $or: [{ homeTeamId: id }, { awayTeamId: id }] }), FantasyPlayer.countDocuments({ realTeamId: id })]);
  if (matches || players) throw new AppError(409, 'این تیم در مسابقه یا بازیکن استفاده شده است؛ ابتدا آن را غیرفعال کنید', 'TEAM_IN_USE');
  const deleted = await Team.findByIdAndDelete(id);
  if (!deleted) throw new AppError(404, 'تیم پیدا نشد');
  res.sendStatus(204);
}));

router.get('/players', asyncHandler(async (req, res) => {
  const input = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(5).max(100).default(20), q: z.string().trim().max(100).optional(), active: activeFilter, teamId: objectId.optional(), position: z.enum(['GK','DEF','MID','FWD']).optional() }).parse(req.query);
  const query: Record<string, unknown> = {};
  if (input.q) query.$or = ['name','nationality'].map(field => ({ [field]: { $regex: escapeRegex(input.q!), $options: 'i' } }));
  if (input.active !== 'all') query.active = input.active === 'true';
  if (input.teamId) query.realTeamId = input.teamId;
  if (input.position) query.position = input.position;
  const [items, total] = await Promise.all([
    FantasyPlayer.find(query).sort({ active: -1, name: 1 }).skip((input.page - 1) * input.limit).limit(input.limit).populate('realTeamId', 'name shortName logoUrl league').lean(),
    FantasyPlayer.countDocuments(query)
  ]);
  res.json(pageResult(items, total, input.page, input.limit));
}));

router.post('/players', asyncHandler(async (req, res) => {
  const item = await FantasyPlayer.create(playerInput.parse(req.body));
  res.status(201).json(await item.populate('realTeamId', 'name shortName logoUrl league'));
}));

router.patch('/players/:id', asyncHandler(async (req, res) => {
  const input = playerInput.partial().refine(value => Object.keys(value).length > 0).parse(req.body);
  const item = await FantasyPlayer.findByIdAndUpdate(objectId.parse(req.params.id), { $set: input }, { new: true, runValidators: true }).populate('realTeamId', 'name shortName logoUrl league');
  if (!item) throw new AppError(404, 'بازیکن پیدا نشد');
  res.json(item);
}));

router.delete('/players/:id', asyncHandler(async (req, res) => {
  const id = new mongoose.Types.ObjectId(objectId.parse(req.params.id));
  if (await PlayerMatchStat.exists({ playerId: id })) throw new AppError(409, 'برای این بازیکن آمار مسابقه وجود دارد؛ او را غیرفعال کنید', 'PLAYER_IN_USE');
  const deleted = await FantasyPlayer.findByIdAndDelete(id);
  if (!deleted) throw new AppError(404, 'بازیکن پیدا نشد');
  res.sendStatus(204);
}));

router.post('/players/sync', asyncHandler(async (req, res) => {
  const input = z.object({ leagueId: z.number().int().positive().optional(), season: z.number().int().min(1900).max(2100).optional() }).strict().parse(req.body);
  res.json(await synchronizeFantasyPlayers(req.authUser!._id, input));
}));

router.get('/sync-status', asyncHandler(async (_req, res) => {
  const [players, statistics] = await Promise.all([
    FootballApiSync.findOne({ type: 'players' }).sort({ startedAt: -1 }).lean(),
    FootballApiSync.findOne({ type: 'statistics' }).sort({ startedAt: -1 }).lean()
  ]);
  res.json({ players, statistics });
}));

router.get('/scoring', asyncHandler(async (_req, res) => {
  const config = await getFantasyScoringConfig();
  res.json(config);
}));

router.put('/scoring', asyncHandler(async (req, res) => {
  const input = z.object({ rules: rulesSchema, reason: z.string().trim().min(5).max(500) }).strict().parse(req.body);
  res.json(await updateFantasyScoringRules(input.rules, input.reason, req.authUser!._id));
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const input = z.object({ page: z.coerce.number().int().positive().default(1), limit: z.coerce.number().int().min(5).max(100).default(20), playerId: objectId.optional(), matchId: objectId.optional(), q: z.string().trim().max(100).optional() }).parse(req.query);
  const query: Record<string, unknown> = {};
  if (input.playerId) query.playerId = input.playerId;
  if (input.q) {
    const players = await FantasyPlayer.find({ name: { $regex: escapeRegex(input.q), $options: 'i' } }).select('_id').limit(1_000).lean();
    query.playerId = { $in: players.map(player => player._id) };
  }
  if (input.matchId) query.matchId = input.matchId;
  const [items, total] = await Promise.all([
    PlayerMatchStat.find(query).sort({ updatedAt: -1 }).skip((input.page - 1) * input.limit).limit(input.limit)
      .populate({ path: 'playerId', select: 'name photoUrl position nationality realTeamId', populate: { path: 'realTeamId', select: 'name shortName logoUrl' } })
      .populate({ path: 'matchId', select: 'homeTeamId awayTeamId competitionName kickoffAt', populate: { path: 'homeTeamId awayTeamId', select: 'name shortName logoUrl' } }).lean(),
    PlayerMatchStat.countDocuments(query)
  ]);
  res.json(pageResult(items.map(statAdminView), total, input.page, input.limit));
}));

router.post('/stats/sync', asyncHandler(async (req, res) => {
  const matchId = new mongoose.Types.ObjectId(z.object({ matchId: objectId }).strict().parse(req.body).matchId);
  res.json(await synchronizeFixtureStats(req.authUser!._id, matchId));
}));

router.patch('/stats/:id/correct', asyncHandler(async (req, res) => {
  const input = z.object({ reason: z.string().trim().min(5).max(500), values: statValuesSchema }).strict().parse(req.body);
  const stat = await PlayerMatchStat.findById(objectId.parse(req.params.id));
  if (!stat) throw new AppError(404, 'آمار بازیکن پیدا نشد');
  const config = await getFantasyScoringConfig();
  if (!config) throw new AppError(500, 'تنظیمات امتیازدهی پیدا نشد');
  const before = statValuesFrom(stat);
  const after = statValuesFrom(input.values);
  stat.corrections.push({ reason: input.reason, correctedBy: req.authUser!._id, before, after, correctedAt: new Date() });
  Object.assign(stat, after, { fantasyPoints: calculateFantasyPoints(after, stat.position, config.rules), scoringVersion: config.version, source: 'corrected' });
  await stat.save();
  const populated = await PlayerMatchStat.findById(stat._id)
    .populate({ path: 'playerId', select: 'name photoUrl position nationality realTeamId', populate: { path: 'realTeamId', select: 'name shortName logoUrl' } })
    .populate({ path: 'matchId', select: 'homeTeamId awayTeamId competitionName kickoffAt', populate: { path: 'homeTeamId awayTeamId', select: 'name shortName logoUrl' } }).lean();
  res.json(statAdminView(populated!));
}));

export default router;

function pageResult<T>(items: T[], total: number, page: number, limit: number) { return { items, total, page, pages: Math.ceil(total / limit) }; }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function statAdminView(stat: Record<string, any>) {
  if (stat.matchId && typeof stat.matchId === 'object') stat.matchId = presentMatch(stat.matchId);
  return stat;
}
