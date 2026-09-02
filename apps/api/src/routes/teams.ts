import { Router, type Response } from "express";

import { ApiError } from "../lib/apiError.js";
import { teamWithRoster, toTeamDto } from "../lib/mappers.js";
import { prisma } from "../lib/prisma.js";
import { teamIdSchema, teamWriteRequestSchema } from "../lib/validation.js";

export const teamsRouter = Router();

teamsRouter.post("/", async (request, response) => {
  const parsed = teamWriteRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Invalid team request.", issues: parsed.error.issues });
    return;
  }

  const team = await prisma.$transaction(async (transaction) => {
    await assertPlayersExist(transaction, parsed.data.rosterPlayerIds);

    return transaction.fantasyTeam.create({
      data: {
        name: parsed.data.name,
        scoringFormat: parsed.data.settings.scoringFormat,
        lineupSlots: parsed.data.settings.lineupSlots,
        rosterMemberships:
          parsed.data.rosterPlayerIds.length === 0
            ? undefined
            : { create: parsed.data.rosterPlayerIds.map((playerId) => ({ playerId })) }
      },
      include: teamWithRoster
    });
  });

  response.status(201).json({ team: toTeamDto(team) });
});

teamsRouter.get("/:teamId", async (request, response) => {
  const teamId = parseTeamId(request.params.teamId, response);

  if (!teamId) {
    return;
  }

  const team = await prisma.fantasyTeam.findUnique({ where: { id: teamId }, include: teamWithRoster });

  if (!team) {
    throw new ApiError(404, "Team not found.");
  }

  response.json({ team: toTeamDto(team) });
});

teamsRouter.put("/:teamId", async (request, response) => {
  const teamId = parseTeamId(request.params.teamId, response);
  const parsed = teamWriteRequestSchema.safeParse(request.body);

  if (!teamId) {
    return;
  }

  if (!parsed.success) {
    response.status(400).json({ error: "Invalid team request.", issues: parsed.error.issues });
    return;
  }

  const team = await prisma.$transaction(async (transaction) => {
    const existingTeam = await transaction.fantasyTeam.findUnique({ where: { id: teamId }, select: { id: true } });

    if (!existingTeam) {
      throw new ApiError(404, "Team not found.");
    }

    await assertPlayersExist(transaction, parsed.data.rosterPlayerIds);
    await transaction.fantasyTeam.update({
      where: { id: teamId },
      data: {
        name: parsed.data.name,
        scoringFormat: parsed.data.settings.scoringFormat,
        lineupSlots: parsed.data.settings.lineupSlots
      }
    });
    await transaction.rosterMembership.deleteMany({ where: { fantasyTeamId: teamId } });

    if (parsed.data.rosterPlayerIds.length > 0) {
      await transaction.rosterMembership.createMany({
        data: parsed.data.rosterPlayerIds.map((playerId) => ({ fantasyTeamId: teamId, playerId }))
      });
    }

    return transaction.fantasyTeam.findUniqueOrThrow({ where: { id: teamId }, include: teamWithRoster });
  });

  response.json({ team: toTeamDto(team) });
});

function parseTeamId(teamId: string, response: Response): string | null {
  const parsed = teamIdSchema.safeParse(teamId);

  if (!parsed.success) {
    response.status(400).json({ error: "Invalid team ID.", issues: parsed.error.issues });
    return null;
  }

  return parsed.data;
}

async function assertPlayersExist(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  playerIds: string[]
) {
  if (playerIds.length === 0) {
    return;
  }

  const players = await transaction.player.findMany({ where: { id: { in: playerIds } }, select: { id: true } });
  const foundIds = new Set(players.map((player) => player.id));
  const unknownPlayerIds = playerIds.filter((playerId) => !foundIds.has(playerId));

  if (unknownPlayerIds.length > 0) {
    throw new ApiError(422, "One or more players were not found.", { unknownPlayerIds });
  }
}
