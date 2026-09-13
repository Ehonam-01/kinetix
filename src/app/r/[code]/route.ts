import { NextResponse } from "next/server";
import {
  recordReferralClick,
  REFERRAL_COOKIE_NAME,
} from "@/services/attribution/resolve-referral";

// A public referral link: https://.../r/{referralCode}, optionally
// ?course={courseId} to land on one specific formation. Records the click
// (referral_clicks) and sets an opaque tracking cookie read back later at
// purchase time (resolveAttribution) — never the ambassador's identity
// itself, just a token pointing at the click row. An unknown/inactive code
// still redirects (no dead link for a mistyped or since-suspended
// ambassador's pseudo), it just sets no cookie.
export async function GET(
  request: Request,
  ctx: RouteContext<"/r/[code]">,
) {
  const { code } = await ctx.params;
  const { searchParams, origin } = new URL(request.url);
  const courseId = searchParams.get("course") ?? undefined;

  const click = await recordReferralClick({
    referralCode: code,
    courseId,
    landingPath: `/r/${code}`,
  });

  const destination = courseId
    ? `${origin}/dashboard/courses/${courseId}`
    : origin;
  const response = NextResponse.redirect(destination);

  if (click) {
    response.cookies.set(REFERRAL_COOKIE_NAME, click.visitorToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      // A generous ceiling on the cookie itself — the actual attribution
      // window is enforced by resolveAttribution reading
      // attribution.cookie_days at purchase time, not by cookie expiry.
      maxAge: 60 * 60 * 24 * 180,
      path: "/",
    });
  }

  return response;
}
