import "server-only";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { subscriptionWalletRequests } from "@/db/schema/subscription-wallet-requests";
import { getBalance } from "@/repositories/financial-transactions";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import {
  findProfileById,
  findProfileByUsername,
} from "@/repositories/profiles";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import { resolveSaleAttribution } from "@/services/attribution/resolve-referral";
import {
  generateOtpCode,
  hashOtpCode,
  OTP_TTL_MINUTES,
} from "@/services/wallet/otp";
import { resendEmailProvider } from "@/services/notifications/resend-email";
import { escapeHtml } from "@/lib/escape-html";

const MAX_REQUESTS_PER_WALLET_PER_HOUR = 3;
const THIRD_PARTY_OTP_TTL_MINUTES = 30;

// The subscription's pendant of request-course-purchase-wallet.ts (retired
// by this pivot) — the wallet being charged can be anyone's, named by
// pseudo, exactly like a transfer's recipient. The OTP goes to the WALLET
// OWNER's email, not the buyer's — the person whose balance is at stake is
// the one who must authorize spending it, even when that happens to be the
// buyer themselves.
//
// The buyer's own status is deliberately never checked, same reasoning as
// the Mobile Money path (initiate-subscription-payment.ts): payment is now
// mandatory before dashboard access at all (dashboard/layout.tsx), so this
// is how a brand new PENDING_PAYMENT account gets its very first paid
// access too — requiring ACTIVE already would make that impossible. What
// does have to be ACTIVE is the WALLET being charged (below): a wallet
// balance only exists for an already-active account, whether or not that
// happens to be the buyer's own.
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
  if (!buyer) {
    throw new Error("Profil introuvable.");
  }

  const wallet = await findProfileByUsername(input.walletUsername);
  if (!wallet) {
    throw new Error("Aucun membre ne correspond à ce pseudo.");
  }
  if (wallet.status !== "ACTIVE") {
    throw new Error("Ce membre ne peut pas payer pour le moment.");
  }

  // Caps how often any one wallet can be targeted — each request emails its
  // owner a fresh code, so without this a member could flood someone
  // else's inbox (security audit H3).
  const recentRequests = await db.$count(
    subscriptionWalletRequests,
    and(
      eq(subscriptionWalletRequests.walletUserId, wallet.id),
      gt(subscriptionWalletRequests.createdAt, sql`now() - interval '1 hour'`),
    ),
  );
  if (recentRequests >= MAX_REQUESTS_PER_WALLET_PER_HOUR) {
    throw new Error(
      "Trop de demandes de paiement vers ce wallet. Réessayez dans une heure.",
    );
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
  const attribution = await resolveSaleAttribution(
    input.buyerUserId,
    input.visitorToken,
  );

  await db
    .update(subscriptionWalletRequests)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(subscriptionWalletRequests.buyerUserId, input.buyerUserId),
        eq(subscriptionWalletRequests.status, "PENDING_OTP"),
      ),
    );

  // Someone else's wallet: its owner has to log in to confirm (only they
  // can enter the code, see confirm-subscription-wallet.ts), which takes
  // longer than the usual 5 minutes — safe to allow since the buyer can no
  // longer attempt the code at all.
  const isSelf = wallet.id === input.buyerUserId;
  const ttlMinutes = isSelf ? OTP_TTL_MINUTES : THIRD_PARTY_OTP_TTL_MINUTES;
  const code = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + ttlMinutes * 60_000);

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

  await resendEmailProvider.sendEmail({
    to: walletEmail,
    subject: "Code de confirmation d'abonnement",
    html: isSelf
      ? `
      <p>Vous avez demandé à payer l'abonnement annuel Kinetix Africa (${amount.toLocaleString("fr-FR")} F) depuis votre solde.</p>
      <p>Code de confirmation : <strong style="font-size:1.5em">${code}</strong></p>
      <p>Ce code expire dans ${ttlMinutes} minutes. Ne le communiquez à personne. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — aucun montant ne sera débité.</p>
    `
      : `
      <p><strong>${escapeHtml(buyer.username)}</strong> vous demande de payer son abonnement annuel Kinetix Africa (${amount.toLocaleString("fr-FR")} F) depuis votre solde.</p>
      <p>Pour accepter, connectez-vous à votre espace membre, page « Transférer », et saisissez ce code dans la demande en attente :</p>
      <p>Code de confirmation : <strong style="font-size:1.5em">${code}</strong></p>
      <p><strong>Ne communiquez jamais ce code, y compris à ${escapeHtml(buyer.username)}.</strong> Il expire dans ${ttlMinutes} minutes. Si vous ne souhaitez pas payer, ignorez simplement cet email — aucun montant ne sera débité.</p>
    `,
  });

  return request;
}
