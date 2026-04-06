import type { Faction, Tier } from './user';

export type PurchaseSource = 'website' | 'telegram';
export type IngestStatus = 'success' | 'error';

export interface PurchasePayload {
  orderId?: string;
  userId?: string;
  nickname: string;
  phone?: string;
  amount: number;
  source: PurchaseSource;
  items?: string[];
  factionPreference?: Faction;
}

export interface PurchaseAuditEntry {
  id: string;
  userId: string;
  amount: number;
  orderId?: string | null;
  source: PurchaseSource;
  items: string[];
  factionPreference?: Faction | null;
  ratingDelta?: number | null;
  createdAt: string;
  user: {
    id: string;
    nickname: string;
    phone?: string | null;
    faction: Faction;
    tier: Tier;
    rank: number;
  };
}

export interface IngestEventEntry {
  id: string;
  source: PurchaseSource;
  status: IngestStatus;
  orderId?: string | null;
  nickname?: string | null;
  phone?: string | null;
  amount?: number | null;
  items: string[];
  rawPayload: unknown;
  errorMessage?: string | null;
  userId?: string | null;
  createdAt: string;
  user?: {
    id: string;
    nickname: string;
    rank: number;
    faction: Faction;
    tier: Tier;
  } | null;
}

export interface RankHistoryEntry {
  id: string;
  userId: string;
  fromRank: number;
  toRank: number;
  rating: number;
  timestamp: string;
  user: {
    id: string;
    nickname: string;
    rank: number;
    faction: Faction;
    tier: Tier;
  };
}

export interface ManualUserPayload {
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

export interface RatingAdjustmentPayload {
  userId: string;
  delta: number;
  reason: string;
}

export interface RatingRules {
  basePointsPerDollar: number;
  websiteBonusPercent: number;
  telegramBonusPercent: number;
  highValueThreshold: number;
  highValueBonusPercent: number;
  decayPerDay: number;
}

export interface ActivityLogEntry {
  id?: string;
  type: 'purchase' | 'adjustment' | 'manual-add' | 'rule-change';
  userId?: string;
  userNickname: string;
  description: string;
  source?: PurchaseSource;
  amount?: number;
  timestamp: string;
  delta?: number;
}

export interface ActivityInsightsPayload {
  windowDays: number;
  purchases: number;
  adjustments: number;
  totalDelta: number;
  topMovers: { nickname: string; delta: number }[];
  lastUpdate?: string | null;
}
