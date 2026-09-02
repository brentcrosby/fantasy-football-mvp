-- CreateTable
CREATE TABLE "WeeklyReport" (
    "id" TEXT NOT NULL,
    "fantasyTeamId" TEXT NOT NULL,
    "teamName" VARCHAR(100) NOT NULL,
    "week" INTEGER NOT NULL,
    "scoringFormat" "ScoringFormat" NOT NULL,
    "lineupSlots" "LineupSlot"[],
    "rosterSnapshot" JSONB NOT NULL,
    "reportSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyReport_fantasyTeamId_createdAt_idx" ON "WeeklyReport"("fantasyTeamId", "createdAt");

-- AddForeignKey
ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_fantasyTeamId_fkey" FOREIGN KEY ("fantasyTeamId") REFERENCES "FantasyTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
