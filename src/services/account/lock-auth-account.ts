import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Called after confirm-account-deletion.ts's DB transaction already
// committed the profile anonymization — best-effort and never throws: a
// Supabase hiccup here must not undo an otherwise-successful deletion, it
// just means the login lockout needs a manual retry. Combines two
// independent lockout mechanisms since Supabase has no single "delete but
// keep the row, and kill every session" primitive: ban_duration blocks new
// sign-ins outright, and resetting the password additionally invalidates
// any refresh tokens issued before this call (an already-issued access
// token can still work until it naturally expires, typically within an
// hour). The email is changed to a reserved-invalid domain (RFC 2606) so
// it can never collide with a real member's address later.
export async function lockAuthAccount(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: randomUUID() + randomUUID(),
      email: `deleted-${userId}@deleted.invalid`,
      ban_duration: "876000h",
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur inconnue.",
    };
  }
}
