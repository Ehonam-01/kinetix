import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accountDeletionRequests } from "@/db/schema/account-deletion-requests";
import { profiles } from "@/db/schema/profiles";
import { findAuthEmailByUserId } from "@/repositories/auth-users";
import { findProfileById } from "@/repositories/profiles";
import { resendEmailProvider } from "@/services/notifications/resend-email";
import {
  generateOtpCode,
  hashOtpCode,
  OTP_TTL_MINUTES,
} from "@/services/wallet/otp";

// Self-service (requestedByUserId === targetUserId, dashboard/settings) and
// admin-triggered (admin/members/[userId], any other requestedByUserId)
// deletion share this one entry point. The OTP always goes to
// requestedByUserId's own email: it proves it's really them acting (a
// hijacked session or a stray click can't complete this without also
// controlling that inbox) — it is not asking the target for consent, which
// an admin's existing authority to suspend/manage a member's account
// already covers.
export async function requestAccountDeletion(
  requestedByUserId: string,
  targetUserId: string,
) {
  const requester = await findProfileById(requestedByUserId);
  if (!requester) {
    throw new Error("Profil introuvable.");
  }
  if (requestedByUserId !== targetUserId && requester.role !== "ADMIN") {
    throw new Error(
      "Seul un administrateur peut supprimer le compte d'un autre membre.",
    );
  }

  const target = await findProfileById(targetUserId);
  if (!target) {
    throw new Error("Membre introuvable.");
  }
  if (target.status === "DELETED") {
    throw new Error("Ce compte est déjà supprimé.");
  }

  // Never leave the platform without a single administrator — irreversible,
  // so checked before any OTP is even sent.
  if (target.role === "ADMIN") {
    const admins = await db.query.profiles.findMany({
      where: eq(profiles.role, "ADMIN"),
    });
    const stillStanding = admins.filter(
      (a) => a.id !== targetUserId && a.status !== "DELETED",
    );
    if (stillStanding.length === 0) {
      throw new Error(
        "Impossible de supprimer le dernier compte administrateur restant.",
      );
    }
  }

  const requesterEmail = await findAuthEmailByUserId(db, requestedByUserId);
  if (!requesterEmail) {
    throw new Error("Impossible de retrouver votre adresse email.");
  }

  // Same "expire the previous pending row" pattern as requestWithdrawal —
  // only one live request per target at a time.
  await db
    .update(accountDeletionRequests)
    .set({ status: "EXPIRED" })
    .where(
      and(
        eq(accountDeletionRequests.targetUserId, targetUserId),
        eq(accountDeletionRequests.status, "PENDING_OTP"),
      ),
    );

  const code = generateOtpCode();
  const otpExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  const [request] = await db
    .insert(accountDeletionRequests)
    .values({
      targetUserId,
      requestedByUserId,
      otpCodeHash: hashOtpCode(code),
      otpExpiresAt,
    })
    .returning();

  const isSelfService = requestedByUserId === targetUserId;
  await resendEmailProvider.sendEmail({
    to: requesterEmail,
    subject: "Code de confirmation — suppression de compte",
    html: `
      <p>${
        isSelfService
          ? "Vous avez demandé la suppression définitive de votre compte."
          : `Vous avez demandé la suppression définitive du compte de <strong>${target.fullName}</strong> (@${target.username}).`
      }</p>
      <p>Cette action est irréversible : les informations personnelles seront anonymisées et la connexion définitivement bloquée.</p>
      <p>Code de confirmation : <strong style="font-size:1.5em">${code}</strong></p>
      <p>Ce code expire dans ${OTP_TTL_MINUTES} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
    `,
  });

  return request;
}
