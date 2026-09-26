import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
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
  // Attempt consumed atomically before comparing the code — see
  // confirmTransfer (security audit H2).
  const [request] = await db
    .update(accountDeletionRequests)
    .set({ otpAttempts: sql`${accountDeletionRequests.otpAttempts} + 1` })
    .where(
      and(
        eq(accountDeletionRequests.id, requestId),
        eq(accountDeletionRequests.requestedByUserId, requesterUserId),
        eq(accountDeletionRequests.status, "PENDING_OTP"),
        lt(accountDeletionRequests.otpAttempts, MAX_OTP_ATTEMPTS),
        gt(accountDeletionRequests.otpExpiresAt, sql`now()`),
      ),
    )
    .returning();

  if (!request) {
    const existing = await db.query.accountDeletionRequests.findFirst({
      where: eq(accountDeletionRequests.id, requestId),
    });
    if (!existing || existing.requestedByUserId !== requesterUserId) {
      throw new Error("Demande de suppression introuvable.");
    }
    if (existing.status !== "PENDING_OTP") {
      throw new Error("Cette demande a déjà été traitée ou a expiré.");
    }
    await db
      .update(accountDeletionRequests)
      .set({ status: "EXPIRED" })
      .where(
        and(
          eq(accountDeletionRequests.id, existing.id),
          eq(accountDeletionRequests.status, "PENDING_OTP"),
        ),
      );
    throw new Error(
      existing.otpAttempts >= MAX_OTP_ATTEMPTS
        ? "Trop de tentatives, veuillez recommencer."
        : "Le code a expiré, veuillez recommencer.",
    );
  }

  if (!verifyOtpCode(code, request.otpCodeHash)) {
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
