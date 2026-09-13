import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { walletTransfers } from "@/db/schema/wallet-transfers";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import { getBalance } from "@/repositories/financial-transactions";
import {
  findProfileById,
  findProfileByUsername,
} from "@/repositories/profiles";
import { resendEmailProvider } from "@/services/notifications/resend-email";
import { generateOtpCode, hashOtpCode, OTP_TTL_MINUTES } from "./otp";

// Any member can be paid by pseudo (explicit product decision — not
// restricted to sponsor/downline, unlike payRegistrationFromWallet). Each
// call always creates a fresh row rather than reusing a pending one, and
// expires whatever was still pending for this sender first, so a member
// can never end up with two live OTPs for two different attempts at once.
export async function initiateTransfer(
  senderId: string,
  recipientUsername: string,
  amount: number,
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Le montant doit être un nombre entier positif.");
  }

  const [sender, recipient] = await Promise.all([
    findProfileById(senderId),
    findProfileByUsername(recipientUsername),
  ]);

  if (!sender || sender.status !== "ACTIVE") {
    throw new Error("Votre compte doit être actif pour envoyer un transfert.");
  }
  if (!recipient) {
    throw new Error("Aucun membre ne correspond à ce pseudo.");
  }
  if (recipient.id === senderId) {
    throw new Error(
      "Vous ne pouvez pas vous transférer des fonds à vous-même.",
    );
  }
  if (recipient.status !== "ACTIVE") {
    throw new Error(
      "Ce membre ne peut pas recevoir de transfert pour le moment.",
    );
  }

  const balance = await getBalance(db, senderId);
  if (balance.availableBalance < amount) {
    throw new Error("Solde disponible insuffisant.");
  }

  const senderEmail = await findAuthEmailByUserId(db, senderId);
  if (!senderEmail) {
    throw new Error("Impossible de retrouver votre adresse email.");
  }

  await db
    .update(walletTransfers)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(walletTransfers.senderId, senderId),
        eq(walletTransfers.status, "PENDING_OTP"),
      ),
    );

  const code = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  const [transfer] = await db
    .insert(walletTransfers)
    .values({
      senderId,
      recipientId: recipient.id,
      amount,
      otpCodeHash: hashOtpCode(code),
      otpExpiresAt,
    })
    .returning();

  await resendEmailProvider.sendEmail({
    to: senderEmail,
    subject: "Code de confirmation de votre transfert",
    html: `
      <p>Vous avez demandé à transférer <strong>${amount.toLocaleString("fr-FR")} F</strong> à <strong>${recipient.username}</strong>.</p>
      <p>Code de confirmation : <strong style="font-size:1.5em">${code}</strong></p>
      <p>Ce code expire dans ${OTP_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `,
  });

  return transfer;
}
