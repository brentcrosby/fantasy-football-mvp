ALTER TYPE "ScoringFormat" ADD VALUE 'CUSTOM';

ALTER TABLE "FantasyTeam"
ADD COLUMN "scoringRules" JSONB;

ALTER TABLE "Player"
ADD COLUMN "projectionStats" JSONB,
ADD COLUMN "projectionSource" VARCHAR(150);

ALTER TABLE "WeeklyReport"
ADD COLUMN "scoringRules" JSONB;
