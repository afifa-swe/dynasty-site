import type { PurchaseSource } from './system';

export type Faction = 'darkness' | 'light';
export type Tier = 'legendary' | 'noble' | 'treasure';

export interface RatingSnapshot {
  timestamp: string;
  rating: number;
  source?: PurchaseSource;
  amount?: number;
}

export interface User {
  id: string;
  nickname: string;
  rating: number;
  rank: number;
  faction: Faction;
  tier: Tier;
  level?: number;
  avatar?: string;
  joinDate: string;
  purchases: number;
  totalPurchases?: number;
  achievements: string[];
  phone?: string;
  lastPurchaseAt?: string;
  lastActive?: string;
  preferredChannel?: PurchaseSource;
  ratingHistory?: RatingSnapshot[];
  totalVolume?: number;
}

export interface TreeNode {
  user: User;
  children: TreeNode[];
  x: number;
  y: number;
}
