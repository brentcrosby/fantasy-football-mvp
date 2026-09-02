import "dotenv/config";

import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => {
  console.log(`Fantasy football API listening on http://localhost:${port}`);
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
