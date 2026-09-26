import type { CookieOptions } from "@supabase/ssr";

// Supabase's session cookies are JavaScript-readable by default so that a
// browser-side Supabase client can use them — this app has none (every
// Supabase call goes through the server: lib/supabase/server.ts and
// src/proxy.ts), so they're forced HttpOnly: an XSS could otherwise read
// the session token straight out of document.cookie (security audit L6).
// Shared by both cookie writers so they can never disagree.
export function hardenSessionCookie(options: CookieOptions): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  };
}
