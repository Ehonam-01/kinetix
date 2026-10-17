import { cookies } from "next/headers";
import { isIpRateLimited } from "@/lib/rate-limit";
import {
  MARKETING_COOKIE_MAX_AGE,
  MARKETING_COOKIE_NAME,
  recordMarketingVisit,
} from "@/services/marketing/campaign-tracking";

// Sent by components/marketing/campaign-tracker.tsx when a page is opened
// from a campaign link (utm_*) or from another site. Public, so capped per
// IP and with a small body; nothing is returned.
const MAX_BODY_BYTES = 2048;

export async function POST(request: Request) {
  if (await isIpRateLimited("marketingVisit")) {
    return new Response(null, { status: 429 });
  }
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });

  let input: Record<string, unknown>;
  try {
    input = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }

  const cookieStore = await cookies();
  const cookieValue = await recordMarketingVisit(
    input,
    new URL(request.url).host,
    cookieStore.get(MARKETING_COOKIE_NAME)?.value,
  );
  if (cookieValue) {
    cookieStore.set(MARKETING_COOKIE_NAME, cookieValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MARKETING_COOKIE_MAX_AGE,
    });
  }
  return new Response(null, { status: 204 });
}
