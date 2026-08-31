import { Router } from "express";

import { buildLineupRecommendation } from "@fantasy-football/shared";

import { sampleRoster, sampleSettings } from "../data/sampleData.js";
import { recommendationRequestSchema } from "../lib/validation.js";

export const recommendationsRouter = Router();

recommendationsRouter.get("/demo", (_request, response) => {
  const report = buildLineupRecommendation({
    week: 1,
    settings: sampleSettings,
    roster: sampleRoster
  });

  response.json({ report });
});

recommendationsRouter.post("/", (request, response) => {
  const parsed = recommendationRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({
      error: "Invalid recommendation request.",
      issues: parsed.error.issues
    });
    return;
  }

  response.json({
    report: buildLineupRecommendation(parsed.data)
  });
});

