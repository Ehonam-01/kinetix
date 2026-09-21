import "server-only";
import { z } from "zod";
import { parseProviderEnv } from "@/config/parse-provider-env";

const monerooEnvSchema = z.object({
  MONEROO_SECRET_KEY: z.string().min(1),
  MONEROO_WEBHOOK_SECRET: z.string().min(1),
});

type MonerooEnv = z.infer<typeof monerooEnvSchema>;

let cached: MonerooEnv | undefined;

// A function, not a module-level constant: validating eagerly at import
// time would make the build/boot of the *entire app* depend on Moneroo
// being configured, the same mistake made with src/proxy.ts in Phase 1 —
// except this module is only imported by services/payments/moneroo.ts, so
// only actually calling this (a real payment or webhook request) needs
// the keys to exist.
export function getMonerooEnv(): MonerooEnv {
  cached ??= parseProviderEnv(monerooEnvSchema, {
    MONEROO_SECRET_KEY: process.env.MONEROO_SECRET_KEY,
    MONEROO_WEBHOOK_SECRET: process.env.MONEROO_WEBHOOK_SECRET,
  });
  return cached;
}
