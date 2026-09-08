import { Router } from "express";

import { toPlayerDto } from "../lib/mappers.js";
import { projectionModelSummary } from "../lib/experimentalProjection.js";
import { prisma } from "../lib/prisma.js";

export const playersRouter = Router();

playersRouter.get("/", async (_request, response) => {
  const sync = await prisma.playerDataSync.findUnique({ where: { id: "weekly-player-data" } });
  const livePlayers = sync
    ? await prisma.player.findMany({
        where: {
          dataSource: "LIVE",
          season: sync.season,
          projectionWeek: sync.week
        },
        orderBy: [{ projectedPoints: "desc" }, { name: "asc" }]
      })
    : [];
  const usingLiveData = livePlayers.length > 0;
  const players = usingLiveData
    ? livePlayers
    : await prisma.player.findMany({
        where: { dataSource: "SEED" },
        orderBy: [{ projectedPoints: "desc" }, { name: "asc" }]
      });

  response.json({
    players: players.map(toPlayerDto),
    metadata: usingLiveData
      ? {
          source: "LIVE",
          sourceLabel: sync!.source,
          season: sync!.season,
          week: sync!.week,
          updatedAt: sync!.sourceUpdatedAt.toISOString(),
          model: projectionModelSummary()
        }
      : {
          source: "SAMPLE",
          sourceLabel: "Sample player catalog",
          season: null,
          week: null,
          updatedAt: null
        }
  });
});
