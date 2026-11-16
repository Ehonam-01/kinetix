import "server-only";
import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/lib/admin-session";
import { createClient } from "@/lib/supabase/server";

export async function logoutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ADMIN_SESSION_COOKIE);
}
