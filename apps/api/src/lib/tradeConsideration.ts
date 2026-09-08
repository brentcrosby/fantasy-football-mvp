import type {
  LeagueSettings,
  LeagueTeam,
  Player,
  Position,
  TradeConsideration,
  TradeConsiderationReport,
  TradeConsiderationRole
} from "@fantasy-football/shared";

const tradePositions: Position[] = ["QB", "RB", "WR", "TE"];
// Bench depth is most actionable at the high-volume RB and WR positions. A
// second QB or TE is not, by itself, enough reason to recommend a trade.
const depthPositions = new Set<Position>(["RB", "WR"]);
const unavailableStatuses = new Set(["OUT", "IR", "SUSPENDED"]);
const minimumProviderImprovement = 1;
const minimumModelGap = 2;
const maximumConsiderations = 8;

interface BuildTradeConsiderationsInput {
  week: number;
  userRosterId: number;
  settings: LeagueSettings;
  teams: LeagueTeam[];
}

interface PositionNeed {
  position: Position;
  severity: number;
  reason: string;
  baseline: number;
}

interface RankedConsideration {
  consideration: TradeConsideration;
  score: number;
}

export function buildTradeConsiderations(input: BuildTradeConsiderationsInput): TradeConsiderationReport {
  const userTeam = input.teams.find((team) => team.rosterId === input.userRosterId);
  const modelUsed = input.settings.scoringFormat === "PPR";

  if (!userTeam) {
    return emptyReport(input, modelUsed, "The connected Sleeper roster is not present in the current league.");
  }

  const leagueMedians = buildLeagueStarterMedians(input.teams);
  const userNeeds = findPositionNeeds(userTeam, input.settings, leagueMedians, input.week);
  const userBench = userTeam.bench.filter((player) => isTradeable(player, input.week));
  const ranked: RankedConsideration[] = [];

  for (const opponent of input.teams.filter((team) => !team.isUserTeam)) {
    const opponentNeeds = findPositionNeeds(opponent, input.settings, leagueMedians, input.week);
    const opponentNeedPositions = new Set(opponentNeeds.map((need) => need.position));
    const possibleTradePieces = userBench
      .filter((player) => opponentNeedPositions.has(player.position))
      .sort((left, right) => right.projectedPoints - left.projectedPoints)
      .slice(0, 3);

    if (possibleTradePieces.length === 0) continue;

    for (const need of userNeeds) {
      const targetCandidates = opponent.bench
        .filter((player) => player.position === need.position)
        .filter((player) => isTradeable(player, input.week))
        .sort((left, right) => right.projectedPoints - left.projectedPoints)
        .slice(0, 2);

      for (const targetPlayer of targetCandidates) {
        const providerUpgrade = roundPoints(targetPlayer.projectedPoints - need.baseline);
        const modelGap = modelUsed && targetPlayer.experimentalProjection
          ? roundPoints(targetPlayer.experimentalProjection.points - targetPlayer.projectedPoints)
          : null;

        if (providerUpgrade < minimumProviderImprovement && (modelGap ?? 0) < minimumModelGap) continue;

        const role = considerationRole(need, providerUpgrade, modelGap);
        const reasons = [
          need.reason,
          `${opponent.teamName} has ${targetPlayer.name} outside its projected starting lineup.`,
          `${opponent.teamName} has a need at ${formatPositionList([...new Set(possibleTradePieces.map((player) => player.position))])}, where your bench has possible conversation pieces.`
        ];

        if (modelGap !== null && modelGap >= minimumModelGap) {
          reasons.push(
            `The experimental PPR model is ${modelGap.toFixed(1)} points above the provider projection for ${targetPlayer.name}.`
          );
        }

        ranked.push({
          consideration: {
            targetPlayer,
            targetTeam: {
              rosterId: opponent.rosterId,
              teamName: opponent.teamName,
              ownerName: opponent.ownerName
            },
            possibleTradePieces,
            role,
            providerUpgrade: providerUpgrade > 0 ? providerUpgrade : null,
            modelGap,
            reasons
          },
          score: need.severity * 10 + Math.max(0, providerUpgrade) + Math.max(0, modelGap ?? 0) * 0.75
        });
      }
    }
  }

  const seenTargets = new Set<string>();
  const considerations = ranked
    .sort((left, right) => right.score - left.score || right.consideration.targetPlayer.projectedPoints - left.consideration.targetPlayer.projectedPoints)
    .filter(({ consideration }) => {
      if (seenTargets.has(consideration.targetPlayer.id)) return false;
      seenTargets.add(consideration.targetPlayer.id);
      return true;
    })
    .slice(0, maximumConsiderations)
    .map(({ consideration }) => consideration);

  return {
    week: input.week,
    scoringFormat: input.settings.scoringFormat,
    considerations,
    summary: considerations.length === 0
      ? "No clear mutually useful trade conversations were found from current roster needs and projected benches."
      : `Found ${considerations.length} trade conversation${considerations.length === 1 ? "" : "s"} with a plausible roster fit for both teams.`,
    modelUsed
  };
}

function findPositionNeeds(
  team: LeagueTeam,
  settings: LeagueSettings,
  leagueMedians: Map<Position, number>,
  week: number
): PositionNeed[] {
  const requiredCounts = countRequiredPositions(settings);
  const startablePlayers = [...team.starters.map(({ player }) => player), ...team.bench]
    .filter((player) => isTradeable(player, week));
  const startersByPosition = groupPlayersByPosition(team.starters.map(({ player }) => player));
  const rosterByPosition = groupPlayersByPosition(startablePlayers);

  return tradePositions.flatMap((position) => {
    const required = requiredCounts.get(position) ?? 0;
    if (required === 0) return [];

    const starters = startersByPosition.get(position) ?? [];
    const rosterPlayers = rosterByPosition.get(position) ?? [];
    const strongestStarter = Math.max(0, ...starters.map((player) => player.projectedPoints));
    const benchPlayers = team.bench.filter((player) => player.position === position && isTradeable(player, week));

    if (starters.length < required) {
      return [{
        position,
        severity: 4,
        reason: `${team.isUserTeam ? "Your team" : team.teamName} has an unfilled ${position} starter slot.`,
        baseline: strongestStarter
      }];
    }

    const leagueMedian = leagueMedians.get(position) ?? 0;
    if (leagueMedian - strongestStarter >= 1.5) {
      return [{
        position,
        severity: 3,
        reason: `${team.isUserTeam ? "Your" : `${team.teamName}'s`} top ${position} projection is ${roundPoints(leagueMedian - strongestStarter).toFixed(1)} points below the league median.`,
        baseline: strongestStarter
      }];
    }

    if (depthPositions.has(position) && (rosterPlayers.length <= required || benchPlayers.length === 0)) {
      return [{
        position,
        severity: 2,
        reason: `${team.isUserTeam ? "Your team" : team.teamName} has no startable ${position} depth behind the projected starters.`,
        baseline: Math.max(0, ...benchPlayers.map((player) => player.projectedPoints))
      }];
    }

    return [];
  });
}

function buildLeagueStarterMedians(teams: LeagueTeam[]): Map<Position, number> {
  return new Map(tradePositions.map((position) => {
    const projections = teams
      .map((team) => Math.max(0, ...team.starters
        .map(({ player }) => player)
        .filter((player) => player.position === position)
        .map((player) => player.projectedPoints)))
      .sort((left, right) => left - right);

    if (projections.length === 0) return [position, 0];

    const middle = Math.floor(projections.length / 2);
    const median = projections.length % 2 === 0
      ? (projections[middle - 1] + projections[middle]) / 2
      : projections[middle];
    return [position, roundPoints(median)];
  }));
}

function countRequiredPositions(settings: LeagueSettings): Map<Position, number> {
  const counts = new Map<Position, number>();

  for (const slot of settings.lineupSlots) {
    if (slot === "FLEX" || slot === "K" || slot === "DST") continue;
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }

  return counts;
}

function groupPlayersByPosition(players: Player[]): Map<Position, Player[]> {
  const grouped = new Map<Position, Player[]>();

  for (const player of players) {
    grouped.set(player.position, [...(grouped.get(player.position) ?? []), player]);
  }

  return grouped;
}

function considerationRole(need: PositionNeed, providerUpgrade: number, modelGap: number | null): TradeConsiderationRole {
  if ((modelGap ?? 0) >= minimumModelGap && providerUpgrade < minimumProviderImprovement) return "MODEL_BUY_LOW";
  return need.severity >= 3 ? "STARTER_UPGRADE" : "DEPTH_TARGET";
}

function isTradeable(player: Player, week: number): boolean {
  return player.hasProjection !== false && player.byeWeek !== week && !unavailableStatuses.has(player.injuryStatus);
}

function formatPositionList(positions: Position[]): string {
  if (positions.length <= 1) return positions[0] ?? "another position";
  return `${positions.slice(0, -1).join(", ")} or ${positions.at(-1)}`;
}

function emptyReport(
  input: BuildTradeConsiderationsInput,
  modelUsed: boolean,
  summary: string
): TradeConsiderationReport {
  return {
    week: input.week,
    scoringFormat: input.settings.scoringFormat,
    considerations: [],
    summary,
    modelUsed
  };
}

function roundPoints(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
