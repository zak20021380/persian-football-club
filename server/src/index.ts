import './types.js';
import http from 'node:http';
import { createApp } from './app.js';
import { startTelegramBot, stopTelegramBot } from './bot/index.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

async function main() {
  await connectDatabase();
  const app = createApp();
  await startTelegramBot(app);
  const server = http.createServer(app);
  server.listen(env.PORT, () => logger.info({ port: env.PORT, baseUrl: env.BASE_URL }, 'Server listening'));

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown started');
    server.close(async () => {
      await stopTelegramBot(signal);
      await disconnectDatabase();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error) => { logger.fatal({ err: error }, 'Application startup failed'); process.exit(1); });
