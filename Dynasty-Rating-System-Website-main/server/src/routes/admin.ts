import { Router } from 'express';
import { z } from 'zod';
import jwt, { SignOptions } from 'jsonwebtoken';
import { SSEBroker } from '../sse';
import { appConfig } from '../config';
import { adjustRating, deleteUser, getActivityInsights, getIngestEvents, getPurchaseAudit, getRankHistory, manualAdd, updateRules, updateUserProfile } from '../services/rating';

const toDateInputValue = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return '';
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const getTodayInputValue = () => {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const isJoinDateAllowed = (value?: string) => {
  if (value === undefined) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  const dateValue = toDateInputValue(trimmed);
  if (!dateValue) return false;
  return dateValue <= getTodayInputValue();
};

const adjustmentSchema = z.object({
  userId: z.string(),
  delta: z.number().refine((value) => value !== 0, 'delta cannot be zero'),
  reason: z.string().min(3),
});

const rulesSchema = z.object({
  basePointsPerDollar: z.number().nonnegative().optional(),
  websiteBonusPercent: z.number().int().optional(),
  telegramBonusPercent: z.number().int().optional(),
  highValueThreshold: z.number().nonnegative().optional(),
  highValueBonusPercent: z.number().int().optional(),
  decayPerDay: z.number().min(0).optional(),
});

const manualAddSchema = z.object({
  id: z.string().optional(),
  nickname: z.string().min(2),
  rating: z.number().nonnegative(),
  faction: z.enum(['darkness', 'light']),
  tier: z.enum(['legendary', 'noble', 'treasure']).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional(),
  joinDate: z.string().optional().refine(isJoinDateAllowed, {
    message: 'Join date cannot be in the future',
  }),
  purchases: z.number().int().nonnegative().optional(),
});

const userUpdateSchema = z.object({
  nickname: z.string().min(2).optional(),
  phone: z.string().optional(),
  faction: z.enum(['darkness', 'light']).optional(),
  tier: z.enum(['legendary', 'noble', 'treasure']).optional(),
  avatar: z.string().url().optional(),
  joinDate: z.string().optional().refine(isJoinDateAllowed, {
    message: 'Join date cannot be in the future',
  }),
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export function createAdminRouter(deps: { sse: SSEBroker }) {
  const router = Router();
  const adminToken = appConfig.admin.token;
  const adminUsername = appConfig.admin.username;
  const adminPassword = appConfig.admin.password;
  const adminJwtSecret = appConfig.admin.jwtSecret;
  const adminJwtTtl = appConfig.admin.jwtTtl;
  const requireJwt = Boolean(adminJwtSecret && adminUsername && adminPassword);
  const MAX_AUDIT_LIMIT = 200;
  const normalizeJwtTtl = (value?: string): SignOptions['expiresIn'] | undefined => {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && String(numeric) === trimmed) return numeric;
    return trimmed as SignOptions['expiresIn'];
  };
  const jwtTtl = normalizeJwtTtl(adminJwtTtl);

  router.post('/login', (req, res) => {
    if (!adminJwtSecret || !adminUsername || !adminPassword) {
      return res.status(503).json({ error: 'Admin login is not configured' });
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid login payload', details: parsed.error.flatten() });
    }

    if (parsed.data.username !== adminUsername || parsed.data.password !== adminPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ sub: adminUsername, role: 'admin' }, adminJwtSecret, jwtTtl ? { expiresIn: jwtTtl } : undefined);
    return res.status(200).json({ token, tokenType: 'Bearer', expiresIn: adminJwtTtl });
  });

  router.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : undefined;
    const tokenFromAltHeader = req.headers['x-admin-token'] as string | undefined;
    const providedToken = tokenFromHeader ?? tokenFromAltHeader;

    if (providedToken && adminJwtSecret) {
      try {
        jwt.verify(providedToken, adminJwtSecret);
        return next();
      } catch (error) {
        // Fall through to shared token check.
      }
    }

    if (adminToken && providedToken && providedToken.trim() === adminToken) {
      return next();
    }

    if (requireJwt) {
      return res.status(401).json({ error: 'Admin session required' });
    }

    if (!adminToken) {
      return res.status(503).json({ error: 'ADMIN_API_TOKEN is not configured' });
    }

    return res.status(401).json({ error: 'Unauthorized' });
  });

  router.get('/ping', (_req, res) => {
    return res.status(200).json({ status: 'ok' });
  });

  router.get('/purchases', async (req, res) => {
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : NaN;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_AUDIT_LIMIT) : 120;
    const sourceRaw = typeof req.query.source === 'string' ? req.query.source : undefined;
    const source = sourceRaw === 'website' || sourceRaw === 'telegram' ? sourceRaw : undefined;

    try {
      const purchases = await getPurchaseAudit({ limit, source });
      return res.status(200).json({ purchases });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: (error as Error).message || 'Failed to load purchases' });
    }
  });

  router.get('/ingest-events', async (req, res) => {
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : NaN;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_AUDIT_LIMIT) : 120;
    const sourceRaw = typeof req.query.source === 'string' ? req.query.source : undefined;
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const source = sourceRaw === 'website' || sourceRaw === 'telegram' ? sourceRaw : undefined;
    const status = statusRaw === 'success' || statusRaw === 'error' ? statusRaw : undefined;

    try {
      const events = await getIngestEvents({ limit, source, status });
      return res.status(200).json({ events });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: (error as Error).message || 'Failed to load ingest events' });
    }
  });

  router.get('/rank-history', async (req, res) => {
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : NaN;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_AUDIT_LIMIT) : 120;
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined;

    try {
      const history = await getRankHistory({ limit, userId });
      return res.status(200).json({ history });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: (error as Error).message || 'Failed to load rank history' });
    }
  });

  router.get('/activity-insights', async (req, res) => {
    const daysRaw = typeof req.query.days === 'string' ? Number(req.query.days) : NaN;
    const days = Number.isFinite(daysRaw) && daysRaw > 0 ? Math.min(daysRaw, 30) : 7;

    try {
      const insights = await getActivityInsights({ days });
      return res.status(200).json(insights);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: (error as Error).message || 'Failed to load activity insights' });
    }
  });

  router.post('/adjust', async (req, res) => {
    const parsed = adjustmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid adjustment payload', details: parsed.error.flatten() });
    }

    try {
      const result = await adjustRating(parsed.data);

      deps.sse.broadcast('rating_adjusted', {
        ...parsed.data,
        leaderboard: result.leaderboard,
        activity: result.activity,
      });

      return res.status(200).json({
        status: 'ok',
        leaderboard: result.leaderboard,
        activity: result.activity,
        rules: result.rules,
        user: result.user,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: (error as Error).message || 'Failed to adjust rating' });
    }
  });

  router.patch('/rules', async (req, res) => {
    const parsed = rulesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid rules payload', details: parsed.error.flatten() });
    }

    try {
      const result = await updateRules(parsed.data);

      deps.sse.broadcast('rules_updated', {
        rules: result.rules,
        leaderboard: result.leaderboard,
      });

      return res.status(200).json({
        status: 'ok',
        rules: result.rules,
        leaderboard: result.leaderboard,
        activity: result.activity,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: (error as Error).message || 'Failed to update rules' });
    }
  });

  router.post('/manual-add', async (req, res) => {
    const parsed = manualAddSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid manual add payload', details: parsed.error.flatten() });
    }

    try {
      const result = await manualAdd(parsed.data);

      deps.sse.broadcast('user_added', {
        user: result.user,
        leaderboard: result.leaderboard,
        activity: result.activity,
      });

      return res.status(200).json({
        status: 'ok',
        user: result.user,
        leaderboard: result.leaderboard,
        activity: result.activity,
        rules: result.rules,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: (error as Error).message || 'Failed to add user' });
    }
  });

  router.patch('/users/:id', async (req, res) => {
    const parsed = userUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid user update payload', details: parsed.error.flatten() });
    }

    if (Object.keys(parsed.data).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update' });
    }

    const sanitize = (value?: string) => (value && value.trim().length > 0 ? value : undefined);

    try {
      const result = await updateUserProfile({
        userId: req.params.id,
        nickname: sanitize(parsed.data.nickname),
        phone: sanitize(parsed.data.phone),
        faction: parsed.data.faction,
        tier: parsed.data.tier,
        avatar: sanitize(parsed.data.avatar),
        joinDate: sanitize(parsed.data.joinDate),
      });

      deps.sse.broadcast('user_updated', {
        leaderboard: result.leaderboard,
        activity: result.activity,
        rules: result.rules,
      });

      return res.status(200).json({
        status: 'ok',
        leaderboard: result.leaderboard,
        activity: result.activity,
        rules: result.rules,
        user: result.user,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: (error as Error).message || 'Failed to update user' });
    }
  });

  router.delete('/users/:id', async (req, res) => {
    try {
      const result = await deleteUser(req.params.id);

      deps.sse.broadcast('user_deleted', {
        leaderboard: result.leaderboard,
        activity: result.activity,
        rules: result.rules,
      });

      return res.status(200).json({
        status: 'ok',
        leaderboard: result.leaderboard,
        activity: result.activity,
        rules: result.rules,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: (error as Error).message || 'Failed to delete user' });
    }
  });

  return router;
}
