import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/config/env.public";
import { getSupabaseAdminEnv } from "@/config/env.supabase-admin";

// Service-role client — bypasses RLS and is the only way to manage another
// user's auth.users row (ban/reset password/change email) from server code.
// Mirrors the admin client scripts/seed-real-level2.ts already builds by
// hand; centralized here now that the app itself needs one too
// (services/account/lock-auth-account.ts). Never import this from
// anything reachable by an unauthenticated request — every call site must
// gate on requireUser/requireAdmin first.
export function createAdminClient() {
  return createClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    getSupabaseAdminEnv().SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
