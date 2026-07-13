import { z } from 'zod';
import type { Types } from 'mongoose';
import { env } from '../config/env.js';
import { FantasyPlayer, FootballApiSync, ImportantMatch, PlayerMatchStat, Team, type FantasyPosition, type FantasyStatValues } from '../models/index.js';
import { AppError } from '../utils/errors.js';
import { calculateFantasyPoints, getFantasyScoringConfig } from './fantasyScoring.js';

const externalId = z.number().int().positive();
const text = z.string().trim().min(1).max(200);
const nullableNumber = z.number().finite().nullable().optional().transform((value) => value ?? 0);
const externalUrl = z.string().url().refine(value => /^https?:\/\//i.test(value));
const playerPageSchema = z.object({
  paging: z.object({ current: z.number().int().positive(), total: z.number().int().positive() }).optional(),
  response: z.array(z.object({
    player: z.object({ id: externalId, name: text, photo: externalUrl.nullable().optional(), nationality: z.string().trim().max(80).nullable().optional() }),
    statistics: z.array(z.object({
      team: z.object({ id: externalId, name: text, logo: externalUrl.nullable().optional() }),
      league: z.object({ name: text, country: z.string().trim().max(80).nullable().optional() }),
      games: z.object({ position: z.string().nullable().optional() })
    })).min(1)
  })),
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional()
});

const fixtureStatsSchema = z.object({
  response: z.array(z.object({
    team: z.object({ id: externalId, name: text }),
    players: z.array(z.object({
      player: z.object({ id: externalId, name: text }),
      statistics: z.array(z.object({
        games: z.object({ minutes: z.number().int().min(0).max(200).nullable().optional(), position: z.string().nullable().optional() }),
        goals: z.object({ total: nullableNumber, assists: nullableNumber, saves: nullableNumber, own: nullableNumber.optional() }),
        cards: z.object({ yellow: nullableNumber, red: nullableNumber }),
        penalty: z.object({ missed: nullableNumber }).optional()
      })).min(1)
    }))
  })),
  errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional()
});

export async function synchronizeFantasyPlayers(requestedBy: Types.ObjectId, input: { leagueId?: number; season?: number }) {
  const leagueId = input.leagueId ?? env.FOOTBALL_API_LEAGUE_ID;
  const season = input.season ?? env.FOOTBALL_API_SEASON;
  if (!leagueId || !season) throw new AppError(503, 'شناسه لیگ و فصل API فوتبال روی سرور تنظیم نشده است', 'FOOTBALL_API_CONFIG_MISSING');
  await ensureNoRunningSync('players');
  const run = await FootballApiSync.create({ type: 'players', status: 'running', requestedBy, processed: 0, errorMessages: [], startedAt: new Date() });
  const errors: string[] = [];
  let processed = 0;
  try {
    let page = 1; let totalPages = 1;
    do {
      const raw = await footballApiRequest('/players', { league: leagueId, season, page });
      const parsed = playerPageSchema.safeParse(raw);
      if (!parsed.success) throw new AppError(502, 'ساختار پاسخ بازیکنان API فوتبال معتبر نیست', 'FOOTBALL_API_RESPONSE_INVALID');
      if (hasProviderErrors(parsed.data.errors)) throw new AppError(502, 'API فوتبال خطا برگرداند؛ تنظیمات لیگ، فصل و کلید را بررسی کنید', 'FOOTBALL_API_PROVIDER_ERROR');
      totalPages = Math.min(parsed.data.paging?.total ?? 1, 100);
      for (const entry of parsed.data.response) {
        try {
          const sample = entry.statistics[0];
          const position = mapPosition(sample.games.position);
          const now = new Date();
          const team = await Team.findOneAndUpdate(
            { externalApiId: sample.team.id },
            { $set: { name: sample.team.name, shortName: shortName(sample.team.name), logoUrl: sample.team.logo ?? undefined, country: sample.league.country || 'نامشخص', league: sample.league.name }, $setOnInsert: { active: true } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
          await FantasyPlayer.findOneAndUpdate(
            { externalApiId: entry.player.id },
            {
              $set: { name: entry.player.name, photoUrl: entry.player.photo ?? undefined, position, realTeamId: team._id, nationality: entry.player.nationality || 'نامشخص', lastSyncedAt: now },
              $setOnInsert: { active: true },
              $unset: { syncError: 1 }
            },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
          processed += 1;
        } catch (error) {
          errors.push(`${entry.player.name}: ${errorMessage(error)}`);
          await FantasyPlayer.updateOne({ externalApiId: entry.player.id }, { $set: { syncError: errorMessage(error) } });
        }
      }
      page += 1;
    } while (page <= totalPages);
    run.status = 'completed'; run.processed = processed; run.errorMessages = errors.slice(0, 100); run.completedAt = new Date(); await run.save();
    return run;
  } catch (error) {
    run.status = 'failed'; run.processed = processed; run.errorMessages = [...errors, errorMessage(error)].slice(0, 100); run.completedAt = new Date(); await run.save();
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'همگام‌سازی بازیکنان با API فوتبال ناموفق بود', 'FOOTBALL_API_SYNC_FAILED');
  }
}

export async function synchronizeFixtureStats(requestedBy: Types.ObjectId, matchId: Types.ObjectId) {
  const match = await ImportantMatch.findById(matchId);
  if (!match) throw new AppError(404, 'مسابقه پیدا نشد');
  if (!match.externalApiId) throw new AppError(409, 'شناسه API خارجی برای این مسابقه ثبت نشده است', 'MATCH_EXTERNAL_ID_MISSING');
  if (match.homeScore === undefined || match.awayScore === undefined) throw new AppError(409, 'برای محاسبه کلین‌شیت ابتدا نتیجه مسابقه را ثبت کنید', 'MATCH_RESULT_MISSING');
  await ensureNoRunningSync('statistics');
  const run = await FootballApiSync.create({ type: 'statistics', status: 'running', requestedBy, processed: 0, errorMessages: [], startedAt: new Date() });
  const errors: string[] = [];
  let processed = 0;
  try {
    const parsed = fixtureStatsSchema.safeParse(await footballApiRequest('/fixtures/players', { fixture: match.externalApiId }));
    if (!parsed.success) throw new AppError(502, 'ساختار آمار مسابقه API فوتبال معتبر نیست', 'FOOTBALL_API_RESPONSE_INVALID');
    if (hasProviderErrors(parsed.data.errors)) throw new AppError(502, 'API فوتبال برای آمار مسابقه خطا برگرداند', 'FOOTBALL_API_PROVIDER_ERROR');
    const config = await getFantasyScoringConfig();
    if (!config) throw new AppError(500, 'تنظیمات امتیازدهی پیدا نشد');
    for (const teamEntry of parsed.data.response) {
      const realTeam = await Team.findOne({ externalApiId: teamEntry.team.id });
      for (const entry of teamEntry.players) {
        try {
          const player = await FantasyPlayer.findOne({ externalApiId: entry.player.id });
          if (!player) throw new Error('بازیکن ابتدا باید همگام‌سازی شود');
          const existing = await PlayerMatchStat.findOne({ playerId: player._id, matchId: match._id });
          if (existing?.source === 'corrected') { errors.push(`${player.name}: اصلاح دستی حفظ شد`); continue; }
          const external = entry.statistics[0];
          const values: FantasyStatValues = {
            minutes: external.games.minutes ?? 0,
            goals: external.goals.total,
            assists: external.goals.assists,
            yellowCards: external.cards.yellow,
            redCards: external.cards.red,
            saves: external.goals.saves,
            cleanSheet: cleanSheetFor(match, realTeam?._id, external.games.minutes ?? 0),
            ownGoals: external.goals.own ?? 0,
            missedPenalties: external.penalty?.missed ?? 0
          };
          await PlayerMatchStat.findOneAndUpdate(
            { playerId: player._id, matchId: match._id },
            { $set: { ...values, position: player.position, fantasyPoints: calculateFantasyPoints(values, player.position, config.rules), scoringVersion: config.version, source: 'external', lastSyncedAt: new Date() } },
            { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
          );
          processed += 1;
        } catch (error) { errors.push(`${entry.player.name}: ${errorMessage(error)}`); }
      }
    }
    run.status = 'completed'; run.processed = processed; run.errorMessages = errors.slice(0, 100); run.completedAt = new Date(); await run.save();
    return run;
  } catch (error) {
    run.status = 'failed'; run.processed = processed; run.errorMessages = [...errors, errorMessage(error)].slice(0, 100); run.completedAt = new Date(); await run.save();
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'همگام‌سازی آمار مسابقه ناموفق بود', 'FOOTBALL_API_SYNC_FAILED');
  }
}

async function footballApiRequest(path: string, params: Record<string, string|number>) {
  if (!env.FOOTBALL_API_KEY) throw new AppError(503, 'کلید API فوتبال روی سرور تنظیم نشده است', 'FOOTBALL_API_UNAVAILABLE');
  const url = new URL(path, env.FOOTBALL_API_BASE_URL.endsWith('/') ? env.FOOTBALL_API_BASE_URL : `${env.FOOTBALL_API_BASE_URL}/`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  let response: Response;
  try {
    response = await fetch(url, { headers: { [env.FOOTBALL_API_KEY_HEADER]: env.FOOTBALL_API_KEY, accept: 'application/json' }, signal: AbortSignal.timeout(env.FOOTBALL_API_TIMEOUT_MS) });
  } catch { throw new AppError(502, 'ارتباط با API فوتبال برقرار نشد', 'FOOTBALL_API_NETWORK_ERROR'); }
  if (!response.ok) throw new AppError(502, `API فوتبال با وضعیت ${response.status} پاسخ داد`, 'FOOTBALL_API_HTTP_ERROR');
  return response.json();
}

function mapPosition(value?: string | null): FantasyPosition {
  const normalized = value?.toLowerCase() ?? '';
  if (normalized.includes('goal')) return 'GK';
  if (normalized.includes('def')) return 'DEF';
  if (normalized.includes('mid')) return 'MID';
  if (normalized.includes('attack') || normalized.includes('forward')) return 'FWD';
  throw new Error('پست بازیکن قابل تشخیص نیست');
}

function shortName(name: string): string { return name.length <= 20 ? name : name.slice(0, 20); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message.slice(0, 500) : 'خطای نامشخص'; }
function hasProviderErrors(errors: unknown): boolean { return Array.isArray(errors) ? errors.length > 0 : Boolean(errors && typeof errors === 'object' && Object.keys(errors).length); }
async function ensureNoRunningSync(type: 'players'|'statistics'): Promise<void> {
  const recent = await FootballApiSync.exists({ type, status: 'running', startedAt: { $gte: new Date(Date.now() - 15 * 60_000) } });
  if (recent) throw new AppError(409, 'یک همگام‌سازی دیگر در حال اجرا است', 'FOOTBALL_API_SYNC_RUNNING');
}
function cleanSheetFor(match: { homeTeamId: Types.ObjectId; awayTeamId: Types.ObjectId; homeScore?: number; awayScore?: number }, teamId: Types.ObjectId|undefined, minutes: number): boolean {
  if (!teamId || minutes <= 0) return false;
  if (String(teamId) === String(match.homeTeamId)) return match.awayScore === 0;
  if (String(teamId) === String(match.awayTeamId)) return match.homeScore === 0;
  return false;
}
