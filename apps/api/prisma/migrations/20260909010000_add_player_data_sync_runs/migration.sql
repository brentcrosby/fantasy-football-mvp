CREATE TYPE "PlayerDataSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'SKIPPED', 'FAILED');

CREATE TABLE "PlayerDataSyncRun" (
    "id" TEXT NOT NULL,
    "status" "PlayerDataSyncStatus" NOT NULL,
    "season" INTEGER,
    "week" INTEGER,
    "recordCount" INTEGER,
    "sourceUpdatedAt" TIMESTAMP(3),
    "errorMessage" VARCHAR(500),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PlayerDataSyncRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PlayerDataSyncRun_startedAt_idx" ON "PlayerDataSyncRun"("startedAt");
CREATE INDEX "PlayerDataSyncRun_status_startedAt_idx" ON "PlayerDataSyncRun"("status", "startedAt");
