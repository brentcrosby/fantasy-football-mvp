import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { assertTestDatabaseUrl } from "../src/lib/testDatabaseGuard.js";

assertTestDatabaseUrl();

const apiDirectory = fileURLToPath(new URL("..", import.meta.url));

runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
runPrisma(["db", "seed", "--schema", "prisma/schema.prisma"]);
runPrisma(["db", "seed", "--schema", "prisma/schema.prisma"]);

function runPrisma(arguments_: string[]) {
  const result = spawnSync("npm", ["exec", "--", "prisma", ...arguments_], {
    cwd: apiDirectory,
    env: process.env,
    stdio: "inherit"
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Prisma command failed with exit code ${result.status ?? "unknown"}.`);
  }
}
