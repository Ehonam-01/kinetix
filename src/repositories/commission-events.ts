import "server-only";
import { desc, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { commissionEvents } from "@/db/schema/commission-events";
import { profiles } from "@/db/schema/profiles";

export async function listCommissionEvents(executor: Executor, limit = 100) {
  const rows = await executor.query.commissionEvents.findMany({
    orderBy: desc(commissionEvents.createdAt),
    limit,
  });
  if (rows.length === 0) return [];

  const userIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.beneficiaryUserId, r.sourceUserId])
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
    sourceName: row.sourceUserId
      ? (nameById.get(row.sourceUserId) ?? "Membre")
      : null,
  }));
}
