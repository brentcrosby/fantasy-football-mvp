import assert from "node:assert/strict";
import { test } from "node:test";

import { hasValidSyncSecret } from "./playerDataSync.js";

test("accepts only a matching bearer token for scheduled player-data sync", () => {
  const secret = "a-strong-test-secret-value";

  assert.equal(hasValidSyncSecret(`Bearer ${secret}`, undefined, secret), true);
  assert.equal(hasValidSyncSecret(undefined, secret, secret), true);
  assert.equal(hasValidSyncSecret("Bearer wrong-secret", undefined, secret), false);
  assert.equal(hasValidSyncSecret(undefined, "wrong-secret", secret), false);
  assert.equal(hasValidSyncSecret(`Basic ${secret}`, undefined, secret), false);
});
