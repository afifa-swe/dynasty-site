-- CreateEnum
CREATE TYPE "Faction" AS ENUM ('darkness', 'light');

-- CreateEnum
CREATE TYPE "Tier" AS ENUM ('legendary', 'noble', 'treasure');

-- CreateEnum
CREATE TYPE "PurchaseSource" AS ENUM ('website', 'telegram');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('purchase', 'adjustment', 'manual_add', 'rule_change');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "phone" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "faction" "Faction" NOT NULL,
    "tier" "Tier" NOT NULL DEFAULT 'treasure',
    "avatar" TEXT,
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "achievements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastPurchaseAt" TIMESTAMP(3),
    "lastActive" TIMESTAMP(3),
    "preferredChannel" "PurchaseSource",
    "totalVolume" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" "PurchaseSource" NOT NULL,
    "items" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "factionPreference" "Faction",
    "ratingDelta" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatingSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "source" "PurchaseSource",
    "amount" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RatingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "userId" TEXT,
    "userNickname" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "source" "PurchaseSource",
    "amount" INTEGER,
    "delta" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rules" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "basePointsPerDollar" INTEGER NOT NULL,
    "websiteBonusPercent" INTEGER NOT NULL,
    "telegramBonusPercent" INTEGER NOT NULL,
    "highValueThreshold" INTEGER NOT NULL,
    "highValueBonusPercent" INTEGER NOT NULL,
    "decayPerDay" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatingSnapshot" ADD CONSTRAINT "RatingSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
