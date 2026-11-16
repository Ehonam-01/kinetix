import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { ADMIN_IDLE_MS } from "./admin-session-timing";

// An admin session ends after an hour without activity, and when the
// browser is closed (explicit user decision): the admin account validates
// withdrawals and sets commission rates, so a session left open on a
// shared or unattended computer mustn't stay usable.
//
// This cookie carries "<user id>.<last activity>.<signature>":
// - set once the admin passes the second factor (app/mfa/actions.ts);
// - a browser session cookie (no Max-Age), so the browser drops it when
//   it's closed, unlike Supabase's own session cookies, which last;
// - moved forward by src/proxy.ts on every request while still fresh;
// - required, fresh, by services/auth/current-user.ts for any admin
//   session past its second factor: missing or stale, the session is
//   signed out (app/auth/admin-expired).
//
// Signed (HMAC-SHA256), so it can't be written or moved forward by hand.
// The key is derived from the server-only Supabase service key with its
// own label, never that key itself. No "server-only" import: the proxy
// uses it too.
export const ADMIN_SESSION_COOKIE = "kx_admin_session";
export { ADMIN_IDLE_MS };

function signingKey(serviceKey: string) {
  return createHash("sha256")
    .update("kinetix:admin-session:v1:")
    .update(serviceKey)
    .digest();
}

function sign(payload: string, serviceKey: string) {
  return createHmac("sha256", signingKey(serviceKey))
    .update(payload)
    .digest("hex");
}

export function signAdminSession(
  userId: string,
  serviceKey: string,
  now = Date.now(),
) {
  const payload = `${userId}.${now}`;
  return `${payload}.${sign(payload, serviceKey)}`;
}

// True when the cookie is this user's, signed, and its last activity is
// less than ADMIN_IDLE_MS ago.
export function isFreshAdminSession(
  value: string | undefined,
  userId: string,
  serviceKey: string,
  now = Date.now(),
) {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [cookieUserId, seenAt, signature] = parts;
  if (cookieUserId !== userId) return false;
  const seen = Number(seenAt);
  if (!Number.isFinite(seen) || seen > now + 60_000) return false;
  if (now - seen >= ADMIN_IDLE_MS) return false;
  const expected = Buffer.from(sign(`${cookieUserId}.${seenAt}`, serviceKey));
  const received = Buffer.from(signature);
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}

// No maxAge or expires: gone when the browser closes.
export const adminSessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
