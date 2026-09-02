-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Position" AS ENUM ('QB', 'RB', 'WR', 'TE', 'K', 'DST');

-- CreateEnum
CREATE TYPE "ScoringFormat" AS ENUM ('STANDARD', 'HALF_PPR', 'PPR');

-- CreateEnum
CREATE TYPE "LineupSlot" AS ENUM ('QB', 'RB', 'WR', 'TE', 'K', 'DST', 'FLEX');

-- CreateEnum
CREATE TYPE "InjuryStatus" AS ENUM ('HEALTHY', 'QUESTIONABLE', 'DOUBTFUL', 'OUT', 'IR', 'SUSPENDED');

-- CreateTable
CREATE TABLE "FantasyTeam" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "scoringFormat" "ScoringFormat" NOT NULL,
    "lineupSlots" "LineupSlot"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FantasyTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "position" "Position" NOT NULL,
    "nflTeam" VARCHAR(3) NOT NULL,
    "byeWeek" INTEGER NOT NULL,
    "injuryStatus" "InjuryStatus" NOT NULL DEFAULT 'HEALTHY',
    "projectedPoints" DOUBLE PRECISION NOT NULL,
    "targetShare" DOUBLE PRECISION,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterMembership" (
    "fantasyTeamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,

    CONSTRAINT "RosterMembership_pkey" PRIMARY KEY ("fantasyTeamId","playerId")
);

-- CreateIndex
CREATE INDEX "RosterMembership_playerId_idx" ON "RosterMembership"("playerId");

-- AddForeignKey
ALTER TABLE "RosterMembership" ADD CONSTRAINT "RosterMembership_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterMembership" ADD CONSTRAINT "RosterMembership_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
