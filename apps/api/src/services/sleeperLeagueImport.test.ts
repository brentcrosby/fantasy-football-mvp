import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "../lib/apiError.js";
import {
  findSleeperLeagues,
  loadSleeperImportCandidate,
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
  scoring_settings: { rec: 0.5 }
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
  assert.deepEqual(candidate.lineupSlots, ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "K", "DST"]);
  assert.deepEqual(candidate.sleeperPlayerIds, ["4984", "9221"]);
  assert.deepEqual(candidate.unsupportedLineupSlots, []);
});

test("flags unsupported lineup and reception scoring without guessing", () => {
  assert.deepEqual(translateLineupSlots(["QB", "SUPER_FLEX", "DL", "BN"]), {
    lineupSlots: ["QB"],
    unsupportedLineupSlots: ["SUPER_FLEX", "DL"]
  });
  assert.equal(translateScoringFormat(0), "STANDARD");
  assert.equal(translateScoringFormat(0.5), "HALF_PPR");
  assert.equal(translateScoringFormat(1), "PPR");
  assert.equal(translateScoringFormat(0.25), null);
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
