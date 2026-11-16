import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";

// Where an admin session goes once it has ended (an hour without activity
// or the browser closed, lib/admin-session.ts): signed out here, where
// cookies can be written, then back to the login page. "local": only this
// browser's session; the admin's other devices keep theirs.
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  const response = NextResponse.redirect(
    new URL("/login?error=session_expired", request.url),
  );
  response.cookies.delete(ADMIN_SESSION_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
