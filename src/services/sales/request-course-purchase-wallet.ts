import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { courses } from "@/db/schema/courses";
import { coursePurchaseWalletRequests } from "@/db/schema/course-purchase-wallet-requests";
import { sales } from "@/db/schema/sales";
import { getBalance } from "@/repositories/financial-transactions";
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

// Mirrors services/wallet/initiate-transfer.ts closely — the wallet being
// charged can be anyone's, named by pseudo, exactly like a transfer's
// recipient (no sponsor/downline restriction, unlike the older
// payRegistrationFromWallet). The OTP goes to the WALLET OWNER's email, not
// the buyer's — the person whose balance is at stake is the one who must
// authorize spending it, even when that happens to be the buyer themselves.
export async function requestCoursePurchaseWithWallet(input: {
  buyerUserId: string;
  courseId: string;
  walletUsername: string;
  visitorToken?: string;
}) {
  const course = await db.query.courses.findFirst({
    where: eq(courses.id, input.courseId),
  });
  if (!course) {
    throw new Error("Formation introuvable.");
  }
  if (course.price == null) {
    throw new Error("Cette formation n'est pas encore disponible à l'achat.");
  }

  const existingSale = await db.query.sales.findFirst({
    where: and(
      eq(sales.buyerUserId, input.buyerUserId),
      eq(sales.courseId, input.courseId),
      eq(sales.status, "CONFIRMED"),
    ),
  });
  if (existingSale) {
    throw new Error("Vous avez déjà accès à cette formation.");
  }

  const buyer = await findProfileById(input.buyerUserId);
  if (!buyer || buyer.status !== "ACTIVE") {
    throw new Error("Votre compte doit être actif pour acheter une formation.");
  }

  const wallet = await findProfileByUsername(input.walletUsername);
  if (!wallet) {
    throw new Error("Aucun membre ne correspond à ce pseudo.");
  }
  if (wallet.status !== "ACTIVE") {
    throw new Error("Ce membre ne peut pas payer pour le moment.");
  }

  const balance = await getBalance(db, wallet.id);
  if (balance.availableBalance < course.price) {
    throw new Error("Solde disponible insuffisant sur ce wallet.");
  }

  const walletEmail = await findAuthEmailByUserId(db, wallet.id);
  if (!walletEmail) {
    throw new Error("Impossible de retrouver l'adresse email de ce membre.");
  }

  // Captured now, while a request context (cookies) still exists — the
  // same reasoning as initiateCoursePurchase, since confirmation later runs
  // with no browser context at all.
  const attribution = await resolveAttribution(input.visitorToken);

  await db
    .update(coursePurchaseWalletRequests)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(coursePurchaseWalletRequests.buyerUserId, input.buyerUserId),
        eq(coursePurchaseWalletRequests.courseId, input.courseId),
        eq(coursePurchaseWalletRequests.status, "PENDING_OTP"),
      ),
    );

  const code = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  const [request] = await db
    .insert(coursePurchaseWalletRequests)
    .values({
      buyerUserId: input.buyerUserId,
      courseId: input.courseId,
      walletUserId: wallet.id,
      amount: course.price,
      ambassadorUserId: attribution?.ambassadorUserId ?? null,
      attributionId: attribution?.attributionId ?? null,
      otpCodeHash: hashOtpCode(code),
      otpExpiresAt,
    })
    .returning();

  const isSelf = wallet.id === input.buyerUserId;
  await resendEmailProvider.sendEmail({
    to: walletEmail,
    subject: "Code de confirmation d'achat de formation",
    html: `
      <p>${
        isSelf
          ? "Vous avez demandé"
          : `<strong>${buyer.username}</strong> a demandé`
      } à payer la formation <strong>${course.title}</strong> (${course.price.toLocaleString("fr-FR")} F) depuis votre solde.</p>
      <p>Code de confirmation : <strong style="font-size:1.5em">${code}</strong></p>
      <p>Ce code expire dans ${OTP_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — aucun montant ne sera débité.</p>
    `,
  });

  return request;
}
