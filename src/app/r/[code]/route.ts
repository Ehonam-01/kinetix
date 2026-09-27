import { NextResponse } from "next/server";
import { z } from "zod";
import { isIpRateLimited } from "@/lib/rate-limit";
import {
  recordReferralClick,
  REFERRAL_COOKIE_NAME,
} from "@/services/attribution/resolve-referral";

const courseIdSchema = z.string().uuid();
// Looser than usernameSchema on length on purpose: a referral code is the
// ambassador's pseudo, which can exceed 20 characters when
// insertProfileIfMissing (repositories/profiles.ts) suffixed it to resolve
// a signup collision.
const referralCodeSchema = z.string().regex(/^[a-z0-9_]{1,64}$/);

// A public referral link: https://.../r/{referralCode}, optionally
// ?course={courseId} to land on one specific formation. Records the click
// (referral_clicks) and sets an opaque tracking cookie read back later at
// purchase time (resolveAttribution) — never the ambassador's identity
// itself, just a token pointing at the click row. An unknown/inactive code
// still redirects (no dead link for a mistyped or since-suspended
// ambassador's pseudo), it just sets no cookie.
//
// Both parameters are validated before anything touches the database
// (security audit L3): a referral code is always a pseudo (join-program.ts),
// and a non-UUID ?course= used to 500 on the referral_clicks insert. An
// invalid course is dropped rather than rejecting the whole link.
export async function GET(
  request: Request,
  ctx: RouteContext<"/r/[code]">,
) {
  const { code } = await ctx.params;
  const { searchParams, origin } = new URL(request.url);

  // Each valid hit writes a referral_clicks row — capped per IP so the
  // table can't be flooded from a script. 30/min is far beyond what a
  // person clicking links ever does.
  if (await isIpRateLimited("referralClick")) {
    return new NextResponse("Trop de requêtes.", { status: 429 });
  }

  const parsedCode = referralCodeSchema.safeParse(code);
  if (!parsedCode.success) {
    return NextResponse.redirect(origin);
  }
  const parsedCourseId = courseIdSchema.safeParse(searchParams.get("course"));
  const courseId = parsedCourseId.success ? parsedCourseId.data : undefined;

  const click = await recordReferralClick({
    referralCode: parsedCode.data,
    courseId,
    landingPath: `/r/${parsedCode.data}`,
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
