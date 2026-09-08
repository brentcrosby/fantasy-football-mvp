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
      },
      "7000": {
        full_name: "Depth Receiver",
        team: "BUF",
        fantasy_positions: ["WR"],
        injury_status: null
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

  assert.equal(batch.players.length, 3);
  const defense = batch.players.find((player) => player.id === "sleeper:JAX");
  assert.deepEqual(defense, {
    id: "sleeper:JAX",
    name: "Jacksonville Jaguars",
    position: "DST",
    nflTeam: "JAX",
    byeWeek: 7,
    injuryStatus: "HEALTHY",
    projectedPoints: 7.4,
    hasProjection: true,
    projectionSource: "Sleeper + FantasyPros via DynastyProcess",
    targetShare: null,
    dataSource: "LIVE",
    externalId: "JAX",
    gsisId: null,
    experimentalProjection: null,
    season: 2026,
    projectionWeek: 1,
    dataUpdatedAt: new Date("2026-09-07T00:00:00.000Z")
  });
  const quarterback = batch.players.find((player) => player.id === "sleeper:4984");
  assert(quarterback);
  assert.equal(quarterback.injuryStatus, "QUESTIONABLE");
  const depthPlayer = batch.players.find((player) => player.id === "sleeper:7000");
  assert(depthPlayer);
  assert.equal(depthPlayer.projectedPoints, 0);
  assert.equal(depthPlayer.hasProjection, false);
  assert.equal(batch.sourceUpdatedAt.toISOString(), "2026-09-07T00:00:00.000Z");
});

test("maps GSIS IDs and attaches real-history model forecasts", () => {
  const statsHeader = [
    "player_id", "position", "season", "week", "season_type", "fantasy_points_ppr", "attempts", "carries",
    "targets", "receptions", "passing_tds", "rushing_tds", "receiving_tds"
  ].join(",");
  const batch = buildLivePlayerBatch({
    season: 2026,
    week: 1,
    sleeperPlayers: {
      "4984": { full_name: "Josh Allen", team: "BUF", fantasy_positions: ["QB"], injury_status: null }
    },
    rankingsCsv: [rankingHeader, "17298,Josh Allen,QB,BUF,7,19.8,2026-09-07"].join("\n"),
    crosswalkCsv: ["fantasypros_id,sleeper_id,gsis_id", "17298,4984,gsis-1"].join("\n"),
    statsCsvs: [[
      statsHeader,
      "gsis-1,QB,2025,15,REG,20,30,2,0,0,2,0,0",
      "gsis-1,QB,2025,16,REG,24,34,3,0,0,3,0,0",
      "gsis-1,QB,2025,17,REG,18,28,4,0,0,1,1,0"
    ].join("\n")]
  });
  const quarterback = batch.players.find((player) => player.id === "sleeper:4984");

  assert.equal(quarterback?.gsisId, "gsis-1");
  assert.equal(quarterback?.experimentalProjection?.status, "EXPERIMENTAL");
  assert.equal(quarterback?.experimentalProjection?.recentGames, 3);
  assert.equal(batch.actualPprPoints.get("gsis-1:2025:16"), 24);
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
