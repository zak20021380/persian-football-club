import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  BOT_TOKEN: z.string().min(1).default('development-token'),
  BOT_USERNAME: z.string().min(1).default('football_club_bot'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/persian-football-club'),
  CHANNEL_ID: z.string().min(1).default('-1000000000000'),
  CHANNEL_USERNAME: z.string().default(''),
  CHANNEL_JOIN_URL: z.string().url().default('https://t.me/example'),
  ADMIN_IDS: z.string().default(''),
  BASE_URL: z.string().url().default('http://localhost:3000'),
  WEBHOOK_SECRET: z.string().min(8).default('development-webhook-secret'),
  CRON_SECRET: z.string().min(8).default('development-cron-secret'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  TIMEZONE: z.string().default('Asia/Tehran'),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  PAYMENT_PROVIDER: z.enum(['none', 'test']).default('none'),
  DAILY_COIN_REWARD: z.coerce.number().int().min(1).max(100_000).default(25),
  TRANSFER_FEE_PERCENT: z.coerce.number().int().min(0).max(50).default(5)
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const adminIds = new Set(
  env.ADMIN_IDS.split(',').map((value) => Number(value.trim())).filter(Number.isSafeInteger)
);
