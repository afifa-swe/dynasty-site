import { appConfig } from '../config';
import { SSEBroker } from '../sse';
import { normalizePhone } from '../lib/phone';
import { processPurchase, recordIngestEvent } from './rating';

type TelegramMessage = {
  message_id: number;
  date: number;
  text?: string;
  caption?: string;
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
  };
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
};

interface TelegramIngestConfig {
  botToken: string;
  adminChatId?: string;
  adminChatUsername?: string;
  pollIntervalMs: number;
  fallbackAmount: number;
}

interface ParsedOrder {
  nickname: string;
  amount: number;
  phone?: string;
  items?: string[];
}

const NAME_LABELS = ['name', 'full name', '\u0438\u043c\u044f', '\u0444\u0438\u043e', '\u043f\u043e\u043b\u0443\u0447\u0430\u0442\u0435\u043b\u044c', '\u043a\u043e\u043d\u0442\u0430\u043a\u0442'];
const PRODUCT_LABELS = ['product', 'item', '\u0442\u043e\u0432\u0430\u0440', '\u043d\u0430\u0431\u043e\u0440', '\u043f\u043e\u0437\u0438\u0446\u0438\u044f', '\u043a\u043e\u043c\u043f\u043b\u0435\u043a\u0442'];
const HANDLE_LABELS = ['telegram', 'tg', 'username', 'user', 'nick', 'nickname', '\u0442\u0435\u043b\u0435\u0433\u0440\u0430\u043c', '\u043d\u0438\u043a', '\u043d\u0438\u043a\u043d\u0435\u0439\u043c', '\u044e\u0437\u0435\u0440\u043d\u0435\u0439\u043c'];
const AMOUNT_LABELS = ['amount', 'price', 'sum', 'total', 'payment', 'cost', '\u0441\u0443\u043c\u043c\u0430', '\u0438\u0442\u043e\u0433\u043e', '\u043e\u043f\u043b\u0430\u0442\u0430', '\u0441\u0442\u043e\u0438\u043c\u043e\u0441\u0442\u044c', '\u0446\u0435\u043d\u0430'];
const PHONE_LABELS = ['phone', 'mobile', '\u0442\u0435\u043b\u0435\u0444\u043e\u043d', '\u043d\u043e\u043c\u0435\u0440', '\u043c\u043e\u0431', '\u043c\u043e\u0431\u0438\u043b\u044c\u043d\u044b\u0439', '\u0442\u0435\u043b.'];
const CURRENCY_HINTS = ['\u20bd', '\u0440\u0443\u0431', '\u0440.', 'rub', '$', 'usd', 'eur', '\u20ac'];

/**
 * Lightweight polling worker that listens for order summaries in the admin Telegram channel
 * and pipes them into the existing rating pipeline as Telegram purchases.
 */
export class TelegramIngestor {
  private offset: number | undefined;
  private timer?: NodeJS.Timeout;
  private running = false;
  private consecutiveErrors = 0;

  constructor(private readonly config: TelegramIngestConfig, private readonly sse: SSEBroker) {}

  async start() {
    if (!this.config.botToken || (!this.config.adminChatId && !this.config.adminChatUsername)) {
      console.warn('Telegram ingest disabled: missing bot token or admin channel identifier.');
      return;
    }

    // Skip backlog on cold start to avoid double-crediting historic messages.
    await this.primeOffset();

    this.running = true;
    this.scheduleNextPoll();
    console.log(
      `Telegram ingest enabled for chat ${this.config.adminChatId ?? '@' + this.config.adminChatUsername}`,
    );
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
    }
  }

  private scheduleNextPoll(delay = this.config.pollIntervalMs) {
    if (!this.running) return;
    this.timer = setTimeout(() => {
      this.poll()
        .then(() => {
          this.consecutiveErrors = 0;
          this.scheduleNextPoll();
        })
        .catch((err) => {
          const status = (err as { status?: number }).status;
          if (status === 409) {
            console.error(
              'Telegram polling conflict detected (409). Another getUpdates consumer is running. Stopping poller.',
            );
            this.stop();
            return;
          }
          this.consecutiveErrors += 1;
          const backoff = Math.min(30_000, this.consecutiveErrors * this.config.pollIntervalMs);
          console.error('Telegram poll failed', err);
          this.scheduleNextPoll(backoff);
        });
    }, delay);
  }

  private async primeOffset() {
    try {
      const response = await this.callApi('getUpdates', {
        allowed_updates: ['message', 'channel_post'],
        timeout: 0,
      });

      const updates: TelegramUpdate[] = response.result ?? [];
      if (updates.length) {
        const lastUpdateId = updates[updates.length - 1].update_id;
        this.offset = lastUpdateId + 1;
      }
    } catch (error) {
      console.warn('Unable to prime Telegram offset; will process from earliest available updates', error);
    }
  }

  private async poll() {
    const response = await this.callApi('getUpdates', {
      offset: this.offset,
      timeout: 10,
      allowed_updates: ['message', 'channel_post'],
    });

    const updates: TelegramUpdate[] = response.result ?? [];

    for (const update of updates) {
      this.offset = update.update_id + 1;

      const message = update.message ?? update.channel_post;
      if (!message) continue;

      if (!this.isFromAdminChannel(message)) continue;

      const text = message.text ?? message.caption;
      if (!text) continue;

      const parsed = parseOrderMessage(text, this.config.fallbackAmount);
      if (!parsed) {
        console.warn('Telegram message skipped: could not parse order payload', text);
        try {
          const orderId = `telegram-${message.chat?.id ?? 'unknown'}-${message.message_id}`;
          await recordIngestEvent({
            source: 'telegram',
            status: 'error',
            orderId,
            rawPayload: {
              messageId: message.message_id,
              chatId: message.chat?.id,
              text,
              receivedAt: new Date().toISOString(),
            },
            errorMessage: 'Telegram parse failed',
          });
        } catch (error) {
          console.error('Failed to record Telegram parse error', error);
        }
        continue;
      }

      try {
        const orderId = `telegram-${message.chat?.id ?? 'unknown'}-${message.message_id}`;
        const result = await processPurchase({
          nickname: parsed.nickname,
          amount: parsed.amount,
          phone: parsed.phone,
          items: parsed.items,
          orderId,
          source: 'telegram',
        });

        if (result.duplicate) {
          continue;
        }

        try {
          await recordIngestEvent({
            source: 'telegram',
            status: 'success',
            orderId,
            nickname: parsed.nickname,
            phone: parsed.phone,
            amount: parsed.amount,
            items: parsed.items,
            rawPayload: {
              messageId: message.message_id,
              chatId: message.chat?.id,
              text,
              receivedAt: new Date().toISOString(),
            },
            userId: result.user?.id,
          });
        } catch (logError) {
          console.error('Failed to record Telegram ingest event', logError);
        }

        this.sse.broadcast('purchase_ingested', {
          source: 'telegram',
          leaderboard: result.leaderboard,
          activity: result.activity,
          rules: result.rules,
        });
      } catch (error) {
        console.error('Failed to process Telegram order', { error, text });
        try {
          const orderId = `telegram-${message.chat?.id ?? 'unknown'}-${message.message_id}`;
          await recordIngestEvent({
            source: 'telegram',
            status: 'error',
            orderId,
            nickname: parsed.nickname,
            phone: parsed.phone,
            amount: parsed.amount,
            items: parsed.items,
            rawPayload: {
              messageId: message.message_id,
              chatId: message.chat?.id,
              text,
              receivedAt: new Date().toISOString(),
            },
            errorMessage: (error as Error).message || 'Failed to process Telegram order',
          });
        } catch (logError) {
          console.error('Failed to record Telegram ingest error', logError);
        }
      }
    }
  }

  private isFromAdminChannel(message: TelegramMessage): boolean {
    const chatId = message.chat?.id ? String(message.chat.id) : '';
    const username = message.chat?.username?.toLowerCase();

    const idMatch = this.config.adminChatId ? chatId === this.config.adminChatId : false;
    const usernameMatch = this.config.adminChatUsername
      ? username === this.config.adminChatUsername.toLowerCase()
      : false;

    return idMatch || usernameMatch;
  }

  private async callApi(method: string, body: Record<string, unknown>) {
    const res = await fetch(`https://api.telegram.org/bot${this.config.botToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const message = await res.text();
      const error = new Error(`Telegram API ${method} failed: ${res.status} ${message}`);
      (error as { status?: number }).status = res.status;
      throw error;
    }

    const json = await res.json();
    if (!json.ok) {
      throw new Error(`Telegram API ${method} returned error: ${json.description ?? 'unknown error'}`);
    }

    return json;
  }
}

export function parseOrderMessage(text: string, fallbackAmount: number): ParsedOrder | null {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return null;

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const handle = findValueByLabel(lines, HANDLE_LABELS) ?? findHandleInText(normalized);
  const name = findValueByLabel(lines, NAME_LABELS);
  const product = findValueByLabel(lines, PRODUCT_LABELS);
  const amount = extractAmount(lines) ?? (fallbackAmount > 0 ? Math.round(fallbackAmount) : null);
  const phone = extractPhone(lines);

  if (!amount) return null;

  const nickname = sanitizeNickname(handle ?? name ?? 'telegram-user');

  return {
    nickname,
    amount,
    phone,
    items: product ? [product] : undefined,
  };
}

function findValueByLabel(lines: string[], labels: string[]): string | undefined {
  const normalizedLabels = labels.map((label) => label.toLowerCase());

  for (const raw of lines) {
    const cleaned = raw.replace(/^[\-\u2022\s]+/, '');
    const [label, ...rest] = cleaned.split(/[:\-\u2013\u2014]\s*/);
    if (!rest.length) continue;

    const normalizedLabel = label.trim().toLowerCase();
    if (!normalizedLabels.some((l) => normalizedLabel.includes(l))) continue;

    const value = rest.join(' ').trim();
    if (value) return value;
  }

  return undefined;
}

function findHandleInText(text: string): string | undefined {
  const match = text.match(/@([A-Za-z0-9_]{3,})/);
  return match ? match[1] : undefined;
}

function extractAmount(lines: string[]): number | undefined {
  for (const line of lines) {
    const lower = line.toLowerCase();
    const hasLabel = AMOUNT_LABELS.some((label) => lower.includes(label));
    const hasCurrencyHint = CURRENCY_HINTS.some((hint) => lower.includes(hint));
    if (!hasLabel && !hasCurrencyHint) continue;

    const numeric = parseNumeric(line);
    if (numeric) return numeric;
  }

  return undefined;
}

function parseNumeric(raw: string): number | null {
  const match = raw.match(/-?\d[\d\s.,]*/);
  if (!match) return null;
  let normalized = match[0].replace(/\s/g, '');
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(',');
    const lastDot = normalized.lastIndexOf('.');
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    normalized = normalized.split(thousandsSeparator).join('');
    normalized = normalized.replace(decimalSeparator, '.');
  } else if (hasComma) {
    const parts = normalized.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = `${parts[0].replace(/,/g, '')}.${parts[1]}`;
    } else {
      normalized = normalized.replace(/,/g, '');
    }
  } else if (hasDot) {
    const parts = normalized.split('.');
    if (parts.length === 2 && parts[1].length <= 2) {
      normalized = `${parts[0].replace(/\./g, '')}.${parts[1]}`;
    } else {
      normalized = normalized.replace(/\./g, '');
    }
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function extractPhone(lines: string[]): string | undefined {
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (!PHONE_LABELS.some((label) => lower.includes(label))) continue;

    const normalized = normalizePhone(line);
    const digits = normalized?.replace(/\D/g, '') ?? '';
    if (digits.length >= 6) return normalized;
  }

  const fallback = lines.join(' ').match(/\+?\d[\d\s\-()]{5,}/);
  if (!fallback?.[0]) return undefined;
  const normalized = normalizePhone(fallback[0]);
  const digits = normalized?.replace(/\D/g, '') ?? '';
  return digits.length >= 6 ? normalized : undefined;
}

function sanitizeNickname(raw: string) {
  const trimmed = raw.trim();
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return withoutAt || 'telegram-user';
}

function normalizeChatId(raw?: string) {
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function normalizeChatUsername(raw?: string) {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  return withoutAt.toLowerCase();
}

export function buildTelegramIngestor(sse: SSEBroker) {
  const { botToken, adminChatId, adminChatUsername, pollIntervalMs, fallbackAmount } = appConfig.telegram;
  const normalizedAdminChatId = normalizeChatId(adminChatId);
  const normalizedAdminChatUsername = normalizeChatUsername(adminChatUsername);

  if (!botToken || (!normalizedAdminChatId && !normalizedAdminChatUsername)) {
    return null;
  }

  return new TelegramIngestor(
    {
      botToken,
      adminChatId: normalizedAdminChatId,
      adminChatUsername: normalizedAdminChatUsername,
      pollIntervalMs,
      fallbackAmount,
    },
    sse,
  );
}
