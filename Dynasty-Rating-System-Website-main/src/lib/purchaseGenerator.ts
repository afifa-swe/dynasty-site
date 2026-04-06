import type { PurchasePayload, PurchaseSource } from '../types/system';
import type { User, Faction } from '../types/user';

const websiteProducts = [
  'Eclipse Hoodie',
  'Dynasty Blade',
  'Solar Crown',
  'Tree Sigil Pin',
  'Obsidian Ring',
  'Aurora Cape',
  'Runic Flask',
  'Market Bundle',
  'Guild Entry',
];

const autoNames = [
  'Dragon',
  'Shadow',
  'Aurora',
  'Storm',
  'Obsidian',
  'Radiant',
  'Nova',
  'Viper',
  'Echo',
  'Specter',
  'Phoenix',
  'Glacier',
  'Zenith',
  'Pulse',
  'Nebula',
  'Titan',
  'Rift',
  'Solstice',
  'Valor',
  'Myth',
];

const factions: Faction[] = ['darkness', 'light'];

export interface GeneratedPurchase {
  payload: PurchasePayload;
  isNewUser: boolean;
}

export function generateRandomPurchase(users: User[]): GeneratedPurchase {
  const hasUsers = users.length > 0;
  const shouldTargetExisting = hasUsers && Math.random() < 0.65;
  const source: PurchaseSource = Math.random() > 0.4 ? 'website' : 'telegram';
  const amount = Math.round(Math.random() * 1800 + 120);
  const items = sampleItems();

  if (shouldTargetExisting) {
    const target = users[Math.floor(Math.random() * users.length)];
    return {
      isNewUser: false,
      payload: {
        orderId: `sim-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        userId: target.id,
        nickname: target.nickname,
        phone: target.phone,
        amount,
        source,
        items,
        factionPreference: target.faction,
      },
    };
  }

  const nickname = buildNickname();
  const userId = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const factionPreference = factions[Math.floor(Math.random() * factions.length)];
  const phone = buildPhone();

  return {
    isNewUser: true,
    payload: {
      orderId: `sim-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      userId,
      nickname,
      phone,
      amount,
      source,
      items,
      factionPreference,
    },
  };
}

function sampleItems(): string[] {
  const shuffled = [...websiteProducts].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.ceil(Math.random() * 3));
}

function buildNickname() {
  const suffix = Math.floor(Math.random() * 999);
  const first = autoNames[Math.floor(Math.random() * autoNames.length)];
  const second = autoNames[Math.floor(Math.random() * autoNames.length)];
  return `${first}${second}${suffix}`;
}

function buildPhone() {
  const middle = Math.floor(100 + Math.random() * 900);
  const end = Math.floor(1000 + Math.random() * 9000);
  return `+1-555-${middle}-${end}`;
}
