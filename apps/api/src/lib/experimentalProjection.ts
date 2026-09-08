import { parse } from "csv-parse/sync";
import type { ExperimentalProjection, ProjectionModelSummary } from "@fantasy-football/shared";

import { projectionModelArtifact } from "../data/projectionModel.js";

interface WeeklyStatRow {
  player_id: string;
  position: string;
  season: string;
  week: string;
  season_type: string;
  fantasy_points_ppr: string;
  attempts: string;
  carries: string;
  targets: string;
  receptions: string;
  passing_tds: string;
  rushing_tds: string;
  receiving_tds: string;
}

interface NumericWeeklyStat {
  playerId: string;
  position: string;
  season: number;
  week: number;
  fantasyPointsPpr: number;
  attempts: number;
  carries: number;
  targets: number;
  receptions: number;
  totalTds: number;
}

export function buildExperimentalProjections(
  statsCsvs: string[],
  season: number,
  week: number
): Map<string, ExperimentalProjection> {
  const stats = parseWeeklyStats(statsCsvs)
    .filter((row) => row.season < season || (row.season === season && row.week < week));
  const statsByPlayer = groupStatsByPlayer(stats);
  const projections = new Map<string, ExperimentalProjection>();
  const intervalRadius = projectionModelArtifact.residualStdDev * 1.28;

  for (const [playerId, playerStats] of statsByPlayer) {
    const recent = playerStats
      .sort((left, right) => left.season - right.season || left.week - right.week)
      .slice(-5);

    if (recent.length < 3) continue;

    const featureValues = buildFeatureValues(recent);
    const prediction = projectionModelArtifact.coefficients.reduce<number>((total, coefficient, index) => {
      const standardized = (featureValues[index] - projectionModelArtifact.means[index]) /
        projectionModelArtifact.scales[index];
      return total + coefficient * standardized;
    }, projectionModelArtifact.intercept);
    const points = roundPoints(Math.max(0, prediction));

    projections.set(playerId, {
      points,
      low: roundPoints(Math.max(0, points - intervalRadius)),
      high: roundPoints(points + intervalRadius),
      version: projectionModelArtifact.version,
      scoringFormat: "PPR",
      status: "EXPERIMENTAL",
      recentGames: recent.length
    });
  }

  return projections;
}

export function readActualPprPoints(statsCsvs: string[]): Map<string, number> {
  return new Map(
    parseWeeklyStats(statsCsvs).map((row) => [statKey(row.playerId, row.season, row.week), row.fantasyPointsPpr])
  );
}

export function projectionModelSummary(): ProjectionModelSummary {
  return {
    version: projectionModelArtifact.version,
    status: projectionModelArtifact.status,
    validationSeason: projectionModelArtifact.validationSeason,
    trainingRows: projectionModelArtifact.trainingRows,
    validationRows: projectionModelArtifact.validationRows,
    modelMae: projectionModelArtifact.metrics.model.mae,
    baselineMae: projectionModelArtifact.metrics.baseline.mae,
    sourceLabel: projectionModelArtifact.source.name
  };
}

export function projectionObservationKey(gsisId: string, season: number, week: number): string {
  return statKey(gsisId, season, week);
}

function parseWeeklyStats(statsCsvs: string[]): NumericWeeklyStat[] {
  return statsCsvs.flatMap((csv) => {
    const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as WeeklyStatRow[];

    return rows.flatMap((row) => {
      const season = Number(row.season);
      const week = Number(row.week);

      if (
        row.season_type !== "REG" ||
        !projectionModelArtifact.supportedPositions.includes(row.position as "QB" | "RB" | "WR" | "TE") ||
        !row.player_id ||
        !Number.isInteger(season) ||
        !Number.isInteger(week)
      ) {
        return [];
      }

      return [{
        playerId: row.player_id,
        position: row.position,
        season,
        week,
        fantasyPointsPpr: numberOrZero(row.fantasy_points_ppr),
        attempts: numberOrZero(row.attempts),
        carries: numberOrZero(row.carries),
        targets: numberOrZero(row.targets),
        receptions: numberOrZero(row.receptions),
        totalTds: numberOrZero(row.passing_tds) + numberOrZero(row.rushing_tds) + numberOrZero(row.receiving_tds)
      }];
    });
  });
}

function groupStatsByPlayer(stats: NumericWeeklyStat[]): Map<string, NumericWeeklyStat[]> {
  const grouped = new Map<string, NumericWeeklyStat[]>();

  for (const row of stats) {
    const current = grouped.get(row.playerId) ?? [];
    current.push(row);
    grouped.set(row.playerId, current);
  }

  return grouped;
}

function buildFeatureValues(recent: NumericWeeklyStat[]): number[] {
  const lastThree = recent.slice(-3);
  const last = recent.at(-1)!;
  const avgPoints3 = average(lastThree.map((row) => row.fantasyPointsPpr));
  const position = last.position;

  const values: Record<(typeof projectionModelArtifact.features)[number], number> = {
    avg_points_3: avgPoints3,
    avg_points_5: average(recent.map((row) => row.fantasyPointsPpr)),
    last_points: last.fantasyPointsPpr,
    points_trend: last.fantasyPointsPpr - avgPoints3,
    avg_attempts_3: average(lastThree.map((row) => row.attempts)),
    avg_carries_3: average(lastThree.map((row) => row.carries)),
    avg_targets_3: average(lastThree.map((row) => row.targets)),
    avg_receptions_3: average(lastThree.map((row) => row.receptions)),
    avg_tds_3: average(lastThree.map((row) => row.totalTds)),
    games_in_window: recent.length,
    is_qb: position === "QB" ? 1 : 0,
    is_rb: position === "RB" ? 1 : 0,
    is_wr: position === "WR" ? 1 : 0,
    is_te: position === "TE" ? 1 : 0
  };

  return projectionModelArtifact.features.map((feature) => values[feature]);
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function numberOrZero(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statKey(playerId: string, season: number, week: number): string {
  return `${playerId}:${season}:${week}`;
}

function roundPoints(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
