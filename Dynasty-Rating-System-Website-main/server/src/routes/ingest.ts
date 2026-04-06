import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { SSEBroker } from '../sse';
import { processPurchase, recordIngestEvent } from '../services/rating';

const purchaseSchema = z.object({
  orderId: z.string().min(1).optional(),
  userId: z.string().optional(),
  nickname: z.string().min(2),
  phone: z.string().optional(),
  amount: z.number().positive(),
  items: z.array(z.string()).optional(),
  factionPreference: z.enum(['darkness', 'light']).optional(),
});

const toJsonValue = (value: unknown): Prisma.InputJsonValue | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((entry) => toJsonValue(entry));
  if (typeof value === 'object') {
    const record: Record<string, Prisma.InputJsonValue | null> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      record[key] = toJsonValue(entry);
    });
    return record;
  }
  return String(value);
};

export function createIngestRouter(deps: { sse: SSEBroker }) {
  const router = Router();

  const recordFailure = async (
    source: 'website' | 'telegram',
    payload: unknown,
    errorMessage: string,
    orderId?: string,
  ) => {
    try {
      await recordIngestEvent({
        source,
        status: 'error',
        orderId,
        rawPayload: { body: toJsonValue(payload), receivedAt: new Date().toISOString() },
        errorMessage,
      });
    } catch (error) {
      console.error('Failed to record ingest failure', error);
    }
  };

  router.post('/website', async (req, res) => {
    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId : undefined;
      await recordFailure('website', req.body, 'Invalid website payload', orderId);
      return res.status(400).json({ error: 'Invalid website payload', details: parsed.error.flatten() });
    }

    const payload = {
      ...parsed.data,
      source: 'website' as const,
      receivedAt: new Date().toISOString(),
    };

    try {
      const result = await processPurchase({
        ...payload,
        source: 'website',
      });

      if (result.duplicate) {
        return res.status(200).json({
          status: 'duplicate',
          source: 'website',
          duplicate: true,
          leaderboard: result.leaderboard,
          activity: result.activity,
          rules: result.rules,
          user: result.user,
        });
      }

      try {
        await recordIngestEvent({
          source: 'website',
          status: 'success',
          orderId: parsed.data.orderId,
          nickname: parsed.data.nickname,
          phone: parsed.data.phone,
          amount: parsed.data.amount,
          items: parsed.data.items,
          rawPayload: { body: toJsonValue(req.body), receivedAt: payload.receivedAt },
          userId: result.user?.id,
        });
      } catch (logError) {
        console.error('Failed to record ingest event', logError);
      }

      deps.sse.broadcast('purchase_ingested', {
        source: 'website',
        leaderboard: result.leaderboard,
        activity: result.activity,
        rules: result.rules,
      });

      return res.status(202).json({
        status: 'accepted',
        source: 'website',
        leaderboard: result.leaderboard,
        activity: result.activity,
        rules: result.rules,
        user: result.user,
      });
    } catch (error) {
      console.error(error);
      await recordFailure(
        'website',
        req.body,
        (error as Error).message || 'Failed to process website purchase',
        parsed.data.orderId,
      );
      return res.status(500).json({ error: (error as Error).message || 'Failed to process website purchase' });
    }
  });

  router.post('/telegram', async (req, res) => {
    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId : undefined;
      await recordFailure('telegram', req.body, 'Invalid Telegram payload', orderId);
      return res.status(400).json({ error: 'Invalid Telegram payload', details: parsed.error.flatten() });
    }

    const payload = {
      ...parsed.data,
      source: 'telegram' as const,
      receivedAt: new Date().toISOString(),
    };

    try {
      const result = await processPurchase({
        ...payload,
        source: 'telegram',
      });

      if (result.duplicate) {
        return res.status(200).json({
          status: 'duplicate',
          source: 'telegram',
          duplicate: true,
          leaderboard: result.leaderboard,
          activity: result.activity,
          rules: result.rules,
          user: result.user,
        });
      }

      try {
        await recordIngestEvent({
          source: 'telegram',
          status: 'success',
          orderId: parsed.data.orderId,
          nickname: parsed.data.nickname,
          phone: parsed.data.phone,
          amount: parsed.data.amount,
          items: parsed.data.items,
          rawPayload: { body: toJsonValue(req.body), receivedAt: payload.receivedAt },
          userId: result.user?.id,
        });
      } catch (logError) {
        console.error('Failed to record ingest event', logError);
      }

      deps.sse.broadcast('purchase_ingested', {
        source: 'telegram',
        leaderboard: result.leaderboard,
        activity: result.activity,
        rules: result.rules,
      });

      return res.status(202).json({
        status: 'accepted',
        source: 'telegram',
        leaderboard: result.leaderboard,
        activity: result.activity,
        rules: result.rules,
        user: result.user,
      });
    } catch (error) {
      console.error(error);
      await recordFailure(
        'telegram',
        req.body,
        (error as Error).message || 'Failed to process Telegram purchase',
        parsed.data.orderId,
      );
      return res.status(500).json({ error: (error as Error).message || 'Failed to process Telegram purchase' });
    }
  });

  return router;
}
