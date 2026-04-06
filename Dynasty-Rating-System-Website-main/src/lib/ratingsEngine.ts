import { useReducer, useCallback, useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { normalizePhone } from './phone';
import type { User, Faction, Tier, RatingSnapshot } from '../types/user';
import type {
  ActivityLogEntry,
  ActivityInsightsPayload,
  IngestEventEntry,
  ManualUserPayload,
  PurchaseAuditEntry,
  PurchasePayload,
  PurchaseSource,
  RankHistoryEntry,
  RatingAdjustmentPayload,
  RatingRules,
} from '../types/system';

interface RatingsState {
  users: User[];
  rules: RatingRules;
  activityLog: ActivityLogEntry[];
}

type RatingsAction =
  | { type: 'REGISTER_PURCHASE'; payload: PurchasePayload }
  | { type: 'MANUAL_ADD'; payload: ManualUserPayload }
  | { type: 'ADJUST_RATING'; payload: RatingAdjustmentPayload }
  | { type: 'UPDATE_USER'; payload: { userId: string; updates: Partial<User> } }
  | { type: 'DELETE_USER'; payload: { userId: string } }
  | { type: 'UPDATE_RULES'; payload: Partial<RatingRules> }
  | { type: 'HYDRATE'; payload: RatingsState };

const HISTORY_LIMIT = 25;
const LOG_LIMIT = 80;
const LEGENDARY_PER_SIDE = 6;
const NOBLE_PER_SIDE = 12;
const TREASURE_PER_SIDE = 22;

export const defaultRatingRules: RatingRules = {
  basePointsPerDollar: 2,
  websiteBonusPercent: 5,
  telegramBonusPercent: 8,
  highValueThreshold: 750,
  highValueBonusPercent: 12,
  decayPerDay: 0,
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function getApiBase() {
  const envBase = (import.meta as any)?.env?.VITE_API_BASE as string | undefined;
  if (envBase && envBase.trim().length > 0) return envBase.trim();
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:4000';
    }
  }
  return undefined;
}

export function useRatingsEngine(seedUsers: User[]) {
  const [state, dispatch] = useReducer(ratingsReducer, seedUsers, createInitialState);
  const [serverAvailable, setServerAvailable] = useState(false);
  const [lastEventAt, setLastEventAt] = useState<string | null>(null);
  const rulesRef = useRef(state.rules);
  const activityRef = useRef(state.activityLog);

  useEffect(() => {
    rulesRef.current = state.rules;
  }, [state.rules]);

  useEffect(() => {
    activityRef.current = state.activityLog;
  }, [state.activityLog]);

  const addUser = useCallback((payload: ManualUserPayload) => {
    const cleanPayload = normalizeManualUserPayload(payload);
    const apiBase = getApiBase();
    if (apiBase) {
      sendManualAdd(apiBase, cleanPayload)
        .then((snapshot) => {
          if (snapshot) {
            dispatch({ type: 'HYDRATE', payload: snapshot });
          }
        })
        .catch((error) => {
          console.error('manual-add failed', error);
          toast.error(normalizeErrorMessage(error, 'Manual add failed'));
        });
      return;
    }
    dispatch({ type: 'MANUAL_ADD', payload: cleanPayload });
  }, []);

  const registerPurchase = useCallback((payload: PurchasePayload) => {
    const apiBase = getApiBase();
    const cleanPayload = normalizePurchasePayload(payload);

    if (apiBase) {
      sendPurchase(apiBase, cleanPayload)
        .then((snapshot) => {
          if (snapshot) {
            dispatch({ type: 'HYDRATE', payload: snapshot });
            return;
          }

          // If backend responded but didn't return a snapshot, keep UI responsive locally.
          dispatch({ type: 'REGISTER_PURCHASE', payload: cleanPayload });
        })
        .catch((error) => {
          console.error('register purchase failed', error);
          // Network/backend failures should not make the demo UI look broken.
          dispatch({ type: 'REGISTER_PURCHASE', payload: cleanPayload });
          toast.error('Backend unavailable: purchase applied locally');
        });
      return;
    }
    dispatch({ type: 'REGISTER_PURCHASE', payload: cleanPayload });
  }, []);

  const adjustRating = useCallback(async (payload: RatingAdjustmentPayload) => {
    const apiBase = getApiBase();
    if (apiBase) {
      try {
        const snapshot = await sendAdjust(apiBase, payload);
        if (snapshot) {
          dispatch({ type: 'HYDRATE', payload: snapshot });
        }
        return true;
      } catch (error) {
        console.error('adjust failed', error);
        toast.error(normalizeErrorMessage(error, 'Adjust failed'));
        return false;
      }
    }
    dispatch({ type: 'ADJUST_RATING', payload });
    return true;
  }, []);

  const updateUser = useCallback(async (userId: string, updates: Partial<User>) => {
    const normalizedUpdates = normalizeUserUpdates(updates);
    if (Object.keys(normalizedUpdates).length === 0) {
      return true;
    }

    const apiBase = getApiBase();
    if (apiBase) {
      try {
        const snapshot = await sendUserUpdate(apiBase, userId, normalizedUpdates);
        if (snapshot) {
          dispatch({ type: 'HYDRATE', payload: snapshot });
        }
        return true;
      } catch (error) {
        console.error('update user failed', error);
        toast.error(normalizeErrorMessage(error, 'Update user failed'));
        return false;
      }
    }
    dispatch({ type: 'UPDATE_USER', payload: { userId, updates: normalizedUpdates } });
    return true;
  }, []);

  const deleteUser = useCallback((userId: string) => {
    const apiBase = getApiBase();
    if (apiBase) {
      sendDeleteUser(apiBase, userId)
        .then((snapshot) => {
          if (snapshot) {
            dispatch({ type: 'HYDRATE', payload: snapshot });
          }
        })
        .catch((error) => {
          console.error('delete user failed', error);
          toast.error(normalizeErrorMessage(error, 'Delete user failed'));
        });
      return;
    }
    dispatch({ type: 'DELETE_USER', payload: { userId } });
  }, []);

  const updateRules = useCallback(async (payload: Partial<RatingRules>) => {
    const apiBase = getApiBase();
    if (apiBase) {
      try {
        const snapshot = await sendRuleUpdate(apiBase, payload);
        if (snapshot) {
          dispatch({ type: 'HYDRATE', payload: snapshot });
        }
        return true;
      } catch (error) {
        console.error('rule update failed', error);
        toast.error(normalizeErrorMessage(error, 'Rule update failed'));
        return false;
      }
    }
    dispatch({ type: 'UPDATE_RULES', payload });
    return true;
  }, []);

  // Bootstrapping from backend (run once, read env inside)
  useEffect(() => {
    const apiBase = getApiBase();
    if (!apiBase) {
      console.warn('API base not loaded yet.');
      setServerAvailable(false);
      return;
    }

    setServerAvailable(true);

    bootstrapFromServer(apiBase)
      .then((snapshot) => {
        if (snapshot) {
          dispatch({ type: 'HYDRATE', payload: snapshot });
        }
      })
      .catch((error) => {
        console.warn('Backend unreachable, falling back to mock data', error);
        setServerAvailable(false);
      });
  }, []);

  // Live updates via SSE
  useEffect(() => {
    const apiBase = getApiBase();
    if (!apiBase || !serverAvailable) return;

    const events = new EventSource(`${apiBase}/events`);

    const markEvent = () => setLastEventAt(new Date().toISOString());

    const hydrateIfPresent = (data: any) => {
      if (data?.leaderboard) {
        dispatch({
          type: 'HYDRATE',
          payload: {
            users: data.leaderboard,
            rules: data.rules ?? rulesRef.current,
            activityLog: data.activity ?? activityRef.current,
          },
        });
        markEvent();
      }
    };

    const handlers: Record<string, (data: any) => void> = {
      purchase_ingested: (data) => hydrateIfPresent(data),
      rating_adjusted: (data) => hydrateIfPresent(data),
      rules_updated: (data) => hydrateIfPresent(data),
      user_added: (data) => hydrateIfPresent(data),
      user_updated: (data) => hydrateIfPresent(data),
      user_deleted: (data) => hydrateIfPresent(data),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      events.addEventListener(event, (evt) => {
        try {
          const data = JSON.parse((evt as MessageEvent).data);
          handler(data);
        } catch (error) {
          console.error('Failed to parse SSE payload', error);
        }
      });
    });

    events.onerror = (err) => {
      console.warn('SSE connection lost', err);
    };

    return () => events.close();
  }, [serverAvailable]);

  return {
    users: state.users,
    rules: state.rules,
    activityLog: state.activityLog,
    addUser,
    registerPurchase,
    adjustRating,
    updateUser,
    deleteUser,
    updateRules,
    serverAvailable,
    lastEventAt,
  };
}

function ratingsReducer(state: RatingsState, action: RatingsAction): RatingsState {
  switch (action.type) {
    case 'REGISTER_PURCHASE':
      return handlePurchase(state, action.payload);
    case 'MANUAL_ADD':
      return handleManualAdd(state, action.payload);
    case 'ADJUST_RATING':
      return handleAdjustRating(state, action.payload);
    case 'UPDATE_USER':
      return handleUpdateUser(state, action.payload.userId, action.payload.updates);
    case 'DELETE_USER':
      return handleDeleteUser(state, action.payload.userId);
    case 'UPDATE_RULES':
      return handleUpdateRules(state, action.payload);
    case 'HYDRATE':
      return {
        users: recalcRanks(action.payload.users),
        rules: action.payload.rules,
        activityLog: action.payload.activityLog.slice(0, LOG_LIMIT),
      };
    default:
      return state;
  }
}

function createInitialState(users: User[]): RatingsState {
  const hydratedUsers = users.map((user, index) => ({
    ...user,
    lastActive: user.lastActive ?? user.joinDate,
    lastPurchaseAt: user.lastPurchaseAt ?? user.joinDate,
    phone: normalizePhone(user.phone),
    ratingHistory:
      user.ratingHistory ??
      [
        {
          timestamp: user.joinDate,
          rating: user.rating,
        },
      ],
    totalVolume: user.totalVolume ?? Math.max(user.purchases, 1) * 120,
    achievements: user.achievements ?? [],
    rank: user.rank ?? index + 1,
  }));

  return {
    users: recalcRanks(hydratedUsers),
    rules: defaultRatingRules,
    activityLog: [],
  };
}

function handleManualAdd(state: RatingsState, payload: ManualUserPayload): RatingsState {
  const now = new Date().toISOString();
  const rating = Math.max(0, payload.rating);
  const phone = normalizePhone(payload.phone);
  const newUser: User = {
    id: payload.id ?? `user-${Date.now()}`,
    nickname: payload.nickname.trim(),
    rating,
    rank: 0,
    faction: payload.faction,
    tier: payload.tier ?? determineTier(rating),
    avatar: payload.avatar ?? buildAvatarUrl(payload.nickname),
    joinDate: payload.joinDate ?? now.split('T')[0],
    purchases: payload.purchases ?? 0,
    achievements: payload.purchases && payload.purchases > 0 ? ['First Purchase'] : [],
    phone,
    lastActive: now,
    lastPurchaseAt: payload.purchases && payload.purchases > 0 ? now : undefined,
    preferredChannel: undefined,
    ratingHistory: [
      {
        timestamp: now,
        rating,
      },
    ],
    totalVolume: (payload.purchases ?? 0) * 120,
  };

  const users = recalcRanks([...state.users, newUser]);
  const log = createLogEntry({
    type: 'manual-add',
    userId: newUser.id,
    userNickname: newUser.nickname,
    description: `Admin added ${newUser.nickname} to ${capitalize(newUser.faction)} faction`,
    timestamp: now,
  });

  return {
    ...state,
    users,
    activityLog: addLog(state.activityLog, log),
  };
}

function handlePurchase(state: RatingsState, payload: PurchasePayload): RatingsState {
  const amount = Math.max(0, payload.amount);
  if (!amount) {
    return state;
  }

  const now = new Date().toISOString();
  const normalizedNickname = payload.nickname.trim().toLowerCase();
  const normalizedPhone = normalizePhone(payload.phone);
  const usersCopy = state.users.map((user) => ({ ...user }));

  const existingIndex = usersCopy.findIndex(
    (user) =>
      (!!payload.userId && user.id === payload.userId) ||
      (!!normalizedPhone && !!user.phone && user.phone === normalizedPhone) ||
      user.nickname.trim().toLowerCase() === normalizedNickname,
  );

  const gain = calculateRatingDelta(amount, payload.source, state.rules);

  let updatedUsers: User[];
  let targetUser: User;

  if (existingIndex === -1) {
    const newUser = createUserFromPurchase({ ...payload, phone: normalizedPhone }, gain, state.users);
    targetUser = newUser;
    updatedUsers = recalcRanks([...state.users, newUser]);
  } else {
    const user = usersCopy[existingIndex];
    user.rating += gain;
    user.purchases += 1;
    user.totalVolume = (user.totalVolume ?? 0) + amount;
    if (normalizedPhone && user.phone !== normalizedPhone) {
      user.phone = normalizedPhone;
    }
    user.lastPurchaseAt = now;
    user.lastActive = now;
    user.preferredChannel = payload.source;
    user.ratingHistory = appendHistory(user.ratingHistory, {
      timestamp: now,
      rating: user.rating,
      source: payload.source,
      amount,
    });
    targetUser = user;
    updatedUsers = recalcRanks(usersCopy);
  }

  const log = createLogEntry({
    type: 'purchase',
    userId: targetUser.id,
    userNickname: targetUser.nickname,
    source: payload.source,
    amount,
    delta: gain,
    description: `${capitalize(payload.source)} purchase ${currencyFormatter.format(amount)} (+${gain} pts)`,
    timestamp: now,
  });

  return {
    ...state,
    users: updatedUsers,
    activityLog: addLog(state.activityLog, log),
  };
}

function handleAdjustRating(state: RatingsState, payload: RatingAdjustmentPayload): RatingsState {
  const usersCopy = state.users.map((user) => ({ ...user }));
  const targetIndex = usersCopy.findIndex((user) => user.id === payload.userId);
  if (targetIndex === -1) {
    return state;
  }

  const now = new Date().toISOString();
  const targetUser = usersCopy[targetIndex];
  targetUser.rating = Math.max(0, targetUser.rating + payload.delta);
  targetUser.lastActive = now;
  targetUser.ratingHistory = appendHistory(targetUser.ratingHistory, {
    timestamp: now,
    rating: targetUser.rating,
  });

  const updatedUsers = recalcRanks(usersCopy);

  const log = createLogEntry({
    type: 'adjustment',
    userId: payload.userId,
    userNickname: targetUser.nickname,
    delta: payload.delta,
    description: `${payload.delta >= 0 ? 'Manual bonus' : 'Manual deduction'} (${payload.reason})`,
    timestamp: now,
  });

  return {
    ...state,
    users: updatedUsers,
    activityLog: addLog(state.activityLog, log),
  };
}

function handleUpdateUser(state: RatingsState, userId: string, updates: Partial<User>): RatingsState {
  const usersCopy = state.users.map((user) => ({ ...user }));
  const targetIndex = usersCopy.findIndex((user) => user.id === userId);
  if (targetIndex === -1) {
    return state;
  }

  const now = new Date().toISOString();
  const current = usersCopy[targetIndex];
  const nextRating = updates.rating !== undefined ? Math.max(0, updates.rating) : current.rating;
  const ratingDelta = nextRating - current.rating;

  const updatedUser: User = {
    ...current,
    ...updates,
    rating: nextRating,
    lastActive: updates.lastActive ?? current.lastActive ?? now,
  };

  if (ratingDelta !== 0) {
    updatedUser.ratingHistory = appendHistory(current.ratingHistory, {
      timestamp: now,
      rating: nextRating,
    });
  }

  usersCopy[targetIndex] = updatedUser;
  const users = recalcRanks(usersCopy, { preserveTier: Boolean(updates.tier) });

  let activityLog = state.activityLog;
  if (ratingDelta !== 0) {
    activityLog = addLog(activityLog, createLogEntry({
      type: 'adjustment',
      userId: updatedUser.id,
      userNickname: updatedUser.nickname,
      delta: ratingDelta,
      description: ratingDelta > 0 ? 'Admin rating increase' : 'Admin rating decrease',
      timestamp: now,
    }));
  }

  return {
    ...state,
    users,
    activityLog,
  };
}

function handleDeleteUser(state: RatingsState, userId: string): RatingsState {
  const target = state.users.find((user) => user.id === userId);
  if (!target) {
    return state;
  }

  const users = recalcRanks(state.users.filter((user) => user.id !== userId));
  const activityLog = addLog(
    state.activityLog,
    createLogEntry({
      type: 'adjustment',
      userId: target.id,
      userNickname: target.nickname,
      description: `${target.nickname} removed by admin`,
      delta: -target.rating,
      timestamp: new Date().toISOString(),
    }),
  );

  return {
    ...state,
    users,
    activityLog,
  };
}

function handleUpdateRules(state: RatingsState, payload: Partial<RatingRules>): RatingsState {
  const nextRules = { ...state.rules, ...payload };
  const now = new Date().toISOString();
  const log = createLogEntry({
    type: 'rule-change',
    userNickname: 'System',
    description: 'Rating rules updated by admin',
    timestamp: now,
  });

  return {
    ...state,
    rules: nextRules,
    activityLog: addLog(state.activityLog, log),
  };
}

function createUserFromPurchase(payload: PurchasePayload, gain: number, existingUsers: User[]): User {
  const now = new Date().toISOString();
  const ratingHistory: RatingSnapshot[] = [
    {
      timestamp: now,
      rating: gain,
      source: payload.source,
      amount: payload.amount,
    },
  ];

  const faction = payload.factionPreference ?? resolveFaction(existingUsers);

  return {
    id: payload.userId ?? `user-${Date.now()}`,
    nickname: payload.nickname.trim(),
    rating: gain,
    rank: 0,
    faction,
    tier: determineTier(gain),
    avatar: buildAvatarUrl(payload.nickname),
    joinDate: now.split('T')[0],
    purchases: 1,
    achievements: ['First Purchase'],
    phone: normalizePhone(payload.phone),
    lastPurchaseAt: now,
    lastActive: now,
    preferredChannel: payload.source,
    ratingHistory,
    totalVolume: payload.amount,
  };
}

function calculateRatingDelta(amount: number, source: PurchasePayload['source'], rules: RatingRules) {
  const base = amount * rules.basePointsPerDollar;
  const sourceBonusPercent = source === 'telegram' ? rules.telegramBonusPercent : rules.websiteBonusPercent;
  let total = base + (base * sourceBonusPercent) / 100;

  if (amount >= rules.highValueThreshold) {
    total += (base * rules.highValueBonusPercent) / 100;
  }

  return Math.round(total);
}

function recalcRanks(users: User[], options: { preserveTier?: boolean } = {}): User[] {
  const { preserveTier = false } = options;
  const ranked = [...users].sort((a, b) => b.rating - a.rating);
  const tierById = preserveTier ? undefined : buildSlotTierMap(ranked);

  return ranked.map((user, index) => {
    const rankedUser: User = {
      ...user,
      rank: index + 1,
      tier: preserveTier && user.tier ? user.tier : (tierById?.get(user.id) ?? 'treasure'),
    };
    rankedUser.achievements = refreshAchievements(rankedUser);
    return rankedUser;
  });
}

function determineTier(rating: number): Tier {
  if (rating >= 9000) return 'legendary';
  if (rating >= 7500) return 'noble';
  return 'treasure';
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

function refreshAchievements(user: User): string[] {
  const achievements = new Set(user.achievements ?? []);

  if (user.purchases > 0) achievements.add('First Purchase');
  if (user.rank <= 10) achievements.add('Top 10');
  if (user.rank <= 3) achievements.add('Podium Elite');
  if (user.rating >= 10000) achievements.add('Gold Tier');
  if ((user.totalVolume ?? 0) >= 25000) achievements.add('High Roller');
  if (user.purchases >= 100) achievements.add('Centurion Shopper');

  return Array.from(achievements);
}

function appendHistory(history: RatingSnapshot[] | undefined, entry: RatingSnapshot) {
  const next = [...(history ?? []), entry];
  return next.slice(-HISTORY_LIMIT);
}

function addLog(log: ActivityLogEntry[], entry: ActivityLogEntry) {
  return [entry, ...log].slice(0, LOG_LIMIT);
}

function createLogEntry(entry: ActivityLogEntry): ActivityLogEntry {
  return {
    id: entry.id ?? `log-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    type: entry.type,
    userId: entry.userId,
    userNickname: entry.userNickname ?? 'Unknown',
    description: entry.description,
    source: entry.source,
    amount: entry.amount,
    timestamp: entry.timestamp,
    delta: entry.delta,
  };
}

function buildAvatarUrl(nickname: string) {
  const seed = encodeURIComponent(nickname.trim() || `member-${Date.now()}`);
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`;
}

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function resolveFaction(users: User[]): Faction {
  const darknessCount = users.filter((user) => user.faction === 'darkness').length;
  const lightCount = users.filter((user) => user.faction === 'light').length;
  if (darknessCount === lightCount) {
    return Math.random() > 0.5 ? 'darkness' : 'light';
  }
  return darknessCount <= lightCount ? 'darkness' : 'light';
}

async function bootstrapFromServer(apiBase: string): Promise<RatingsState | null> {
  const res = await fetch(`${apiBase}/leaderboard`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.leaderboard) return null;

  return {
    users: recalcRanks(data.leaderboard),
    rules: data.rules ?? defaultRatingRules,
    activityLog: data.activity ?? [],
  };
}

function normalizePurchasePayload(payload: PurchasePayload): PurchasePayload {
  const numericAmount = Number(payload.amount);
  const items = payload.items?.filter(Boolean);
  const orderId = payload.orderId?.trim();
  const phone = normalizePhone(payload.phone);

  return {
    ...payload,
    orderId: orderId && orderId.length > 0 ? orderId : undefined,
    userId: payload.userId ?? undefined,
    nickname: payload.nickname,
    phone,
    amount: Number.isFinite(numericAmount) ? numericAmount : 0,
    items: items?.length ? items : items ?? undefined,
    factionPreference: payload.factionPreference ?? undefined,
  };
}

function normalizeManualUserPayload(payload: ManualUserPayload): ManualUserPayload {
  const phone = normalizePhone(payload.phone);
  return {
    ...payload,
    phone,
  };
}

function normalizeUserUpdates(updates: Partial<User>): Partial<User> {
  if (updates.phone === undefined) return updates;
  const phone = normalizePhone(updates.phone);
  if (!phone) {
    const { phone: _removed, ...rest } = updates;
    return rest;
  }
  return { ...updates, phone };
}

async function sendPurchase(apiBase: string, payload: PurchasePayload): Promise<RatingsState | null> {
  const path = payload.source === 'telegram' ? '/ingest/telegram' : '/ingest/website';
  const cleanPayload = normalizePurchasePayload(payload);

  const res = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cleanPayload),
  });
  if (!res.ok) return null;

  const data = await res.json();
  if (!data?.leaderboard) return null;

  return {
    users: recalcRanks(data.leaderboard),
    rules: data.rules ?? defaultRatingRules,
    activityLog: data.activity ?? [],
  };
}

async function sendManualAdd(apiBase: string, payload: ManualUserPayload): Promise<RatingsState | null> {
  const cleanPayload = normalizeManualUserPayload(payload);
  const res = await fetch(`${apiBase}/admin/manual-add`, {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify(cleanPayload),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const data = await res.json();
  if (!data?.leaderboard) return null;
  return {
    users: recalcRanks(data.leaderboard),
    rules: data.rules ?? defaultRatingRules,
    activityLog: data.activity ?? [],
  };
}

async function sendAdjust(apiBase: string, payload: RatingAdjustmentPayload): Promise<RatingsState | null> {
  const res = await fetch(`${apiBase}/admin/adjust`, {
    method: 'POST',
    headers: buildAdminHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const data = await res.json();
  if (!data?.leaderboard) return null;
  return {
    users: recalcRanks(data.leaderboard),
    rules: data.rules ?? defaultRatingRules,
    activityLog: data.activity ?? [],
  };
}

async function sendRuleUpdate(apiBase: string, payload: Partial<RatingRules>): Promise<RatingsState | null> {
  const res = await fetch(`${apiBase}/admin/rules`, {
    method: 'PATCH',
    headers: buildAdminHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const data = await res.json();
  if (!data?.leaderboard) return null;
  return {
    users: recalcRanks(data.leaderboard),
    rules: data.rules ?? defaultRatingRules,
    activityLog: data.activity ?? [],
  };
}

function sanitizeUserUpdate(updates: Partial<User>) {
  const payload: Record<string, unknown> = {};
  if (updates.nickname) payload.nickname = updates.nickname;
  const phone = normalizePhone(updates.phone);
  if (phone) payload.phone = phone;
  if (updates.faction) payload.faction = updates.faction;
  if (updates.tier) payload.tier = updates.tier;
  if (updates.avatar) payload.avatar = updates.avatar;
  if (updates.joinDate) payload.joinDate = updates.joinDate;
  return payload;
}

async function sendUserUpdate(apiBase: string, userId: string, updates: Partial<User>): Promise<RatingsState | null> {
  const payload = sanitizeUserUpdate(updates);
  if (Object.keys(payload).length === 0) return null;

  const res = await fetch(`${apiBase}/admin/users/${userId}`, {
    method: 'PATCH',
    headers: buildAdminHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const data = await res.json();
  if (!data?.leaderboard) return null;
  return {
    users: recalcRanks(data.leaderboard),
    rules: data.rules ?? defaultRatingRules,
    activityLog: data.activity ?? [],
  };
}

async function sendDeleteUser(apiBase: string, userId: string): Promise<RatingsState | null> {
  const res = await fetch(`${apiBase}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: buildAdminHeaders(),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res));
  }
  const data = await res.json();
  if (!data?.leaderboard) return null;
  return {
    users: recalcRanks(data.leaderboard),
    rules: data.rules ?? defaultRatingRules,
    activityLog: data.activity ?? [],
  };
}

export async function verifyAdminToken(apiBase: string, token: string) {
  const res = await fetch(`${apiBase}/admin/ping`, {
    method: 'GET',
    headers: buildAdminHeaders(token),
  });

  if (res.ok) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    error: await readApiError(res),
  };
}

export async function loginAdmin(apiBase: string, username: string, password: string) {
  const res = await fetch(`${apiBase}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  const data = await res.json();
  if (!data?.token) {
    throw new Error('Login failed');
  }

  return {
    token: data.token as string,
    tokenType: (data.tokenType as string | undefined) ?? 'Bearer',
    expiresIn: data.expiresIn as string | undefined,
  };
}

export async function fetchAdminPurchases(
  apiBase: string,
  options: { limit?: number; source?: PurchaseSource } = {},
): Promise<PurchaseAuditEntry[]> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.source) params.set('source', options.source);

  const query = params.toString();
  const res = await fetch(`${apiBase}/admin/purchases${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: buildAdminHeaders(),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  const data = await res.json();
  return (data?.purchases ?? []) as PurchaseAuditEntry[];
}

export async function fetchIngestEvents(
  apiBase: string,
  options: { limit?: number; source?: PurchaseSource; status?: 'success' | 'error' } = {},
): Promise<IngestEventEntry[]> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.source) params.set('source', options.source);
  if (options.status) params.set('status', options.status);

  const query = params.toString();
  const res = await fetch(`${apiBase}/admin/ingest-events${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: buildAdminHeaders(),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  const data = await res.json();
  return (data?.events ?? []) as IngestEventEntry[];
}

export async function fetchActivityInsights(
  apiBase: string,
  options: { days?: number } = {},
): Promise<ActivityInsightsPayload> {
  const params = new URLSearchParams();
  if (options.days) params.set('days', String(options.days));

  const query = params.toString();
  const res = await fetch(`${apiBase}/admin/activity-insights${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: buildAdminHeaders(),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  return (await res.json()) as ActivityInsightsPayload;
}

export async function fetchRankHistory(
  apiBase: string,
  options: { limit?: number; userId?: string } = {},
): Promise<RankHistoryEntry[]> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.userId) params.set('userId', options.userId);

  const query = params.toString();
  const res = await fetch(`${apiBase}/admin/rank-history${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: buildAdminHeaders(),
  });

  if (!res.ok) {
    throw new Error(await readApiError(res));
  }

  const data = await res.json();
  return (data?.history ?? []) as RankHistoryEntry[];
}

function getAdminToken() {
  if (typeof window === 'undefined') return undefined;
  const token = window.localStorage.getItem('dynasty_admin_token');
  return token && token.trim().length > 0 ? token.trim() : undefined;
}

function buildAdminHeaders(tokenOverride?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = tokenOverride?.trim() || getAdminToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function readApiError(res: Response) {
  try {
    const data = await res.json();
    if (data?.error) return data.error as string;
    if (data?.message) return data.message as string;
  } catch {
    // Ignore JSON parse failures.
  }

  try {
    const text = await res.text();
    if (text) return text;
  } catch {
    // Ignore read failures.
  }

  return `Request failed (${res.status})`;
}

function normalizeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

