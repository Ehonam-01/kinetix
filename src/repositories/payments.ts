import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { payments } from "@/db/schema/payments";
import { profiles } from "@/db/schema/profiles";

export function findPaymentById(executor: Executor, id: string) {
  return executor.query.payments.findFirst({ where: eq(payments.id, id) });
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
