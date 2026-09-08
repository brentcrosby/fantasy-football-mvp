import assert from "node:assert/strict";
import { test } from "node:test";

import { PLAYER_DATA_STALE_AFTER_MS, playerDataFreshness } from "./playerDataFreshness.js";

const now = new Date("2026-09-09T12:00:00.000Z");

test("reports fresh player data and the latest successful attempt", () => {
  const freshness = playerDataFreshness(
    { syncedAt: new Date("2026-09-09T06:01:00.000Z") },
    { status: "SUCCESS", startedAt: new Date("2026-09-09T06:00:00.000Z") },
    now
  );

  assert.deepEqual(freshness, {
    status: "FRESH",
    lastSuccessfulSyncAt: "2026-09-09T06:01:00.000Z",
    lastAttemptAt: "2026-09-09T06:00:00.000Z",
    lastAttemptStatus: "SUCCESS"
  });
});

test("reports stale data without hiding a recent failed refresh", () => {
  const freshness = playerDataFreshness(
    { syncedAt: new Date(now.getTime() - PLAYER_DATA_STALE_AFTER_MS - 1) },
    { status: "FAILED", startedAt: new Date("2026-09-09T11:00:00.000Z") },
    now
  );

  assert.equal(freshness.status, "STALE");
  assert.equal(freshness.lastAttemptStatus, "FAILED");
});

test("reports unavailable data before any completed sync", () => {
  assert.deepEqual(playerDataFreshness(null, null, now), {
    status: "UNAVAILABLE",
    lastSuccessfulSyncAt: null,
    lastAttemptAt: null,
    lastAttemptStatus: null
  });
});
