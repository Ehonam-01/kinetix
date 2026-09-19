import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { accountDeletionRequests } from "@/db/schema/account-deletion-requests";
import { profiles } from "@/db/schema/profiles";
import { logAdminAction } from "@/services/admin/audit-log";
import { MAX_OTP_ATTEMPTS, verifyOtpCode } from "@/services/wallet/otp";
import { lockAuthAccount } from "./lock-auth-account";

// Mirrors confirmWithdrawal's two-phase shape (OTP validated outside any
// transaction so a wrong code's attempt-count penalty survives even though
// the call throws; the actual mutation is one WHERE-guarded transaction).
// Anonymizes profiles in place instead of deleting the row — see
// db/schema/profiles.ts's DELETED comment for why: binary_nodes,
// sponsorships, commission_events and financial_transactions referencing
// this id must stay valid for every other member's genealogy/ledger
// history. Locking the Supabase auth account (lockAuthAccount) happens
// AFTER this commits, deliberately outside the transaction — external I/O,
// same reasoning as approveWithdrawal's Bictorys payout call — and is
// best-effort: its failure is reported back, never rolled back into the
// anonymization that already succeeded.
export async function confirmAccountDeletion(
  requesterUserId: string,
  requestId: string,
  code: string,
) {
  const request = await db.query.accountDeletionRequests.findFirst({
    where: eq(accountDeletionRequests.id, requestId),
  });
  if (!request || request.requestedByUserId !== requesterUserId) {
    throw new Error("Demande de suppression introuvable.");
  }
  if (request.status !== "PENDING_OTP") {
    throw new Error("Cette demande a déjà été traitée ou a expiré.");
  }
  if (request.otpExpiresAt.getTime() < Date.now()) {
    await db
      .update(accountDeletionRequests)
      .set({ status: "EXPIRED" })
      .where(eq(accountDeletionRequests.id, request.id));
    throw new Error("Le code a expiré, veuillez recommencer.");
  }
  if (request.otpAttempts >= MAX_OTP_ATTEMPTS) {
    await db
      .update(accountDeletionRequests)
      .set({ status: "EXPIRED" })
      .where(eq(accountDeletionRequests.id, request.id));
    throw new Error("Trop de tentatives, veuillez recommencer.");
  }

  if (!verifyOtpCode(code, request.otpCodeHash)) {
    await db
      .update(accountDeletionRequests)
      .set({ otpAttempts: sql`${accountDeletionRequests.otpAttempts} + 1` })
      .where(eq(accountDeletionRequests.id, request.id));
    throw new Error("Code incorrect.");
  }

  // Full id, not a slice: username is unique-constrained and this must
  // never collide, even astronomically unlikely doesn't clear the bar for
  // an irreversible write.
  const anonymizedUsername = `compte_supprime_${request.targetUserId}`;

  const anonymized = await db.transaction(async (tx) => {
    const [locked] = await tx
      .update(accountDeletionRequests)
      .set({ status: "CONFIRMED", confirmedAt: sql`now()` })
      .where(
        and(
          eq(accountDeletionRequests.id, request.id),
          eq(accountDeletionRequests.status, "PENDING_OTP"),
        ),
      )
      .returning();
    if (!locked) {
      throw new Error("Cette demande a déjà été traitée.");
    }

    const [updated] = await tx
      .update(profiles)
      .set({
        fullName: "Compte supprimé",
        username: anonymizedUsername,
        phone: null,
        country: null,
        bio: null,
        goal: null,
        skills: null,
        status: "DELETED",
        deletedAt: sql`now()`,
        deletedBy: requesterUserId,
      })
      .where(eq(profiles.id, request.targetUserId))
      .returning();
    if (!updated) {
      throw new Error("Membre introuvable.");
    }

    await logAdminAction(tx, {
      actorUserId: requesterUserId,
      action: "ACCOUNT_DELETED",
      targetType: "profile",
      targetId: request.targetUserId,
      metadata: { selfService: requesterUserId === request.targetUserId },
    });

    return updated;
  });

  const lockResult = await lockAuthAccount(request.targetUserId);

  return { profile: anonymized, authLocked: lockResult.ok };
}
