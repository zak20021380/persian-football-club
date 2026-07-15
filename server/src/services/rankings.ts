import { Types } from 'mongoose';
import {
  ClubPlayer,
  FantasyPlayer,
  ImportantMatch,
  PlayerMatchStat,
  Prediction,
  QuizAttempt,
  Referral,
  Squad,
  Team,
  User
} from '../models/index.js';
import { env } from '../config/env.js';

export type RankingCategory = 'fantasy'|'predictions'|'quiz'|'friends';
export type RankingPeriod = 'week'|'month'|'season';
export type RankingScope = 'all'|'friends';

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
  membershipConfirmed?: boolean;
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
  logoUrl?: string;
  form: number[];
}

export interface RankingResponse {
  type: RankingCategory|'club-value';
  period: RankingPeriod;
  metric: 'points'|'value';
  leaders: RankingEntry[];
  current: RankingEntry;
}

export interface RankingClubPlayer {
  _id: string;
  name: string;
  position: string;
  photoUrl?: string;
  nationality?: string;
  club?: string;
  marketValue?: number;
  fantasyPoints: number;
}

export interface RankingClubDetails {
  userId: string;
  logoUrl?: string;
  formation?: string;
  starters: Array<RankingClubPlayer|null>;
  substitutes: RankingClubPlayer[];
  captainId?: string;
  viceCaptainId?: string;
  customPositions: Array<{ role: string; x: number; y: number }>;
  totalSquadValue: number;
  totalFantasyPoints: number;
  recentWeeks: Array<{ startsAt: string; points: number }>;
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

export async function performanceRankings(category: RankingCategory, period: RankingPeriod, currentUserId: Types.ObjectId, scope: RankingScope = 'all'): Promise<RankingResponse> {
  const users = await rankingUsers(currentUserId, scope);
  const window = rankingPeriodWindow(period);
  const [scores, previousScores, squadMeta, logos] = await Promise.all([
    metricScores(category, window.start, window.end),
    window.previousStart && window.previousEnd ? metricScores(category, window.previousStart, window.previousEnd) : Promise.resolve(new Map<string, number>()),
    squadMetadata(users.map(user => user._id)),
    rankingClubLogos(users)
  ]);
  return rankedResponse(category, period, 'points', users, scores, previousScores, squadMeta, logos, currentUserId);
}

export async function clubValueRankings(currentUserId: Types.ObjectId): Promise<RankingResponse> {
  const users = await rankingUsers(currentUserId);
  const values = await ClubPlayer.aggregate<{ _id: Types.ObjectId; total: number; playerCount: number }>([
    { $group: { _id: '$ownerId', total: { $sum: { $ifNull: ['$marketValue', 0] } }, playerCount: { $sum: 1 } } }
  ]);
  const scores = new Map(values.map(item => [String(item._id), item.total]));
  users.forEach(user => scores.set(String(user._id), (scores.get(String(user._id)) ?? 0) + user.coinBalance));
  const [meta, logos] = await Promise.all([squadMetadata(users.map(user => user._id)), rankingClubLogos(users)]);
  values.forEach(item => {
    const key = String(item._id);
    meta.set(key, { ...meta.get(key), playerCount: item.playerCount });
  });
  return rankedResponse('club-value', 'season', 'value', users, scores, new Map(), meta, logos, currentUserId);
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

async function rankingUsers(currentUserId: Types.ObjectId, scope: RankingScope = 'all'): Promise<RankingUser[]> {
  let userIds: Types.ObjectId[]|undefined;
  if (scope === 'friends') {
    const referrals = await Referral.find({
      status: 'rewarded',
      $or: [{ referrerId: currentUserId }, { invitedUserId: currentUserId }]
    }).select('referrerId invitedUserId').lean();
    userIds = [...new Set([String(currentUserId), ...referrals.flatMap(item => [String(item.referrerId), String(item.invitedUserId)])])]
      .map(id => new Types.ObjectId(id));
  }
  return User.find({
    ...(userIds ? { _id: { $in: userIds } } : {}),
    $or: [{ membershipConfirmed: true }, { _id: currentUserId }]
  })
    .select('displayName clubName favoriteTeam membershipConfirmed coinBalance createdAt')
    .lean() as unknown as Promise<RankingUser[]>;
}

async function rankingClubLogos(users: RankingUser[]): Promise<Map<string, string>> {
  if (!users.length) return new Map();
  const teams = await Team.find({ active: true, logoUrl: { $exists: true, $ne: '' } }).select('name shortName logoUrl').lean();
  const result = new Map<string, string>();
  users.forEach(user => {
    const candidates = [user.favoriteTeam, user.clubName].filter(Boolean).map(value => normalizedTeamName(value!));
    const match = teams.find(team => {
      const names = [team.name, team.shortName].map(normalizedTeamName);
      return candidates.some(candidate => names.some(name => candidate === name || candidate.includes(name) || name.includes(candidate)));
    });
    if (match?.logoUrl) result.set(String(user._id), match.logoUrl);
  });
  return result;
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
  logos: Map<string, string>,
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
      playerCount: meta?.playerCount ?? 0,
      logoUrl: logos.get(key),
      form: previousScores.size ? [previousScores.get(key) ?? 0, scores.get(key) ?? 0] : [scores.get(key) ?? 0]
    };
  });
  const current = entries.find(entry => entry.isCurrent) ?? {
    userId: String(currentUserId), clubName: 'باشگاه من', ownerName: 'بازیکن باشگاه', score: 0, rank: entries.length + 1, rankChange: 0, isCurrent: true, playerCount: 0, form: [0]
  };
  return { type, period, metric, leaders: entries.filter(entry => entry.score > 0).slice(0, 50), current };
}

export async function rankingClubDetails(userId: Types.ObjectId, period: RankingPeriod, currentUserId: Types.ObjectId): Promise<RankingClubDetails|null> {
  const user = await User.findById(userId).select('clubName favoriteTeam membershipConfirmed').lean() as unknown as RankingUser|null;
  if (!user || (!user.membershipConfirmed && String(userId) !== String(currentUserId))) return null;

  const [squad, roster, logos] = await Promise.all([
    Squad.findOne({ userId }).lean(),
    ClubPlayer.find({ ownerId: userId }).lean(),
    rankingClubLogos([user])
  ]);
  const fantasyIdByClubPlayer = await fantasyLinks(roster);
  const fantasyIds = [...new Set(fantasyIdByClubPlayer.values())];
  const window = rankingPeriodWindow(period);
  const selectedPoints = await fantasyPointsForRange(fantasyIds, window.start, window.end);
  const starterIds = squad?.starterIds ?? [];
  const captainId = squad?.captainId ? String(squad.captainId) : undefined;
  const byId = new Map(roster.map(player => [String(player._id), player]));
  const presentPlayer = (id: unknown): RankingClubPlayer|null => {
    const player = id ? byId.get(String(id)) : undefined;
    if (!player) return null;
    const fantasyId = fantasyIdByClubPlayer.get(String(player._id));
    return {
      _id: String(player._id),
      name: player.name,
      position: player.position,
      photoUrl: player.photoUrl,
      nationality: player.nationality,
      club: player.club,
      marketValue: player.marketValue,
      fantasyPoints: fantasyId ? selectedPoints.get(fantasyId) ?? 0 : 0
    };
  };
  const starters = Array.from({ length: 11 }, (_, index) => presentPlayer(starterIds[index]));
  const substitutes = (squad?.substituteIds ?? []).map(presentPlayer).filter((player): player is RankingClubPlayer => Boolean(player));
  const selectedLineup = starters.filter((player): player is RankingClubPlayer => Boolean(player));
  const totalFantasyPoints = lineupFantasyTotal(selectedLineup.map(player => ({ id: player._id, points: player.fantasyPoints })), captainId);

  const currentWeekStart = rankingPeriodWindow('week').start!;
  const recentWeeks = await Promise.all([4, 3, 2, 1, 0].map(async offset => {
    const startsAt = new Date(currentWeekStart.getTime() - offset * 7 * 24 * 60 * 60 * 1000);
    const endsAt = offset === 0 ? new Date() : new Date(startsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const points = await fantasyPointsForRange(fantasyIds, startsAt, endsAt);
    const lineup = selectedLineup.map(player => {
      const fantasyId = fantasyIdByClubPlayer.get(player._id);
      return { id: player._id, points: fantasyId ? points.get(fantasyId) ?? 0 : 0 };
    });
    return { startsAt: startsAt.toISOString(), points: lineupFantasyTotal(lineup, captainId) };
  }));

  return {
    userId: String(userId),
    logoUrl: logos.get(String(userId)),
    formation: squad?.formation,
    starters,
    substitutes,
    captainId,
    customPositions: squad?.customPositions ?? [],
    totalSquadValue: roster.reduce((total, player) => total + (player.marketValue ?? 0), 0),
    totalFantasyPoints,
    recentWeeks
  };
}

async function fantasyLinks(players: Array<{ _id: unknown; fantasyPlayerId?: unknown; name: string }>): Promise<Map<string, string>> {
  const directIds = players.map(player => player.fantasyPlayerId).filter(Boolean) as Types.ObjectId[];
  const names = [...new Set(players.filter(player => !player.fantasyPlayerId).map(player => player.name))];
  if (!directIds.length && !names.length) return new Map();
  const fantasyPlayers = await FantasyPlayer.find({
    $or: [
      ...(directIds.length ? [{ _id: { $in: directIds } }] : []),
      ...(names.length ? [{ name: { $in: names } }] : [])
    ]
  }).select('name').lean();
  const byName = new Map(fantasyPlayers.map(player => [normalizedName(player.name), String(player._id)]));
  return new Map(players.flatMap(player => {
    const fantasyId = player.fantasyPlayerId ? String(player.fantasyPlayerId) : byName.get(normalizedName(player.name));
    return fantasyId ? [[String(player._id), fantasyId] as const] : [];
  }));
}

async function fantasyPointsForRange(fantasyIds: string[], start: Date|undefined, end: Date): Promise<Map<string, number>> {
  if (!fantasyIds.length) return new Map();
  const kickoffAt = start ? { $gte: start, $lt: end } : { $lt: end };
  const matches = await ImportantMatch.find({ status: 'finished', kickoffAt }).select('_id').lean();
  if (!matches.length) return new Map();
  const values = await PlayerMatchStat.aggregate<{ _id: Types.ObjectId; score: number }>([
    { $match: { matchId: { $in: matches.map(match => match._id) }, playerId: { $in: fantasyIds.map(id => new Types.ObjectId(id)) } } },
    { $group: { _id: '$playerId', score: { $sum: '$fantasyPoints' } } }
  ]);
  return scoreMap(values);
}

function scoreMap(values: Array<{ _id: Types.ObjectId; score: number }>): Map<string, number> {
  return new Map(values.map(item => [String(item._id), Math.round(item.score * 100) / 100]));
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase('fa').replace(/[\s\u200c\u200f]+/g, ' ');
}

function normalizedTeamName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/\b(football club|fc|club)\b/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
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
