import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { ApiError } from "../lib/apiError.js";
import { teamWithRoster, toTeamDto } from "../lib/mappers.js";
import { prisma } from "../lib/prisma.js";
import { getAuthenticatedUser, requireAuth } from "../lib/session.js";
import { assistantRequestSchema, teamIdSchema } from "../lib/validation.js";
import { createAssistantReply } from "../services/aiAssistant.js";

export const assistantRouter = Router();
assistantRouter.use(requireAuth);

const assistantRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 25,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (_request, response) => getAuthenticatedUser(response).id,
  message: { error: "Daily AI assistant limit reached. Try again tomorrow." }
});

assistantRouter.post("/teams/:teamId", assistantRateLimit, async (request, response) => {
  const parsedTeamId = teamIdSchema.safeParse(request.params.teamId);
  const parsedRequest = assistantRequestSchema.safeParse(request.body);

  if (!parsedTeamId.success || !parsedRequest.success) {
    response.status(400).json({
      error: "Invalid AI assistant request.",
      issues: [...(parsedTeamId.success ? [] : parsedTeamId.error.issues), ...(parsedRequest.success ? [] : parsedRequest.error.issues)]
    });
    return;
  }

  const user = getAuthenticatedUser(response);
  const team = await prisma.fantasyTeam.findFirst({
    where: { id: parsedTeamId.data, userId: user.id },
    include: teamWithRoster
  });

  if (!team) {
    throw new ApiError(404, "Team not found.");
  }

  if (team.rosterMemberships.length === 0) {
    throw new ApiError(422, "Add at least one player before using the AI assistant.");
  }

  const reply = await createAssistantReply({
    team: toTeamDto(team),
    message: parsedRequest.data.message,
    history: parsedRequest.data.history ?? []
  });
  response.json({ reply });
});
