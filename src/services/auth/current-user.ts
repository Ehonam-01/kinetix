import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionStatus } from "@/repositories/subscriptions";
import { getAdminMfaState } from "./admin-mfa";
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

export const DEACTIVATED_ACCOUNT_MESSAGE =
  "Votre compte est désactivé. Contactez le support pour le réactiver.";

// Past the grace period after a lapsed subscription (repositories/
// subscriptions.ts's GRACE_PERIOD_DAYS): the account is deactivated and
// nothing on the platform is allowed anymore — self-service payment
// included — until an admin grants a new subscription. Admins are exempt,
// same convention as every other gate.
export async function isAccountDeactivated(profile: {
  id: string;
  role: string;
}): Promise<boolean> {
  if (profile.role === "ADMIN") return false;
  return (await getSubscriptionStatus(db, profile.id)).frozen;
}

// For every member action (transfers, withdrawals, ambassador/mentor
// programs, rewards, courses, profile edits): an ACTIVE account whose
// subscription is still paid or within its grace period. dashboard/
// layout.tsx's blocked screen is only what the member sees — a layout
// doesn't stop Server Actions from being called directly (security audit
// M2), so the rule is enforced here, on the server, for each action.
// Deliberately NOT used for password change, account deletion or logout:
// a deactivated member keeps control over their own account's security
// and personal data.
export async function requireActiveMember() {
  const current = await requireUser();
  if (current.profile.role === "ADMIN") return current;
  if (current.profile.status !== "ACTIVE") redirect("/dashboard");
  if (await isAccountDeactivated(current.profile)) redirect("/dashboard");
  return current;
}

// Every admin page and admin action goes through here: role check, then the
// second factor (services/auth/admin-mfa.ts) — an admin session that hasn't
// entered its TOTP code is sent to /mfa, whatever it was trying to reach.
export async function requireAdmin() {
  const current = await requireUser();
  if (current.profile.role !== "ADMIN") redirect("/dashboard");
  const mfa = await getAdminMfaState();
  if (mfa.status !== "verified") redirect("/mfa");
  return current;
}
