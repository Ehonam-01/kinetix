import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import type { Executor } from "@/db/executor";
import { payments } from "@/db/schema/payments";
import { profiles } from "@/db/schema/profiles";
import { sponsorships } from "@/db/schema/sponsorships";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { createRootNode, placeMember } from "@/services/genealogy/place-member";
import { createCommissionEvent } from "@/services/mlm/commission";
import { unlockLevel } from "@/services/mlm/unlock-level";

// The section 5 flow, made atomic: payment confirmed -> account activated
// -> binary placement -> level 1 unlocked -> direct commission to the
// sponsor. All or nothing (single transaction). Idempotent: a payment
// already CONFIRMED is a no-op, so a redelivered webhook or a retried
// admin/wallet call never re-runs this (never treat a payment intent as a
// validated payment — section 5).
export async function activateRegistration(tx: Executor, paymentId: string) {
  const payment = await tx.query.payments.findFirst({
    where: eq(payments.id, paymentId),
  });
  if (!payment) {
    throw new Error(`Paiement introuvable : ${paymentId}`);
  }
  if (payment.status === "CONFIRMED") {
    return payment;
  }
  const memberId = payment.beneficiaryUserId;
  if (!memberId) {
    throw new Error(`Paiement d'inscription sans membre : ${paymentId}`);
  }

  await tx
    .update(payments)
    .set({ status: "CONFIRMED", confirmedAt: sql`now()` })
    .where(eq(payments.id, paymentId));

  await tx
    .update(profiles)
    .set({ status: "ACTIVE" })
    .where(eq(profiles.id, memberId));

  const sponsorship = await tx.query.sponsorships.findFirst({
    where: eq(sponsorships.userId, memberId),
  });

  if (sponsorship) {
    await placeMember(tx, memberId, sponsorship.sponsorId);
  } else {
    // No sponsor only ever happens for the platform's very first member —
    // createRootNode refuses a second call once a root exists.
    await createRootNode(tx, memberId);
  }

  await unlockLevel(tx, memberId, 1);

  if (sponsorship) {
    const rate = await getCurrentParameterValue(tx, "commission.direct");
    await createCommissionEvent(tx, {
      beneficiaryUserId: sponsorship.sponsorId,
      sourceUserId: memberId,
      type: "DIRECT",
      amount: rate,
      dedupeKey: `DIRECT:${sponsorship.sponsorId}:${memberId}`,
    });
  }

  return { ...payment, status: "CONFIRMED" as const };
}

export async function activateRegistrationInNewTransaction(paymentId: string) {
  return db.transaction((tx) => activateRegistration(tx, paymentId));
}
