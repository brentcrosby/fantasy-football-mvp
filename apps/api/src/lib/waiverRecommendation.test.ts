import assert from "node:assert/strict";
import { test } from "node:test";

import type { Player } from "@fantasy-football/shared";

import { buildWaiverReport } from "./waiverRecommendation.js";

test("recommends a free agent who improves the starting lineup and identifies the displaced player", () => {
  const rosterPlayer = player("roster-rb", "Current Back", 8);
  const availablePlayer = player("available-rb", "Waiver Back", 15);
  const report = buildWaiverReport({
    week: 1,
    leagueId: "league-1",
    settings: { scoringFormat: "HALF_PPR", lineupSlots: ["RB"] },
    roster: [{ player: rosterPlayer }],
    availablePlayers: [availablePlayer],
    rosteredPlayerCount: 20
  });

  assert.equal(report.recommendations.length, 1);
  assert.equal(report.recommendations[0]?.player.id, availablePlayer.id);
  assert.equal(report.recommendations[0]?.dropCandidate?.id, rosterPlayer.id);
  assert.equal(report.recommendations[0]?.priority, "STARTER_UPGRADE");
  assert.equal(report.recommendations[0]?.lineupGain, 7);
});

test("recommends startable depth when a position has no bench coverage", () => {
  const report = buildWaiverReport({
    week: 1,
    leagueId: "league-1",
    settings: { scoringFormat: "PPR", lineupSlots: ["RB"] },
    roster: [{ player: player("starter-rb", "Starter Back", 15) }],
    availablePlayers: [player("depth-rb", "Depth Back", 10)],
    rosteredPlayerCount: 20
  });

  assert.equal(report.recommendations[0]?.priority, "DEPTH_NEED");
  assert.equal(report.recommendations[0]?.dropCandidate, null);
});

test("excludes unavailable and bye-week free agents", () => {
  const outPlayer = { ...player("out-rb", "Out Back", 20), injuryStatus: "OUT" as const };
  const byePlayer = { ...player("bye-rb", "Bye Back", 20), byeWeek: 1 };
  const report = buildWaiverReport({
    week: 1,
    leagueId: "league-1",
    settings: { scoringFormat: "STANDARD", lineupSlots: ["RB"] },
    roster: [{ player: player("starter-rb", "Starter Back", 5) }],
    availablePlayers: [outPlayer, byePlayer],
    rosteredPlayerCount: 20
  });

  assert.equal(report.availablePlayerCount, 0);
  assert.deepEqual(report.recommendations, []);
});

test("omits trivial lineup changes and returns one recommendation per position", () => {
  const report = buildWaiverReport({
    week: 1,
    leagueId: "league-1",
    settings: { scoringFormat: "STANDARD", lineupSlots: ["RB"] },
    roster: [
      { player: player("starter-rb", "Starter Back", 10) },
      { player: player("bench-rb", "Bench Back", 7) }
    ],
    availablePlayers: [
      player("small-gain-rb", "Small Gain Back", 10.3),
      player("upgrade-rb", "Upgrade Back", 14),
      player("second-upgrade-rb", "Second Upgrade Back", 13)
    ],
    rosteredPlayerCount: 20
  });

  assert.equal(report.recommendations.length, 1);
  assert.equal(report.recommendations[0]?.player.id, "upgrade-rb");
});

function player(id: string, name: string, projectedPoints: number): Player {
  return {
    id,
    name,
    position: "RB",
    nflTeam: "FA",
    byeWeek: 10,
    injuryStatus: "HEALTHY",
    projectedPoints,
    hasProjection: true,
    projectionSource: "Test projections"
  };
}
