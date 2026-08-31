import { Router } from "express";

import { samplePlayers } from "../data/sampleData.js";

export const playersRouter = Router();

playersRouter.get("/", (_request, response) => {
  response.json({ players: samplePlayers });
});

