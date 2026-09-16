import "server-only";
import { z } from "zod";

const siteEnvSchema = z.object({
  SITE_URL: z.string().url(),
});

type SiteEnv = z.infer<typeof siteEnvSchema>;

let cached: SiteEnv | undefined;

// A function, not a module-level constant, same reasoning as the other
// env.*.ts modules — only building a link outside of any request context
// (services/subscriptions/send-expiry-reminders.ts, run by a Vercel Cron
// job with no `headers()`/origin to read) needs this.
export function getSiteEnv(): SiteEnv {
  cached ??= siteEnvSchema.parse({
    SITE_URL: process.env.SITE_URL,
  });
  return cached;
}
