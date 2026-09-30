import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

// Per-identifier request limits (security audit H6), backed by Upstash
// Redis so they hold across Vercel's serverless instances — an in-memory
// counter would reset on every cold start and differ per instance.
//
// Fails OPEN, deliberately: missing UPSTASH_* env vars (e.g. a preview
// deployment, the test suite) or Redis being slow/down never locks every
// member out of login and payments — the request goes through and the
// problem is logged. The limits are an abuse brake layered on top of the
// real protections (5-attempt OTP cap, Supabase's own auth limits), not
// the only thing standing in the way.
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
} as const satisfies Record<
  string,
  { tokens: number; window: `${number} ${"s" | "m" | "h"}` }
>;

export type RateLimitKind = keyof typeof LIMITS;

export const RATE_LIMIT_MESSAGE =
  "Trop de tentatives. Veuillez patienter quelques minutes avant de réessayer.";

let limiters: Map<RateLimitKind, Ratelimit> | null | undefined;

function getLimiters(): Map<RateLimitKind, Ratelimit> | null {
  if (limiters !== undefined) return limiters;
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    if (process.env.NODE_ENV === "production" && !process.env.VITEST) {
      console.error(
        "Rate limiting désactivé : UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN manquants.",
      );
    }
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
        // Let the request through if Redis doesn't answer quickly.
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
  const limiter = getLimiters()?.get(kind);
  if (!limiter) return false;
  try {
    const { success } = await limiter.limit(identifier);
    return !success;
  } catch (err) {
    console.error(`Rate limit ${kind} indisponible :`, err);
    return false;
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
