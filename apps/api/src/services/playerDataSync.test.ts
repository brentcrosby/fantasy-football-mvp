import assert from "node:assert/strict";
import { test } from "node:test";

import { buildLivePlayerBatch, normalizeInjuryStatus } from "./playerDataSync.js";

const rankingHeader = [
  "fantasypros_id",
  "player_name",
  "pos",
  "team",
  "player_bye_week",
  "r2p_pts",
  "scrape_date"
].join(",");

test("builds current offensive players and defenses from provider fixtures", () => {
  const batch = buildLivePlayerBatch({
    season: 2026,
    week: 1,
    sleeperPlayers: {
      "4984": {
        full_name: "Josh Allen",
        team: "BUF",
        fantasy_positions: ["QB"],
        injury_status: "Questionable"
      }
    },
    rankingsCsv: [
      rankingHeader,
      "17298,Josh Allen,QB,BUF,7,19.8,2026-09-07",
      "8140,Jacksonville Jaguars,DST,JAC,7,7.4,2026-09-07",
      "99999,No Projection,RB,FA,8,0,2026-09-07"
    ].join("\n"),
    crosswalkCsv: ["fantasypros_id,sleeper_id", "17298,4984", "99999,NA"].join("\n")
  });

  assert.equal(batch.players.length, 2);
  assert.deepEqual(batch.players[0], {
    id: "sleeper:JAX",
    name: "Jacksonville Jaguars",
    position: "DST",
    nflTeam: "JAX",
    byeWeek: 7,
    injuryStatus: "HEALTHY",
    projectedPoints: 7.4,
    targetShare: null,
    dataSource: "LIVE",
    externalId: "JAX",
    season: 2026,
    projectionWeek: 1,
    dataUpdatedAt: new Date("2026-09-07T00:00:00.000Z")
  });
  assert.equal(batch.players[1].id, "sleeper:4984");
  assert.equal(batch.players[1].injuryStatus, "QUESTIONABLE");
  assert.equal(batch.sourceUpdatedAt.toISOString(), "2026-09-07T00:00:00.000Z");
});

test("normalizes provider injury labels conservatively", () => {
  assert.equal(normalizeInjuryStatus(null), "HEALTHY");
  assert.equal(normalizeInjuryStatus("Injured Reserve"), "IR");
  assert.equal(normalizeInjuryStatus("PUP"), "IR");
  assert.equal(normalizeInjuryStatus("Out"), "OUT");
  assert.equal(normalizeInjuryStatus("Doubtful"), "DOUBTFUL");
  assert.equal(normalizeInjuryStatus("Questionable"), "QUESTIONABLE");
  assert.equal(normalizeInjuryStatus("Suspended"), "SUSPENDED");
  assert.equal(normalizeInjuryStatus("Probable"), "HEALTHY");
});
