import { Router } from "express";

import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({
      ok: true,
      service: "fantasy-football-api",
      database: "connected"
    });
  } catch (error) {
    console.error("Health check could not reach PostgreSQL.", error);
    response.status(503).json({
      ok: false,
      service: "fantasy-football-api",
      database: "unavailable"
    });
  }
});
