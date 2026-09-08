import { timingSafeEqual } from "node:crypto";

import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { prisma } from "../lib/prisma.js";
import { syncLivePlayerData } from "../services/playerDataSync.js";

export const playerDataSyncRouter = Router();

const syncRateLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many player-data refresh requests. Try again later." }
});

playerDataSyncRouter.post("/player-data", (request, response, next) => {
  const secret = process.env.DATA_SYNC_CRON_SECRET;

  if (!secret || !hasValidSyncSecret(request.header("authorization"), request.header("x-player-data-sync-secret"), secret)) {
    response.status(404).json({ error: "Route not found." });
    return;
  }

  next();
}, syncRateLimit, async (_request, response) => {
  const result = await syncLivePlayerData(prisma, { force: true });
  response.json({ result });
});

export function hasValidSyncSecret(
  authorization: string | undefined,
  playerDataSyncSecret: string | undefined,
  secret: string
): boolean {
  const bearerToken = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  const token = playerDataSyncSecret ?? bearerToken;
  const expected = Buffer.from(secret);
  const supplied = Buffer.from(token);

  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
