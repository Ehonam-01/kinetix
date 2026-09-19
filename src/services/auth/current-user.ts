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
  // Defense in depth on top of the Supabase-side lockout
  // (services/account/lock-auth-account.ts's ban_duration + password
  // reset): an access token issued just before deletion can still be valid
  // for up to its natural ~1h lifetime even once banned, and this reads
  // profiles fresh on every call regardless of token state — every caller
  // of requireUser/requireAdmin (every dashboard/admin layout, every
  // server action) is covered from this one place, so a deleted account
  // can never act as though it still exists in that window.
  if (current.profile.status === "DELETED") redirect("/login");
  return current;
}

export async function requireAdmin() {
  const current = await requireUser();
  if (current.profile.role !== "ADMIN") redirect("/dashboard");
  return current;
}
