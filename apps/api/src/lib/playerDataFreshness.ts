import type { PlayerDataSync, PlayerDataSyncRun } from "@prisma/client";
import type { PlayerDataFreshness } from "@fantasy-football/shared";

export const PLAYER_DATA_STALE_AFTER_MS = 12 * 60 * 60 * 1000;

export function playerDataFreshness(
  sync: Pick<PlayerDataSync, "syncedAt"> | null,
  lastRun: Pick<PlayerDataSyncRun, "status" | "startedAt"> | null,
  now = new Date()
): PlayerDataFreshness {
  if (!sync) {
    return {
      status: "UNAVAILABLE",
      lastSuccessfulSyncAt: null,
      lastAttemptAt: lastRun?.startedAt.toISOString() ?? null,
      lastAttemptStatus: lastRun?.status ?? null
    };
  }

  return {
    status: now.getTime() - sync.syncedAt.getTime() <= PLAYER_DATA_STALE_AFTER_MS ? "FRESH" : "STALE",
    lastSuccessfulSyncAt: sync.syncedAt.toISOString(),
    lastAttemptAt: lastRun?.startedAt.toISOString() ?? null,
    lastAttemptStatus: lastRun?.status ?? null
  };
}
