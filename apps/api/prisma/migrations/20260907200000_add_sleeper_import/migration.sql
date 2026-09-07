-- AlterTable
ALTER TABLE "FantasyTeam"
ADD COLUMN "sleeperLeagueId" VARCHAR(30),
ADD COLUMN "sleeperRosterId" INTEGER,
ADD COLUMN "sleeperUserId" VARCHAR(30),
ADD COLUMN "sleeperUsername" VARCHAR(50),
ADD COLUMN "sleeperSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Player"
ADD COLUMN "hasProjection" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "FantasyTeam_userId_sleeperLeagueId_key" ON "FantasyTeam"("userId", "sleeperLeagueId");
