import { Router, type Response } from "express";
import { rateLimit } from "express-rate-limit";
import { Prisma } from "@prisma/client";
import { buildLineupRecommendation, type RecommendationRequest } from "@fantasy-football/shared";

import { ApiError } from "../lib/apiError.js";
import { buildLeagueOverview } from "../lib/leagueOverview.js";
import { teamWithRoster, toPlayerDto, toSavedWeeklyReportDto, toTeamDto } from "../lib/mappers.js";
import { assertProjectionWeek } from "../lib/playerProjection.js";
import { prisma } from "../lib/prisma.js";
import { getAuthenticatedUser, requireAuth } from "../lib/session.js";
import { buildWaiverReport } from "../lib/waiverRecommendation.js";
import { saveWeeklyReportRequestSchema, teamIdSchema, teamWriteRequestSchema } from "../lib/validation.js";
import { loadSleeperLeagueContext, loadSleeperLeagueRosteredPlayerIds } from "../services/sleeperLeagueImport.js";

export const teamsRouter = Router();
teamsRouter.use(requireAuth);

const waiverRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many waiver scans. Try again later." }
});

const leagueRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many league refreshes. Try again later." }
});

teamsRouter.get("/", async (_request, response) => {
  const user = getAuthenticatedUser(response);
  const teams = await prisma.fantasyTeam.findMany({
    where: { userId: user.id },
    include: teamWithRoster,
    orderBy: { updatedAt: "desc" }
  });

  response.json({ teams: teams.map(toTeamDto) });
});

teamsRouter.post("/", async (request, response) => {
  const user = getAuthenticatedUser(response);
  const parsed = teamWriteRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(400).json({ error: "Invalid team request.", issues: parsed.error.issues });
    return;
  }

  const team = await prisma.$transaction(async (transaction) => {
    await assertPlayersExist(transaction, parsed.data.rosterPlayerIds);

    return transaction.fantasyTeam.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        scoringFormat: parsed.data.settings.scoringFormat,
        ...(parsed.data.settings.scoringRules
          ? { scoringRules: parsed.data.settings.scoringRules as Prisma.InputJsonValue }
          : {}),
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

teamsRouter.get<{ teamId: string }>("/:teamId/waivers", waiverRateLimit, async (request, response) => {
  const user = getAuthenticatedUser(response);
  const teamId = parseTeamId(request.params.teamId, response);

  if (!teamId) return;

  const team = await prisma.fantasyTeam.findFirst({
    where: { id: teamId, userId: user.id },
    include: teamWithRoster
  });

  if (!team) {
    throw new ApiError(404, "Team not found.");
  }

  if (!team.sleeperLeagueId) {
    throw new ApiError(422, "Import this team from Sleeper before scanning its waiver wire.");
  }

  const sync = await prisma.playerDataSync.findUnique({ where: { id: "weekly-player-data" } });

  if (!sync) {
    throw new ApiError(503, "Current player projections are unavailable. Sync player data before scanning waivers.");
  }

  const [leagueRosteredPlayerIds, currentPlayers] = await Promise.all([
    loadSleeperLeagueRosteredPlayerIds(team.sleeperLeagueId),
    prisma.player.findMany({
      where: {
        dataSource: "LIVE",
        season: sync.season,
        projectionWeek: sync.week,
        hasProjection: true
      }
    })
  ]);
  const leagueRosteredIds = new Set(leagueRosteredPlayerIds);
  const currentRosterIds = new Set(team.rosterMemberships.map(({ playerId }) => playerId));
  const availablePlayers = currentPlayers
    .filter((player) => player.externalId && !leagueRosteredIds.has(player.externalId))
    .filter((player) => !currentRosterIds.has(player.id))
    .map(toPlayerDto);
  const scoringRules = readScoringRules(team.scoringRules);
  const report = buildWaiverReport({
    week: sync.week,
    leagueId: team.sleeperLeagueId,
    settings: {
      scoringFormat: team.scoringFormat,
      lineupSlots: team.lineupSlots,
      ...(scoringRules ? { scoringRules } : {})
    },
    roster: team.rosterMemberships.map(({ player }) => ({ player: toPlayerDto(player) })),
    availablePlayers,
    rosteredPlayerCount: leagueRosteredIds.size
  });

  response.json({ report });
});

teamsRouter.get<{ teamId: string }>("/:teamId/league", leagueRateLimit, async (request, response) => {
  const user = getAuthenticatedUser(response);
  const teamId = parseTeamId(request.params.teamId, response);

  if (!teamId) return;

  const team = await prisma.fantasyTeam.findFirst({
    where: { id: teamId, userId: user.id },
    include: teamWithRoster
  });

  if (!team) {
    throw new ApiError(404, "Team not found.");
  }

  if (!team.sleeperLeagueId || team.sleeperRosterId === null) {
    throw new ApiError(422, "Import this team from Sleeper before loading league details.");
  }

  const sync = await prisma.playerDataSync.findUnique({ where: { id: "weekly-player-data" } });

  if (!sync) {
    throw new ApiError(503, "Current player projections are unavailable. Sync player data before loading the league.");
  }

  const [context, currentPlayers] = await Promise.all([
    loadSleeperLeagueContext(team.sleeperLeagueId, sync.week),
    prisma.player.findMany({
      where: {
        dataSource: "LIVE",
        season: sync.season,
        projectionWeek: sync.week
      }
    })
  ]);
  const playersByExternalId = new Map(
    currentPlayers.flatMap((player) => (player.externalId ? [[player.externalId, toPlayerDto(player)] as const] : []))
  );
  const scoringRules = readScoringRules(team.scoringRules);
  const overview = buildLeagueOverview({
    context,
    week: sync.week,
    userRosterId: team.sleeperRosterId,
    settings: {
      scoringFormat: team.scoringFormat,
      lineupSlots: team.lineupSlots,
      ...(scoringRules ? { scoringRules } : {})
    },
    playersByExternalId,
    projectionSource: sync.source
  });

  response.json({ overview });
});

teamsRouter.get("/:teamId/reports", async (request, response) => {
  const user = getAuthenticatedUser(response);
  const teamId = parseTeamId(request.params.teamId, response);

  if (!teamId) {
    return;
  }

  await assertOwnedTeam(teamId, user.id);

  const reports = await prisma.weeklyReport.findMany({
    where: { fantasyTeamId: teamId },
    orderBy: { createdAt: "desc" }
  });

  response.json({ reports: reports.map(toSavedWeeklyReportDto) });
});

teamsRouter.post("/:teamId/reports", async (request, response) => {
  const user = getAuthenticatedUser(response);
  const teamId = parseTeamId(request.params.teamId, response);
  const parsed = saveWeeklyReportRequestSchema.safeParse(request.body);

  if (!teamId) {
    return;
  }

  if (!parsed.success) {
    response.status(400).json({ error: "Invalid weekly report request.", issues: parsed.error.issues });
    return;
  }

  const team = await prisma.fantasyTeam.findFirst({
    where: { id: teamId, userId: user.id },
    include: teamWithRoster
  });

  if (!team) {
    throw new ApiError(404, "Team not found.");
  }

  if (team.rosterMemberships.length === 0) {
    throw new ApiError(422, "Add at least one player before saving a weekly report.");
  }

  assertProjectionWeek(
    team.rosterMemberships.map(({ player }) => player),
    parsed.data.week
  );

  const roster = team.rosterMemberships
    .map(({ player }) => ({ player: toPlayerDto(player) }))
    .sort((left, right) => left.player.name.localeCompare(right.player.name));
  const scoringRules = readScoringRules(team.scoringRules);
  const recommendationRequest: RecommendationRequest = {
    week: parsed.data.week,
    settings: {
      scoringFormat: team.scoringFormat,
      lineupSlots: team.lineupSlots,
      ...(scoringRules ? { scoringRules } : {})
    },
    roster
  };
  const report = buildLineupRecommendation(recommendationRequest);

  const savedReport = await prisma.weeklyReport.create({
    data: {
      fantasyTeamId: team.id,
      teamName: team.name,
      week: parsed.data.week,
      scoringFormat: team.scoringFormat,
      scoringRules: team.scoringRules === null ? undefined : (team.scoringRules as Prisma.InputJsonValue),
      lineupSlots: team.lineupSlots,
      rosterSnapshot: roster as unknown as Prisma.InputJsonValue,
      reportSnapshot: report as unknown as Prisma.InputJsonValue
    }
  });

  response.status(201).json({ report: toSavedWeeklyReportDto(savedReport) });
});

teamsRouter.get("/:teamId", async (request, response) => {
  const user = getAuthenticatedUser(response);
  const teamId = parseTeamId(request.params.teamId, response);

  if (!teamId) {
    return;
  }

  const team = await prisma.fantasyTeam.findFirst({ where: { id: teamId, userId: user.id }, include: teamWithRoster });

  if (!team) {
    throw new ApiError(404, "Team not found.");
  }

  response.json({ team: toTeamDto(team) });
});

teamsRouter.put("/:teamId", async (request, response) => {
  const user = getAuthenticatedUser(response);
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
    const existingTeam = await transaction.fantasyTeam.findFirst({
      where: { id: teamId, userId: user.id },
      select: { id: true }
    });

    if (!existingTeam) {
      throw new ApiError(404, "Team not found.");
    }

    await assertPlayersExist(transaction, parsed.data.rosterPlayerIds);
    await transaction.fantasyTeam.update({
      where: { id: teamId },
      data: {
        name: parsed.data.name,
        scoringFormat: parsed.data.settings.scoringFormat,
        scoringRules: parsed.data.settings.scoringRules
          ? (parsed.data.settings.scoringRules as Prisma.InputJsonValue)
          : Prisma.DbNull,
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

async function assertOwnedTeam(teamId: string, userId: string): Promise<void> {
  const team = await prisma.fantasyTeam.findFirst({ where: { id: teamId, userId }, select: { id: true } });

  if (!team) {
    throw new ApiError(404, "Team not found.");
  }
}

function readScoringRules(value: Prisma.JsonValue | null): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1])
  );

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}
