import type { InjuryStatus, PlayerDataSource, Position, Prisma, PrismaClient } from "@prisma/client";
import { parse } from "csv-parse/sync";
import { z } from "zod";

const SYNC_ID = "weekly-player-data";
const SOURCE_LABEL = "Sleeper + FantasyPros via DynastyProcess";
const FRESHNESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const MINIMUM_LIVE_PLAYERS = 100;

const SLEEPER_STATE_URL = "https://api.sleeper.app/v1/state/nfl";
const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl?active=true";
const WEEKLY_RANKINGS_URL = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/fp_latest_weekly.csv";
const PLAYER_IDS_URL = "https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv";

const supportedPositions = new Set<Position>(["QB", "RB", "WR", "TE", "K", "DST"]);

const sleeperStateSchema = z.object({
  season: z.coerce.number().int().min(2000),
  display_week: z.coerce.number().int().min(1).max(18),
  season_type: z.string()
});

const sleeperPlayerSchema = z
  .object({
    full_name: z.string().nullish(),
    first_name: z.string().nullish(),
    last_name: z.string().nullish(),
    team: z.string().nullish(),
    fantasy_positions: z.array(z.string()).nullish(),
    injury_status: z.string().nullish()
  })
  .passthrough();

const sleeperPlayersSchema = z.record(z.string(), sleeperPlayerSchema);

interface RankingRow {
  fantasypros_id: string;
  player_name: string;
  pos: string;
  team: string;
  player_bye_week: string;
  r2p_pts: string;
  scrape_date: string;
}

interface CrosswalkRow {
  fantasypros_id: string;
  sleeper_id: string;
}

interface LivePlayerRecord {
  id: string;
  name: string;
  position: Position;
  nflTeam: string;
  byeWeek: number;
  injuryStatus: InjuryStatus;
  projectedPoints: number;
  targetShare: null;
  dataSource: PlayerDataSource;
  externalId: string;
  season: number;
  projectionWeek: number;
  dataUpdatedAt: Date;
}

export interface LivePlayerBatch {
  players: LivePlayerRecord[];
  season: number;
  week: number;
  sourceUpdatedAt: Date;
}

export interface PlayerDataSyncResult {
  status: "synced" | "skipped";
  season: number;
  week: number;
  recordCount: number;
  reconciledRosterPlayers: number;
}

interface BuildLivePlayerBatchInput {
  season: number;
  week: number;
  sleeperPlayers: unknown;
  rankingsCsv: string;
  crosswalkCsv: string;
}

interface SyncOptions {
  fetcher?: typeof fetch;
  force?: boolean;
  now?: Date;
}

export async function syncLivePlayerData(
  prismaClient: PrismaClient,
  { fetcher = fetch, force = false, now = new Date() }: SyncOptions = {}
): Promise<PlayerDataSyncResult> {
  const state = sleeperStateSchema.parse(await fetchJson(fetcher, SLEEPER_STATE_URL));

  if (state.season_type !== "regular") {
    throw new Error(`Live player sync only supports the regular season; Sleeper reported ${state.season_type}.`);
  }

  const existingSync = await prismaClient.playerDataSync.findUnique({ where: { id: SYNC_ID } });
  const isFresh =
    existingSync &&
    existingSync.season === state.season &&
    existingSync.week === state.display_week &&
    now.getTime() - existingSync.syncedAt.getTime() < FRESHNESS_WINDOW_MS;

  if (!force && isFresh) {
    return {
      status: "skipped",
      season: existingSync.season,
      week: existingSync.week,
      recordCount: existingSync.recordCount,
      reconciledRosterPlayers: 0
    };
  }

  const [sleeperPlayers, rankingsCsv, crosswalkCsv] = await Promise.all([
    fetchJson(fetcher, SLEEPER_PLAYERS_URL),
    fetchText(fetcher, WEEKLY_RANKINGS_URL),
    fetchText(fetcher, PLAYER_IDS_URL)
  ]);

  const batch = buildLivePlayerBatch({
    season: state.season,
    week: state.display_week,
    sleeperPlayers,
    rankingsCsv,
    crosswalkCsv
  });

  if (batch.players.length < MINIMUM_LIVE_PLAYERS) {
    throw new Error(`Live player sync produced only ${batch.players.length} usable records.`);
  }

  const seedRosterPlayers = await prismaClient.player.findMany({
    where: { dataSource: "SEED" },
    select: {
      id: true,
      name: true,
      position: true,
      rosterMemberships: { select: { fantasyTeamId: true } }
    }
  });
  const livePlayerByIdentity = new Map(
    batch.players.map((player) => [playerIdentityKey(player.name, player.position), player])
  );
  const rosterReplacements = seedRosterPlayers.flatMap((seedPlayer) => {
    const livePlayer = livePlayerByIdentity.get(playerIdentityKey(seedPlayer.name, seedPlayer.position));

    if (!livePlayer) return [];

    return seedPlayer.rosterMemberships.map((membership) => ({
      fantasyTeamId: membership.fantasyTeamId,
      seedPlayerId: seedPlayer.id,
      livePlayerId: livePlayer.id
    }));
  });
  const livePlayerIds = batch.players.map((player) => player.id);
  const operations: Prisma.PrismaPromise<unknown>[] = [
    prismaClient.player.updateMany({
      where: { dataSource: "LIVE", id: { notIn: livePlayerIds } },
      data: { projectionWeek: null }
    }),
    ...batch.players.map((player) =>
      prismaClient.player.upsert({
        where: { id: player.id },
        create: player,
        update: {
          name: player.name,
          position: player.position,
          nflTeam: player.nflTeam,
          byeWeek: player.byeWeek,
          injuryStatus: player.injuryStatus,
          projectedPoints: player.projectedPoints,
          targetShare: player.targetShare,
          dataSource: player.dataSource,
          externalId: player.externalId,
          season: player.season,
          projectionWeek: player.projectionWeek,
          dataUpdatedAt: player.dataUpdatedAt
        }
      })
    )
  ];

  for (const replacement of rosterReplacements) {
    operations.push(
      prismaClient.rosterMembership.upsert({
        where: {
          fantasyTeamId_playerId: {
            fantasyTeamId: replacement.fantasyTeamId,
            playerId: replacement.livePlayerId
          }
        },
        create: {
          fantasyTeamId: replacement.fantasyTeamId,
          playerId: replacement.livePlayerId
        },
        update: {}
      }),
      prismaClient.rosterMembership.delete({
        where: {
          fantasyTeamId_playerId: {
            fantasyTeamId: replacement.fantasyTeamId,
            playerId: replacement.seedPlayerId
          }
        }
      })
    );
  }

  operations.push(
    prismaClient.playerDataSync.upsert({
      where: { id: SYNC_ID },
      create: {
        id: SYNC_ID,
        season: batch.season,
        week: batch.week,
        source: SOURCE_LABEL,
        recordCount: batch.players.length,
        sourceUpdatedAt: batch.sourceUpdatedAt,
        syncedAt: now
      },
      update: {
        season: batch.season,
        week: batch.week,
        source: SOURCE_LABEL,
        recordCount: batch.players.length,
        sourceUpdatedAt: batch.sourceUpdatedAt,
        syncedAt: now
      }
    })
  );

  await prismaClient.$transaction(operations);

  return {
    status: "synced",
    season: batch.season,
    week: batch.week,
    recordCount: batch.players.length,
    reconciledRosterPlayers: rosterReplacements.length
  };
}

export function buildLivePlayerBatch({
  season,
  week,
  sleeperPlayers,
  rankingsCsv,
  crosswalkCsv
}: BuildLivePlayerBatchInput): LivePlayerBatch {
  const parsedSleeperPlayers = sleeperPlayersSchema.parse(sleeperPlayers);
  const rankings = parseCsv<RankingRow>(rankingsCsv);
  const crosswalk = parseCsv<CrosswalkRow>(crosswalkCsv);
  const sleeperIdByFantasyProsId = new Map(
    crosswalk
      .filter((row) => isExternalId(row.fantasypros_id) && isExternalId(row.sleeper_id))
      .map((row) => [row.fantasypros_id, row.sleeper_id])
  );
  const sourceUpdatedAt = latestSourceDate(rankings);
  const playersById = new Map<string, LivePlayerRecord>();

  for (const ranking of rankings) {
    const position = toPosition(ranking.pos);
    const projectedPoints = Number(ranking.r2p_pts);
    const byeWeek = Number(ranking.player_bye_week);

    if (!position || !Number.isFinite(projectedPoints) || projectedPoints <= 0 || !isValidWeek(byeWeek)) {
      continue;
    }

    if (position === "DST") {
      const team = normalizeTeam(ranking.team);

      if (!team) continue;

      playersById.set(`sleeper:${team}`, {
        id: `sleeper:${team}`,
        name: ranking.player_name,
        position,
        nflTeam: team,
        byeWeek,
        injuryStatus: "HEALTHY",
        projectedPoints,
        targetShare: null,
        dataSource: "LIVE",
        externalId: team,
        season,
        projectionWeek: week,
        dataUpdatedAt: sourceUpdatedAt
      });
      continue;
    }

    const sleeperId = sleeperIdByFantasyProsId.get(ranking.fantasypros_id);
    const sleeperPlayer = sleeperId ? parsedSleeperPlayers[sleeperId] : undefined;
    const team = normalizeTeam(sleeperPlayer?.team);

    if (!sleeperId || !sleeperPlayer || !team || !sleeperPlayer.fantasy_positions?.includes(position)) {
      continue;
    }

    const name = sleeperPlayer.full_name?.trim() ||
      [sleeperPlayer.first_name, sleeperPlayer.last_name].filter(Boolean).join(" ").trim() ||
      ranking.player_name.trim();

    if (!name) continue;

    playersById.set(`sleeper:${sleeperId}`, {
      id: `sleeper:${sleeperId}`,
      name,
      position,
      nflTeam: team,
      byeWeek,
      injuryStatus: normalizeInjuryStatus(sleeperPlayer.injury_status),
      projectedPoints,
      targetShare: null,
      dataSource: "LIVE",
      externalId: sleeperId,
      season,
      projectionWeek: week,
      dataUpdatedAt: sourceUpdatedAt
    });
  }

  return {
    players: [...playersById.values()].sort((left, right) => left.name.localeCompare(right.name)),
    season,
    week,
    sourceUpdatedAt
  };
}

export function normalizeInjuryStatus(status: string | null | undefined): InjuryStatus {
  const normalized = status?.trim().toUpperCase().replace(/[\s_-]+/g, "") ?? "";

  if (normalized.includes("SUSPEND")) return "SUSPENDED";
  if (normalized === "IR" || normalized.includes("INJUREDRESERVE") || normalized === "PUP" || normalized === "NFI") {
    return "IR";
  }
  if (normalized.includes("OUT")) return "OUT";
  if (normalized.includes("DOUBTFUL")) return "DOUBTFUL";
  if (normalized.includes("QUESTIONABLE")) return "QUESTIONABLE";
  return "HEALTHY";
}

function parseCsv<Row>(csv: string): Row[] {
  return parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Row[];
}

function toPosition(value: string): Position | null {
  return supportedPositions.has(value as Position) ? (value as Position) : null;
}

function normalizeTeam(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();

  if (!normalized || normalized === "FA" || normalized.length > 3) return null;
  if (normalized === "JAC") return "JAX";
  return normalized;
}

function isExternalId(value: string | undefined): value is string {
  return Boolean(value && value !== "NA");
}

function isValidWeek(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 18;
}

function playerIdentityKey(name: string, position: Position): string {
  const normalizedName = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(?:jr|sr|ii|iii|iv)$/, "");

  return `${position}:${normalizedName}`;
}

function latestSourceDate(rankings: RankingRow[]): Date {
  const timestamps = rankings
    .map((ranking) => Date.parse(`${ranking.scrape_date}T00:00:00.000Z`))
    .filter(Number.isFinite);

  if (timestamps.length === 0) {
    throw new Error("Weekly rankings did not include a valid scrape date.");
  }

  return new Date(Math.max(...timestamps));
}

async function fetchJson(fetcher: typeof fetch, url: string): Promise<unknown> {
  const response = await fetchSource(fetcher, url);
  return response.json();
}

async function fetchText(fetcher: typeof fetch, url: string): Promise<string> {
  const response = await fetchSource(fetcher, url);
  return response.text();
}

async function fetchSource(fetcher: typeof fetch, url: string): Promise<Response> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(30_000) });

  if (!response.ok) {
    throw new Error(`Player data source returned HTTP ${response.status}.`);
  }

  return response;
}
