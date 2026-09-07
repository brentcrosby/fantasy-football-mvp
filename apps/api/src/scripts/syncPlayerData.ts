import "dotenv/config";

import { prisma } from "../lib/prisma.js";
import { syncLivePlayerData } from "../services/playerDataSync.js";

const allowStaleData = process.env.ALLOW_STALE_PLAYER_DATA === "true";
const force = process.argv.includes("--force");

try {
  const result = await syncLivePlayerData(prisma, { force });
  console.log(
    result.status === "synced"
      ? `Synced ${result.recordCount} live players for ${result.season} Week ${result.week}; reconciled ${result.reconciledRosterPlayers} saved roster entries.`
      : `Live player data is current for ${result.season} Week ${result.week}; sync skipped.`
  );
} catch (error) {
  const availablePlayers = await prisma.player.count();

  if (!allowStaleData || availablePlayers === 0) {
    throw error;
  }

  console.error("Live player sync failed; continuing with the existing player catalog.", error);
} finally {
  await prisma.$disconnect();
}
