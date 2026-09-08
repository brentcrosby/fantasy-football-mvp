import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildExperimentalProjections,
  projectionModelSummary,
  readActualPprPoints
} from "./experimentalProjection.js";

const header = [
  "player_id", "position", "season", "week", "season_type", "fantasy_points_ppr", "attempts", "carries",
  "targets", "receptions", "passing_tds", "rushing_tds", "receiving_tds"
].join(",");

test("produces a bounded experimental projection from at least three prior games", () => {
  const csv = [
    header,
    "gsis-1,RB,2025,15,REG,10,0,12,3,2,0,0,1",
    "gsis-1,RB,2025,16,REG,14,0,15,4,3,0,1,0",
    "gsis-1,RB,2025,17,REG,12,0,14,5,4,0,0,0"
  ].join("\n");
  const projection = buildExperimentalProjections([csv], 2026, 1).get("gsis-1");

  assert(projection);
  assert(projection.points >= 0);
  assert(projection.low >= 0);
  assert(projection.high > projection.points);
  assert.equal(projection.scoringFormat, "PPR");
  assert.equal(projection.status, "EXPERIMENTAL");
});

test("does not project players without three games and reads actual outcomes", () => {
  const csv = [
    header,
    "gsis-1,WR,2026,1,REG,8,0,0,4,3,0,0,0",
    "gsis-1,WR,2026,2,REG,12,0,0,7,5,0,0,1"
  ].join("\n");

  assert.equal(buildExperimentalProjections([csv], 2026, 3).size, 0);
  assert.equal(readActualPprPoints([csv]).get("gsis-1:2026:2"), 12);
});

test("exposes the held-out validation result", () => {
  const summary = projectionModelSummary();

  assert.equal(summary.validationSeason, 2025);
  assert(summary.trainingRows > 10_000);
  assert(summary.validationRows > 1_000);
  assert(summary.modelMae < summary.baselineMae);
});
