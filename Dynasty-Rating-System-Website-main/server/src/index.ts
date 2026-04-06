import express from 'express';
import cors from 'cors';
import { appConfig } from './config';
import { SSEBroker } from './sse';
import { createIngestRouter } from './routes/ingest';
import { createAdminRouter } from './routes/admin';
import { pingDatabase } from './db';
import { getLeaderboard, getRules } from './services/rating';
import { PrismaClient } from '@prisma/client';
import { buildTelegramIngestor } from './services/telegramIngest';

const app = express();
const sse = new SSEBroker();
const prisma = new PrismaClient();
const telegramIngestor = buildTelegramIngestor(sse);

app.use(cors());
app.use(express.json());

app.get('/health', async (_req, res) => {
  const db = await pingDatabase();
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    db,
  });
});

app.get('/events', (req, res) => sse.handleClient(req, res));

app.use('/ingest', createIngestRouter({ sse }));
app.use('/admin', createAdminRouter({ sse }));

// Public read endpoints
app.get('/leaderboard', async (_req, res) => {
  try {
    const result = await getLeaderboard();
    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message || 'Failed to load leaderboard' });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        ratingHistory: { orderBy: { timestamp: 'desc' }, take: 25 },
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message || 'Failed to load user' });
  }
});

app.get('/rules', async (_req, res) => {
  try {
    const rules = await getRules();
    res.json(rules);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message || 'Failed to load rules' });
  }
});

app.get('/activity', async (_req, res) => {
  try {
    const activity = await prisma.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 120,
      select: {
        id: true,
        type: true,
        userId: true,
        userNickname: true,
        description: true,
        source: true,
        amount: true,
        delta: true,
        timestamp: true,
      },
    });
    res.json(activity);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message || 'Failed to load activity' });
  }
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(appConfig.port, () => {
  console.log(`API running on http://localhost:${appConfig.port}`);
});

telegramIngestor?.start().catch((error) => {
  console.error('Failed to start Telegram ingestor', error);
});

['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, () => {
    console.log(`Received ${signal}, closing.`);
    sse.close();
    telegramIngestor?.stop();
    server.close(() => process.exit(0));
  });
});
