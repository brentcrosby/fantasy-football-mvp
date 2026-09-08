import assert from "node:assert/strict";
import { test } from "node:test";

import type { Player } from "@fantasy-football/shared";

import { buildLeagueOverview } from "./leagueOverview.js";

test("builds standings, matchup totals, positional edges, and unmatched counts", () => {
  const players = [
    player("qb-user", "User QB", "QB", 22),
    player("rb-user", "User RB", "RB", 14),
    player("qb-rival", "Rival QB", "QB", 18),
    player("rb-rival", "Rival RB", "RB", 16)
  ];
  const overview = buildLeagueOverview({
    context: {
      league: { id: "league-1", name: "Test League", season: 2026, status: "in_season" },
      rosters: [
        {
          rosterId: 1,
          ownerId: "owner-1",
          ownerName: "User",
          teamName: "User Team",
          playerIds: ["qb-user", "rb-user", "missing"],
          starterIds: ["qb-user", "rb-user"],
          wins: 2,
          losses: 1,
          ties: 0,
          pointsFor: 310,
          pointsAgainst: 280,
          matchupId: 5,
          matchupPoints: 31
        },
        {
          rosterId: 2,
          ownerId: "owner-2",
          ownerName: "Rival",
          teamName: "Rival Team",
          playerIds: ["qb-rival", "rb-rival"],
          starterIds: ["qb-rival", "rb-rival"],
          wins: 3,
          losses: 0,
          ties: 0,
          pointsFor: 330,
          pointsAgainst: 270,
          matchupId: 5,
          matchupPoints: 29
        }
      ]
    },
    week: 4,
    userRosterId: 1,
    settings: { scoringFormat: "HALF_PPR", lineupSlots: ["QB", "RB"] },
    playersByExternalId: new Map(players.map((candidate) => [candidate.id, candidate])),
    projectionSource: "Test projections"
  });

  assert.deepEqual(overview.teams.map((team) => team.rosterId), [2, 1]);
  assert.equal(overview.teams.find((team) => team.isUserTeam)?.unmatchedPlayerCount, 1);
  assert.equal(overview.matchup?.projectedMargin, 2);
  assert.deepEqual(overview.tradeReport.considerations, []);
  assert.deepEqual(overview.matchup?.positionEdges, [
    { slot: "QB", userProjectedPoints: 22, opponentProjectedPoints: 18, advantage: "USER" },
    { slot: "RB", userProjectedPoints: 14, opponentProjectedPoints: 16, advantage: "OPPONENT" }
  ]);
});

function player(id: string, name: string, position: "QB" | "RB", projectedPoints: number): Player {
  return {
    id,
    name,
    position,
    nflTeam: "NFL",
    byeWeek: 10,
    injuryStatus: "HEALTHY",
    projectedPoints,
    hasProjection: true
  };
}
