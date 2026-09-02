export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";
export type LineupSlot = Position | "FLEX";
export type ScoringFormat = "STANDARD" | "HALF_PPR" | "PPR";
export type InjuryStatus = "HEALTHY" | "QUESTIONABLE" | "DOUBTFUL" | "OUT" | "IR" | "SUSPENDED";

export interface Player {
  id: string;
  name: string;
  position: Position;
  nflTeam: string;
  byeWeek: number;
  injuryStatus: InjuryStatus;
  projectedPoints: number;
  targetShare?: number;
}

export interface RosterPlayer {
  player: Player;
}

export interface LeagueSettings {
  scoringFormat: ScoringFormat;
  lineupSlots: LineupSlot[];
}

export interface RecommendationRequest {
  week: number;
  settings: LeagueSettings;
  roster: RosterPlayer[];
}

export interface RecommendationApiRequest {
  week: number;
  settings: LeagueSettings;
  rosterPlayerIds: string[];
}

export interface PersistedFantasyTeam {
  id: string;
  name: string;
  settings: LeagueSettings;
  roster: RosterPlayer[];
  createdAt: string;
  updatedAt: string;
}

export interface TeamWriteRequest {
  name: string;
  settings: LeagueSettings;
  rosterPlayerIds: string[];
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SlotAssignment {
  slot: LineupSlot;
  player: Player;
  reason: string;
}

export interface RecommendationReport {
  week: number;
  starters: SlotAssignment[];
  bench: Player[];
  riskNotes: string[];
  positionNeeds: string[];
  summary: string;
}

const FLEX_POSITIONS: Position[] = ["RB", "WR", "TE"];
const DEPTH_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];
const UNAVAILABLE_STATUSES: InjuryStatus[] = ["OUT", "IR", "SUSPENDED"];

export const DEFAULT_LINEUP_SLOTS: LineupSlot[] = [
  "QB",
  "RB",
  "RB",
  "WR",
  "WR",
  "TE",
  "FLEX",
  "K",
  "DST"
];

export function buildLineupRecommendation(request: RecommendationRequest): RecommendationReport {
  const selectedIds = new Set<string>();
  const starters: SlotAssignment[] = [];
  const riskNotes = buildRiskNotes(request);

  for (const slot of request.settings.lineupSlots) {
    const eligiblePlayers = request.roster
      .map((rosterPlayer) => rosterPlayer.player)
      .filter((player) => !selectedIds.has(player.id))
      .filter((player) => isEligibleForSlot(player, slot))
      .filter((player) => isStartable(player, request.week))
      .sort((a, b) => adjustedProjection(b, request.settings.scoringFormat) - adjustedProjection(a, request.settings.scoringFormat));

    const selected = eligiblePlayers[0];

    if (selected) {
      selectedIds.add(selected.id);
      starters.push({
        slot,
        player: selected,
        reason: `${selected.name} is the highest projected available ${slotLabel(slot)} option.`
      });
    }
  }

  const bench = request.roster
    .map((rosterPlayer) => rosterPlayer.player)
    .filter((player) => !selectedIds.has(player.id))
    .sort((a, b) => adjustedProjection(b, request.settings.scoringFormat) - adjustedProjection(a, request.settings.scoringFormat));

  const positionNeeds = buildPositionNeeds(request, starters, bench);

  return {
    week: request.week,
    starters,
    bench,
    riskNotes,
    positionNeeds,
    summary: buildSummary(starters, riskNotes, positionNeeds)
  };
}

export function adjustedProjection(player: Player, scoringFormat: ScoringFormat): number {
  const receptionValue = scoringFormat === "PPR" ? 1 : scoringFormat === "HALF_PPR" ? 0.5 : 0;
  const receivingUsageBoost = player.targetShare ? player.targetShare * receptionValue : 0;
  const injuryPenalty = player.injuryStatus === "QUESTIONABLE" ? 1.5 : player.injuryStatus === "DOUBTFUL" ? 4 : 0;

  return Math.max(0, player.projectedPoints + receivingUsageBoost - injuryPenalty);
}

function isEligibleForSlot(player: Player, slot: LineupSlot): boolean {
  if (slot === "FLEX") {
    return FLEX_POSITIONS.includes(player.position);
  }

  return player.position === slot;
}

function isStartable(player: Player, week: number): boolean {
  return player.byeWeek !== week && !UNAVAILABLE_STATUSES.includes(player.injuryStatus);
}

function buildRiskNotes(request: RecommendationRequest): string[] {
  return request.roster.flatMap(({ player }) => {
    const notes: string[] = [];

    if (player.byeWeek === request.week) {
      notes.push(`${player.name} is on bye in Week ${request.week}.`);
    }

    if (player.injuryStatus !== "HEALTHY") {
      notes.push(`${player.name} is listed as ${player.injuryStatus.toLowerCase().replace("_", " ")}.`);
    }

    return notes;
  });
}

function buildPositionNeeds(request: RecommendationRequest, starters: SlotAssignment[], bench: Player[]): string[] {
  const needs: string[] = [];
  const starterCounts = countByPosition(starters.map((assignment) => assignment.player));
  const benchCounts = countByPosition(bench.filter((player) => isStartable(player, request.week)));

  for (const position of DEPTH_POSITIONS) {
    if ((starterCounts[position] ?? 0) === 0) {
      needs.push(`No startable ${position} filled in the current lineup.`);
    } else if ((benchCounts[position] ?? 0) === 0) {
      needs.push(`Limited ${position} depth behind the starters.`);
    }
  }

  return needs;
}

function countByPosition(players: Player[]): Partial<Record<Position, number>> {
  return players.reduce<Partial<Record<Position, number>>>((counts, player) => {
    counts[player.position] = (counts[player.position] ?? 0) + 1;
    return counts;
  }, {});
}

function buildSummary(starters: SlotAssignment[], riskNotes: string[], positionNeeds: string[]): string {
  if (starters.length === 0) {
    return "No startable lineup could be generated from the current roster.";
  }

  const riskText = riskNotes.length > 0 ? `${riskNotes.length} roster risk note${riskNotes.length === 1 ? "" : "s"}` : "no major roster risks";
  const needText = positionNeeds.length > 0 ? `${positionNeeds.length} position need${positionNeeds.length === 1 ? "" : "s"}` : "balanced bench depth";

  return `Generated ${starters.length} recommended starters with ${riskText} and ${needText}.`;
}

function slotLabel(slot: LineupSlot): string {
  return slot === "FLEX" ? "flex" : slot;
}
