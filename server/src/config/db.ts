import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
import { ImportantMatch, Team, User } from '../models/index.js';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 12_000 });
  await migrateLegacyMatchTeams();
  const cleanup = await User.collection.updateMany(
    { $or: [{ firstName: { $exists: true } }, { lastName: { $exists: true } }, { username: { $exists: true } }, { photoUrl: { $exists: true } }] },
    { $unset: { firstName: '', lastName: '', username: '', photoUrl: '' } }
  );
  if (cleanup.modifiedCount) logger.info({ users: cleanup.modifiedCount }, 'Removed legacy Telegram profile fields from persisted users');
  logger.info('MongoDB connected');
}

async function migrateLegacyMatchTeams(): Promise<void> {
  const legacyMatches = await ImportantMatch.collection.find({
    $or: [{ homeTeamId: { $exists: false } }, { awayTeamId: { $exists: false } }]
  }).toArray();
  for (const match of legacyMatches) {
    const league = typeof match.competitionName === 'string' && match.competitionName.trim() ? match.competitionName.trim() : 'لیگ نامشخص';
    const homeTeamId = match.homeTeamId ?? await legacyTeamId(String(match.homeTeam ?? 'تیم میزبان'), league, match.homeLogo);
    const awayTeamId = match.awayTeamId ?? await legacyTeamId(String(match.awayTeam ?? 'تیم میهمان'), league, match.awayLogo);
    await ImportantMatch.collection.updateOne(
      { _id: match._id },
      { $set: { homeTeamId, awayTeamId }, $unset: { homeTeam: '', awayTeam: '', homeLogo: '', awayLogo: '' } }
    );
  }
  if (legacyMatches.length) logger.info({ matches: legacyMatches.length }, 'Migrated match team names to Team references');
}

async function legacyTeamId(name: string, league: string, logo: unknown) {
  const normalizedName = name.trim().slice(0, 100) || 'تیم نامشخص';
  const team = await Team.findOneAndUpdate(
    { name: normalizedName, league },
    {
      $setOnInsert: {
        name: normalizedName,
        shortName: normalizedName.slice(0, 20),
        country: 'نامشخص',
        league,
        active: true,
        ...(typeof logo === 'string' && logo.length <= 2_048 ? { logoUrl: logo } : {})
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return team._id;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
