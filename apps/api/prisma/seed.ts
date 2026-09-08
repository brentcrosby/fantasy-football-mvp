import { PrismaClient } from "@prisma/client";

import { seedPlayers } from "./seedData.js";

const prisma = new PrismaClient();

try {
  await prisma.$transaction(
    seedPlayers.map((player) =>
      prisma.player.upsert({
        where: { id: player.id },
        create: player,
        update: {
          name: player.name,
          position: player.position,
          nflTeam: player.nflTeam,
          byeWeek: player.byeWeek,
          injuryStatus: player.injuryStatus,
          projectedPoints: player.projectedPoints,
          projectionSource: player.projectionSource,
          targetShare: player.targetShare,
          dataSource: player.dataSource
        }
      })
    )
  );
} finally {
  await prisma.$disconnect();
}
