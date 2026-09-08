import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import type { SleeperImportPreview } from "@fantasy-football/shared";
import type { Prisma } from "@prisma/client";

import { ApiError } from "../lib/apiError.js";
import { teamWithRoster, toPlayerDto, toTeamDto } from "../lib/mappers.js";
import { prisma } from "../lib/prisma.js";
import { getAuthenticatedUser, requireAuth } from "../lib/session.js";
import { sleeperImportRequestSchema, sleeperUsernameSchema } from "../lib/validation.js";
import {
  findSleeperLeagues,
  loadSleeperImportCandidate,
  type SleeperImportCandidate
} from "../services/sleeperLeagueImport.js";

export const sleeperRouter = Router();

const sleeperRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many Sleeper requests. Try again later." }
});

sleeperRouter.use(requireAuth, sleeperRateLimit);

sleeperRouter.get("/leagues", async (request, response) => {
  const parsed = sleeperUsernameSchema.safeParse(request.query.username);

  if (!parsed.success) {
    response.status(400).json({ error: "Invalid Sleeper username.", issues: parsed.error.issues });
    return;
  }

  response.json(await findSleeperLeagues(parsed.data));
});

sleeperRouter.post("/preview", async (request, response) => {
  const user = getAuthenticatedUser(response);
  const parsed = sleeperImportRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Invalid Sleeper import request.", issues: parsed.error.issues });
    return;
  }

  const candidate = await loadSleeperImportCandidate(parsed.data.username, parsed.data.leagueId);
  response.json({ preview: await buildImportPreview(candidate, user.id) });
});

sleeperRouter.post("/import", async (request, response) => {
  const user = getAuthenticatedUser(response);
  const parsed = sleeperImportRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Invalid Sleeper import request.", issues: parsed.error.issues });
    return;
  }

  const candidate = await loadSleeperImportCandidate(parsed.data.username, parsed.data.leagueId);
  const preview = await buildImportPreview(candidate, user.id);

  if (!preview.canImport || !preview.settings) {
    throw new ApiError(422, "This Sleeper league cannot be imported with the current lineup model.", {
      unsupportedLineupSlots: preview.unsupportedLineupSlots,
      unmatchedPlayerIds: preview.unmatchedPlayerIds,
      warnings: preview.warnings
    });
  }

  const settings = preview.settings;
  const rosterPlayerIds = preview.rosterPlayers.map((player) => player.id);
  const syncedAt = new Date();
  const existingTeam = await prisma.fantasyTeam.findFirst({
    where: { userId: user.id, sleeperLeagueId: candidate.league.id },
    select: { id: true }
  });
  const team = await prisma.$transaction(async (transaction) => {
    if (existingTeam) {
      await transaction.fantasyTeam.update({
        where: { id: existingTeam.id },
        data: {
          name: candidate.teamName,
          scoringFormat: settings.scoringFormat,
          scoringRules: settings.scoringRules as Prisma.InputJsonValue,
          lineupSlots: settings.lineupSlots,
          sleeperRosterId: candidate.rosterId,
          sleeperUserId: candidate.user.id,
          sleeperUsername: candidate.user.username,
          sleeperSyncedAt: syncedAt
        }
      });
      await transaction.rosterMembership.deleteMany({ where: { fantasyTeamId: existingTeam.id } });
      await transaction.rosterMembership.createMany({
        data: rosterPlayerIds.map((playerId) => ({ fantasyTeamId: existingTeam.id, playerId }))
      });

      return transaction.fantasyTeam.findUniqueOrThrow({
        where: { id: existingTeam.id },
        include: teamWithRoster
      });
    }

    return transaction.fantasyTeam.create({
      data: {
        userId: user.id,
        name: candidate.teamName,
        scoringFormat: settings.scoringFormat,
        scoringRules: settings.scoringRules as Prisma.InputJsonValue,
        lineupSlots: settings.lineupSlots,
        sleeperLeagueId: candidate.league.id,
        sleeperRosterId: candidate.rosterId,
        sleeperUserId: candidate.user.id,
        sleeperUsername: candidate.user.username,
        sleeperSyncedAt: syncedAt,
        rosterMemberships: {
          create: rosterPlayerIds.map((playerId) => ({ playerId }))
        }
      },
      include: teamWithRoster
    });
  });

  response.status(existingTeam ? 200 : 201).json({ team: toTeamDto(team) });
});

async function buildImportPreview(candidate: SleeperImportCandidate, userId: string): Promise<SleeperImportPreview> {
  const sync = await prisma.playerDataSync.findUnique({ where: { id: "weekly-player-data" } });
  const players = sync
    ? await prisma.player.findMany({
        where: {
          dataSource: "LIVE",
          externalId: { in: candidate.sleeperPlayerIds },
          season: sync.season,
          projectionWeek: sync.week
        }
      })
    : [];
  const playerByExternalId = new Map(
    players.flatMap((player) => (player.externalId ? [[player.externalId, player] as const] : []))
  );
  const rosterPlayers = candidate.sleeperPlayerIds.flatMap((playerId) => {
    const player = playerByExternalId.get(playerId);
    return player ? [toPlayerDto(player)] : [];
  });
  const unmatchedPlayerIds = candidate.sleeperPlayerIds.filter((playerId) => !playerByExternalId.has(playerId));
  const warnings = [...candidate.warnings];

  if (!sync) {
    warnings.push("The live player catalog must be synced before importing a Sleeper roster.");
  } else if (unmatchedPlayerIds.length > 0) {
    warnings.push(
      `${unmatchedPlayerIds.length} roster entr${unmatchedPlayerIds.length === 1 ? "y is" : "ies are"} unsupported or missing from the current player catalog.`
    );
  }

  if (rosterPlayers.length === 0) {
    warnings.push("No supported roster players were found.");
  }

  if (rosterPlayers.length > 30) {
    warnings.push("This roster has more than the 30 players currently supported by the lineup engine.");
  }

  if (candidate.lineupSlots.length > 30) {
    warnings.push("This league has more than the 30 starting slots currently supported by the lineup engine.");
  }

  const existingTeam = await prisma.fantasyTeam.findFirst({
    where: { userId, sleeperLeagueId: candidate.league.id },
    select: { id: true }
  });

  return {
    user: candidate.user,
    league: candidate.league,
    teamName: candidate.teamName,
    settings:
      candidate.lineupSlots.length > 0
        ? {
            scoringFormat: candidate.scoringFormat,
            lineupSlots: candidate.lineupSlots,
            scoringRules: candidate.scoringRules
          }
        : null,
    rosterPlayers,
    unmatchedPlayerIds,
    unsupportedLineupSlots: candidate.unsupportedLineupSlots,
    warnings,
    canImport:
      Boolean(sync) &&
      candidate.lineupSlots.length > 0 &&
      candidate.lineupSlots.length <= 30 &&
      candidate.unsupportedLineupSlots.length === 0 &&
      rosterPlayers.length > 0 &&
      rosterPlayers.length <= 30,
    existingTeamId: existingTeam?.id ?? null
  };
}
