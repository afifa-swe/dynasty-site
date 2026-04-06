import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const count = Number(process.argv[2] ?? 500);
if (!Number.isFinite(count) || count <= 0) {
  console.error('Usage: node scripts/seedLarge.mjs <count>');
  process.exit(1);
}

const seedTag = Date.now();
const now = new Date();

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickFaction = (index) => (index % 2 === 0 ? 'darkness' : 'light');

const determineTier = (rating) => {
  if (rating >= 9000) return 'legendary';
  if (rating >= 7500) return 'noble';
  return 'treasure';
};

const buildAchievements = (user, rank) => {
  const achievements = new Set(user.achievements ?? []);
  if (user.purchases > 0) achievements.add('First Purchase');
  if (rank <= 10) achievements.add('Top 10');
  if (rank <= 3) achievements.add('Podium Elite');
  if (user.rating >= 10000) achievements.add('Gold Tier');
  if ((user.totalVolume ?? 0) >= 25000) achievements.add('High Roller');
  if (user.purchases >= 100) achievements.add('Centurion Shopper');
  return Array.from(achievements);
};

const seedUsers = Array.from({ length: count }, (_, index) => {
  const rating = randomBetween(200, 12000);
  const purchases = randomBetween(0, 8);
  const totalVolume = purchases * randomBetween(80, 220);
  const tier = determineTier(rating);

  return {
    id: `seed-${seedTag}-${index + 1}`,
    nickname: `SeedMember${index + 1}`,
    rating,
    rank: 0,
    faction: pickFaction(index),
    tier,
    joinDate: now,
    purchases,
    achievements: purchases > 0 ? ['First Purchase'] : [],
    lastActive: now,
    lastPurchaseAt: purchases > 0 ? now : null,
    preferredChannel: purchases > 0 ? (index % 3 === 0 ? 'telegram' : 'website') : null,
    totalVolume,
  };
});

async function main() {
  console.log(`Seeding ${count} users...`);
  await prisma.user.createMany({ data: seedUsers });

  const users = await prisma.user.findMany({ orderBy: { rating: 'desc' } });
  for (let i = 0; i < users.length; i += 1) {
    const user = users[i];
    const rank = i + 1;
    const tier = determineTier(user.rating);
    const achievements = buildAchievements(user, rank);
    await prisma.user.update({
      where: { id: user.id },
      data: { rank, tier, achievements },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
