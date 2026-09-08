import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildLineupRecommendation,
  defaultScoringRules,
  scoreProjectedStatLine,
  type Player,
  type ScoringFormat
} from "@fantasy-football/shared";

const receiverStats = {
  rec: 6,
  rec_yd: 80,
  rec_td: 1
};

test("scores the same receiving stat line differently in Standard, Half PPR, and PPR", () => {
  const score = (format: ScoringFormat) =>
    scoreProjectedStatLine(receiverStats, defaultScoringRules(format)).points;

  assert.equal(score("STANDARD"), 14);
  assert.equal(score("HALF_PPR"), 17);
  assert.equal(score("PPR"), 20);
});

test("honors imported passing touchdown values and custom bonuses", () => {
  const result = scoreProjectedStatLine(
    { pass_yd: 305, pass_td: 3, pass_int: 1, bonus_pass_yd_300: 1 },
    { pass_yd: 0.04, pass_td: 6, pass_int: -2, bonus_pass_yd_300: 3 }
  );

  assert.equal(result.points, 31.2);
  assert.equal(result.matchedStatCount, 4);
  assert(result.breakdown.some((entry) => entry.stat === "bonus_pass_yd_300" && entry.fantasyPoints === 3));
});

test("ranks component projections with league rules and includes a breakdown", () => {
  const highVolumeReceiver = player({
    id: "volume",
    name: "Volume Receiver",
    projectedPoints: 12,
    projectionStats: { rec: 9, rec_yd: 60 }
  });
  const touchdownReceiver = player({
    id: "touchdown",
    name: "Touchdown Receiver",
    projectedPoints: 15,
    projectionStats: { rec: 2, rec_yd: 60, rec_td: 1 }
  });
  const report = buildLineupRecommendation({
    week: 1,
    settings: { scoringFormat: "PPR", lineupSlots: ["WR"] },
    roster: [{ player: highVolumeReceiver }, { player: touchdownReceiver }]
  });

  assert.equal(report.starters[0]?.player.id, "volume");
  assert.equal(report.starters[0]?.player.projectedPoints, 15);
  assert.equal(report.starters[0]?.player.projectionMethod, "LEAGUE_RULES");
  assert.equal(report.projectionSummary?.method, "LEAGUE_RULES");
  assert(report.starters[0]?.player.projectionBreakdown?.some((entry) => entry.stat === "rec"));
});

test("leaves provider totals unchanged when no stat components exist", () => {
  const providerPlayer = player({
    id: "provider",
    name: "Provider Player",
    projectedPoints: 12.4,
    targetShare: 0.3
  });
  const report = buildLineupRecommendation({
    week: 1,
    settings: { scoringFormat: "PPR", lineupSlots: ["WR"] },
    roster: [{ player: providerPlayer }]
  });

  assert.equal(report.starters[0]?.player.projectedPoints, 12.4);
  assert.equal(report.starters[0]?.player.projectionMethod, "PROVIDER_TOTAL");
  assert.equal(report.projectionSummary?.method, "PROVIDER_TOTAL");
});

function player(overrides: Partial<Player>): Player {
  return {
    id: "player",
    name: "Test Player",
    position: "WR",
    nflTeam: "TST",
    byeWeek: 8,
    injuryStatus: "HEALTHY",
    projectedPoints: 0,
    hasProjection: true,
    projectionSource: "Test stat feed",
    ...overrides
  };
}
