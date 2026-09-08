import assert from "node:assert/strict";
import { test } from "node:test";

import type { LeagueTeam, Player } from "@fantasy-football/shared";

import { buildLeagueAlerts } from "./leagueAlerts.js";

test("prioritizes a user's status change over an opposing starter's projection change", () => {
  const userPlayer = player("user-rb", "User Back", "RB", 15);
  const opponentPlayer = player("opponent-wr", "Opponent Receiver", "WR", 16);
  const report = buildLeagueAlerts({
    week: 1,
    userRosterId: 1,
    opponentRosterId: 2,
    teams: [team(1, true, [userPlayer]), team(2, false, [opponentPlayer])],
    storedAlerts: [
      {
        id: "opponent-fall",
        playerId: opponentPlayer.id,
        type: "PROJECTION_FALL",
        previousInjuryStatus: null,
        injuryStatus: null,
        previousProjectedPoints: 19,
        projectedPoints: 16,
        createdAt: new Date("2026-09-08T12:00:00Z")
      },
      {
        id: "user-status",
        playerId: userPlayer.id,
        type: "INJURY_STATUS",
        previousInjuryStatus: "HEALTHY",
        injuryStatus: "QUESTIONABLE",
        previousProjectedPoints: null,
        projectedPoints: null,
        createdAt: new Date("2026-09-08T11:00:00Z")
      }
    ]
  });

  assert.deepEqual(report.alerts.map((alert) => alert.id), ["user-status", "opponent-fall"]);
  assert.equal(report.alerts[0]?.scope, "YOUR_ROSTER");
  assert.equal(report.alerts[1]?.scope, "MATCHUP_OPPONENT");
  assert.match(report.alerts[0]?.summary ?? "", /changed from healthy to questionable/);
});

test("filters other managers' bench updates from league alerts", () => {
  const benchPlayer = player("bench-rb", "Bench Back", "RB", 10);
  const report = buildLeagueAlerts({
    week: 1,
    userRosterId: 1,
    opponentRosterId: null,
    teams: [team(1, true, [player("user-qb", "User QB", "QB", 20)]), team(2, false, [], [benchPlayer])],
    storedAlerts: [{
      id: "bench-change",
      playerId: benchPlayer.id,
      type: "INJURY_STATUS",
      previousInjuryStatus: "HEALTHY",
      injuryStatus: "OUT",
      previousProjectedPoints: null,
      projectedPoints: null,
      createdAt: new Date("2026-09-08T12:00:00Z")
    }]
  });

  assert.deepEqual(report.alerts, []);
});

function team(rosterId: number, isUserTeam: boolean, starters: Player[], bench: Player[] = []): LeagueTeam {
  return {
    rosterId,
    ownerName: `Manager ${rosterId}`,
    teamName: `Team ${rosterId}`,
    isUserTeam,
    record: { wins: 0, losses: 0, ties: 0 },
    pointsFor: 0,
    pointsAgainst: 0,
    projectedPoints: starters.reduce((total, candidate) => total + candidate.projectedPoints, 0),
    actualPoints: 0,
    starters: starters.map((candidate) => ({ slot: candidate.position, player: candidate, reason: "Test assignment" })),
    bench,
    unmatchedPlayerCount: 0
  };
}

function player(id: string, name: string, position: "QB" | "RB" | "WR", projectedPoints: number): Player {
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
