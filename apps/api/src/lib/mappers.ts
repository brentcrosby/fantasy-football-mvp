import type { Player as PrismaPlayer, Prisma } from "@prisma/client";
import type { PersistedFantasyTeam, Player } from "@fantasy-football/shared";

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
