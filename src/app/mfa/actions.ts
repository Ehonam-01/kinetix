"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { getAdminMfaState } from "@/services/auth/admin-mfa";
import { requireUser } from "@/services/auth/current-user";

const codeSchema = z.string().trim().regex(/^\d{6}$/, "Code à 6 chiffres.");

// Deliberately requireUser + an explicit role check, not requireAdmin:
// requireAdmin is what sends a not-yet-verified admin here in the first
// place, so using it would loop.
async function requireAdminAccount() {
  const current = await requireUser();
  if (current.profile.role !== "ADMIN") redirect("/dashboard");
  return current;
}

export async function startMfaEnrollmentAction() {
  await requireAdminAccount();
  const state = await getAdminMfaState();
  if (state.status !== "needs-enrollment") {
    return { error: "La double authentification est déjà configurée.", enrollment: null };
  }

  const supabase = await createClient();
  // An enrollment started earlier and never confirmed (page closed before
  // scanning) would otherwise pile up — clear it before starting fresh.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Kinetix Africa admin ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) {
    console.error("Activation MFA impossible :", error);
    return {
      error: "Impossible de démarrer la configuration. Réessayez.",
      enrollment: null,
    };
  }
  return {
    error: null,
    enrollment: {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
    },
  };
}

async function verifyCode(factorId: string, rawCode: string) {
  const { profile } = await requireAdminAccount();
  if (await isRateLimited("otpConfirm", `user:${profile.id}`)) {
    return { error: RATE_LIMIT_MESSAGE };
  }
  const code = codeSchema.safeParse(rawCode);
  if (!code.success) return { error: "Saisissez le code à 6 chiffres." };

  const supabase = await createClient();
  // Supabase itself checks that the factor belongs to this user.
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.data,
  });
  if (error) return { error: "Code incorrect ou expiré." };
  redirect("/admin");
}

// First-time setup: confirms the factor just enrolled by scanning the QR code.
export async function confirmMfaEnrollmentAction(factorId: string, code: string) {
  return verifyCode(factorId, code);
}

// Every later admin sign-in: the factor id is looked up server-side, never
// taken from the browser.
export async function verifyMfaAction(code: string) {
  await requireAdminAccount();
  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const factor = data?.totp?.[0];
  if (!factor) return { error: "Aucune double authentification configurée." };
  return verifyCode(factor.id, code);
}
