import {
  adjustedProjection,
  buildLineupRecommendation,
  type LeagueSettings,
  type Player,
  type Position,
  type RosterPlayer,
  type WaiverRecommendation,
  type WaiverReport
} from "@fantasy-football/shared";

const unavailableStatuses = new Set(["OUT", "IR", "SUSPENDED"]);
const minimumStarterUpgrade = 0.5;
const minimumDepthUpgrade = 1;
const maximumRecommendations = 5;

interface WaiverReportInput {
  week: number;
  leagueId: string;
  settings: LeagueSettings;
  roster: RosterPlayer[];
  availablePlayers: Player[];
  rosteredPlayerCount: number;
}

export function buildWaiverReport(input: WaiverReportInput): WaiverReport {
  const baselineReport = buildLineupRecommendation({
    week: input.week,
    settings: input.settings,
    roster: input.roster
  });
  const baselinePlayers = [...baselineReport.starters.map(({ player }) => player), ...baselineReport.bench];
  const currentRosterIds = new Set(baselinePlayers.map((player) => player.id));
  const baselineStarterTotal = projectedStarterTotal(baselineReport.starters.map(({ player }) => player));
  const depthNeeds = positionsWithNeeds(baselineReport.positionNeeds);

  const rankedRecommendations = input.availablePlayers
    .filter((player) => !currentRosterIds.has(player.id))
    .filter((player) => isStartable(player, input.week))
    .map((player) => analyzeCandidate(player, input, baselinePlayers, baselineStarterTotal, depthNeeds))
    .filter((recommendation): recommendation is WaiverRecommendation => recommendation !== null)
    .sort(compareRecommendations);
  const recommendedPositions = new Set<Position>();
  const recommendations = rankedRecommendations
    .filter((recommendation) => {
      if (recommendedPositions.has(recommendation.player.position)) return false;
      recommendedPositions.add(recommendation.player.position);
      return true;
    })
    .slice(0, maximumRecommendations);

  return {
    week: input.week,
    leagueId: input.leagueId,
    rosteredPlayerCount: input.rosteredPlayerCount,
    availablePlayerCount: input.availablePlayers.filter((player) => isStartable(player, input.week)).length,
    recommendations,
    summary:
      recommendations.length === 0
        ? "No clear waiver upgrades were found among the projected free agents."
        : `Found ${recommendations.length} waiver option${recommendations.length === 1 ? "" : "s"} that can improve the starting lineup or roster depth.`
  };
}

function analyzeCandidate(
  candidate: Player,
  input: WaiverReportInput,
  baselinePlayers: Player[],
  baselineStarterTotal: number,
  depthNeeds: Set<Position>
): WaiverRecommendation | null {
  const candidateReport = buildLineupRecommendation({
    week: input.week,
    settings: input.settings,
    roster: [...input.roster, { player: candidate }]
  });
  const scoredCandidate = [...candidateReport.starters.map(({ player }) => player), ...candidateReport.bench].find(
    (player) => player.id === candidate.id
  );

  if (!scoredCandidate) return null;

  const starterIds = new Set(candidateReport.starters.map(({ player }) => player.id));
  const dropCandidate = baselinePlayers
    .filter((player) => player.position === scoredCandidate.position)
    .filter((player) => !starterIds.has(player.id))
    .sort((left, right) => adjustedProjection(left) - adjustedProjection(right))[0] ?? null;
  const lineupGain = roundPoints(
    projectedStarterTotal(candidateReport.starters.map(({ player }) => player)) - baselineStarterTotal
  );
  const projectionGain = dropCandidate
    ? roundPoints(adjustedProjection(scoredCandidate) - adjustedProjection(dropCandidate))
    : null;

  if (lineupGain >= minimumStarterUpgrade) {
    return {
      player: scoredCandidate,
      dropCandidate,
      priority: "STARTER_UPGRADE",
      lineupGain,
      projectionGain,
      reason: `${scoredCandidate.name} raises projected starter output by ${lineupGain.toFixed(1)} points in Week ${input.week}.`
    };
  }

  if (projectionGain !== null && projectionGain >= minimumDepthUpgrade) {
    return {
      player: scoredCandidate,
      dropCandidate,
      priority: "DEPTH_UPGRADE",
      lineupGain,
      projectionGain,
      reason: `${scoredCandidate.name} projects ${projectionGain.toFixed(1)} points above ${dropCandidate.name} and improves ${scoredCandidate.position} depth.`
    };
  }

  if (depthNeeds.has(scoredCandidate.position) && !dropCandidate) {
    return {
      player: scoredCandidate,
      dropCandidate: null,
      priority: "DEPTH_NEED",
      lineupGain,
      projectionGain: null,
      reason: `${scoredCandidate.name} adds a startable ${scoredCandidate.position} option where the current roster lacks depth.`
    };
  }

  return null;
}

function compareRecommendations(left: WaiverRecommendation, right: WaiverRecommendation): number {
  const priorityOrder = { STARTER_UPGRADE: 0, DEPTH_NEED: 1, DEPTH_UPGRADE: 2 } as const;

  return (
    priorityOrder[left.priority] - priorityOrder[right.priority] ||
    right.lineupGain - left.lineupGain ||
    (right.projectionGain ?? 0) - (left.projectionGain ?? 0) ||
    adjustedProjection(right.player) - adjustedProjection(left.player) ||
    left.player.name.localeCompare(right.player.name)
  );
}

function positionsWithNeeds(needs: string[]): Set<Position> {
  const positions: Position[] = ["QB", "RB", "WR", "TE"];
  return new Set(positions.filter((position) => needs.some((need) => need.includes(` ${position} `))));
}

function projectedStarterTotal(players: Player[]): number {
  return players.reduce((total, player) => total + player.projectedPoints, 0);
}

function isStartable(player: Player, week: number): boolean {
  return player.hasProjection !== false && player.byeWeek !== week && !unavailableStatuses.has(player.injuryStatus);
}

function roundPoints(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
