import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hardenSessionCookie } from "@/lib/supabase/cookie-options";

// businessplan.<domain> serves the ambassador sales page
// (app/businessplan) at its root — the same page as <domain>/businessplan.
// Only the root is rewritten: its links point at the main site.
function businessPlanRewrite(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("businessplan.") && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/businessplan";
    return NextResponse.rewrite(url);
  }
  return null;
}

export async function proxy(request: NextRequest) {
  const rewrite = businessPlanRewrite(request);
  if (rewrite) return rewrite;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase isn't provisioned yet in every environment (e.g. before Phase 2's
  // auth setup). The proxy runs on every request, so it must not hard-crash
  // the app for routes that don't need a session — unlike lib/supabase/*,
  // which fail fast on purpose once actually called.
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, hardenSessionCookie(options)),
        );
      },
    },
  });

  // Refreshes the session cookie when the access token has expired.
  // getClaims (Supabase's current recommendation for middleware) validates
  // the token locally when the project signs with asymmetric keys, and
  // falls back to the same getUser round trip otherwise — never weaker,
  // often one network call fewer on every request. Pages and actions still
  // validate the user with Supabase themselves (services/auth/session.ts).
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    // Static files, the PWA manifest, service worker and offline page need
    // no session refresh (one Supabase call saved per request).
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
