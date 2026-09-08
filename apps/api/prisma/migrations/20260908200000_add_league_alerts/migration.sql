CREATE TYPE "LeagueAlertType" AS ENUM ('INJURY_STATUS', 'PROJECTION_RISE', 'PROJECTION_FALL');

CREATE TABLE "LeagueAlert" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "type" "LeagueAlertType" NOT NULL,
    "previousInjuryStatus" "InjuryStatus",
    "injuryStatus" "InjuryStatus",
    "previousProjectedPoints" DOUBLE PRECISION,
    "projectedPoints" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueAlert_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeagueAlert_season_week_createdAt_idx" ON "LeagueAlert"("season", "week", "createdAt");
CREATE INDEX "LeagueAlert_playerId_createdAt_idx" ON "LeagueAlert"("playerId", "createdAt");

ALTER TABLE "LeagueAlert" ADD CONSTRAINT "LeagueAlert_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
