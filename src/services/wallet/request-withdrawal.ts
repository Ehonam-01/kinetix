import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { withdrawalRequests } from "@/db/schema/withdrawals";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import { getBalance } from "@/repositories/financial-transactions";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { findProfileById } from "@/repositories/profiles";
import { resendEmailProvider } from "@/services/notifications/resend-email";
import { generateOtpCode, hashOtpCode, OTP_TTL_MINUTES } from "./otp";

// Digits only past an optional leading "+", 8 to 15 of them — loose enough
// for any mobile money number format used across the countries this
// platform targets, strict enough to reject obvious typos/garbage.
const PAYOUT_PHONE_PATTERN = /^\+?[0-9]{8,15}$/;

// Mirrors initiateTransfer (services/wallet/initiate-transfer.ts) almost
// exactly — same OTP-gated request pattern — except the destination is a
// mobile money number instead of another member, and the minimum amount is
// admin-configurable (parameter_versions key withdrawal.minimum_amount)
// rather than hardcoded.
export async function requestWithdrawal(
  userId: string,
  amount: number,
  payoutPhone: string,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Le montant doit être un nombre entier positif.");
  }
  const trimmedPhone = payoutPhone.trim();
  if (!PAYOUT_PHONE_PATTERN.test(trimmedPhone)) {
    throw new Error("Le numéro mobile money n'est pas valide.");
  }

  const user = await findProfileById(userId);
  if (!user || user.status !== "ACTIVE") {
    throw new Error("Votre compte doit être actif pour demander un retrait.");
  }

  const minimum = await getCurrentParameterValue(
    db,
    "withdrawal.minimum_amount",
  );
  if (amount < minimum) {
    throw new Error(
      `Le montant minimum de retrait est de ${minimum.toLocaleString("fr-FR")} F.`,
    );
  }

  const balance = await getBalance(db, userId);
  if (balance.availableBalance < amount) {
    throw new Error("Solde disponible insuffisant.");
  }

  const email = await findAuthEmailByUserId(db, userId);
  if (!email) {
    throw new Error("Impossible de retrouver votre adresse email.");
  }

  await db
    .update(withdrawalRequests)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(withdrawalRequests.userId, userId),
        eq(withdrawalRequests.status, "PENDING_OTP"),
      ),
    );

  const code = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  const [request] = await db
    .insert(withdrawalRequests)
    .values({
      userId,
      amount,
      payoutPhone: trimmedPhone,
      otpCodeHash: hashOtpCode(code),
      otpExpiresAt,
    })
    .returning();

  await resendEmailProvider.sendEmail({
    to: email,
    subject: "Code de confirmation de votre retrait",
    html: `
      <p>Vous avez demandé à retirer <strong>${amount.toLocaleString("fr-FR")} F</strong> vers le numéro <strong>${trimmedPhone}</strong>.</p>
      <p>Code de confirmation : <strong style="font-size:1.5em">${code}</strong></p>
      <p>Ce code expire dans ${OTP_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `,
  });

  return request;
}
