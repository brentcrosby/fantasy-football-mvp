import type { Player as PrismaPlayer, Prisma, WeeklyReport } from "@prisma/client";
import type {
  PersistedFantasyTeam,
  Player,
  RecommendationReport,
  RosterPlayer,
  SavedWeeklyReport
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
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    nflTeam: player.nflTeam,
    byeWeek: player.byeWeek,
    injuryStatus: player.injuryStatus,
    projectedPoints: player.projectedPoints,
    ...(player.targetShare === null ? {} : { targetShare: player.targetShare })
  };
}

export function toTeamDto(team: TeamWithRoster): PersistedFantasyTeam {
  return {
    id: team.id,
    name: team.name,
    settings: {
      scoringFormat: team.scoringFormat,
      lineupSlots: team.lineupSlots
    },
    roster: team.rosterMemberships
      .map(({ player }) => ({ player: toPlayerDto(player) }))
      .sort((left, right) => left.player.name.localeCompare(right.player.name)),
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString()
  };
}

export function toSavedWeeklyReportDto(savedReport: WeeklyReport): SavedWeeklyReport {
  return {
    id: savedReport.id,
    fantasyTeamId: savedReport.fantasyTeamId,
    teamName: savedReport.teamName,
    week: savedReport.week,
    settings: {
      scoringFormat: savedReport.scoringFormat,
      lineupSlots: savedReport.lineupSlots
    },
    roster: savedReport.rosterSnapshot as unknown as RosterPlayer[],
    report: savedReport.reportSnapshot as unknown as RecommendationReport,
    createdAt: savedReport.createdAt.toISOString()
  };
}
