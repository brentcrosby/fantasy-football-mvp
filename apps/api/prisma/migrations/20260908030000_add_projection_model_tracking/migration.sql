ALTER TABLE "Player"
ADD COLUMN "experimentalProjection" JSONB,
ADD COLUMN "gsisId" VARCHAR(20);

CREATE TABLE "ProjectionObservation" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "providerProjectedPoints" DOUBLE PRECISION NOT NULL,
    "modelProjectedPoints" DOUBLE PRECISION,
    "actualPprPoints" DOUBLE PRECISION,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "ProjectionObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectionObservation_playerId_season_week_key"
ON "ProjectionObservation"("playerId", "season", "week");

CREATE INDEX "ProjectionObservation_season_week_idx"
ON "ProjectionObservation"("season", "week");

CREATE INDEX "ProjectionObservation_actualPprPoints_idx"
ON "ProjectionObservation"("actualPprPoints");

ALTER TABLE "ProjectionObservation"
ADD CONSTRAINT "ProjectionObservation_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
