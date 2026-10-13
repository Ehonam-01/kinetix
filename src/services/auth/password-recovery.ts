import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseAdminEnv } from "@/config/env.supabase-admin";

// Proof that this browser came through a password-recovery email link
// (security audit SEC-03). The reset form used to accept any signed-in
// session: someone holding a stolen session could set a new password
// without knowing the current one and lock the member out. Now
// auth/callback/route.ts sets this cookie only when it exchanges a code
// from a recovery email (next=/reset-password), and the reset action
// requires it — for that same user, within RECOVERY_TTL_MS.
//
// Signed (HMAC-SHA256), so it can't be written by hand. The key is derived
// from the server-only Supabase service key with its own label, never that
// key itself.
export const RECOVERY_COOKIE_NAME = "kx_pw_recovery";
export const RECOVERY_TTL_MS = 15 * 60 * 1000;

function signingKey() {
  return createHash("sha256")
    .update("kinetix:password-recovery:v1:")
    .update(getSupabaseAdminEnv().SUPABASE_SERVICE_ROLE_KEY)
    .digest();
}

function sign(payload: string) {
  return createHmac("sha256", signingKey()).update(payload).digest("hex");
}

export function createRecoveryProof(userId: string, now = Date.now()) {
  const payload = `${userId}.${now + RECOVERY_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidRecoveryProof(
  value: string | undefined,
  userId: string,
  now = Date.now(),
) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [proofUserId, expiresAt, signature] = parts;
  if (proofUserId !== userId) return false;
  const expiry = Number(expiresAt);
  if (!Number.isFinite(expiry) || expiry <= now) return false;
  const expected = Buffer.from(sign(`${proofUserId}.${expiresAt}`));
  const received = Buffer.from(signature);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

export const recoveryCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: RECOVERY_TTL_MS / 1000,
};

// Set when a reset link is asked for (forgot-password), in the browser that
// will open it — the link itself comes back to the plain /auth/callback
// (the redirect URL Supabase already accepts; with "?next=..." it fell back
// to the site's root and the member never reached the reset form). The
// callback reads this to send that browser to /reset-password. Not a proof
// on its own: the proof above still requires exchanging the code from the
// email. One hour, Supabase's default lifetime for the link.
export const RECOVERY_REQUEST_COOKIE_NAME = "kx_pw_reset_requested";
export const recoveryRequestCookieOptions = {
  ...recoveryCookieOptions,
  maxAge: 60 * 60,
};
