import { z } from "zod";

const runtimeConfigSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  DATABASE_URL: z.string().trim().min(1),
  WEB_ORIGIN: z.string().url().optional()
});

export function loadRuntimeConfig(environment: NodeJS.ProcessEnv = process.env) {
  const parsed = runtimeConfigSchema.safeParse(environment);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`).join("; ");
    throw new Error(`Invalid runtime configuration. ${details}`);
  }

  return {
    nodeEnvironment: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    webOrigin: parsed.data.WEB_ORIGIN
  };
}
