import "server-only";
import { z } from "zod";

const cronEnvSchema = z.object({
  CRON_SECRET: z.string().min(1),
});

type CronEnv = z.infer<typeof cronEnvSchema>;

let cached: CronEnv | undefined;

// A function, not a module-level constant — same reasoning as getEmailEnv/
// getMonerooEnv: only handling a real cron request should require this to
// exist, not booting the whole app. Vercel Cron sends
// `Authorization: Bearer ${CRON_SECRET}` automatically on every scheduled
// request once this env var is set (see vercel.json) — the route compares
// against it to reject anyone else calling the endpoint directly.
export function getCronEnv(): CronEnv {
  cached ??= cronEnvSchema.parse({
    CRON_SECRET: process.env.CRON_SECRET,
  });
  return cached;
}
