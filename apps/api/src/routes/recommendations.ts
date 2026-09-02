import { Router } from "express";

import { buildLineupRecommendation, type RecommendationRequest } from "@fantasy-football/shared";

import { ApiError } from "../lib/apiError.js";
import { toPlayerDto } from "../lib/mappers.js";
import { prisma } from "../lib/prisma.js";
import { recommendationApiRequestSchema } from "../lib/validation.js";

export const recommendationsRouter = Router();

recommendationsRouter.post("/", async (request, response) => {
  const parsed = recommendationApiRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({
      error: "Invalid recommendation request.",
      issues: parsed.error.issues
    });
    return;
  }

  const players = await prisma.player.findMany({ where: { id: { in: parsed.data.rosterPlayerIds } } });
  const playersById = new Map(players.map((player) => [player.id, player]));
  const unknownPlayerIds = parsed.data.rosterPlayerIds.filter((playerId) => !playersById.has(playerId));

  if (unknownPlayerIds.length > 0) {
    throw new ApiError(422, "One or more players were not found.", { unknownPlayerIds });
  }

  const recommendationRequest: RecommendationRequest = {
    week: parsed.data.week,
    settings: parsed.data.settings,
    roster: parsed.data.rosterPlayerIds.map((playerId) => ({ player: toPlayerDto(playersById.get(playerId)!) }))
  };

  response.json({ report: buildLineupRecommendation(recommendationRequest) });
});
