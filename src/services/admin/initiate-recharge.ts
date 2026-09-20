import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { adminRechargeRequests } from "@/db/schema/admin-recharge-requests";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import {
  findActiveProfileByUsername,
  findProfileById,
} from "@/repositories/profiles";
import { resendEmailProvider } from "@/services/notifications/resend-email";
import { generateOtpCode, hashOtpCode, OTP_TTL_MINUTES } from "@/services/wallet/otp";

// Mirrors initiateTransfer's shape exactly (services/wallet/initiate-
// transfer.ts) — a member can be recharged by pseudo, one fresh request row
// per attempt, whatever was still pending for this admin is expired first.
export async function initiateAdminRecharge(
  adminUserId: string,
  beneficiaryUsername: string,
  amount: number,
  reason?: string,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Le montant doit être un nombre entier positif.");
  }

  const admin = await findProfileById(adminUserId);
  if (admin?.role !== "ADMIN") {
    throw new Error("Seul un administrateur peut recharger un compte.");
  }

  const beneficiary = await findActiveProfileByUsername(beneficiaryUsername);
  if (!beneficiary) {
    throw new Error("Aucun membre actif ne correspond à ce pseudo.");
  }

  const adminEmail = await findAuthEmailByUserId(db, adminUserId);
  if (!adminEmail) {
    throw new Error("Impossible de retrouver votre adresse email.");
  }

  await db
    .update(adminRechargeRequests)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(adminRechargeRequests.requestedByAdminId, adminUserId),
        eq(adminRechargeRequests.status, "PENDING_OTP"),
      ),
    );

  const code = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  const [request] = await db
    .insert(adminRechargeRequests)
    .values({
      beneficiaryUserId: beneficiary.id,
      requestedByAdminId: adminUserId,
      amount,
      reason: reason ?? null,
      otpCodeHash: hashOtpCode(code),
      otpExpiresAt,
    })
    .returning();

  await resendEmailProvider.sendEmail({
    to: adminEmail,
    subject: "Code de confirmation — recharge de compte",
    html: `
      <p>Vous avez demandé à créditer <strong>${amount.toLocaleString("fr-FR")} F</strong> sur le compte de <strong>${beneficiary.fullName}</strong> (@${beneficiary.username}).</p>
      <p>Code de confirmation : <strong style="font-size:1.5em">${code}</strong></p>
      <p>Ce code expire dans ${OTP_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `,
  });

  return request;
}
