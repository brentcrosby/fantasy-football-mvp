import { z } from "zod";

const scoringFormatSchema = z.enum(["STANDARD", "HALF_PPR", "PPR", "CUSTOM"]);
const lineupSlotSchema = z.enum(["QB", "RB", "WR", "TE", "K", "DST", "FLEX"]);
const scoringRulesSchema = z
  .record(
    z.string().trim().regex(/^[a-z0-9_]+$/).max(60),
    z.number().finite().min(-1000).max(1000)
  )
  .superRefine((rules, context) => {
    if (Object.keys(rules).length > 250) {
      context.addIssue({ code: "custom", message: "Scoring rules cannot contain more than 250 entries." });
    }
  });
const settingsSchema = z
  .object({
    scoringFormat: scoringFormatSchema,
    lineupSlots: z.array(lineupSlotSchema).min(1).max(30),
    scoringRules: scoringRulesSchema.optional()
  })
  .strict()
  .superRefine((settings, context) => {
    if (
      settings.scoringFormat === "CUSTOM" &&
      (!settings.scoringRules || Object.keys(settings.scoringRules).length === 0)
    ) {
      context.addIssue({
        code: "custom",
        message: "Custom scoring requires scoring rules.",
        path: ["scoringRules"]
      });
    }
  });
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

export const saveWeeklyReportRequestSchema = z
  .object({
    week: z.number().int().min(1).max(18)
  })
  .strict();

export const authCredentialsSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(320),
    password: z.string().min(10).max(128)
  })
  .strict();

export const sleeperUsernameSchema = z.string().trim().min(1).max(50);

export const sleeperLeagueIdSchema = z.string().trim().regex(/^\d+$/, "Sleeper league ID must be numeric.").max(30);

export const sleeperImportRequestSchema = z
  .object({
    username: sleeperUsernameSchema,
    leagueId: sleeperLeagueIdSchema
  })
  .strict();
