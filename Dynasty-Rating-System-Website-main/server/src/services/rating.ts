import {
  PrismaClient,
  Prisma,
  type Faction,
  type PurchaseSource,
  type Tier,
  type User,
  type Rules,
} from '@prisma/client';
import { normalizePhone } from '../lib/phone';

const prisma = new PrismaClient();

const DEFAULT_RULES: Omit<Rules, 'id' | 'updatedAt'> = {
  basePointsPerDollar: 2,
  websiteBonusPercent: 5,
  telegramBonusPercent: 8,
  highValueThreshold: 750,
  highValueBonusPercent: 12,
  decayPerDay: 0,
};

const ACTIVITY_LIMIT = 120;
const TX_TIMEOUT_MS = 20_000;
const LEGENDARY_PER_SIDE = 6;
const NOBLE_PER_SIDE = 12;
const TREASURE_PER_SIDE = 22;

export interface PurchaseInput {
  orderId?: string;
  userId?: string;
  nickname: string;
  phone?: string;
  amount: number;
  source: PurchaseSource;
  items?: string[];
  factionPreference?: Faction;
}

export interface ManualAddInput {
  id?: string;
  nickname: string;
  rating: number;
  faction: Faction;
  tier?: Tier;
  phone?: string;
  avatar?: string;
  joinDate?: string;
  purchases?: number;
}

export interface AdjustmentInput {
  userId: string;
  delta: number;
  reason: string;
}

export interface RulesInput {
  basePointsPerDollar?: number;
  websiteBonusPercent?: number;
  telegramBonusPercent?: number;
  highValueThreshold?: number;
  highValueBonusPercent?: number;
  decayPerDay?: number;
}

export interface UserUpdateInput {
  userId: string;
  nickname?: string;
  phone?: string;
  faction?: Faction;
  tier?: Tier;
  avatar?: string;
  joinDate?: string;
}

export interface RatingResult {
  leaderboard: User[];
  activity: Prisma.ActivityLogGetPayload<{ select: typeof ACTIVITY_SELECT }>[];
  rules: Rules;
  user?: User;
  duplicate?: boolean;
}

export interface ActivityInsightsResult {
  windowDays: number;
  purchases: number;
  adjustments: number;
  totalDelta: number;
  topMovers: { nickname: string; delta: number }[];
  lastUpdate?: string;
}

export interface IngestEventInput {
  source: PurchaseSource;
  status: 'success' | 'error';
  rawPayload: Prisma.InputJsonValue;
  orderId?: string;
  nickname?: string;
  phone?: string;
  amount?: number;
  items?: string[];
  errorMessage?: string;
  userId?: string;
}

const ACTIVITY_SELECT = {
  id: true,
  type: true,
  userId: true,
  userNickname: true,
  description: true,
  source: true,
  amount: true,
  delta: true,
  timestamp: true,
} as const;

export async function getLeaderboard(): Promise<RatingResult> {
  const [leaderboard, activity, rules] = await Promise.all([
    refreshRanks(prisma),
    prisma.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: ACTIVITY_LIMIT,
      select: ACTIVITY_SELECT,
    }),
    ensureRules(),
  ]);

  return { leaderboard, activity, rules };
}

export async function processPurchase(payload: PurchaseInput): Promise<RatingResult> {
  const normalizedNickname = payload.nickname.trim();
  const normalizedPhone = normalizePhone(payload.phone);
  const normalizedPayload: PurchaseInput = {
    ...payload,
    nickname: normalizedNickname,
    phone: normalizedPhone,
  };
  const amount = Math.max(0, Math.round(payload.amount));
  if (!amount) {
    throw new Error('Amount must be greater than zero.');
  }

  const orderId = payload.orderId?.trim() || undefined;
  if (orderId) {
    const existingPurchase = await prisma.purchase.findUnique({ where: { orderId } });
    if (existingPurchase) {
      const result = await buildRatingResult(existingPurchase.userId);
      return { ...result, duplicate: true };
    }
  }

  const rules = await ensureRules();
  const delta = calculateRatingDelta(amount, payload.source, rules);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await findUser(tx, normalizedPayload);
      let user: User;

      if (!existing) {
        user = await createUserFromPurchase(tx, normalizedPayload, delta);
      } else {
        user = await updateUserFromPurchase(tx, existing, normalizedPayload, delta);
      }

      await tx.purchase.create({
        data: {
          userId: user.id,
          amount,
          orderId,
          source: payload.source,
          factionPreference: payload.factionPreference,
          ratingDelta: delta,
          items: payload.items ?? [],
        },
      });

      await tx.ratingSnapshot.create({
        data: {
          userId: user.id,
          amount: payload.amount,
          rating: user.rating,
          source: payload.source,
        },
      });

      await tx.activityLog.create({
        data: {
          type: 'purchase',
          userId: user.id,
          userNickname: normalizedNickname,
          description: `${capitalize(payload.source)} purchase ${formatCurrency(amount)} (+${delta} pts)`,
          source: payload.source,
          amount,
          delta,
        },
      });

      const leaderboard = await refreshRanks(tx);
      const activity = await tx.activityLog.findMany({
        orderBy: { timestamp: 'desc' },
        take: ACTIVITY_LIMIT,
        select: ACTIVITY_SELECT,
      });

      return { leaderboard, activity, rules, user };
    }, { timeout: TX_TIMEOUT_MS });

    return result;
  } catch (error) {
    if (orderId && isOrderIdConflict(error)) {
      const existingPurchase = await prisma.purchase.findUnique({ where: { orderId } });
      if (existingPurchase) {
        const result = await buildRatingResult(existingPurchase.userId);
        return { ...result, duplicate: true };
      }
    }
    throw error;
  }
}

export async function manualAdd(input: ManualAddInput): Promise<RatingResult> {
  const nowIso = new Date().toISOString();
  const rating = Math.max(0, Math.round(input.rating));
  const phone = normalizePhone(input.phone);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        id: input.id,
        nickname: input.nickname.trim(),
        rating,
        faction: input.faction,
        tier: input.tier ?? determineTier(rating),
        rank: 0,
        avatar: input.avatar,
        joinDate: input.joinDate ? new Date(input.joinDate) : new Date(nowIso),
        purchases: input.purchases ?? 0,
        achievements: input.purchases && input.purchases > 0 ? ['First Purchase'] : [],
        phone,
        lastActive: new Date(nowIso),
        lastPurchaseAt: input.purchases && input.purchases > 0 ? new Date(nowIso) : null,
        preferredChannel: null,
        totalVolume: (input.purchases ?? 0) * 120,
      },
    });

    await tx.ratingSnapshot.create({
      data: {
        userId: user.id,
        rating,
        timestamp: new Date(nowIso),
      },
    });

    await tx.activityLog.create({
      data: {
        type: 'manual_add',
        userId: user.id,
        userNickname: user.nickname,
        description: `Admin added ${user.nickname} to ${capitalize(user.faction)} faction`,
        timestamp: new Date(nowIso),
      },
    });

    const leaderboard = await refreshRanks(tx);
    const activity = await tx.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: ACTIVITY_LIMIT,
      select: ACTIVITY_SELECT,
    });

    const rules = await ensureRules(tx);

    return { leaderboard, activity, rules, user };
  }, { timeout: TX_TIMEOUT_MS });

  return result;
}

export async function adjustRating(input: AdjustmentInput): Promise<RatingResult> {
  const delta = Math.round(input.delta);
  if (delta === 0) throw new Error('Delta cannot be zero.');

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id: input.userId } });
    if (!existing) {
      throw new Error('User not found.');
    }

    const updatedRating = Math.max(0, existing.rating + delta);

    await tx.user.update({
      where: { id: input.userId },
      data: {
        rating: updatedRating,
        lastActive: new Date(),
      },
    });

    await tx.ratingSnapshot.create({
      data: {
        userId: existing.id,
        rating: updatedRating,
      },
    });

    await tx.activityLog.create({
      data: {
        type: 'adjustment',
        userId: existing.id,
        userNickname: existing.nickname,
        description: `${delta >= 0 ? 'Manual bonus' : 'Manual deduction'} (${input.reason})`,
        delta,
      },
    });

    const leaderboard = await refreshRanks(tx);
    const activity = await tx.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: ACTIVITY_LIMIT,
      select: ACTIVITY_SELECT,
    });

    const rules = await ensureRules(tx);
    const user = leaderboard.find((u) => u.id === existing.id);

    return { leaderboard, activity, rules, user };
  }, { timeout: TX_TIMEOUT_MS });

  return result;
}

export async function updateRules(input: RulesInput): Promise<RatingResult> {
  const rules = await ensureRules();
  const next = await prisma.rules.update({
    where: { id: rules.id },
    data: {
      ...input,
    },
  });

  const leaderboard = await refreshRanks(prisma);
  const activity = await prisma.activityLog.findMany({
    orderBy: { timestamp: 'desc' },
    take: ACTIVITY_LIMIT,
    select: ACTIVITY_SELECT,
  });

  await prisma.activityLog.create({
    data: {
      type: 'rule_change',
      userNickname: 'System',
      description: 'Rating rules updated by admin',
    },
  });

  return { leaderboard, activity, rules: next };
}

export async function updateUserProfile(input: UserUpdateInput): Promise<RatingResult> {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id: input.userId } });
    if (!existing) {
      throw new Error('User not found.');
    }

    const phone = normalizePhone(input.phone);
    const updated = await tx.user.update({
      where: { id: input.userId },
      data: {
        nickname: input.nickname?.trim() ?? undefined,
        phone: phone ?? undefined,
        faction: input.faction ?? undefined,
        tier: input.tier ?? undefined,
        avatar: input.avatar ?? undefined,
        joinDate: input.joinDate ? new Date(input.joinDate) : undefined,
        lastActive: new Date(),
      },
    });

    await tx.activityLog.create({
      data: {
        type: 'adjustment',
        userId: updated.id,
        userNickname: updated.nickname,
        description: `Admin updated profile for ${updated.nickname}`,
      },
    });

    const leaderboard = await refreshRanks(tx);
    const activity = await tx.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: ACTIVITY_LIMIT,
      select: ACTIVITY_SELECT,
    });
    const rules = await ensureRules(tx);

    return { leaderboard, activity, rules, user: updated };
  }, { timeout: TX_TIMEOUT_MS });

  return result;
}

export async function deleteUser(userId: string): Promise<RatingResult> {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { id: userId } });
    if (!existing) {
      throw new Error('User not found.');
    }

    await tx.activityLog.updateMany({
      where: { userId },
      data: { userId: null },
    });

    await tx.ingestEvent.updateMany({
      where: { userId },
      data: { userId: null },
    });

    await tx.rankHistory.deleteMany({ where: { userId } });

    await tx.purchase.deleteMany({ where: { userId } });
    await tx.ratingSnapshot.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });

    await tx.activityLog.create({
      data: {
        type: 'adjustment',
        userNickname: existing.nickname,
        description: `Admin removed ${existing.nickname}`,
        delta: -existing.rating,
      },
    });

    const leaderboard = await refreshRanks(tx);
    const activity = await tx.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: ACTIVITY_LIMIT,
      select: ACTIVITY_SELECT,
    });
    const rules = await ensureRules(tx);

    return { leaderboard, activity, rules };
  }, { timeout: TX_TIMEOUT_MS });

  return result;
}

export async function getRules(): Promise<Rules> {
  return ensureRules();
}

export async function recordIngestEvent(input: IngestEventInput) {
  const amount = input.amount !== undefined ? Math.max(0, Math.round(input.amount)) : undefined;
  const phone = normalizePhone(input.phone);

  return prisma.ingestEvent.create({
    data: {
      source: input.source,
      status: input.status,
      orderId: input.orderId,
      nickname: input.nickname?.trim() ?? undefined,
      phone: phone ?? undefined,
      amount,
      items: input.items ?? [],
      rawPayload: input.rawPayload,
      errorMessage: input.errorMessage,
      userId: input.userId,
    },
  });
}

export async function getIngestEvents(options: { limit: number; source?: PurchaseSource; status?: 'success' | 'error' }) {
  const { limit, source, status } = options;
  return prisma.ingestEvent.findMany({
    where: {
      ...(source ? { source } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          rank: true,
          faction: true,
          tier: true,
        },
      },
    },
  });
}

export async function getRankHistory(options: { limit: number; userId?: string }) {
  const { limit, userId } = options;
  return prisma.rankHistory.findMany({
    where: userId ? { userId } : undefined,
    orderBy: { timestamp: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          rank: true,
          faction: true,
          tier: true,
        },
      },
    },
  });
}

export async function getPurchaseAudit(options: { limit: number; source?: PurchaseSource }) {
  const { limit, source } = options;

  return prisma.purchase.findMany({
    where: source ? { source } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          nickname: true,
          phone: true,
          faction: true,
          tier: true,
          rank: true,
        },
      },
    },
  });
}

export async function getActivityInsights(options: { days?: number } = {}): Promise<ActivityInsightsResult> {
  const rawDays = options.days ?? 7;
  const windowDays = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 30) : 7;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const activity = await prisma.activityLog.findMany({
    where: { timestamp: { gte: since } },
    orderBy: { timestamp: 'desc' },
    select: {
      type: true,
      userId: true,
      userNickname: true,
      delta: true,
      timestamp: true,
    },
  });

  const purchases = activity.filter((entry) => entry.type === 'purchase').length;
  const adjustments = activity.filter((entry) => entry.type === 'adjustment').length;
  const totalDelta = activity.reduce((sum, entry) => sum + (entry.delta ?? 0), 0);

  const moversMap = new Map<string, { nickname: string; delta: number }>();
  for (const entry of activity) {
    if (!entry.userId || typeof entry.delta !== 'number') continue;
    const existing = moversMap.get(entry.userId);
    const nextDelta = (existing?.delta ?? 0) + entry.delta;
    moversMap.set(entry.userId, { nickname: entry.userNickname, delta: nextDelta });
  }

  const topMovers = Array.from(moversMap.values())
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 3);

  const lastUpdate = activity[0]?.timestamp ? activity[0].timestamp.toISOString() : undefined;

  return {
    windowDays,
    purchases,
    adjustments,
    totalDelta,
    topMovers,
    lastUpdate,
  };
}

async function buildRatingResult(userId?: string): Promise<RatingResult> {
  const [leaderboard, activity, rules, user] = await Promise.all([
    prisma.user.findMany({ orderBy: { rank: 'asc' } }),
    prisma.activityLog.findMany({ orderBy: { timestamp: 'desc' }, take: ACTIVITY_LIMIT, select: ACTIVITY_SELECT }),
    ensureRules(),
    userId ? prisma.user.findUnique({ where: { id: userId } }) : Promise.resolve(undefined),
  ]);

  return { leaderboard, activity, rules, user: user ?? undefined };
}

function isOrderIdConflict(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2002') return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes('orderId');
  if (typeof target === 'string') return target.includes('orderId');
  return false;
}

async function ensureRules(tx?: PrismaClient | Prisma.TransactionClient): Promise<Rules> {
  const client = tx ?? prisma;
  return client.rules.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, ...DEFAULT_RULES },
  });
}

async function findUser(
  tx: PrismaClient | Prisma.TransactionClient,
  payload: PurchaseInput,
): Promise<User | null> {
  return tx.user.findFirst({
    where: {
      OR: [
        payload.userId ? { id: payload.userId } : undefined,
        payload.phone ? { phone: payload.phone } : undefined,
        { nickname: { equals: payload.nickname.trim(), mode: 'insensitive' } },
      ].filter(Boolean) as Prisma.UserWhereInput[],
    },
  });
}

async function createUserFromPurchase(
  tx: PrismaClient | Prisma.TransactionClient,
  payload: PurchaseInput,
  gain: number,
): Promise<User> {
  const now = new Date();
  const faction = payload.factionPreference ?? (await resolveFaction(tx));

  const user = await tx.user.create({
    data: {
      id: payload.userId,
      nickname: payload.nickname.trim(),
      rating: gain,
      rank: 0,
      faction,
      tier: determineTier(gain),
      avatar: buildAvatarUrl(payload.nickname),
      joinDate: now,
      purchases: 1,
      achievements: ['First Purchase'],
      phone: payload.phone,
      lastPurchaseAt: now,
      lastActive: now,
      preferredChannel: payload.source,
      totalVolume: payload.amount,
    },
  });

  return user;
}

async function updateUserFromPurchase(
  tx: PrismaClient | Prisma.TransactionClient,
  user: User,
  payload: PurchaseInput,
  gain: number,
): Promise<User> {
  const now = new Date();
  const phone = payload.phone ?? undefined;
  const shouldUpdatePhone = Boolean(phone && phone !== user.phone);
  const updated = await tx.user.update({
    where: { id: user.id },
    data: {
      rating: user.rating + gain,
      purchases: user.purchases + 1,
      totalVolume: (user.totalVolume ?? 0) + payload.amount,
      lastPurchaseAt: now,
      lastActive: now,
      preferredChannel: payload.source,
      ...(shouldUpdatePhone ? { phone } : {}),
    },
  });

  return updated;
}

async function refreshRanks(
  tx: PrismaClient | Prisma.TransactionClient,
): Promise<User[]> {
  const users = await tx.user.findMany({
    orderBy: { rating: 'desc' },
  });
  const tierById = buildSlotTierMap(users);

  const updated: User[] = [];
  const rankHistory: Prisma.RankHistoryCreateManyInput[] = [];
  const now = new Date();

  for (let i = 0; i < users.length; i += 1) {
    const user = users[i];
    const rank = i + 1;
    const tier = tierById.get(user.id) ?? 'treasure';
    const achievements = refreshAchievements(user, rank);
    const achievementsChanged =
      achievements.length !== user.achievements.length ||
      achievements.some((value, index) => value !== user.achievements[index]);
    const needsUpdate = user.rank !== rank || user.tier !== tier || achievementsChanged;

    if (user.rank !== rank) {
      rankHistory.push({
        userId: user.id,
        fromRank: user.rank,
        toRank: rank,
        rating: user.rating,
        timestamp: now,
      });
    }

    if (needsUpdate) {
      const next = await tx.user.update({
        where: { id: user.id },
        data: { rank, tier, achievements },
      });
      updated.push(next);
    } else {
      updated.push(user);
    }
  }

  if (rankHistory.length) {
    await tx.rankHistory.createMany({ data: rankHistory });
  }

  return updated.sort((a, b) => a.rank - b.rank);
}

function buildSlotTierMap(users: User[]): Map<string, Tier> {
  const tierById = new Map<string, Tier>();
  if (users.length === 0) return tierById;

  const winner = users[0];
  tierById.set(winner.id, 'legendary');

  const darkness: User[] = [];
  const light: User[] = [];
  for (const user of users) {
    if (user.id === winner.id) continue;
    if (user.faction === 'darkness') {
      darkness.push(user);
    } else {
      light.push(user);
    }
  }

  const assignTier = (list: User[], start: number, count: number, tier: Tier) => {
    const end = Math.min(list.length, start + count);
    for (let i = start; i < end; i += 1) {
      tierById.set(list[i].id, tier);
    }
  };

  assignTier(darkness, 0, LEGENDARY_PER_SIDE, 'legendary');
  assignTier(light, 0, LEGENDARY_PER_SIDE, 'legendary');
  assignTier(darkness, LEGENDARY_PER_SIDE, NOBLE_PER_SIDE, 'noble');
  assignTier(light, LEGENDARY_PER_SIDE, NOBLE_PER_SIDE, 'noble');
  assignTier(darkness, LEGENDARY_PER_SIDE + NOBLE_PER_SIDE, TREASURE_PER_SIDE, 'treasure');
  assignTier(light, LEGENDARY_PER_SIDE + NOBLE_PER_SIDE, TREASURE_PER_SIDE, 'treasure');

  for (const user of users) {
    if (!tierById.has(user.id)) {
      tierById.set(user.id, 'treasure');
    }
  }

  return tierById;
}

function calculateRatingDelta(amount: number, source: PurchaseSource, rules: Rules): number {
  const base = amount * rules.basePointsPerDollar;
  const sourceBonusPercent = source === 'telegram' ? rules.telegramBonusPercent : rules.websiteBonusPercent;
  let total = base + (base * sourceBonusPercent) / 100;

  if (amount >= rules.highValueThreshold) {
    total += (base * rules.highValueBonusPercent) / 100;
  }

  return Math.round(total);
}

function determineTier(rating: number): Tier {
  if (rating >= 9000) return 'legendary';
  if (rating >= 7500) return 'noble';
  return 'treasure';
}

function refreshAchievements(user: User, rank: number): string[] {
  const achievements = new Set<string>(user.achievements ?? []);

  if (user.purchases > 0) achievements.add('First Purchase');
  if (rank <= 10) achievements.add('Top 10');
  if (rank <= 3) achievements.add('Podium Elite');
  if (user.rating >= 10000) achievements.add('Gold Tier');
  if ((user.totalVolume ?? 0) >= 25000) achievements.add('High Roller');
  if (user.purchases >= 100) achievements.add('Centurion Shopper');

  return Array.from(achievements);
}

async function resolveFaction(tx: PrismaClient | Prisma.TransactionClient): Promise<Faction> {
  const [darknessCount, lightCount] = await Promise.all([
    tx.user.count({ where: { faction: 'darkness' } }),
    tx.user.count({ where: { faction: 'light' } }),
  ]);

  if (darknessCount === lightCount) {
    return Math.random() > 0.5 ? 'darkness' : 'light';
  }
  return darknessCount <= lightCount ? 'darkness' : 'light';
}

function buildAvatarUrl(nickname: string) {
  const seed = encodeURIComponent(nickname.trim() || `member-${Date.now()}`);
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}
