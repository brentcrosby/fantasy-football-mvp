import type { PlayerDataSource } from "@prisma/client";

import { ApiError } from "./apiError.js";

interface ProjectionWeekPlayer {
  dataSource: PlayerDataSource;
  projectionWeek: number | null;
}

export function assertProjectionWeek(players: ProjectionWeekPlayer[], requestedWeek: number): void {
  const livePlayers = players.filter((player) => player.dataSource === "LIVE");
  const availableWeeks = [
    ...new Set(
      livePlayers
        .filter((player) => player.projectionWeek !== null)
        .map((player) => player.projectionWeek!)
    )
  ];

  if (livePlayers.some((player) => player.projectionWeek !== requestedWeek)) {
    throw new ApiError(422, `Live projections are not available for Week ${requestedWeek}.`, {
      requestedWeek,
      availableWeeks,
      unavailablePlayerCount: livePlayers.filter((player) => player.projectionWeek === null).length
    });
  }
}
