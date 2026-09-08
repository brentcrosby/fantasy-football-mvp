import type {
  InjuryStatus,
  LeagueAlertReport,
  LeagueAlertScope,
  LeagueAlertType,
  LeagueTeam,
  Player,
  TradePartnerSummary
} from "@fantasy-football/shared";

export interface StoredLeagueAlert {
  id: string;
  playerId: string;
  type: LeagueAlertType;
  previousInjuryStatus: InjuryStatus | null;
  injuryStatus: InjuryStatus | null;
  previousProjectedPoints: number | null;
  projectedPoints: number | null;
  createdAt: Date;
}

interface BuildLeagueAlertsInput {
  week: number;
  userRosterId: number;
  opponentRosterId: number | null;
  teams: LeagueTeam[];
  storedAlerts: StoredLeagueAlert[];
}

interface PlayerPlacement {
  player: Player;
  team: LeagueTeam;
  isStarter: boolean;
}

const maximumAlerts = 12;

export function buildLeagueAlerts(input: BuildLeagueAlertsInput): LeagueAlertReport {
  const placements = buildPlayerPlacements(input.teams);
  const alerts = input.storedAlerts
    .flatMap((alert) => {
      const placement = placements.get(alert.playerId);
      if (!placement) return [];

      const scope = alertScope(placement, input.userRosterId, input.opponentRosterId);
      if (scope === "LEAGUE_BENCH") return [];

      return [{
        id: alert.id,
        type: alert.type,
        scope,
        player: placement.player,
        team: teamSummary(placement.team),
        previousInjuryStatus: alert.previousInjuryStatus,
        injuryStatus: alert.injuryStatus,
        previousProjectedPoints: alert.previousProjectedPoints,
        projectedPoints: alert.projectedPoints,
        createdAt: alert.createdAt.toISOString(),
        summary: alertSummary(alert, placement, scope)
      }];
    })
    .sort((left, right) => alertPriority(right) - alertPriority(left) || right.createdAt.localeCompare(left.createdAt))
    .slice(0, maximumAlerts);

  return {
    week: input.week,
    alerts,
    summary: alerts.length === 0
      ? `No material rostered-player changes have been captured for Week ${input.week} yet.`
      : `Showing ${alerts.length} meaningful roster update${alerts.length === 1 ? "" : "s"} from the latest player-data sync.`
  };
}

function buildPlayerPlacements(teams: LeagueTeam[]): Map<string, PlayerPlacement> {
  const placements = new Map<string, PlayerPlacement>();

  for (const team of teams) {
    for (const assignment of team.starters) {
      placements.set(assignment.player.id, { player: assignment.player, team, isStarter: true });
    }
    for (const player of team.bench) {
      placements.set(player.id, { player, team, isStarter: false });
    }
  }

  return placements;
}

function alertScope(
  placement: PlayerPlacement,
  userRosterId: number,
  opponentRosterId: number | null
): LeagueAlertScope {
  if (placement.team.rosterId === userRosterId) return "YOUR_ROSTER";
  if (placement.isStarter && placement.team.rosterId === opponentRosterId) return "MATCHUP_OPPONENT";
  return placement.isStarter ? "LEAGUE_STARTER" : "LEAGUE_BENCH";
}

function alertSummary(
  alert: StoredLeagueAlert,
  placement: PlayerPlacement,
  scope: LeagueAlertScope
): string {
  const subject = scope === "YOUR_ROSTER" ? "Your roster" : placement.team.teamName;

  if (alert.type === "INJURY_STATUS") {
    return `${subject}: ${placement.player.name} changed from ${formatStatus(alert.previousInjuryStatus)} to ${formatStatus(alert.injuryStatus)}.`;
  }

  const delta = (alert.projectedPoints ?? 0) - (alert.previousProjectedPoints ?? 0);
  return `${subject}: ${placement.player.name}'s provider projection ${delta >= 0 ? "rose" : "fell"} ${Math.abs(delta).toFixed(1)} points to ${(alert.projectedPoints ?? 0).toFixed(1)}.`;
}

function alertPriority(alert: { scope: LeagueAlertScope; type: LeagueAlertType; injuryStatus: InjuryStatus | null }): number {
  const scopeScore = {
    YOUR_ROSTER: 40,
    MATCHUP_OPPONENT: 30,
    LEAGUE_STARTER: 20,
    LEAGUE_BENCH: 0
  }[alert.scope];
  const typeScore = alert.type === "INJURY_STATUS"
    ? injurySeverity(alert.injuryStatus)
    : alert.type === "PROJECTION_FALL" ? 8 : 5;
  return scopeScore + typeScore;
}

function injurySeverity(status: InjuryStatus | null): number {
  if (status === "OUT" || status === "IR" || status === "SUSPENDED") return 20;
  if (status === "DOUBTFUL") return 16;
  if (status === "QUESTIONABLE") return 12;
  return 4;
}

function formatStatus(status: InjuryStatus | null): string {
  return (status ?? "HEALTHY").toLowerCase().replace("_", " ");
}

function teamSummary(team: LeagueTeam): TradePartnerSummary {
  return { rosterId: team.rosterId, teamName: team.teamName, ownerName: team.ownerName };
}
