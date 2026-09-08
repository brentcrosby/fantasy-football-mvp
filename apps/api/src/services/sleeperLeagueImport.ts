import type {
  LineupSlot,
  ScoringFormat,
  ScoringRules,
  SleeperLeagueLookup,
  SleeperLeagueSummary,
  SleeperUserSummary
} from "@fantasy-football/shared";
import { z } from "zod";

import { ApiError } from "../lib/apiError.js";

const ignoredRosterSlots = new Set(["BN", "IR", "TAXI"]);
const supportedRosterSlots: Record<string, LineupSlot> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DST",
  DST: "DST",
  FLEX: "FLEX",
  WRRB_FLEX: "FLEX",
  REC_FLEX: "FLEX"
};

const sleeperUserSchema = z
  .object({
    user_id: z.string(),
    username: z.string().nullish(),
    display_name: z.string().nullish()
  })
  .passthrough();

const sleeperStateSchema = z
  .object({
    season: z.coerce.number().int().min(2000),
    season_type: z.string()
  })
  .passthrough();

const sleeperLeagueSchema = z
  .object({
    league_id: z.string(),
    name: z.string(),
    season: z.coerce.number().int().min(2000),
    status: z.string(),
    sport: z.literal("nfl"),
    roster_positions: z.array(z.string()).max(40),
    scoring_settings: z.record(z.string(), z.number())
  })
  .passthrough();

const sleeperRosterSchema = z
  .object({
    roster_id: z.coerce.number().int().positive(),
    owner_id: z.string().nullish(),
    players: z.array(z.string()).max(100).nullish()
  })
  .passthrough();

const sleeperLeagueUserSchema = z
  .object({
    user_id: z.string(),
    metadata: z
      .object({
        team_name: z.string().nullish()
      })
      .passthrough()
      .nullish()
  })
  .passthrough();

export interface SleeperImportCandidate {
  user: SleeperUserSummary;
  league: SleeperLeagueSummary;
  teamName: string;
  scoringFormat: ScoringFormat;
  scoringRules: ScoringRules;
  lineupSlots: LineupSlot[];
  unsupportedLineupSlots: string[];
  sleeperPlayerIds: string[];
  rosterId: number;
  warnings: string[];
}

export async function findSleeperLeagues(username: string, fetcher: typeof fetch = fetch): Promise<SleeperLeagueLookup> {
  return withSleeperErrors(async () => {
    const [userPayload, statePayload] = await Promise.all([
      fetchJson(fetcher, `/user/${encodeURIComponent(username)}`),
      fetchJson(fetcher, "/state/nfl")
    ]);
    const user = parseSleeperUser(userPayload, username);
    const state = parseProviderPayload(sleeperStateSchema, statePayload);
    const leaguesPayload = await fetchJson(
      fetcher,
      `/user/${encodeURIComponent(user.id)}/leagues/nfl/${state.season}`
    );
    const leagues = parseProviderPayload(z.array(sleeperLeagueSchema).max(100), leaguesPayload)
      .map(toLeagueSummary)
      .sort((left, right) => left.name.localeCompare(right.name));

    return { user, season: state.season, leagues };
  });
}

export async function loadSleeperImportCandidate(
  username: string,
  leagueId: string,
  fetcher: typeof fetch = fetch
): Promise<SleeperImportCandidate> {
  return withSleeperErrors(async () => {
    const [userPayload, statePayload, leaguePayload, rostersPayload, leagueUsersPayload] = await Promise.all([
      fetchJson(fetcher, `/user/${encodeURIComponent(username)}`),
      fetchJson(fetcher, "/state/nfl"),
      fetchJson(fetcher, `/league/${encodeURIComponent(leagueId)}`),
      fetchJson(fetcher, `/league/${encodeURIComponent(leagueId)}/rosters`),
      fetchJson(fetcher, `/league/${encodeURIComponent(leagueId)}/users`)
    ]);
    const user = parseSleeperUser(userPayload, username);
    const state = parseProviderPayload(sleeperStateSchema, statePayload);
    const league = parseProviderPayload(sleeperLeagueSchema, leaguePayload);
    const rosters = parseProviderPayload(z.array(sleeperRosterSchema).max(100), rostersPayload);
    const leagueUsers = parseProviderPayload(z.array(sleeperLeagueUserSchema).max(100), leagueUsersPayload);

    if (league.league_id !== leagueId || league.season !== state.season) {
      throw new ApiError(422, `Only current ${state.season} Sleeper leagues can be imported.`);
    }

    const roster = rosters.find((candidate) => candidate.owner_id === user.id);

    if (!roster) {
      throw new ApiError(404, "No roster owned by that Sleeper user was found in this league.");
    }

    const leagueUser = leagueUsers.find((candidate) => candidate.user_id === user.id);
    const teamName = leagueUser?.metadata?.team_name?.trim() || league.name.trim() || "Sleeper Team";
    const { lineupSlots, unsupportedLineupSlots } = translateLineupSlots(league.roster_positions);
    const scoringFormat = translateScoringFormat(league.scoring_settings.rec);
    const scoringRules = { ...league.scoring_settings };
    const warnings = [
      "League scoring rules will be saved. The current projection feed supplies totals without stat components, so lineup points remain provider totals for now."
    ];

    if (unsupportedLineupSlots.length > 0) {
      warnings.push(`Unsupported starting slots: ${unsupportedLineupSlots.join(", ")}.`);
    }

    return {
      user,
      league: toLeagueSummary(league),
      teamName: teamName.slice(0, 100),
      scoringFormat,
      scoringRules,
      lineupSlots,
      unsupportedLineupSlots,
      sleeperPlayerIds: [...new Set(roster.players ?? [])],
      rosterId: roster.roster_id,
      warnings
    };
  });
}

export async function loadSleeperLeagueRosteredPlayerIds(
  leagueId: string,
  fetcher: typeof fetch = fetch
): Promise<string[]> {
  return withSleeperErrors(async () => {
    const rostersPayload = await fetchJson(fetcher, `/league/${encodeURIComponent(leagueId)}/rosters`);
    const rosters = parseProviderPayload(z.array(sleeperRosterSchema).max(100), rostersPayload);

    return [...new Set(rosters.flatMap((roster) => roster.players ?? []))];
  });
}

export function translateLineupSlots(rosterPositions: string[]): {
  lineupSlots: LineupSlot[];
  unsupportedLineupSlots: string[];
} {
  const lineupSlots: LineupSlot[] = [];
  const unsupportedLineupSlots = new Set<string>();

  for (const rosterPosition of rosterPositions) {
    if (ignoredRosterSlots.has(rosterPosition)) continue;

    const mappedSlot = supportedRosterSlots[rosterPosition];

    if (mappedSlot) {
      lineupSlots.push(mappedSlot);
    } else {
      unsupportedLineupSlots.add(rosterPosition);
    }
  }

  return { lineupSlots, unsupportedLineupSlots: [...unsupportedLineupSlots] };
}

export function translateScoringFormat(receptionPoints: number | undefined): ScoringFormat {
  if (receptionPoints === 0) return "STANDARD";
  if (receptionPoints === 0.5) return "HALF_PPR";
  if (receptionPoints === 1) return "PPR";
  return "CUSTOM";
}

function parseSleeperUser(payload: unknown, requestedUsername: string): SleeperUserSummary {
  if (payload === null) {
    throw new ApiError(404, `Sleeper user ${requestedUsername} was not found.`);
  }

  const user = parseProviderPayload(sleeperUserSchema, payload);

  return {
    id: user.user_id,
    username: user.username?.trim() || requestedUsername,
    displayName: user.display_name?.trim() || user.username?.trim() || requestedUsername
  };
}

function toLeagueSummary(league: z.infer<typeof sleeperLeagueSchema>): SleeperLeagueSummary {
  return {
    id: league.league_id,
    name: league.name,
    season: league.season,
    status: league.status
  };
}

function parseProviderPayload<Schema extends z.ZodType>(schema: Schema, payload: unknown): z.infer<Schema> {
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new ApiError(502, "Sleeper returned an unexpected response.");
  }

  return parsed.data;
}

async function withSleeperErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, "Sleeper is temporarily unavailable.");
  }
}

async function fetchJson(fetcher: typeof fetch, path: string): Promise<unknown> {
  const response = await fetcher(`${sleeperApiBaseUrl()}${path}`, { signal: AbortSignal.timeout(10_000) });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new ApiError(502, "Sleeper is temporarily unavailable.");
  }

  return response.json();
}

function sleeperApiBaseUrl(): string {
  return (process.env.SLEEPER_API_BASE_URL ?? "https://api.sleeper.app/v1").replace(/\/$/, "");
}
