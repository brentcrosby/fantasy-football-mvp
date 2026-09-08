import {
  buildLineupRecommendation,
  type LeagueMatchup,
  type LeagueOverview,
  type LeagueSettings,
  type LeagueTeam,
  type LineupSlot,
  type Player
} from "@fantasy-football/shared";

import type { SleeperLeagueContext } from "../services/sleeperLeagueImport.js";
import { buildTradeConsiderations } from "./tradeConsideration.js";

interface BuildLeagueOverviewInput {
  context: SleeperLeagueContext;
  week: number;
  userRosterId: number;
  settings: LeagueSettings;
  playersByExternalId: Map<string, Player>;
  projectionSource: string;
}

export function buildLeagueOverview(input: BuildLeagueOverviewInput): LeagueOverview {
  const teams = input.context.rosters
    .map((roster): LeagueTeam => {
      const players = roster.playerIds.flatMap((id) => {
        const player = input.playersByExternalId.get(id);
        return player ? [player] : [];
      });
      const report = buildLineupRecommendation({
        week: input.week,
        settings: input.settings,
        roster: players.map((player) => ({ player }))
      });

      return {
        rosterId: roster.rosterId,
        ownerName: roster.ownerName,
        teamName: roster.teamName,
        isUserTeam: roster.rosterId === input.userRosterId,
        record: { wins: roster.wins, losses: roster.losses, ties: roster.ties },
        pointsFor: roster.pointsFor,
        pointsAgainst: roster.pointsAgainst,
        projectedPoints: roundPoints(report.starters.reduce((total, assignment) => total + assignment.player.projectedPoints, 0)),
        actualPoints: roster.matchupPoints,
        starters: report.starters,
        bench: report.bench,
        unmatchedPlayerCount: roster.playerIds.length - players.length
      };
    })
    .sort(compareStandings);
  const tradeReport = buildTradeConsiderations({
    week: input.week,
    userRosterId: input.userRosterId,
    settings: input.settings,
    teams
  });

  return {
    league: input.context.league,
    week: input.week,
    userRosterId: input.userRosterId,
    teams,
    matchup: buildMatchup(input.context, teams, input.userRosterId),
    projectionSource: input.projectionSource,
    tradeReport
  };
}

function buildMatchup(
  context: SleeperLeagueContext,
  teams: LeagueTeam[],
  userRosterId: number
): LeagueMatchup | null {
  const userContext = context.rosters.find((roster) => roster.rosterId === userRosterId);
  const matchupId = userContext?.matchupId;

  if (!matchupId) return null;

  const opponentContext = context.rosters.find(
    (roster) => roster.rosterId !== userRosterId && roster.matchupId === matchupId
  );
  const userTeam = teams.find((team) => team.rosterId === userRosterId);
  const opponentTeam = teams.find((team) => team.rosterId === opponentContext?.rosterId);

  if (!userTeam || !opponentTeam) return null;

  return {
    matchupId,
    userRosterId,
    opponentRosterId: opponentTeam.rosterId,
    projectedMargin: roundPoints(userTeam.projectedPoints - opponentTeam.projectedPoints),
    positionEdges: buildPositionEdges(userTeam, opponentTeam)
  };
}

function buildPositionEdges(userTeam: LeagueTeam, opponentTeam: LeagueTeam) {
  const userTotals = projectionBySlot(userTeam);
  const opponentTotals = projectionBySlot(opponentTeam);
  const slots = [...new Set([...userTotals.keys(), ...opponentTotals.keys()])];

  return slots.map((slot) => {
    const userProjectedPoints = roundPoints(userTotals.get(slot) ?? 0);
    const opponentProjectedPoints = roundPoints(opponentTotals.get(slot) ?? 0);
    const difference = userProjectedPoints - opponentProjectedPoints;

    return {
      slot,
      userProjectedPoints,
      opponentProjectedPoints,
      advantage: difference > 0.05 ? "USER" as const : difference < -0.05 ? "OPPONENT" as const : "EVEN" as const
    };
  });
}

function projectionBySlot(team: LeagueTeam): Map<LineupSlot, number> {
  const totals = new Map<LineupSlot, number>();

  for (const assignment of team.starters) {
    totals.set(assignment.slot, (totals.get(assignment.slot) ?? 0) + assignment.player.projectedPoints);
  }

  return totals;
}

function compareStandings(left: LeagueTeam, right: LeagueTeam): number {
  return (
    right.record.wins - left.record.wins ||
    left.record.losses - right.record.losses ||
    right.pointsFor - left.pointsFor ||
    left.teamName.localeCompare(right.teamName)
  );
}

function roundPoints(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
