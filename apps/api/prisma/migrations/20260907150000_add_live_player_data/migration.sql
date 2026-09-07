-- CreateEnum
CREATE TYPE "PlayerDataSource" AS ENUM ('SEED', 'LIVE');

-- AlterTable
ALTER TABLE "Player"
ADD COLUMN "dataSource" "PlayerDataSource" NOT NULL DEFAULT 'SEED',
ADD COLUMN "externalId" VARCHAR(50),
ADD COLUMN "season" INTEGER,
ADD COLUMN "projectionWeek" INTEGER,
ADD COLUMN "dataUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PlayerDataSync" (
    "id" VARCHAR(50) NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "source" VARCHAR(150) NOT NULL,
    "recordCount" INTEGER NOT NULL,
    "sourceUpdatedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerDataSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_dataSource_externalId_key" ON "Player"("dataSource", "externalId");

-- CreateIndex
CREATE INDEX "Player_dataSource_season_projectionWeek_idx" ON "Player"("dataSource", "season", "projectionWeek");
