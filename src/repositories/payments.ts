import "server-only";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { payments, type paymentPurposeEnum } from "@/db/schema/payments";
import { profiles } from "@/db/schema/profiles";

export function findPaymentById(executor: Executor, id: string) {
  return executor.query.payments.findFirst({ where: eq(payments.id, id) });
}

// Picks up a hosted-checkout payment (Moneroo, or PayDunya/Bictorys with no
// operator recognized) right where the member left it: after redirecting to
// the provider's own page, the return trip lands back on
// dashboard/subscription with no paymentId in the URL to poll — this is how
// that page finds it anyway. Bounded to the last 20 minutes (a generous
// checkout-session lifetime) so a payment abandoned days ago never resurrects
// a "confirmation en cours" banner for someone just visiting the page.
export function findRecentPendingPayment(
  executor: Executor,
  beneficiaryUserId: string,
  purpose: (typeof paymentPurposeEnum.enumValues)[number],
) {
  const cutoff = new Date(Date.now() - 20 * 60 * 1000);
  return executor.query.payments.findFirst({
    where: and(
      eq(payments.beneficiaryUserId, beneficiaryUserId),
      eq(payments.purpose, purpose),
      eq(payments.status, "PENDING"),
      gte(payments.createdAt, cutoff),
    ),
    orderBy: desc(payments.createdAt),
  });
}

export function findPaymentByProviderReference(
  executor: Executor,
  providerReference: string,
) {
  return executor.query.payments.findFirst({
    where: eq(payments.providerReference, providerReference),
  });
}

export async function listPayments(executor: Executor, limit = 100) {
  const rows = await executor.query.payments.findMany({
    orderBy: desc(payments.createdAt),
    limit,
  });
  if (rows.length === 0) return [];

  const userIds = [
    ...new Set(
      rows
        .flatMap((r) => [
          r.beneficiaryUserId,
          r.payerUserId,
          r.grantedByAdminId,
        ])
        .filter((id) => id !== null),
    ),
  ];
  const relatedProfiles = userIds.length
    ? await executor.query.profiles.findMany({
        where: inArray(profiles.id, userIds),
      })
    : [];
  const nameById = new Map(relatedProfiles.map((p) => [p.id, p.fullName]));

  return rows.map((row) => ({
    ...row,
    beneficiaryName: nameById.get(row.beneficiaryUserId) ?? "Membre",
    payerName: row.payerUserId
      ? (nameById.get(row.payerUserId) ?? "Membre")
      : null,
    grantedByName: row.grantedByAdminId
      ? (nameById.get(row.grantedByAdminId) ?? "Admin")
      : null,
  }));
}
