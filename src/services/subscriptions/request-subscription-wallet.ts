import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { subscriptionWalletRequests } from "@/db/schema/subscription-wallet-requests";
import { getBalance } from "@/repositories/financial-transactions";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import {
  findProfileById,
  findProfileByUsername,
} from "@/repositories/profiles";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import { resolveAttribution } from "@/services/attribution/resolve-referral";
import {
  generateOtpCode,
  hashOtpCode,
  OTP_TTL_MINUTES,
} from "@/services/wallet/otp";
import { resendEmailProvider } from "@/services/notifications/resend-email";

// The subscription's pendant of request-course-purchase-wallet.ts (retired
// by this pivot) — the wallet being charged can be anyone's, named by
// pseudo, exactly like a transfer's recipient. The OTP goes to the WALLET
// OWNER's email, not the buyer's — the person whose balance is at stake is
// the one who must authorize spending it, even when that happens to be the
// buyer themselves.
//
// Unlike the Mobile Money path (initiate-subscription-payment.ts), the buyer
// must already be ACTIVE here — same reasoning as every other wallet-funded
// action (request-withdrawal.ts, initiate-transfer.ts): a wallet balance
// only exists for an already-active account, so this can never be a brand
// new member's very first paid access.
export async function requestSubscriptionWithWallet(input: {
  buyerUserId: string;
  walletUsername: string;
  visitorToken?: string;
}) {
  const amount = await getCurrentParameterValue(
    db,
    "subscription.price_in_cfa",
  );

  const buyer = await findProfileById(input.buyerUserId);
  if (!buyer || buyer.status !== "ACTIVE") {
    throw new Error("Votre compte doit être actif pour souscrire.");
  }

  const wallet = await findProfileByUsername(input.walletUsername);
  if (!wallet) {
    throw new Error("Aucun membre ne correspond à ce pseudo.");
  }
  if (wallet.status !== "ACTIVE") {
    throw new Error("Ce membre ne peut pas payer pour le moment.");
  }

  const balance = await getBalance(db, wallet.id);
  if (balance.availableBalance < amount) {
    throw new Error("Solde disponible insuffisant sur ce wallet.");
  }

  const walletEmail = await findAuthEmailByUserId(db, wallet.id);
  if (!walletEmail) {
    throw new Error("Impossible de retrouver l'adresse email de ce membre.");
  }

  // Captured now, while a request context (cookies) still exists — the
  // same reasoning as initiateSubscriptionPayment, since confirmation later
  // runs with no browser context at all.
  const attribution = await resolveAttribution(input.visitorToken);

  await db
    .update(subscriptionWalletRequests)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(subscriptionWalletRequests.buyerUserId, input.buyerUserId),
        eq(subscriptionWalletRequests.status, "PENDING_OTP"),
      ),
    );

  const code = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  const [request] = await db
    .insert(subscriptionWalletRequests)
    .values({
      buyerUserId: input.buyerUserId,
      walletUserId: wallet.id,
      amount,
      ambassadorUserId: attribution?.ambassadorUserId ?? null,
      attributionId: attribution?.attributionId ?? null,
      otpCodeHash: hashOtpCode(code),
      otpExpiresAt,
    })
    .returning();

  const isSelf = wallet.id === input.buyerUserId;
  await resendEmailProvider.sendEmail({
    to: walletEmail,
    subject: "Code de confirmation d'abonnement",
    html: `
      <p>${
        isSelf
          ? "Vous avez demandé"
          : `<strong>${buyer.username}</strong> a demandé`
      } à payer l'abonnement annuel Kinetix Africa (${amount.toLocaleString("fr-FR")} F) depuis votre solde.</p>
      <p>Code de confirmation : <strong style="font-size:1.5em">${code}</strong></p>
      <p>Ce code expire dans ${OTP_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — aucun montant ne sera débité.</p>
    `,
  });

  return request;
}
