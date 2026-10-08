import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db/client";
import { profiles } from "@/db/schema/profiles";
import { GOAL_COOKIE_NAME, isGoalValue } from "@/config/goals";
import { getCurrentUser } from "@/services/auth/current-user";

// Where the homepage's "Que veux-tu accomplir ?" cards lead
// (app/_components/goal-section.tsx). Becoming a member comes first:
//  - a visitor without an account is sent to sign-up, the goal kept in a
//    cookie (saved on the profile at sign-up, or picked up at sign-in);
//  - a signed-in member gets the goal saved on their profile and lands on
//    the mentors page — or straight on the orientation questionnaire for
//    "Je ne sais pas encore". The dashboard itself still requires a paid
//    subscription (dashboard/layout.tsx).
// Linked with a plain <a>, never next/link: this GET writes, so it must not
// be prefetched.
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("objectif");
  const goal = isGoalValue(raw) ? raw : null;
  const current = await getCurrentUser();

  if (!current || current.profile.status === "DELETED") {
    const response = NextResponse.redirect(new URL("/register", request.url));
    if (goal) {
      response.cookies.set(GOAL_COOKIE_NAME, goal, {
        maxAge: 60 * 60 * 24 * 30,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
    return response;
  }

  if (goal) {
    await db
      .update(profiles)
      .set({ goal })
      .where(eq(profiles.id, current.profile.id));
  }
  const destination =
    goal === "incertain"
      ? "/dashboard/mentors/orientation"
      : "/dashboard/mentors";
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.delete(GOAL_COOKIE_NAME);
  return response;
}
