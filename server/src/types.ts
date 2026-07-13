import type { HydratedDocument } from 'mongoose';
import type { IUser } from './models/User.js';
import type { TelegramInitUser } from './services/telegramAuth.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: HydratedDocument<IUser>;
      telegramUser?: Pick<TelegramInitUser, 'id'|'first_name'|'last_name'|'photo_url'>;
    }
  }
}

export {};
