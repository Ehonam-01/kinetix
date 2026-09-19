import "server-only";
import { z } from "zod";

const paydunyaEnvSchema = z.object({
  PAYDUNYA_MASTER_KEY: z.string().min(1),
  PAYDUNYA_PRIVATE_KEY: z.string().min(1),
  PAYDUNYA_TOKEN: z.string().min(1),
});

type PaydunyaEnv = z.infer<typeof paydunyaEnvSchema>;

let cached: PaydunyaEnv | undefined;

// A function, not a module-level constant — see getMonerooEnv (same repo)
// for why: only services/payments/paydunya.ts actually needs these keys,
// so the rest of the app's build/boot shouldn't depend on them existing.
export function getPaydunyaEnv(): PaydunyaEnv {
  cached ??= paydunyaEnvSchema.parse({
    PAYDUNYA_MASTER_KEY: process.env.PAYDUNYA_MASTER_KEY,
    PAYDUNYA_PRIVATE_KEY: process.env.PAYDUNYA_PRIVATE_KEY,
    PAYDUNYA_TOKEN: process.env.PAYDUNYA_TOKEN,
  });
  return cached;
}
