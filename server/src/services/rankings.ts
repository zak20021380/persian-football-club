import { type Types } from 'mongoose';
import {
  ClubPlayer,
  FantasyPlayer,
  ImportantMatch,
  PlayerMatchStat,
  Prediction,
  QuizAttempt,
  Referral,
  Squad,
  User
} from '../models/index.js';
import { env } from '../config/env.js';

export type RankingCategory = 'fantasy'|'predictions'|'quiz'|'friends';
export type RankingPeriod = 'week'|'month'|'season';

interface PeriodWindow {
  start?: Date;
  end: Date;
  previousStart?: Date;
  previousEnd?: Date;
}

interface RankingUser {
  _id: Types.ObjectId;
  displayName?: string;
  clubName?: string;
  favoriteTeam?: string;
  coinBalance: number;
  createdAt: Date;
}

interface SquadMeta {
  formation?: string;
  playerCount: number;
}

export interface RankingEntry {
  userId: string;
  clubName: string;
  ownerName: string;
  score: number;
  rank: number;
  rankChange: number;
  isCurrent: boolean;
  formation?: string;
  playerCount: number;
}

export interface RankingResponse {
  type: RankingCategory|'club-value';
  period: RankingPeriod;
  metric: 'points'|'value';
  leaders: RankingEntry[];
  current: RankingEntry;
}

export function lineupFantasyTotal(players: Array<{ id: string; points: number }>, captainId?: string): number {
  const total = players.reduce((sum, player) => sum + player.points * (player.id === captainId ? 2 : 1), 0);
  return Math.round(total * 100) / 100;
}

export function rankingPeriodWindow(period: RankingPeriod, now = new Date()): PeriodWindow {
  if (period === 'season') return { end: now };
  const local = zonedParts(now);
  if (period === 'month') {
    const start = zonedDate(local.year, local.month, 1);
    const previousDate = new Date(Date.UTC(local.year, local.month - 2, 1));
    return {
      start,
      end: now,
      previousStart: zonedDate(previousDate.getUTCFullYear(), previousDate.getUTCMonth() + 1, 1),
      previousEnd: start
    };
  }
  const localDay = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const daysSinceSaturday = (localDay.getUTCDay() + 1) % 7;
  localDay.setUTCDate(localDay.getUTCDate() - daysSinceSaturday);
  const start = zonedDate(localDay.getUTCFullYear(), localDay.getUTCMonth() + 1, localDay.getUTCDate());
  return {
    start,
    end: now,
    previousStart: new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000),
    previousEnd: start
  };
}

export async function performanceRankings(category: RankingCategory, period: RankingPeriod, currentUserId: Types.ObjectId): Promise<RankingResponse> {
  const users = await rankingUsers(currentUserId);
  const window = rankingPeriodWindow(period);
  const [scores, previousScores, squadMeta] = await Promise.all([
    metricScores(category, window.start, window.end),
    window.previousStart && window.previousEnd ? metricScores(category, window.previousStart, window.previousEnd) : Promise.resolve(new Map<string, number>()),
    squadMetadata(users.map(user => user._id))
  ]);
  return rankedResponse(category, period, 'points', users, scores, previousScores, squadMeta, currentUserId);
}

export async function clubValueRankings(currentUserId: Types.ObjectId): Promise<RankingResponse> {
  const users = await rankingUsers(currentUserId);
  const values = await ClubPlayer.aggregate<{ _id: Types.ObjectId; total: number; playerCount: number }>([
    { $group: { _id: '$ownerId', total: { $sum: { $ifNull: ['$marketValue', 0] } }, playerCount: { $sum: 1 } } }
  ]);
  const scores = new Map(values.map(item => [String(item._id), item.total]));
  users.forEach(user => scores.set(String(user._id), (scores.get(String(user._id)) ?? 0) + user.coinBalance));
  const meta = await squadMetadata(users.map(user => user._id));
  values.forEach(item => {
    const key = String(item._id);
    meta.set(key, { ...meta.get(key), playerCount: item.playerCount });
  });
  return rankedResponse('club-value', 'season', 'value', users, scores, new Map(), meta, currentUserId);
}

async function metricScores(category: RankingCategory, start: Date|undefined, end: Date): Promise<Map<string, number>> {
  if (category === 'fantasy') return fantasyScores(start, end);
  const range = start ? { $gte: start, $lt: end } : { $lt: end };
  if (category === 'predictions') {
    const values = await Prediction.aggregate<{ _id: Types.ObjectId; score: number }>([
      { $match: { scored: true, updatedAt: range } },
      { $group: { _id: '$userId', score: { $sum: '$pointsAwarded' } } }
    ]);
    return scoreMap(values);
  }
  if (category === 'quiz') {
    const values = await QuizAttempt.aggregate<{ _id: Types.ObjectId; score: number }>([
      { $match: { completedAt: range } },
      { $group: { _id: '$userId', score: { $sum: '$score' } } }
    ]);
    return scoreMap(values);
  }
  const values = await Referral.aggregate<{ _id: Types.ObjectId; score: number }>([
    { $match: { status: 'rewarded', rewardedAt: range } },
    { $group: { _id: '$referrerId', score: { $sum: 1 } } }
  ]);
  return scoreMap(values);
}

async function fantasyScores(start: Date|undefined, end: Date): Promise<Map<string, number>> {
  const squads = await Squad.find({}).select('userId starterIds captainId').lean();
  const starterIds = squads.flatMap(squad => squad.starterIds.filter(Boolean)) as Types.ObjectId[];
  if (!starterIds.length) return new Map();
  const clubPlayers = await ClubPlayer.find({ _id: { $in: starterIds } }).select('name fantasyPlayerId').lean();
  const directIds = clubPlayers.map(player => player.fantasyPlayerId).filter(Boolean) as Types.ObjectId[];
  const names = [...new Set(clubPlayers.filter(player => !player.fantasyPlayerId).map(player => player.name))];
  const fantasyPlayers = await FantasyPlayer.find({
    $or: [
      ...(directIds.length ? [{ _id: { $in: directIds } }] : []),
      ...(names.length ? [{ name: { $in: names } }] : [])
    ]
  }).select('name').lean();
  if (!fantasyPlayers.length) return new Map();
  const fantasyByName = new Map(fantasyPlayers.map(player => [normalizedName(player.name), String(player._id)]));
  const fantasyIdByClubPlayer = new Map(clubPlayers.map(player => [
    String(player._id),
    player.fantasyPlayerId ? String(player.fantasyPlayerId) : fantasyByName.get(normalizedName(player.name))
  ]));
  const kickoffAt = start ? { $gte: start, $lt: end } : { $lt: end };
  const matches = await ImportantMatch.find({ status: 'finished', kickoffAt }).select('_id').lean();
  if (!matches.length) return new Map();
  const stats = await PlayerMatchStat.aggregate<{ _id: Types.ObjectId; score: number }>([
    { $match: { matchId: { $in: matches.map(match => match._id) }, playerId: { $in: fantasyPlayers.map(player => player._id) } } },
    { $group: { _id: '$playerId', score: { $sum: '$fantasyPoints' } } }
  ]);
  const pointsByFantasyId = scoreMap(stats);
  const scores = new Map<string, number>();
  squads.forEach(squad => {
    const players = squad.starterIds.filter(Boolean).map(id => {
      const clubPlayerId = String(id);
      const fantasyId = fantasyIdByClubPlayer.get(clubPlayerId);
      return { id: clubPlayerId, points: fantasyId ? pointsByFantasyId.get(fantasyId) ?? 0 : 0 };
    });
    scores.set(String(squad.userId), lineupFantasyTotal(players, squad.captainId ? String(squad.captainId) : undefined));
  });
  return scores;
}

async function rankingUsers(currentUserId: Types.ObjectId): Promise<RankingUser[]> {
  return User.find({ $or: [{ membershipConfirmed: true }, { _id: currentUserId }] })
    .select('displayName clubName favoriteTeam coinBalance createdAt')
    .lean() as unknown as Promise<RankingUser[]>;
}

async function squadMetadata(userIds: Types.ObjectId[]): Promise<Map<string, SquadMeta>> {
  const squads = await Squad.find({ userId: { $in: userIds } }).select('userId formation starterIds').lean();
  return new Map(squads.map(squad => [String(squad.userId), {
    formation: squad.formation,
    playerCount: squad.starterIds.filter(Boolean).length
  }]));
}

function rankedResponse(
  type: RankingCategory|'club-value',
  period: RankingPeriod,
  metric: 'points'|'value',
  users: RankingUser[],
  scores: Map<string, number>,
  previousScores: Map<string, number>,
  squadMeta: Map<string, SquadMeta>,
  currentUserId: Types.ObjectId
): RankingResponse {
  const sorted = [...users].sort((a, b) => (scores.get(String(b._id)) ?? 0) - (scores.get(String(a._id)) ?? 0) || a.createdAt.getTime() - b.createdAt.getTime());
  const previousRanks = new Map([...users]
    .sort((a, b) => (previousScores.get(String(b._id)) ?? 0) - (previousScores.get(String(a._id)) ?? 0) || a.createdAt.getTime() - b.createdAt.getTime())
    .map((user, index) => [String(user._id), index + 1]));
  const entries = sorted.map((user, index): RankingEntry => {
    const key = String(user._id);
    const meta = squadMeta.get(key);
    return {
      userId: key,
      clubName: user.clubName || user.favoriteTeam || 'باشگاه بدون نام',
      ownerName: user.displayName || user.clubName || user.favoriteTeam || 'بازیکن باشگاه',
      score: scores.get(key) ?? 0,
      rank: index + 1,
      rankChange: previousScores.size ? (previousRanks.get(key) ?? index + 1) - (index + 1) : 0,
      isCurrent: key === String(currentUserId),
      formation: meta?.formation,
      playerCount: meta?.playerCount ?? 0
    };
  });
  const current = entries.find(entry => entry.isCurrent) ?? {
    userId: String(currentUserId), clubName: 'باشگاه من', ownerName: 'بازیکن باشگاه', score: 0, rank: entries.length + 1, rankChange: 0, isCurrent: true, playerCount: 0
  };
  return { type, period, metric, leaders: entries.filter(entry => entry.score > 0).slice(0, 50), current };
}

function scoreMap(values: Array<{ _id: Types.ObjectId; score: number }>): Map<string, number> {
  return new Map(values.map(item => [String(item._id), Math.round(item.score * 100) / 100]));
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase('fa').replace(/[\s\u200c\u200f]+/g, ' ');
}

function zonedParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: env.TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value ?? 0);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') };
}

function zonedDate(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day);
  const atGuess = zonedParts(new Date(guess));
  const representedAsUtc = Date.UTC(atGuess.year, atGuess.month - 1, atGuess.day, atGuess.hour, atGuess.minute, atGuess.second);
  return new Date(guess - (representedAsUtc - guess));
}
