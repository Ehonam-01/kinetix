import "server-only";
import { z } from "zod";

const supabaseAdminEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

type SupabaseAdminEnv = z.infer<typeof supabaseAdminEnvSchema>;

let cached: SupabaseAdminEnv | undefined;

// A function, not a module-level constant — see getMonerooEnv (same repo)
// for why: only services/account/lock-auth-account.ts actually needs this
// key, so the rest of the app's build/boot shouldn't depend on it existing.
export function getSupabaseAdminEnv(): SupabaseAdminEnv {
  cached ??= supabaseAdminEnvSchema.parse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  return cached;
}
