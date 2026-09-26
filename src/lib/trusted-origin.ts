import "server-only";
import { headers } from "next/headers";
import { getSiteEnv } from "@/config/env.site";

// The origin to build absolute links from (auth email redirects, payment
// return/callback URLs) — never the request's Origin header as-is in
// production, where SITE_URL is the only trusted value (security audit L1).
// Local dev (localhost, a LAN IP) and Vercel preview deployments each run on
// their own host, so their request origin is used there instead: otherwise
// a signup made while testing locally would link back to production.
export async function getTrustedOrigin(): Promise<string> {
  const requestOrigin = (await headers()).get("origin");
  const isNonProduction =
    process.env.NODE_ENV !== "production" ||
    process.env.VERCEL_ENV === "preview";
  if (requestOrigin && isNonProduction) return requestOrigin;
  return new URL(getSiteEnv().SITE_URL).origin;
}
