import { Router } from "express";

import { sampleRoster, sampleSettings } from "../data/sampleData.js";

export const teamsRouter = Router();

teamsRouter.get("/demo", (_request, response) => {
  response.json({
    team: {
      id: "demo",
      name: "Demo Lineup",
      settings: sampleSettings,
      roster: sampleRoster
    }
  });
});

