import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// The signed-in Supabase user, validated by Supabase itself (getUser sends
// the session's access token to the Auth server) — once per request:
// layouts, pages and guards all ask, and each ask used to be its own
// network round trip (React's cache() dedupes them within one request).
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

// The payload of the current session's access token, decoded locally —
// trusted only because getAuthUser has validated that same session with
// Supabase in this request, and only if it belongs to that user and hasn't
// expired. Read fresh each time (no cache): right after an MFA code is
// verified, the session in the cookies is replaced by an aal2 one within
// the same request.
export async function getVerifiedSessionClaims(
  user: User,
): Promise<{ aal?: string } | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  try {
    const part = session.access_token.split(".")[1];
    const claims = JSON.parse(
      Buffer.from(
        part.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf8"),
    ) as { sub?: string; exp?: number; aal?: string };
    if (claims.sub !== user.id) return null;
    if (!claims.exp || claims.exp * 1000 <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}
