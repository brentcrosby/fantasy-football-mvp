import assert from "node:assert/strict";
import { test } from "node:test";

import { isPresentableAssistantAnswer } from "./aiAssistant.js";

test("accepts plain-language assistant answers", () => {
  assert.equal(
    isPresentableAssistantAnswer("There is no clear trade to force this week. Your receivers give you flexibility, but no supported deal improves the lineup enough."),
    true
  );
});

test("rejects implementation language from assistant answers", () => {
  assert.equal(isPresentableAssistantAnswer("The positionNeeds field shows thin running back depth."), false);
  assert.equal(isPresentableAssistantAnswer("The experimentalProjection is higher than the provider projection."), false);
  assert.equal(isPresentableAssistantAnswer("The experimental PPR model likes this player."), false);
  assert.equal(isPresentableAssistantAnswer("Team rosterId 4 has a useful player."), false);
});
