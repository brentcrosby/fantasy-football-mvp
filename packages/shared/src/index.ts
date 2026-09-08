export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";
export type LineupSlot = Position | "FLEX";
export type ScoringFormat = "STANDARD" | "HALF_PPR" | "PPR" | "CUSTOM";
export type InjuryStatus = "HEALTHY" | "QUESTIONABLE" | "DOUBTFUL" | "OUT" | "IR" | "SUSPENDED";
export type ScoringRules = Record<string, number>;
export type ProjectionStatLine = Record<string, number>;
export type ProjectionMethod = "LEAGUE_RULES" | "PROVIDER_TOTAL";

export interface ProjectionBreakdownEntry {
  stat: string;
  label: string;
  projectedValue: number;
  pointsPerUnit: number;
  fantasyPoints: number;
}

export interface Player {
  id: string;
  name: string;
  position: Position;
  nflTeam: string;
  byeWeek: number;
  injuryStatus: InjuryStatus;
  projectedPoints: number;
  hasProjection?: boolean;
  targetShare?: number;
  projectionStats?: ProjectionStatLine;
  projectionSource?: string;
  projectionMethod?: ProjectionMethod;
  projectionBreakdown?: ProjectionBreakdownEntry[];
  experimentalProjection?: ExperimentalProjection;
}

export interface ExperimentalProjection {
  points: number;
  low: number;
  high: number;
  version: string;
  scoringFormat: "PPR";
  status: "EXPERIMENTAL";
  recentGames: number;
}

export interface ProjectionModelSummary {
  version: string;
  status: "EXPERIMENTAL";
  validationSeason: number;
  trainingRows: number;
  validationRows: number;
  modelMae: number;
  baselineMae: number;
  sourceLabel: string;
}

export type PlayerDataFreshnessStatus = "FRESH" | "STALE" | "UNAVAILABLE";
export type PlayerDataSyncStatus = "RUNNING" | "SUCCESS" | "SKIPPED" | "FAILED";

export interface PlayerDataFreshness {
  status: PlayerDataFreshnessStatus;
  lastSuccessfulSyncAt: string | null;
  lastAttemptAt: string | null;
  lastAttemptStatus: PlayerDataSyncStatus | null;
}

export interface PlayerCatalogMetadata {
  source: "LIVE" | "SAMPLE";
  sourceLabel: string;
  season: number | null;
  week: number | null;
  updatedAt: string | null;
  syncedAt: string | null;
  freshness: PlayerDataFreshness;
  model?: ProjectionModelSummary;
}

export interface PlayerCatalog {
  players: Player[];
  metadata: PlayerCatalogMetadata;
}

export interface RosterPlayer {
  player: Player;
}

export interface LeagueSettings {
  scoringFormat: ScoringFormat;
  lineupSlots: LineupSlot[];
  scoringRules?: ScoringRules;
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
  sleeper: SleeperTeamConnection | null;
  createdAt: string;
  updatedAt: string;
}

export interface SleeperTeamConnection {
  leagueId: string;
  rosterId: number;
  userId: string;
  username: string;
  syncedAt: string;
}

export interface SleeperUserSummary {
  id: string;
  username: string;
  displayName: string;
}

export interface SleeperLeagueSummary {
  id: string;
  name: string;
  season: number;
  status: string;
}

export interface SleeperLeagueLookup {
  user: SleeperUserSummary;
  season: number;
  leagues: SleeperLeagueSummary[];
}

export interface SleeperImportRequest {
  username: string;
  leagueId: string;
}

export interface SleeperImportPreview {
  user: SleeperUserSummary;
  league: SleeperLeagueSummary;
  teamName: string;
  settings: LeagueSettings | null;
  rosterPlayers: Player[];
  unmatchedPlayerIds: string[];
  unsupportedLineupSlots: string[];
  warnings: string[];
  canImport: boolean;
  existingTeamId: string | null;
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
  projectionSummary?: {
    method: ProjectionMethod | "MIXED";
    sourceLabel: string;
    message: string;
  };
}

export interface SavedWeeklyReport {
  id: string;
  fantasyTeamId: string;
  teamName: string;
  week: number;
  settings: LeagueSettings;
  roster: RosterPlayer[];
  report: RecommendationReport;
  createdAt: string;
}

export interface SaveWeeklyReportRequest {
  week: number;
}

export type WaiverRecommendationPriority = "STARTER_UPGRADE" | "DEPTH_UPGRADE" | "DEPTH_NEED";

export interface WaiverRecommendation {
  player: Player;
  dropCandidate: Player | null;
  priority: WaiverRecommendationPriority;
  lineupGain: number;
  projectionGain: number | null;
  reason: string;
}

export interface WaiverReport {
  week: number;
  leagueId: string;
  rosteredPlayerCount: number;
  availablePlayerCount: number;
  recommendations: WaiverRecommendation[];
  summary: string;
}

export interface LeagueRecord {
  wins: number;
  losses: number;
  ties: number;
}

export interface LeagueTeam {
  rosterId: number;
  ownerName: string;
  teamName: string;
  isUserTeam: boolean;
  record: LeagueRecord;
  pointsFor: number;
  pointsAgainst: number;
  projectedPoints: number;
  actualPoints: number | null;
  starters: SlotAssignment[];
  bench: Player[];
  unmatchedPlayerCount: number;
}

export interface MatchupPositionEdge {
  slot: LineupSlot;
  userProjectedPoints: number;
  opponentProjectedPoints: number;
  advantage: "USER" | "OPPONENT" | "EVEN";
}

export interface LeagueMatchup {
  matchupId: number;
  userRosterId: number;
  opponentRosterId: number;
  projectedMargin: number;
  positionEdges: MatchupPositionEdge[];
}

export interface LeagueOverview {
  league: SleeperLeagueSummary;
  week: number;
  userRosterId: number;
  teams: LeagueTeam[];
  matchup: LeagueMatchup | null;
  projectionSource: string;
  tradeReport: TradeConsiderationReport;
  alertReport: LeagueAlertReport;
}

export type LeagueAlertType = "INJURY_STATUS" | "PROJECTION_RISE" | "PROJECTION_FALL";
export type LeagueAlertScope = "YOUR_ROSTER" | "MATCHUP_OPPONENT" | "LEAGUE_STARTER" | "LEAGUE_BENCH";

export interface LeagueAlert {
  id: string;
  type: LeagueAlertType;
  scope: LeagueAlertScope;
  player: Player;
  team: TradePartnerSummary;
  previousInjuryStatus: InjuryStatus | null;
  injuryStatus: InjuryStatus | null;
  previousProjectedPoints: number | null;
  projectedPoints: number | null;
  createdAt: string;
  summary: string;
}

export interface LeagueAlertReport {
  week: number;
  alerts: LeagueAlert[];
  summary: string;
}

export type TradeConsiderationRole = "STARTER_UPGRADE" | "DEPTH_TARGET" | "MODEL_BUY_LOW";

export interface TradePartnerSummary {
  rosterId: number;
  teamName: string;
  ownerName: string;
}

export interface TradeConsideration {
  targetPlayer: Player;
  targetTeam: TradePartnerSummary;
  possibleTradePieces: Player[];
  role: TradeConsiderationRole;
  providerUpgrade: number | null;
  modelGap: number | null;
  reasons: string[];
}

export interface TradeConsiderationReport {
  week: number;
  scoringFormat: ScoringFormat;
  considerations: TradeConsideration[];
  summary: string;
  modelUsed: boolean;
}

const FLEX_POSITIONS: Position[] = ["RB", "WR", "TE"];
const REQUIRED_STARTER_POSITIONS: Position[] = ["QB", "RB", "WR", "TE"];
const DEPTH_POSITIONS: Position[] = ["RB", "WR", "TE"];
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

const BASE_SCORING_RULES: ScoringRules = {
  pass_yd: 0.04,
  pass_td: 4,
  pass_int: -2,
  pass_2pt: 2,
  rush_yd: 0.1,
  rush_td: 6,
  rush_2pt: 2,
  rec_yd: 0.1,
  rec_td: 6,
  rec_2pt: 2,
  fum_lost: -2,
  xpm: 1,
  fgm_0_19: 3,
  fgm_20_29: 3,
  fgm_30_39: 3,
  fgm_40_49: 4,
  fgm_50p: 5,
  sack: 1,
  int: 2,
  fum_rec: 2,
  def_td: 6,
  safe: 2,
  blk_kick: 2,
  def_2pt: 2,
  pts_allow_0: 10,
  pts_allow_1_6: 7,
  pts_allow_7_13: 4,
  pts_allow_14_20: 1,
  pts_allow_21_27: 0,
  pts_allow_28_34: -1,
  pts_allow_35p: -4
};

const STAT_LABELS: Record<string, string> = {
  pass_yd: "Passing yards",
  pass_td: "Passing TDs",
  pass_int: "Interceptions",
  pass_2pt: "Passing 2-point conversions",
  rush_yd: "Rushing yards",
  rush_td: "Rushing TDs",
  rush_2pt: "Rushing 2-point conversions",
  rec: "Receptions",
  rec_yd: "Receiving yards",
  rec_td: "Receiving TDs",
  rec_2pt: "Receiving 2-point conversions",
  fum_lost: "Fumbles lost",
  xpm: "Extra points made",
  fgm_0_19: "Field goals, 0-19 yards",
  fgm_20_29: "Field goals, 20-29 yards",
  fgm_30_39: "Field goals, 30-39 yards",
  fgm_40_49: "Field goals, 40-49 yards",
  fgm_50p: "Field goals, 50+ yards",
  sack: "Sacks",
  int: "Defensive interceptions",
  fum_rec: "Fumble recoveries",
  def_td: "Defensive TDs",
  safe: "Safeties",
  blk_kick: "Blocked kicks",
  def_2pt: "Defensive 2-point returns",
  pts_allow_0: "Shutouts",
  pts_allow_1_6: "Games allowing 1-6 points",
  pts_allow_7_13: "Games allowing 7-13 points",
  pts_allow_14_20: "Games allowing 14-20 points",
  pts_allow_21_27: "Games allowing 21-27 points",
  pts_allow_28_34: "Games allowing 28-34 points",
  pts_allow_35p: "Games allowing 35+ points"
};

export function defaultScoringRules(scoringFormat: ScoringFormat): ScoringRules {
  return {
    ...BASE_SCORING_RULES,
    rec: scoringFormat === "PPR" ? 1 : scoringFormat === "HALF_PPR" ? 0.5 : 0
  };
}

export function scoreProjectedStatLine(
  stats: ProjectionStatLine,
  scoringRules: ScoringRules
): { points: number; breakdown: ProjectionBreakdownEntry[]; matchedStatCount: number } {
  const breakdown = Object.entries(stats).flatMap(([stat, projectedValue]) => {
    const pointsPerUnit = scoringRules[stat];

    if (!Number.isFinite(projectedValue) || !Number.isFinite(pointsPerUnit)) return [];

    const fantasyPoints = projectedValue * pointsPerUnit;

    return [{
      stat,
      label: STAT_LABELS[stat] ?? stat.replaceAll("_", " "),
      projectedValue,
      pointsPerUnit,
      fantasyPoints
    }];
  });

  return {
    points: roundProjection(breakdown.reduce((total, entry) => total + entry.fantasyPoints, 0)),
    breakdown: breakdown
      .filter((entry) => entry.projectedValue !== 0 && entry.fantasyPoints !== 0)
      .sort((left, right) => Math.abs(right.fantasyPoints) - Math.abs(left.fantasyPoints)),
    matchedStatCount: breakdown.length
  };
}

export function buildLineupRecommendation(request: RecommendationRequest): RecommendationReport {
  const scoringRules = request.settings.scoringRules ?? defaultScoringRules(request.settings.scoringFormat);
  const scoredRoster = request.roster.map(({ player }) => ({ player: applyLeagueProjection(player, scoringRules) }));
  const scoredRequest = { ...request, roster: scoredRoster };
  const selectedIds = new Set<string>();
  const starters: SlotAssignment[] = [];
  const riskNotes = buildRiskNotes(scoredRequest);

  for (const slot of request.settings.lineupSlots) {
    const eligiblePlayers = scoredRoster
      .map((rosterPlayer) => rosterPlayer.player)
      .filter((player) => !selectedIds.has(player.id))
      .filter((player) => isEligibleForSlot(player, slot))
      .filter((player) => isStartable(player, request.week))
      .sort((a, b) => adjustedProjection(b) - adjustedProjection(a));

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

  const bench = scoredRoster
    .map((rosterPlayer) => rosterPlayer.player)
    .filter((player) => !selectedIds.has(player.id))
    .sort((a, b) => adjustedProjection(b) - adjustedProjection(a));

  const positionNeeds = buildPositionNeeds(scoredRequest, starters, bench);

  return {
    week: request.week,
    starters,
    bench,
    riskNotes,
    positionNeeds,
    summary: buildSummary(starters, riskNotes, positionNeeds),
    projectionSummary: buildProjectionSummary(scoredRoster.map(({ player }) => player))
  };
}

export function adjustedProjection(player: Player): number {
  const injuryPenalty = player.injuryStatus === "QUESTIONABLE" ? 1.5 : player.injuryStatus === "DOUBTFUL" ? 4 : 0;

  return Math.max(0, player.projectedPoints - injuryPenalty);
}

function applyLeagueProjection(player: Player, scoringRules: ScoringRules): Player {
  if (!player.projectionStats) {
    return { ...player, projectionMethod: "PROVIDER_TOTAL" };
  }

  const result = scoreProjectedStatLine(player.projectionStats, scoringRules);

  if (result.matchedStatCount === 0) {
    return { ...player, projectionMethod: "PROVIDER_TOTAL" };
  }

  return {
    ...player,
    projectedPoints: Math.max(0, result.points),
    projectionMethod: "LEAGUE_RULES",
    projectionBreakdown: result.breakdown
  };
}

function buildProjectionSummary(players: Player[]): NonNullable<RecommendationReport["projectionSummary"]> {
  const methods = new Set(players.map((player) => player.projectionMethod ?? "PROVIDER_TOTAL"));
  const sources = [...new Set(players.map((player) => player.projectionSource).filter((source): source is string => Boolean(source)))];
  const sourceLabel = sources.length === 1 ? sources[0] : sources.length > 1 ? "Multiple projection sources" : "Projection provider";

  if (methods.size === 1 && methods.has("LEAGUE_RULES")) {
    return {
      method: "LEAGUE_RULES",
      sourceLabel,
      message: "Projected stat lines were scored with this team's league rules."
    };
  }

  if (methods.size > 1) {
    return {
      method: "MIXED",
      sourceLabel,
      message: "League scoring was applied where stat lines were available; remaining players use provider totals."
    };
  }

  return {
    method: "PROVIDER_TOTAL",
    sourceLabel,
    message: "This source supplies point totals without stat components, so provider totals are shown unchanged."
  };
}

function roundProjection(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

    if (player.hasProjection === false) {
      notes.push(`${player.name} does not have a current point projection.`);
    }

    return notes;
  });
}

function buildPositionNeeds(request: RecommendationRequest, starters: SlotAssignment[], bench: Player[]): string[] {
  const needs: string[] = [];
  const starterCounts = countByPosition(starters.map((assignment) => assignment.player));
  const benchCounts = countByPosition(bench.filter((player) => isStartable(player, request.week)));

  for (const position of REQUIRED_STARTER_POSITIONS) {
    if ((starterCounts[position] ?? 0) === 0) {
      needs.push(`No startable ${position} filled in the current lineup.`);
    }
  }

  for (const position of DEPTH_POSITIONS) {
    if ((starterCounts[position] ?? 0) > 0 && (benchCounts[position] ?? 0) === 0) {
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
