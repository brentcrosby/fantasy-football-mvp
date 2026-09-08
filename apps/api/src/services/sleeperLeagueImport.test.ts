import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../lib/apiError.js";
import {
  findSleeperLeagues,
  loadSleeperImportCandidate,
  loadSleeperLeagueContext,
  loadSleeperLeagueRosteredPlayerIds,
  translateLineupSlots,
  translateScoringFormat
} from "./sleeperLeagueImport.js";

const user = { user_id: "user-1", username: "testcoach", display_name: "Test Coach" };
const state = { season: "2026", season_type: "regular" };
const league = {
  league_id: "123456789",
  name: "Sunday League",
  season: "2026",
  status: "in_season",
  sport: "nfl",
  roster_positions: ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DEF", "BN", "IR"],
  scoring_settings: { rec: 0.5, pass_td: 6, bonus_pass_yd_300: 3 }
};

test("finds and sorts the current Sleeper user's leagues", async () => {
  const fetcher = fixtureFetch({
    "/user/testcoach": user,
    "/state/nfl": state,
    "/user/user-1/leagues/nfl/2026": [
      league,
      { ...league, league_id: "987654321", name: "Alpha League" }
    ]
  });

  const result = await findSleeperLeagues("testcoach", fetcher);

  assert.equal(result.user.id, "user-1");
  assert.equal(result.season, 2026);
  assert.deepEqual(result.leagues.map(({ name }) => name), ["Alpha League", "Sunday League"]);
});

test("builds an import candidate from the owned roster and league settings", async () => {
  const fetcher = fixtureFetch({
    "/user/testcoach": user,
    "/state/nfl": state,
    "/league/123456789": league,
    "/league/123456789/rosters": [
      { roster_id: 4, owner_id: "other-user", players: ["9999"] },
      { roster_id: 7, owner_id: "user-1", players: ["4984", "9221", "4984"] }
    ],
    "/league/123456789/users": [
      { user_id: "user-1", metadata: { team_name: "Fourth and Long" } }
    ]
  });

  const candidate = await loadSleeperImportCandidate("testcoach", "123456789", fetcher);

  assert.equal(candidate.teamName, "Fourth and Long");
  assert.equal(candidate.rosterId, 7);
  assert.equal(candidate.scoringFormat, "HALF_PPR");
  assert.deepEqual(candidate.scoringRules, { rec: 0.5, pass_td: 6, bonus_pass_yd_300: 3 });
  assert.deepEqual(candidate.lineupSlots, ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DST"]);
  assert.deepEqual(candidate.sleeperPlayerIds, ["4984", "9221"]);
  assert.deepEqual(candidate.unsupportedLineupSlots, []);
});

test("collects unique rostered players from every team in a Sleeper league", async () => {
  const fetcher = fixtureFetch({
    "/league/123456789/rosters": [
      { roster_id: 4, owner_id: "other-user", players: ["1111", "2222"] },
      { roster_id: 7, owner_id: "user-1", players: ["2222", "3333"] }
    ]
  });

  assert.deepEqual(await loadSleeperLeagueRosteredPlayerIds("123456789", fetcher), ["1111", "2222", "3333"]);
});

test("loads standings, managers, rosters, and the selected week's matchups", async () => {
  const fetcher = fixtureFetch({
    "/league/123456789": league,
    "/league/123456789/rosters": [
      {
        roster_id: 7,
        owner_id: "user-1",
        players: ["4984", "9221"],
        starters: ["4984"],
        settings: { wins: 3, losses: 1, ties: 0, fpts: 412, fpts_decimal: 45, fpts_against: 390, fpts_against_decimal: 5 }
      },
      { roster_id: 8, owner_id: "user-2", players: ["3333"], starters: ["3333"], settings: { wins: 2, losses: 2 } }
    ],
    "/league/123456789/users": [
      { user_id: "user-1", username: "testcoach", display_name: "Test Coach", metadata: { team_name: "Fourth and Long" } },
      { user_id: "user-2", username: "rival", display_name: "Rival Manager", metadata: {} }
    ],
    "/league/123456789/matchups/4": [
      { roster_id: 7, matchup_id: 3, points: 42.1 },
      { roster_id: 8, matchup_id: 3, points: 38.6 }
    ]
  });

  const context = await loadSleeperLeagueContext("123456789", 4, fetcher);

  assert.equal(context.league.name, "Sunday League");
  assert.deepEqual(context.rosters[0], {
    rosterId: 7,
    ownerId: "user-1",
    ownerName: "Test Coach",
    teamName: "Fourth and Long",
    playerIds: ["4984", "9221"],
    starterIds: ["4984"],
    wins: 3,
    losses: 1,
    ties: 0,
    pointsFor: 412.45,
    pointsAgainst: 390.05,
    matchupId: 3,
    matchupPoints: 42.1
  });
  assert.equal(context.rosters[1]?.teamName, "Team 8");
});

test("flags unsupported lineup slots and represents nonstandard reception scoring as custom", () => {
  assert.deepEqual(translateLineupSlots(["QB", "SUPER_FLEX", "DL", "BN"]), {
    lineupSlots: ["QB"],
    unsupportedLineupSlots: ["SUPER_FLEX", "DL"]
  });
  assert.equal(translateScoringFormat(0), "STANDARD");
  assert.equal(translateScoringFormat(0.5), "HALF_PPR");
  assert.equal(translateScoringFormat(1), "PPR");
  assert.equal(translateScoringFormat(0.25), "CUSTOM");
});

test("rejects a league from a different season", async () => {
  const fetcher = fixtureFetch({
    "/user/testcoach": user,
    "/state/nfl": state,
    "/league/123456789": { ...league, season: "2025" },
    "/league/123456789/rosters": [],
    "/league/123456789/users": []
  });

  await assert.rejects(
    () => loadSleeperImportCandidate("testcoach", "123456789", fetcher),
    (error: unknown) => error instanceof ApiError && error.status === 422
  );
});

function fixtureFetch(fixtures: Record<string, unknown>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const fixturePath = url.pathname.replace(/^\/v1/, "");

    if (!(fixturePath in fixtures)) {
      return new Response(JSON.stringify({ error: "missing fixture" }), { status: 404 });
    }

    return new Response(JSON.stringify(fixtures[fixturePath]), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }) as typeof fetch;
}
