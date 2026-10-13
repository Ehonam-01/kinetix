import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { alertAdmins } from "@/services/notifications/admin-alerts";

// Per-identifier request limits (security audit H6), backed by Upstash
// Redis so they hold across Vercel's serverless instances — an in-memory
// counter would reset on every cold start and differ per instance.
//
// Missing UPSTASH_* env vars or Redis being slow/down: in production, the
// few kinds in FAIL_CLOSED_KINDS below are refused and the admins alerted;
// everything else (sign-in, payments) goes through, so a Redis outage never
// locks every member out. Outside production (dev, tests), everything goes
// through. The limits are an abuse brake layered on top of the real
// protections (5-attempt OTP cap, Supabase's own auth limits), not the only
// thing standing in the way.
const LIMITS = {
  // Per IP — brute force/credential stuffing across many emails.
  loginByIp: { tokens: 20, window: "15 m" },
  // Per email — brute force on one account from many IPs.
  loginByEmail: { tokens: 5, window: "15 m" },
  signupByIp: { tokens: 5, window: "1 h" },
  passwordResetByIp: { tokens: 5, window: "1 h" },
  passwordResetByEmail: { tokens: 3, window: "1 h" },
  // Settings-page password change re-authenticates with the current
  // password — without a cap it'd be an oracle to brute-force it.
  passwordChange: { tokens: 5, window: "15 m" },
  // Anything that emails a code (transfer, withdrawal, wallet payment,
  // account deletion, admin recharge) — caps email flooding and Resend cost.
  otpRequest: { tokens: 5, window: "1 h" },
  // Anything that checks a code — on top of the 5-attempt cap per request.
  otpConfirm: { tokens: 10, window: "15 m" },
  // Starting a mobile money payment pushes a USSD/SMS prompt to a phone.
  paymentStart: { tokens: 5, window: "15 m" },
  // Pseudo -> name previews (registration sponsor, transfer recipient).
  lookup: { tokens: 30, window: "1 m" },
  referralClick: { tokens: 30, window: "1 m" },
  // Questions and answers under lessons, per member.
  lessonPost: { tokens: 5, window: "1 m" },
  // Browsers reporting CSP violations (app/api/csp-report), per IP.
  cspReport: { tokens: 20, window: "1 m" },
  // Support tickets and replies, per member.
  supportMessage: { tokens: 10, window: "15 m" },
} as const satisfies Record<
  string,
  { tokens: number; window: `${number} ${"s" | "m" | "h"}` }
>;

export type RateLimitKind = keyof typeof LIMITS;

// When rate limiting itself is unavailable in production (Upstash missing
// or not answering): these are refused rather than let through unchecked
// (security audit SEC-05) — each one emails someone (a code that moves
// money, a password reset link) or changes a password. Everything else,
// sign-in included, keeps working: blocking every member out because Redis
// is down would be worse than a few minutes without limits. Either way the
// admins are alerted. otpConfirm stays open: wallet codes already cap
// attempts in the database, and it also guards the admin's own two-factor
// sign-in.
const FAIL_CLOSED_KINDS: ReadonlySet<RateLimitKind> = new Set([
  "otpRequest",
  "passwordResetByIp",
  "passwordResetByEmail",
  "passwordChange",
]);

function failsClosed(kind: RateLimitKind) {
  return (
    FAIL_CLOSED_KINDS.has(kind) &&
    process.env.NODE_ENV === "production" &&
    !process.env.VITEST
  );
}

function reportUnavailable(reason: string) {
  if (process.env.NODE_ENV !== "production" || process.env.VITEST) return;
  alertAdmins("rate-limit-unavailable", "Limitation de débit indisponible", [
    reason,
    "En attendant : codes OTP, liens de réinitialisation et changements de mot de passe sont refusés ; la connexion et le reste du site fonctionnent sans limite.",
    "Vérifiez Upstash et les variables UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN sur Vercel.",
  ]);
}

export const RATE_LIMIT_MESSAGE =
  "Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.";

let limiters: Map<RateLimitKind, Ratelimit> | null | undefined;

function getLimiters(): Map<RateLimitKind, Ratelimit> | null {
  if (limiters !== undefined) return limiters;
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    reportUnavailable(
      "UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN manquants.",
    );
    limiters = null;
    return limiters;
  }
  const redis = Redis.fromEnv();
  limiters = new Map(
    (Object.keys(LIMITS) as RateLimitKind[]).map((kind) => [
      kind,
      new Ratelimit({
        redis,
        prefix: `rl:${kind}`,
        limiter: Ratelimit.slidingWindow(
          LIMITS[kind].tokens,
          LIMITS[kind].window,
        ),
        // Redis not answering quickly: the call fails (see the catch in
        // isRateLimited) instead of waiting.
        timeout: 1500,
      }),
    ]),
  );
  return limiters;
}

// True when this identifier has used up its allowance for this kind of
// action. Identifiers are namespaced by the caller (e.g. `ip:…`,
// `email:…`, `user:…`) — the kind already scopes the counter.
export async function isRateLimited(
  kind: RateLimitKind,
  identifier: string,
): Promise<boolean> {
  const all = getLimiters();
  const limiter = all?.get(kind);
  if (!limiter) {
    if (all === null) reportUnavailable("Configuration Upstash absente.");
    return failsClosed(kind);
  }
  try {
    const { success, reason } = await limiter.limit(identifier);
    // Upstash's own timeout lets the call through with reason "timeout":
    // treated as unavailable, like an error.
    if (reason === "timeout") {
      reportUnavailable(`Upstash n'a pas répondu à temps (${kind}).`);
      return failsClosed(kind);
    }
    return !success;
  } catch (err) {
    console.error(`Rate limit ${kind} indisponible :`, err);
    reportUnavailable(`Erreur Upstash (${kind}) : ${(err as Error).message}`);
    return failsClosed(kind);
  }
}

// The client's IP as seen by the hosting edge. On Vercel, x-forwarded-for
// is set by the platform itself (a client-sent value is overwritten), so
// its first entry is trustworthy there; behind another proxy, check that it
// overwrites the header the same way before relying on this.
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function isIpRateLimited(kind: RateLimitKind): Promise<boolean> {
  return isRateLimited(kind, `ip:${await getClientIp()}`);
}
