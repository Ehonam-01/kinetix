import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "./ensure-profile";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const profile = await ensureProfile(user);
  if (!profile) return null;

  return { authUser: user, profile };
}

export async function requireUser() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  return current;
}

export async function requireAdmin() {
  const current = await requireUser();
  if (current.profile.role !== "ADMIN") redirect("/dashboard");
  return current;
}
