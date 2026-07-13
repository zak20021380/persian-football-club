import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
import { User } from '../models/index.js';

export async function connectDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 12_000 });
  const cleanup = await User.collection.updateMany(
    { $or: [{ firstName: { $exists: true } }, { lastName: { $exists: true } }, { username: { $exists: true } }, { photoUrl: { $exists: true } }] },
    { $unset: { firstName: '', lastName: '', username: '', photoUrl: '' } }
  );
  if (cleanup.modifiedCount) logger.info({ users: cleanup.modifiedCount }, 'Removed legacy Telegram profile fields from persisted users');
  logger.info('MongoDB connected');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
