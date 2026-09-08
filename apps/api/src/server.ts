import "dotenv/config";

import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";
import { loadRuntimeConfig } from "./lib/runtimeConfig.js";

const { port } = loadRuntimeConfig();
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Fantasy football API listening on http://localhost:${port}`);
  console.log(`Player-data sync endpoint ${process.env.DATA_SYNC_CRON_SECRET ? "enabled" : "disabled"}.`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close((error) => {
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }

      void prisma.$disconnect().catch((disconnectError: unknown) => {
        console.error("Failed to disconnect Prisma during shutdown.", disconnectError);
        process.exitCode = 1;
      });
    });
  });
}
