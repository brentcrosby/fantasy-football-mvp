import { z } from "zod";

export const playerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  position: z.enum(["QB", "RB", "WR", "TE", "K", "DST"]),
  nflTeam: z.string().min(1),
  byeWeek: z.number().int().min(1).max(18),
  injuryStatus: z.enum(["HEALTHY", "QUESTIONABLE", "DOUBTFUL", "OUT", "IR", "SUSPENDED"]),
  projectedPoints: z.number().min(0),
  targetShare: z.number().min(0).max(1).optional()
});

export const recommendationRequestSchema = z.object({
  week: z.number().int().min(1).max(18),
  settings: z.object({
    scoringFormat: z.enum(["STANDARD", "HALF_PPR", "PPR"]),
    lineupSlots: z.array(z.enum(["QB", "RB", "WR", "TE", "K", "DST", "FLEX"])).min(1)
  }),
  roster: z.array(z.object({ player: playerSchema })).min(1)
});

