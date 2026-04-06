import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH ?? path.resolve(__dirname, '../.env') });

const port = Number(process.env.PORT) || 4000;
const databaseUrl = process.env.DATABASE_URL || '';
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
const telegramAdminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
const telegramAdminChatUsername = process.env.TELEGRAM_ADMIN_CHAT_USERNAME;
const telegramPollIntervalMs = Number(process.env.TELEGRAM_POLL_INTERVAL_MS ?? '1500');
const telegramFallbackAmount = Number(process.env.TELEGRAM_FALLBACK_AMOUNT ?? '100');
const adminApiToken = process.env.ADMIN_API_TOKEN?.trim();
const adminUsername = process.env.ADMIN_USERNAME?.trim();
const adminPassword = process.env.ADMIN_PASSWORD?.trim();
const adminJwtSecret = process.env.ADMIN_JWT_SECRET?.trim();
const adminJwtTtl = process.env.ADMIN_JWT_TTL?.trim() || '2h';

export const appConfig = {
  port,
  databaseUrl,
  sseKeepAliveMs: 15_000,
  admin: {
    token: adminApiToken,
    username: adminUsername,
    password: adminPassword,
    jwtSecret: adminJwtSecret,
    jwtTtl: adminJwtTtl,
  },
  telegram: {
    botToken: telegramBotToken,
    adminChatId: telegramAdminChatId,
    adminChatUsername: telegramAdminChatUsername,
    pollIntervalMs: Number.isFinite(telegramPollIntervalMs) ? telegramPollIntervalMs : 1500,
    fallbackAmount: Number.isFinite(telegramFallbackAmount) && telegramFallbackAmount > 0 ? telegramFallbackAmount : 100,
  },
};
