import { Router } from "express";

import { toPlayerDto } from "../lib/mappers.js";
import { prisma } from "../lib/prisma.js";

export const playersRouter = Router();

playersRouter.get("/", async (_request, response) => {
  const players = await prisma.player.findMany({ orderBy: { name: "asc" } });

  response.json({ players: players.map(toPlayerDto) });
});
