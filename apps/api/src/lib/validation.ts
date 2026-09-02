import { z } from "zod";

const scoringFormatSchema = z.enum(["STANDARD", "HALF_PPR", "PPR"]);
const lineupSlotSchema = z.enum(["QB", "RB", "WR", "TE", "K", "DST", "FLEX"]);
const settingsSchema = z
  .object({
    scoringFormat: scoringFormatSchema,
    lineupSlots: z.array(lineupSlotSchema).min(1).max(30)
  })
  .strict();
const playerIdSchema = z.string().trim().min(1).max(100);

function uniquePlayerIds(minimum: number) {
  return z
    .array(playerIdSchema)
    .min(minimum)
    .max(30)
    .superRefine((playerIds, context) => {
      const seenIds = new Set<string>();

      playerIds.forEach((playerId, index) => {
        if (seenIds.has(playerId)) {
          context.addIssue({
            code: "custom",
            message: `Duplicate player ID: ${playerId}.`,
            path: [index]
          });
        }

        seenIds.add(playerId);
      });
    });
}

export const recommendationApiRequestSchema = z
  .object({
    week: z.number().int().min(1).max(18),
    settings: settingsSchema,
    rosterPlayerIds: uniquePlayerIds(1)
  })
  .strict();

export const teamWriteRequestSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    settings: settingsSchema,
    rosterPlayerIds: uniquePlayerIds(0)
  })
  .strict();

export const teamIdSchema = z.string().trim().min(1).max(100);

export const authCredentialsSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    password: z.string().min(10).max(128)
  })
  .strict();
