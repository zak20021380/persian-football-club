import crypto from 'node:crypto';
import { Router } from 'express';
import mongoose, { type Model } from 'mongoose';
import multer from 'multer';
import { z } from 'zod';
import { adminIds, env } from '../config/env.js';
import { authenticate, requireAdmin, verifyLiveMembership } from '../middleware/auth.js';
import {
  AppSetting, Badge, Broadcast, CoinPackage, Competition, CompetitionEntry, ImportantMatch, Prediction, Question, Quiz,
  QuizAttempt, Referral, Reminder, Reward, Sponsor, Team, User
} from '../models/index.js';
import { scoreQuiz } from '../services/scoring.js';
import { scoreMatch } from '../services/matchScoring.js';
import { isPredictionOpen } from '../services/prediction.js';
import { availableMatchReminderMinutes, ensureTelegramReminderAccess, matchReminderSendAt } from '../services/reminders.js';
import { createSponsorRedirectToken, trackSponsorEvent, verifySponsorRedirectToken, assertSafeHttpUrl } from '../services/sponsor.js';
import { createPendingReferral, rewardPendingReferral } from '../services/referral.js';
import { createSessionToken } from '../services/session.js';
import { validateTelegramInitData, type TelegramInitUser } from '../services/telegramAuth.js';
import { recoverTelegramUser } from '../services/userRecovery.js';
import { presentMatch } from '../services/matchPresentation.js';
import { clubValueRankings, performanceRankings, rankingClubDetails } from '../services/rankings.js';
import { premierLeagueStandings } from '../services/footballApi.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import funRouter from './fun.js';
import storeRouter from './store.js';
import subscriptionRouter from './subscription.js';
import clubRouter from './club.js';
import adminFantasyRouter from './adminFantasy.js';

const router = Router();
const membershipFilter = (): Record<string, boolean> => env.CHANNEL_MEMBERSHIP_REQUIRED ? { membershipConfirmed: true } : {};
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpeg|webp|gif)$/.test(file.mimetype)) });

router.get('/health', (_req, res) => res.json({ ok: true, service: 'persian-football-club', time: new Date().toISOString() }));
router.post('/auth/telegram', asyncHandler(async (req, res) => {
  const { initData } = z.object({ initData: z.string().max(16_384).default('') }).strict().parse(req.body);
  let telegramUser: TelegramInitUser;
  let startParam: string | undefined;
  let developmentMock = false;
  if (!initData && env.NODE_ENV === 'development') {
    telegramUser = { id: env.DEV_MOCK_TELEGRAM_ID, first_name: 'کاربر توسعه' };
    developmentMock = true;
  } else {
    const validated = validateTelegramInitData(initData, env.BOT_TOKEN, env.INIT_DATA_MAX_AGE_SECONDS);
    telegramUser = validated.user;
    startParam = validated.startParam;
  }
  const recovered = await recoverTelegramUser(telegramUser);
  if (recovered.created && startParam?.startsWith('ref_')) {
    await createPendingReferral(startParam.slice(4), recovered.user._id, recovered.user.telegramId);
  }
  const session = createSessionToken(String(recovered.user._id), telegramUser);
  res.set('Cache-Control', 'no-store');
  res.json({
    token: session.token,
    expiresAt: session.expiresAt,
    demoDataEnabled: env.DEMO_DATA_ENABLED,
    footballApiEnabled: env.FOOTBALL_API_ENABLED,
    developmentMock,
    user: publicUser(recovered.user.toObject(), {}, telegramUser)
  });
}));
router.get('/sponsors/:id/redirect', asyncHandler(async (req, res) => {
  const token = z.string().min(20).parse(req.query.token);
  const payload = verifySponsorRedirectToken(token);
  if (payload.sponsorId !== req.params.id || !mongoose.isValidObjectId(payload.userId)) throw new AppError(401, 'توکن هدایت نامعتبر است');
  const sponsor = await trackSponsorEvent(payload.sponsorId, new mongoose.Types.ObjectId(payload.userId), 'click', 'redirect');
  res.redirect(302, assertSafeHttpUrl(sponsor.destinationUrl).toString());
}));

router.use(authenticate);
router.use('/fun', funRouter);
router.use('/store', storeRouter);
router.use('/subscription', subscriptionRouter);
router.use('/club', clubRouter);

router.get('/bootstrap', asyncHandler(async (req, res) => {
  const user = req.authUser!;
  const [weeklyRank, allTimeRank, badges, supportSetting] = await Promise.all([
    User.countDocuments({ weeklyPoints: { $gt: user.weeklyPoints } }).then((n) => n + 1),
    User.countDocuments({ points: { $gt: user.points } }).then((n) => n + 1),
    Badge.find({ _id: { $in: user.badgeIds } }).lean(),
    AppSetting.findOne({ key: 'supportTelegramUsername' }).select('value').lean()
  ]);
  res.json({
    user: publicUser(user.toObject(), { weeklyRank, allTimeRank, badges }, req.telegramUser),
    membershipConfirmed: env.CHANNEL_MEMBERSHIP_REQUIRED ? user.membershipConfirmed : true,
    joinUrl: env.CHANNEL_JOIN_URL,
    botUsername: env.BOT_USERNAME,
    supportTelegramUsername: normalizeTelegramUsername(supportSetting?.value),
    isAdmin: adminIds.has(user.telegramId),
    developmentMock: env.NODE_ENV === 'development' && user.telegramId === env.DEV_MOCK_TELEGRAM_ID,
    timezone: env.TIMEZONE
  });
}));

router.post('/membership/check', asyncHandler(async (req, res) => {
  if (!env.CHANNEL_MEMBERSHIP_REQUIRED) {
    res.json({ member: true, enforcementRequired: false });
    return;
  }
  const user = req.authUser!;
  if (env.NODE_ENV !== 'production' && env.BOT_TOKEN === 'development-token') {
    user.membershipConfirmed = true;
    await user.save();
    await rewardPendingReferral(user._id);
    res.json({ member: true });
    return;
  }
  const { bot } = await import('../bot/index.js');
  const { checkChannelMembership } = await import('../services/membership.js');
  const member = await checkChannelMembership(bot.telegram, user.telegramId);
  user.membershipConfirmed = member;
  await user.save();
  if (member) await rewardPendingReferral(user._id);
  res.json({ member });
}));

router.get('/home', asyncHandler(async (req, res) => {
  const now = new Date();
  const user = req.authUser!;
  const [matches, competitions, dailyQuiz, leaders, rewards, sponsor, predictionsCount, weeklyRank] = await Promise.all([
    ImportantMatch.find({ published: true, status: { $in: ['live','scheduled'] }, kickoffAt: { $gte: new Date(now.getTime() - 3 * 60 * 60 * 1000) } }).sort({ status: 1, kickoffAt: 1 }).limit(5).populate('homeTeamId awayTeamId', 'name shortName logoUrl').lean(),
    Competition.find({ published: true, status: 'active', startsAt: { $lte: now }, endsAt: { $gt: now } }).sort({ endsAt: 1 }).limit(4).lean(),
    Quiz.findOne({ published: true, status: 'active', startsAt: { $lte: now }, endsAt: { $gt: now } }).sort({ startsAt: -1 }).lean(),
    User.find(membershipFilter()).sort({ weeklyPoints: -1, createdAt: 1 }).limit(5).select('displayName clubName weeklyPoints points').lean(),
    Reward.find({ active: true, startsAt: { $lte: now }, endsAt: { $gt: now } }).sort({ endsAt: 1 }).limit(4).lean(),
    Sponsor.findOne({ active: true, placement: 'home', startsAt: { $lte: now }, endsAt: { $gt: now } }).sort({ createdAt: -1 }).lean(),
    Prediction.countDocuments({ userId: user._id }),
    User.countDocuments({ weeklyPoints: { $gt: user.weeklyPoints } }).then((n) => n + 1)
  ]);
  let sponsorView = null;
  if (sponsor) {
    await trackSponsorEvent(String(sponsor._id), user._id, 'impression', `home:${todayKey()}`);
    sponsorView = { ...sponsor, clickUrl: `/api/sponsors/${sponsor._id}/redirect?token=${encodeURIComponent(createSponsorRedirectToken(String(sponsor._id), String(user._id)))}` };
  }
  const homePredictions = await Prediction.find({ userId: user._id, matchId: { $in: matches.map((match) => match._id) } }).lean();
  const homePredictionMap = new Map(homePredictions.map((prediction) => [String(prediction.matchId), prediction]));
  const matchesWithPredictions = matches.map((match) => ({
    ...presentMatch(match),
    prediction: homePredictionMap.get(String(match._id)) ?? null,
    predictionOpen: isPredictionOpen({ status: match.status, predictionDeadline: new Date(match.predictionDeadline), kickoffAt: new Date(match.kickoffAt) })
  }));
  let activeCompetition: Record<string, unknown> | null = null;
  const latestActiveEntry = competitions.length
    ? await CompetitionEntry.findOne({ userId: user._id, competitionId: { $in: competitions.map((competition) => competition._id) } }).sort({ completedAt: -1 }).lean()
    : null;
  const featuredCompetition = latestActiveEntry
    ? competitions.find((competition) => String(competition._id) === String(latestActiveEntry.competitionId))
    : null;
  if (featuredCompetition) {
    const entry = await CompetitionEntry.findOne({ userId: user._id, competitionId: featuredCompetition._id }).sort({ score: -1, durationMs: 1 }).lean();
    const rank = entry ? await CompetitionEntry.countDocuments({ competitionId: featuredCompetition._id, $or: [{ score: { $gt: entry.score } }, { score: entry.score, durationMs: { $lt: entry.durationMs } }] }).then((count) => count + 1) : null;
    activeCompetition = { ...featuredCompetition, rank, attempted: true };
  }
  res.json({
    user: { firstName: displayNameFor(user.toObject(), req.telegramUser), points: user.points, coinBalance: user.coinBalance ?? 0, weeklyRank, streak: user.streak },
    club: null,
    transferStatus: { activeListings: 0, receivedOffers: 0, expiringOffers: 0 },
    activeCompetition,
    matches: matchesWithPredictions, competitions, dailyQuiz, leaders: leaders.map((leader) => publicUser(leader)), rewards, sponsor: sponsorView, predictionsCount
  });
}));

router.get('/matches', asyncHandler(async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const query: Record<string, unknown> = { published: true };
  if (status && ['scheduled','live','finished','cancelled'].includes(status)) query.status = status;
  const matches = await ImportantMatch.find(query).sort({ kickoffAt: status === 'finished' ? -1 : 1 }).limit(100).populate('homeTeamId awayTeamId', 'name shortName logoUrl').lean();
  const predictions = await Prediction.find({ userId: req.authUser!._id, matchId: { $in: matches.map((m) => m._id) } }).lean();
  const predictionMap = new Map(predictions.map((p) => [String(p.matchId), p]));
  res.json(matches.map((match) => ({ ...presentMatch(match), prediction: predictionMap.get(String(match._id)) ?? null, predictionOpen: isPredictionOpen({ status: match.status, predictionDeadline: new Date(match.predictionDeadline), kickoffAt: new Date(match.kickoffAt) }) })));
}));

router.get('/matches/:id', asyncHandler(async (req, res) => {
  const match = await ImportantMatch.findOne({ _id: req.params.id, published: true }).populate('homeTeamId awayTeamId', 'name shortName logoUrl').lean();
  if (!match) throw new AppError(404, 'بازی پیدا نشد');
  const [prediction, reminder] = await Promise.all([
    Prediction.findOne({ userId: req.authUser!._id, matchId: match._id }).lean(),
    Reminder.findOne({ userId: req.authUser!._id, type: 'match', entityId: match._id, status: { $ne: 'cancelled' } }).lean()
  ]);
  const reminderOptions = availableMatchReminderMinutes(new Date(match.kickoffAt));
  const reminderError = env.BOT_TOKEN === 'development-token'
    ? { code: 'BOT_UNAVAILABLE', message: 'ربات تلگرام هنوز روی سرور تنظیم نشده است' }
    : req.authUser!.blockedBot
      ? { code: 'TELEGRAM_ACCESS_UNAVAILABLE', message: 'ربات به گفت‌وگوی شما دسترسی ندارد؛ ابتدا ربات را Start کنید' }
      : reminder?.status === 'failed'
        ? { code: reminder.lastErrorCode ?? 'TELEGRAM_DELIVERY_FAILED', message: 'ارسال قبلی ناموفق بود؛ دوباره یادآوری را فعال کنید' }
      : reminderOptions.length === 0 && match.status === 'scheduled' && !reminder
        ? { code: 'REMINDER_TIME_PASSED', message: 'زمان فعال‌کردن یادآوری این مسابقه گذشته است' }
        : null;
  res.json({
    ...presentMatch(match),
    prediction,
    predictionOpen: isPredictionOpen({ status: match.status, predictionDeadline: new Date(match.predictionDeadline), kickoffAt: new Date(match.kickoffAt) }),
    reminder: reminder ? { _id: reminder._id, minutes: reminder.reminderMinutes ?? 30, sendAt: reminder.sendAt, status: reminder.status } : null,
    reminderOptions,
    reminderError
  });
}));

router.post('/matches/:id/prediction', verifyLiveMembership, asyncHandler(async (req, res) => {
  const input = z.object({ outcome: z.enum(['home','draw','away']), homeScore: z.number().int().min(0).max(99).optional(), awayScore: z.number().int().min(0).max(99).optional() }).refine((v) => (v.homeScore === undefined) === (v.awayScore === undefined), 'امتیاز دقیق باید کامل وارد شود').parse(req.body);
  const match = await ImportantMatch.findOne({ _id: req.params.id, published: true });
  if (!match) throw new AppError(404, 'بازی پیدا نشد');
  if (!isPredictionOpen(match)) throw new AppError(409, 'مهلت پیش‌بینی تمام شده است', 'PREDICTION_CLOSED');
  const prediction = await Prediction.create({ userId: req.authUser!._id, matchId: match._id, ...input });
  res.status(201).json(prediction);
}));

router.post('/matches/:id/reminder', verifyLiveMembership, asyncHandler(async (req, res) => {
  const input = z.object({ minutes: z.union([z.literal(15), z.literal(30), z.literal(60)]) }).parse(req.body);
  const match = await ImportantMatch.findOne({ _id: req.params.id, published: true });
  if (!match) throw new AppError(404, 'بازی پیدا نشد');
  if (match.status === 'cancelled') throw new AppError(409, 'این مسابقه لغو شده است', 'MATCH_CANCELLED');
  if (match.status !== 'scheduled' || match.kickoffAt.getTime() <= Date.now()) throw new AppError(409, 'این مسابقه شروع شده است', 'MATCH_STARTED');
  if (!availableMatchReminderMinutes(match.kickoffAt).includes(input.minutes)) throw new AppError(409, 'زمان انتخاب‌شده برای این مسابقه گذشته است', 'REMINDER_TIME_PASSED');
  const existing = await Reminder.findOne({ userId: req.authUser!._id, type: 'match', entityId: match._id });
  if (existing?.status === 'sent') throw new AppError(409, 'یادآوری این مسابقه قبلاً ارسال شده است', 'REMINDER_ALREADY_SENT');
  if (existing?.status === 'processing') throw new AppError(409, 'یادآوری در حال ارسال است', 'REMINDER_PROCESSING');
  const { bot } = await import('../bot/index.js');
  await ensureTelegramReminderAccess(bot.telegram, req.authUser!.telegramId);
  const sendAt = matchReminderSendAt(match.kickoffAt, input.minutes);
  const key = `match:${match._id}:user:${req.authUser!._id}`;
  const reminder = await Reminder.findOneAndUpdate(
    { userId: req.authUser!._id, type: 'match', entityId: match._id },
    {
      $set: { telegramId: req.authUser!.telegramId, sendAt, reminderMinutes: input.minutes, matchKickoffAt: match.kickoffAt, message: '', status: 'pending' },
      $unset: { sentAt: 1, lastErrorCode: 1 },
      $setOnInsert: { userId: req.authUser!._id, type: 'match', entityId: match._id, idempotencyKey: key }
    },
    { upsert: true, new: true, runValidators: true }
  );
  res.status(existing ? 200 : 201).json({ _id: reminder!._id, minutes: reminder!.reminderMinutes, sendAt: reminder!.sendAt, status: reminder!.status });
}));

router.delete('/matches/:id/reminder', asyncHandler(async (req, res) => {
  await Reminder.updateOne(
    { userId: req.authUser!._id, type: 'match', entityId: req.params.id, status: { $in: ['pending','processing','failed'] } },
    { $set: { status: 'cancelled', lastErrorCode: 'USER_CANCELLED' } }
  );
  res.sendStatus(204);
}));

router.get('/quizzes/active', verifyLiveMembership, asyncHandler(async (req, res) => {
  const now = new Date();
  const quiz = await Quiz.findOne({ published: true, status: 'active', startsAt: { $lte: now }, endsAt: { $gt: now } }).populate({ path: 'questionIds', match: { active: true }, select: 'text options category difficulty score' }).lean();
  if (!quiz) throw new AppError(404, 'کوییز فعالی وجود ندارد');
  const attempt = await QuizAttempt.findOne({ userId: req.authUser!._id, quizId: quiz._id }).lean();
  res.json({ ...quiz, attempted: Boolean(attempt), attempt });
}));

router.post('/quizzes/:id/submit', verifyLiveMembership, asyncHandler(async (req, res) => {
  const input = z.object({ answers: z.array(z.object({ questionId: z.string(), option: z.number().int().min(0).max(3) })), durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000) }).parse(req.body);
  const now = new Date();
  const quiz = await Quiz.findOne({ _id: req.params.id, published: true, status: 'active', startsAt: { $lte: now }, endsAt: { $gt: now } }).populate('questionIds');
  if (!quiz) throw new AppError(404, 'کوییز فعال پیدا نشد');
  const questions = quiz.questionIds as unknown as Array<{ _id: mongoose.Types.ObjectId; correctOption: number; score: number; explanation?: string }>;
  const result = scoreQuiz(questions.map((q) => ({ id: String(q._id), correctOption: q.correctOption, score: q.score })), input.answers, quiz.scoreMultiplier);
  const attempt = await QuizAttempt.create({ userId: req.authUser!._id, quizId: quiz._id, answers: result.details.map((d) => ({ ...d, questionId: d.questionId })), score: result.score, correctCount: result.correctCount, durationMs: input.durationMs });
  await User.updateOne({ _id: req.authUser!._id }, { $inc: { points: result.score, weeklyPoints: result.score, quizCorrect: result.correctCount, quizTotal: questions.length, streak: 1 }, $push: { activity: { $each: [{ type: 'quiz', title: quiz.title, points: result.score, at: now }], $slice: -50 } } });
  const rank = await QuizAttempt.countDocuments({ quizId: quiz._id, $or: [{ score: { $gt: result.score } }, { score: result.score, durationMs: { $lt: input.durationMs } }] }).then((n) => n + 1);
  res.status(201).json({ attempt, rank, feedback: result.details });
}));

router.get('/competitions', asyncHandler(async (_req, res) => {
  const competitions = await Competition.find({ published: true }).sort({ status: 1, startsAt: -1 }).limit(100).lean();
  res.json(competitions);
}));

router.get('/competitions/:id', verifyLiveMembership, asyncHandler(async (req, res) => {
  const competition = await Competition.findOne({ _id: req.params.id, published: true }).populate({ path: 'questionIds', match: { active: true }, select: 'text options category difficulty score' }).lean();
  if (!competition) throw new AppError(404, 'مسابقه پیدا نشد');
  const attempts = await CompetitionEntry.find({ userId: req.authUser!._id, competitionId: competition._id }).sort({ attemptNo: 1 }).lean();
  res.json({ ...competition, attempts });
}));

router.post('/competitions/:id/submit', verifyLiveMembership, asyncHandler(async (req, res) => {
  const input = z.object({ answers: z.array(z.object({ questionId: z.string(), option: z.number().int().min(0).max(3) })), durationMs: z.number().int().min(0) }).parse(req.body);
  const now = new Date();
  const competition = await Competition.findOne({ _id: req.params.id, published: true, status: 'active', startsAt: { $lte: now }, endsAt: { $gt: now } }).populate('questionIds');
  if (!competition) throw new AppError(404, 'مسابقه فعال پیدا نشد');
  const priorCount = await CompetitionEntry.countDocuments({ userId: req.authUser!._id, competitionId: competition._id });
  if (priorCount >= competition.attemptLimit) throw new AppError(409, 'تعداد تلاش مجاز تمام شده است');
  const questions = competition.questionIds as unknown as Array<{ _id: mongoose.Types.ObjectId; correctOption: number; score: number }>;
  const result = scoreQuiz(questions.map((q) => ({ id: String(q._id), correctOption: q.correctOption, score: q.score })), input.answers);
  const entry = await CompetitionEntry.create({ userId: req.authUser!._id, competitionId: competition._id, attemptNo: priorCount + 1, score: result.score, correctCount: result.correctCount, durationMs: input.durationMs, answers: result.details });
  await User.updateOne({ _id: req.authUser!._id }, { $inc: { points: result.score, weeklyPoints: result.score }, $push: { activity: { $each: [{ type: 'competition', title: competition.title, points: result.score, at: now }], $slice: -50 } } });
  const rank = await CompetitionEntry.countDocuments({ competitionId: competition._id, $or: [{ score: { $gt: result.score } }, { score: result.score, durationMs: { $lt: input.durationMs } }] }).then((n) => n + 1);
  res.status(201).json({ entry, rank, feedback: result.details });
}));

router.get('/premier-league/standings', asyncHandler(async (_req, res) => {
  res.json(await premierLeagueStandings());
}));

router.get('/rankings/:userId', asyncHandler(async (req, res) => {
  const userId = z.string().refine(mongoose.isValidObjectId, 'شناسه باشگاه نامعتبر است').parse(req.params.userId);
  const period = z.enum(['week','month','season']).parse(req.query.period ?? 'week');
  const details = await rankingClubDetails(new mongoose.Types.ObjectId(userId), period, req.authUser!._id);
  if (!details) throw new AppError(404, 'اطلاعات این باشگاه پیدا نشد', 'RANKING_CLUB_NOT_FOUND');
  res.json(details);
}));

router.get('/rankings', asyncHandler(async (req, res) => {
  const type = String(req.query.type ?? 'weekly');
  const current = req.authUser!;
  const modernType = z.enum(['fantasy','predictions','quiz','friends']).safeParse(type);
  if (modernType.success) {
    const period = z.enum(['week','month','season']).parse(req.query.period ?? 'week');
    const requestedScope = z.enum(['all','friends']).parse(req.query.scope ?? 'all');
    const scope = modernType.data === 'fantasy' ? requestedScope : 'all';
    res.json(await performanceRankings(modernType.data, period, current._id, scope)); return;
  }
  if (type === 'club-value') {
    res.json(await clubValueRankings(current._id)); return;
  }
  if (type === 'predictors') {
    const leaders = await User.find(membershipFilter()).sort({ correctPredictions: -1, exactPredictions: -1 }).limit(50).select('displayName clubName favoriteTeam correctPredictions exactPredictions').lean();
    const rank = await User.countDocuments({ correctPredictions: { $gt: current.correctPredictions } }).then((n) => n + 1);
    res.json({ type, leaders: leaders.map((leader) => publicUser(leader)), current: { ...publicUser(current.toObject(), {}, req.telegramUser), rank } }); return;
  }
  if (type === 'referrals') {
    const leaders = await User.find(membershipFilter()).sort({ successfulReferrals: -1 }).limit(50).select('displayName clubName favoriteTeam successfulReferrals points').lean();
    const rank = await User.countDocuments({ successfulReferrals: { $gt: current.successfulReferrals } }).then((n) => n + 1);
    res.json({ type, leaders: leaders.map((leader) => publicUser(leader)), current: { ...publicUser(current.toObject(), {}, req.telegramUser), rank } }); return;
  }
  if (type === 'competition') {
    const competitionId = z.string().refine(mongoose.isValidObjectId).parse(req.query.competitionId);
    const entries = await CompetitionEntry.find({ competitionId }).sort({ score: -1, durationMs: 1 }).limit(50).populate('userId', 'displayName clubName favoriteTeam').lean();
    const mine = await CompetitionEntry.findOne({ competitionId, userId: current._id }).sort({ score: -1, durationMs: 1 }).lean();
    let rank: number | null = null;
    if (mine) rank = await CompetitionEntry.countDocuments({ competitionId, $or: [{ score: { $gt: mine.score } }, { score: mine.score, durationMs: { $lt: mine.durationMs } }] }).then((n) => n + 1);
    const leaders = entries.map((entry) => {
      const populatedUser = entry.userId as unknown;
      return {
        ...entry,
        userId: populatedUser && typeof populatedUser === 'object'
          ? publicUser(populatedUser as Record<string, unknown>)
          : populatedUser
      };
    });
    res.json({ type, leaders, current: mine ? { ...mine, rank } : null }); return;
  }
  const field = type === 'all' ? 'points' : 'weeklyPoints';
  const leaders = await User.find(membershipFilter()).sort({ [field]: -1, createdAt: 1 }).limit(50).select(`displayName clubName favoriteTeam ${field} points weeklyPoints`).lean();
  const value = field === 'points' ? current.points : current.weeklyPoints;
  const rank = await User.countDocuments({ [field]: { $gt: value } }).then((n) => n + 1);
  res.json({ type, leaders: leaders.map((leader) => publicUser(leader)), current: { ...publicUser(current.toObject(), {}, req.telegramUser), rank } });
}));

router.get('/rewards', verifyLiveMembership, asyncHandler(async (req, res) => {
  const now = new Date();
  const user = req.authUser!;
  const all = await Reward.find({ active: true, startsAt: { $lte: now }, endsAt: { $gt: now } }).sort({ endsAt: 1 }).lean();
  const rank = await User.countDocuments({ points: { $gt: user.points } }).then((n) => n + 1);
  res.json(all.map((reward) => ({ ...reward, eligible: (reward.pointsRequired === undefined || user.points >= reward.pointsRequired) && (reward.rankRequired === undefined || rank <= reward.rankRequired) })));
}));

router.get('/profile', asyncHandler(async (req, res) => {
  const user = req.authUser!;
  const [weeklyRank, allTimeRank, badges, referrals] = await Promise.all([
    User.countDocuments({ weeklyPoints: { $gt: user.weeklyPoints } }).then((n) => n + 1),
    User.countDocuments({ points: { $gt: user.points } }).then((n) => n + 1),
    Badge.find({ _id: { $in: user.badgeIds } }).lean(),
    Referral.find({ referrerId: user._id, status: 'rewarded' }).sort({ rewardedAt: -1 }).limit(50).lean()
  ]);
  res.json({ ...publicUser(user.toObject(), { weeklyRank, allTimeRank, badges }, req.telegramUser), referrals });
}));

router.patch('/profile', asyncHandler(async (req, res) => {
  const input = z.object({
    displayName: z.string().trim().min(2).max(50).optional(),
    clubName: z.string().trim().min(2).max(80).optional(),
    favoriteTeam: z.string().trim().min(2).max(80).optional()
  }).strict().refine((value) => Object.keys(value).length > 0, 'حداقل یک مقدار باید وارد شود').parse(req.body);
  if (input.displayName !== undefined) req.authUser!.displayName = input.displayName;
  if (input.clubName !== undefined) req.authUser!.clubName = input.clubName;
  if (input.favoriteTeam !== undefined) req.authUser!.favoriteTeam = input.favoriteTeam;
  await req.authUser!.save();
  res.json(publicUser(req.authUser!.toObject(), {}, req.telegramUser));
}));

router.get('/referrals', verifyLiveMembership, asyncHandler(async (req, res) => {
  const user = req.authUser!;
  const referrals = await Referral.find({ referrerId: user._id }).sort({ createdAt: -1 }).lean();
  res.json({ link: `https://t.me/${env.BOT_USERNAME}?start=ref_${user.referralCode}`, successful: referrals.filter((item) => item.status === 'rewarded').length, earnedPoints: referrals.filter((item) => item.status === 'rewarded').reduce((sum, item) => sum + item.rewardPoints, 0), referrals });
}));

router.post('/sponsors/:id/impression', asyncHandler(async (req, res) => {
  const entityKey = z.object({ entityKey: z.string().min(1).max(160) }).parse(req.body).entityKey;
  await trackSponsorEvent(param(req.params.id), req.authUser!._id, 'impression', entityKey);
  res.sendStatus(204);
}));

// Admin APIs
router.use('/admin', requireAdmin);
router.use('/admin/fantasy', adminFantasyRouter);

const resources: Record<string, Model<any>> = {
  matches: ImportantMatch, questions: Question, quizzes: Quiz, competitions: Competition,
  rewards: Reward, sponsors: Sponsor, badges: Badge, broadcasts: Broadcast, settings: AppSetting, users: User,
  coinPackages: CoinPackage
};

router.get('/admin/overview', asyncHandler(async (_req, res) => {
  const now = new Date();
  const [users, members, activeCompetitions, upcomingMatches, pendingBroadcasts, sponsorAgg] = await Promise.all([
    User.countDocuments(), User.countDocuments(membershipFilter()), Competition.countDocuments({ status: 'active', endsAt: { $gt: now } }),
    ImportantMatch.countDocuments({ status: 'scheduled', kickoffAt: { $gt: now } }), Broadcast.countDocuments({ status: { $in: ['draft','scheduled'] } }),
    Sponsor.aggregate([{ $group: { _id: null, impressions: { $sum: '$impressions' }, clicks: { $sum: '$clicks' } } }])
  ]);
  res.json({ users, members, activeCompetitions, upcomingMatches, pendingBroadcasts, sponsor: sponsorAgg[0] ?? { impressions: 0, clicks: 0 } });
}));

router.post('/admin/upload', upload.single('image'), (req, res, next) => {
  if (!req.file) return next(new AppError(400, 'فایل تصویر ارسال نشده است'));
  res.status(201).json({ url: `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` });
});

router.post('/admin/coinPackages/:id/move', asyncHandler(async (req, res) => {
  const direction = z.object({ direction: z.enum(['up','down']) }).parse(req.body).direction;
  const packages = await CoinPackage.find().sort({ sortOrder: 1, createdAt: 1 });
  const currentIndex = packages.findIndex(item => String(item._id) === param(req.params.id));
  if (currentIndex < 0) throw new AppError(404, 'بسته سکه پیدا نشد');
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= packages.length) { res.json(packages[currentIndex]); return; }
  [packages[currentIndex], packages[targetIndex]] = [packages[targetIndex], packages[currentIndex]];
  await CoinPackage.bulkWrite(packages.map((item, index) => ({ updateOne: { filter: { _id: item._id }, update: { $set: { sortOrder: (index + 1) * 10 } } } })));
  res.json(await CoinPackage.findById(param(req.params.id)));
}));

router.get('/admin/:resource', asyncHandler(async (req, res) => {
  const resource = param(req.params.resource);
  const model = resources[resource];
  if (!model) throw new AppError(404, 'بخش مدیریتی نامعتبر است');
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 30)));
  const query: Record<string, unknown> = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.q && resource === 'matches') {
    const term = escapeRegex(String(req.query.q));
    const teams = await Team.find({ $or: [{ name: { $regex: term, $options: 'i' } }, { shortName: { $regex: term, $options: 'i' } }] }).select('_id').lean();
    query.$or = [{ competitionName: { $regex: term, $options: 'i' } }, { homeTeamId: { $in: teams.map(team => team._id) } }, { awayTeamId: { $in: teams.map(team => team._id) } }];
  } else if (req.query.q) query.$or = searchableFields(resource).map((field) => ({ [field]: { $regex: escapeRegex(String(req.query.q)), $options: 'i' } }));
  const sort = resource === 'coinPackages' ? { sortOrder: 1, createdAt: 1 } : { createdAt: -1 };
  const find = model.find(query).sort(sort as any).skip((page - 1) * limit).limit(limit);
  if (resource === 'matches') find.populate('homeTeamId awayTeamId', 'name shortName logoUrl');
  const [items, total] = await Promise.all([find.lean(), model.countDocuments(query)]);
  res.json({ items: resource === 'matches' ? items.map(item => presentMatch(item as Record<string, any>)) : items, total, page, pages: Math.ceil(total / limit) });
}));

router.post('/admin/:resource', asyncHandler(async (req, res) => {
  const model = resources[param(req.params.resource)];
  if (!model) throw new AppError(404, 'بخش مدیریتی نامعتبر است');
  const payload = sanitizeAdminPayload(param(req.params.resource), req.body);
  if (param(req.params.resource) === 'matches') await validateMatchTeams(payload);
  if (param(req.params.resource) === 'sponsors' && payload.destinationUrl) assertSafeHttpUrl(String(payload.destinationUrl));
  if (param(req.params.resource) === 'broadcasts' && !payload.idempotencyKey) payload.idempotencyKey = crypto.randomUUID();
  const item = await model.create(payload);
  res.status(201).json(item);
}));

router.post('/admin/:resource/:id/duplicate', asyncHandler(async (req, res) => {
  const model = resources[param(req.params.resource)];
  if (!model || param(req.params.resource) === 'users') throw new AppError(404, 'امکان کپی وجود ندارد');
  const original = await model.findById(param(req.params.id)).lean();
  if (!original) throw new AppError(404, 'رکورد پیدا نشد');
  const copy: Record<string, unknown> = { ...original };
  delete copy._id; delete copy.createdAt; delete copy.updatedAt; delete copy.__v;
  if ('title' in copy) copy.title = `${String(copy.title)} - کپی`;
  if ('name' in copy) copy.name = `${String(copy.name)} - کپی`;
  if ('status' in copy) copy.status = 'draft';
  if ('published' in copy) copy.published = false;
  if (param(req.params.resource) === 'matches') delete copy.externalApiId;
  if (param(req.params.resource) === 'broadcasts') copy.idempotencyKey = crypto.randomUUID();
  const item = await model.create(copy);
  res.status(201).json(item);
}));

router.patch('/admin/:resource/:id', asyncHandler(async (req, res) => {
  const resource = param(req.params.resource);
  const model = resources[resource];
  if (!model) throw new AppError(404, 'بخش مدیریتی نامعتبر است');
  const payload = sanitizeAdminPayload(resource, req.body);
  if (resource === 'matches') {
    const existing = await ImportantMatch.findById(param(req.params.id)).lean();
    if (!existing) throw new AppError(404, 'رکورد پیدا نشد');
    await validateMatchTeams({ ...existing, ...payload });
  }
  if (resource === 'sponsors' && payload.destinationUrl) assertSafeHttpUrl(String(payload.destinationUrl));
  const item = await model.findByIdAndUpdate(param(req.params.id), { $set: payload }, { new: true, runValidators: true });
  if (!item) throw new AppError(404, 'رکورد پیدا نشد');
  res.json(item);
}));

router.delete('/admin/:resource/:id', asyncHandler(async (req, res) => {
  const model = resources[param(req.params.resource)];
  if (!model || param(req.params.resource) === 'users') throw new AppError(400, 'حذف این بخش مجاز نیست');
  const item = await model.findByIdAndDelete(param(req.params.id));
  if (!item) throw new AppError(404, 'رکورد پیدا نشد');
  res.sendStatus(204);
}));

router.post('/admin/matches/:id/score', asyncHandler(async (req, res) => {
  const input = z.object({ homeScore: z.number().int().min(0), awayScore: z.number().int().min(0) }).parse(req.body);
  res.json(await scoreMatch(param(req.params.id), input.homeScore, input.awayScore));
}));

router.post('/admin/broadcasts/:id/send', asyncHandler(async (req, res) => {
  const broadcast = await Broadcast.findById(param(req.params.id));
  if (!broadcast) throw new AppError(404, 'پیام پیدا نشد');
  broadcast.status = 'scheduled'; broadcast.scheduledAt = new Date(); await broadcast.save();
  res.json(broadcast);
}));

export default router;

function param(value: string | string[]): string { return Array.isArray(value) ? value[0] : value; }

function publicUser(user: Record<string, any>, extra: Record<string, unknown> = {}, telegramUser?: Pick<TelegramInitUser, 'first_name'|'last_name'|'photo_url'>) {
  const safe = { ...user };
  delete safe.telegramId;
  delete safe.referredBy;
  delete safe.blockedBot;
  delete safe.firstName;
  delete safe.lastName;
  delete safe.username;
  delete safe.photoUrl;
  return {
    ...safe,
    firstName: displayNameFor(user, telegramUser),
    photoUrl: telegramUser?.photo_url,
    quizAccuracy: safe.quizTotal ? Math.round((safe.quizCorrect / safe.quizTotal) * 100) : 0,
    ...extra
  };
}
function displayNameFor(user: Record<string, any>, telegramUser?: Pick<TelegramInitUser, 'first_name'|'last_name'>): string {
  if (user.displayName) return String(user.displayName);
  const telegramName = telegramUser ? [telegramUser.first_name, telegramUser.last_name].filter(Boolean).join(' ').trim() : '';
  return telegramName || user.clubName || user.favoriteTeam || 'بازیکن باشگاه';
}
function todayKey(): string { return new Intl.DateTimeFormat('en-CA', { timeZone: env.TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function normalizeTelegramUsername(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const username = value.trim().replace(/^@/, '');
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username) ? username : null;
}
function searchableFields(resource: string): string[] {
  return ({ matches: ['competitionName'], questions: ['text','category'], quizzes: ['title'], competitions: ['title'], rewards: ['title'], sponsors: ['name'], badges: ['name'], broadcasts: ['title','message'], settings: ['key'], users: ['displayName','clubName'], coinPackages: ['title','badge'] } as Record<string,string[]>)[resource] ?? ['title'];
}
function sanitizeAdminPayload(resource: string, payload: unknown): Record<string, any> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new AppError(400, 'بدنه درخواست نامعتبر است');
  const value = { ...(payload as Record<string, any>) };
  delete value._id; delete value.__v; delete value.createdAt; delete value.updatedAt; delete value.telegramId; delete value.points; delete value.weeklyPoints; delete value.referralCode;
  if (resource === 'matches') { delete value.homeTeam; delete value.awayTeam; delete value.homeLogo; delete value.awayLogo; }
  if (resource === 'users') {
    const allowed = ['displayName','clubName','favoriteTeam','membershipConfirmed','blockedBot'];
    return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.includes(key)));
  }
  if (resource === 'coinPackages') {
    const allowed = ['title','coins','price','originalPrice','badge','active','sortOrder'];
    return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.includes(key)));
  }
  if (resource === 'settings' && value.key === 'supportTelegramUsername') {
    const username = normalizeTelegramUsername(value.value);
    if (!username) throw new AppError(400, 'نام کاربری تلگرام پشتیبانی معتبر نیست');
    value.value = username;
  }
  return value;
}
async function validateMatchTeams(payload: Record<string, any>): Promise<void> {
  const ids = [payload.homeTeamId, payload.awayTeamId].filter(Boolean);
  if (!ids.length) return;
  if (ids.some(id => !mongoose.isValidObjectId(id))) throw new AppError(400, 'شناسه تیم مسابقه معتبر نیست');
  if (payload.homeTeamId && payload.awayTeamId && String(payload.homeTeamId) === String(payload.awayTeamId)) throw new AppError(400, 'تیم میزبان و میهمان باید متفاوت باشند');
  if (await Team.countDocuments({ _id: { $in: ids } }) !== new Set(ids.map(String)).size) throw new AppError(400, 'یکی از تیم‌های مسابقه پیدا نشد');
}
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
