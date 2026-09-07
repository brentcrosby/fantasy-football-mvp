import assert from "node:assert/strict";
import { test } from "node:test";

import { ApiError } from "./apiError.js";
import { assertProjectionWeek } from "./playerProjection.js";

test("accepts the week supplied by the live projection catalog", () => {
  assert.doesNotThrow(() =>
    assertProjectionWeek([{ dataSource: "LIVE", projectionWeek: 1 }], 1)
  );
});

test("rejects a week that does not match live projections", () => {
  assert.throws(
    () => assertProjectionWeek([{ dataSource: "LIVE", projectionWeek: 1 }], 2),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 422);
      assert.equal(error.message, "Live projections are not available for Week 2.");
      assert.deepEqual(error.details, { requestedWeek: 2, availableWeeks: [1], unavailablePlayerCount: 0 });
      return true;
    }
  );
});

test("rejects live roster players that no longer have a current projection", () => {
  assert.throws(
    () => assertProjectionWeek([{ dataSource: "LIVE", projectionWeek: null }], 1),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.deepEqual(error.details, { requestedWeek: 1, availableWeeks: [], unavailablePlayerCount: 1 });
      return true;
    }
  );
});

test("does not constrain the development sample catalog", () => {
  assert.doesNotThrow(() =>
    assertProjectionWeek([{ dataSource: "SEED", projectionWeek: null }], 18)
  );
});
