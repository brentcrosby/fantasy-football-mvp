import assert from "node:assert/strict";
import { test } from "node:test";

import type { LeagueTeam, Player } from "@fantasy-football/shared";

import { buildTradeConsiderations } from "./tradeConsideration.js";

test("finds a mutual roster fit and uses the PPR model as a supporting signal", () => {
  const userTeam = team(
    1,
    true,
    [player("user-qb", "User QB", "QB", 20), player("user-rb", "User RB", "RB", 8), player("user-wr", "User WR", "WR", 15), player("user-te", "User TE", "TE", 10)],
    [player("user-bench-wr", "Bench Receiver", "WR", 12)]
  );
  const target = {
    ...player("target-rb", "Target Back", "RB", 12),
    experimentalProjection: {
      points: 15,
      low: 7,
      high: 23,
      version: "test-model",
      scoringFormat: "PPR" as const,
      status: "EXPERIMENTAL" as const,
      recentGames: 5
    }
  };
  const opponent = team(
    2,
    false,
    [player("other-qb", "Other QB", "QB", 20), player("other-rb", "Other RB", "RB", 15), player("other-wr", "Other WR", "WR", 8), player("other-te", "Other TE", "TE", 10)],
    [target]
  );
  const report = buildTradeConsiderations({
    week: 1,
    userRosterId: 1,
    settings: { scoringFormat: "PPR", lineupSlots: ["QB", "RB", "WR", "TE"] },
    teams: [userTeam, opponent]
  });

  assert.equal(report.modelUsed, true);
  assert.equal(report.considerations[0]?.targetPlayer.id, target.id);
  assert.equal(report.considerations[0]?.targetTeam.rosterId, 2);
  assert.equal(report.considerations[0]?.possibleTradePieces[0]?.id, "user-bench-wr");
  assert.equal(report.considerations[0]?.providerUpgrade, 4);
  assert.equal(report.considerations[0]?.modelGap, 3);
  assert(report.considerations[0]?.reasons.some((reason) => reason.includes("experimental PPR model")));
});

test("does not use PPR model divergence in a non-PPR league", () => {
  const userTeam = team(
    1,
    true,
    [player("user-rb", "User RB", "RB", 8), player("user-wr", "User WR", "WR", 15)],
    [player("user-bench-wr", "Bench Receiver", "WR", 12)]
  );
  const target = {
    ...player("target-rb", "Target Back", "RB", 9.5),
    experimentalProjection: {
      points: 16,
      low: 8,
      high: 24,
      version: "test-model",
      scoringFormat: "PPR" as const,
      status: "EXPERIMENTAL" as const,
      recentGames: 5
    }
  };
  const opponent = team(
    2,
    false,
    [player("other-rb", "Other RB", "RB", 15), player("other-wr", "Other WR", "WR", 8)],
    [target]
  );
  const report = buildTradeConsiderations({
    week: 1,
    userRosterId: 1,
    settings: { scoringFormat: "HALF_PPR", lineupSlots: ["RB", "WR"] },
    teams: [userTeam, opponent]
  });

  assert.equal(report.modelUsed, false);
  assert.equal(report.considerations[0]?.modelGap, null);
});

test("does not manufacture a trade solely for backup QB or TE depth", () => {
  const userTeam = team(
    1,
    true,
    [player("user-qb", "User QB", "QB", 20), player("user-te", "User TE", "TE", 10)],
    [player("user-bench-rb", "Bench Back", "RB", 12)]
  );
  const opponent = team(
    2,
    false,
    [player("other-qb", "Other QB", "QB", 21), player("other-te", "Other TE", "TE", 11)],
    [player("backup-qb", "Backup QB", "QB", 18), player("backup-te", "Backup TE", "TE", 9)]
  );
  const report = buildTradeConsiderations({
    week: 1,
    userRosterId: 1,
    settings: { scoringFormat: "PPR", lineupSlots: ["QB", "TE"] },
    teams: [userTeam, opponent]
  });

  assert.deepEqual(report.considerations, []);
});

function team(rosterId: number, isUserTeam: boolean, starters: Player[], bench: Player[]): LeagueTeam {
  return {
    rosterId,
    ownerName: `Owner ${rosterId}`,
    teamName: `Team ${rosterId}`,
    isUserTeam,
    record: { wins: 0, losses: 0, ties: 0 },
    pointsFor: 0,
    pointsAgainst: 0,
    projectedPoints: starters.reduce((total, candidate) => total + candidate.projectedPoints, 0),
    actualPoints: 0,
    starters: starters.map((candidate) => ({
      slot: candidate.position,
      player: candidate,
      reason: "Test assignment"
    })),
    bench,
    unmatchedPlayerCount: 0
  };
}

function player(id: string, name: string, position: "QB" | "RB" | "WR" | "TE", projectedPoints: number): Player {
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
