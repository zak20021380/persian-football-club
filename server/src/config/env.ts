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
  TELEGRAM_MINI_APP_DEEP_LINK_BASE: z.string().url().default('http://localhost:3000'),
  WEBHOOK_SECRET: z.string().min(8).default('development-webhook-secret'),
  CRON_SECRET: z.string().min(8).default('development-cron-secret'),
  SESSION_SECRET: z.string().min(32).default('development-session-secret-change-me'),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86_400).default(3600),
  INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().min(60).max(86_400).default(3600),
  DEV_MOCK_TELEGRAM_ID: z.coerce.number().int().positive().default(900001),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  TIMEZONE: z.string().default('Asia/Tehran'),
  UPLOAD_DIR: z.string().min(1).default('uploads'),
  PAYMENT_PROVIDER: z.enum(['none', 'test']).default('none'),
  DAILY_COIN_REWARD: z.coerce.number().int().min(1).max(100_000).default(25),
  TRANSFER_FEE_PERCENT: z.coerce.number().int().min(0).max(50).default(5),
  FOOTBALL_API_BASE_URL: z.string().url().refine(value => /^https?:\/\//i.test(value), 'Football API URL must use HTTP(S)').default('https://v3.football.api-sports.io'),
  FOOTBALL_API_KEY: z.string().default(''),
  FOOTBALL_API_KEY_HEADER: z.string().regex(/^[A-Za-z0-9-]+$/).default('x-apisports-key'),
  FOOTBALL_API_LEAGUE_ID: z.preprocess((value) => value === '' ? undefined : value, z.coerce.number().int().positive().optional()),
  FOOTBALL_API_SEASON: z.preprocess((value) => value === '' ? undefined : value, z.coerce.number().int().min(1900).max(2100).optional()),
  FOOTBALL_API_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(15_000)
});

const parsed = schema.superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && value.BOT_TOKEN === 'development-token') {
    context.addIssue({ code: 'custom', path: ['BOT_TOKEN'], message: 'BOT_TOKEN must be configured in production' });
  }
  if (value.NODE_ENV === 'production' && value.SESSION_SECRET === 'development-session-secret-change-me') {
    context.addIssue({ code: 'custom', path: ['SESSION_SECRET'], message: 'SESSION_SECRET must be configured in production' });
  }
  if (value.NODE_ENV === 'production' && !value.TELEGRAM_MINI_APP_DEEP_LINK_BASE.startsWith('https://')) {
    context.addIssue({ code: 'custom', path: ['TELEGRAM_MINI_APP_DEEP_LINK_BASE'], message: 'TELEGRAM_MINI_APP_DEEP_LINK_BASE must use HTTPS in production' });
  }
}).safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const adminIds = new Set(
  env.ADMIN_IDS.split(',').map((value) => Number(value.trim())).filter(Number.isSafeInteger)
);
