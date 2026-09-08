import type { Player as PrismaPlayer, Prisma, WeeklyReport } from "@prisma/client";
import type {
  PersistedFantasyTeam,
  Player,
  RecommendationReport,
  RosterPlayer,
  SavedWeeklyReport,
  ScoringRules
} from "@fantasy-football/shared";

export const teamWithRoster = {
  rosterMemberships: {
    include: {
      player: true
    }
  }
} satisfies Prisma.FantasyTeamInclude;

type TeamWithRoster = Prisma.FantasyTeamGetPayload<{ include: typeof teamWithRoster }>;

export function toPlayerDto(player: PrismaPlayer): Player {
  const projectionStats = toNumberRecord(player.projectionStats);
  const projectionSource =
    player.projectionSource ??
    (player.dataSource === "LIVE" ? "Sleeper + FantasyPros via DynastyProcess" : "Sample projection data");

  return {
    id: player.id,
    name: player.name,
    position: player.position,
    nflTeam: player.nflTeam,
    byeWeek: player.byeWeek,
    injuryStatus: player.injuryStatus,
    projectedPoints: player.projectedPoints,
    hasProjection: player.hasProjection,
    ...(projectionStats ? { projectionStats } : {}),
    projectionSource,
    ...(player.targetShare === null ? {} : { targetShare: player.targetShare })
  };
}

export function toTeamDto(team: TeamWithRoster): PersistedFantasyTeam {
  const scoringRules = toNumberRecord(team.scoringRules);

  return {
    id: team.id,
    name: team.name,
    settings: {
      scoringFormat: team.scoringFormat,
      lineupSlots: team.lineupSlots,
      ...(scoringRules ? { scoringRules } : {})
    },
    roster: team.rosterMemberships
      .map(({ player }) => ({ player: toPlayerDto(player) }))
      .sort((left, right) => left.player.name.localeCompare(right.player.name)),
    sleeper:
      team.sleeperLeagueId &&
      team.sleeperRosterId !== null &&
      team.sleeperUserId &&
      team.sleeperUsername &&
      team.sleeperSyncedAt
        ? {
            leagueId: team.sleeperLeagueId,
            rosterId: team.sleeperRosterId,
            userId: team.sleeperUserId,
            username: team.sleeperUsername,
            syncedAt: team.sleeperSyncedAt.toISOString()
          }
        : null,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString()
  };
}

export function toSavedWeeklyReportDto(savedReport: WeeklyReport): SavedWeeklyReport {
  const scoringRules = toNumberRecord(savedReport.scoringRules);

  return {
    id: savedReport.id,
    fantasyTeamId: savedReport.fantasyTeamId,
    teamName: savedReport.teamName,
    week: savedReport.week,
    settings: {
      scoringFormat: savedReport.scoringFormat,
      lineupSlots: savedReport.lineupSlots,
      ...(scoringRules ? { scoringRules } : {})
    },
    roster: savedReport.rosterSnapshot as unknown as RosterPlayer[],
    report: savedReport.reportSnapshot as unknown as RecommendationReport,
    createdAt: savedReport.createdAt.toISOString()
  };
}

function toNumberRecord(value: Prisma.JsonValue | null): ScoringRules | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])
  );

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}
