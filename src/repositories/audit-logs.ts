import "server-only";
import { desc, inArray } from "drizzle-orm";
import type { Executor } from "@/db/executor";
import { auditLogs } from "@/db/schema/audit-logs";
import { profiles } from "@/db/schema/profiles";

export async function listAuditLogs(executor: Executor, limit = 100) {
  const rows = await executor.query.auditLogs.findMany({
    orderBy: desc(auditLogs.createdAt),
    limit,
  });
  if (rows.length === 0) return [];

  const actorIds = [
    ...new Set(rows.map((r) => r.actorUserId).filter((id) => id !== null)),
  ];
  const actors = actorIds.length
    ? await executor.query.profiles.findMany({
        where: inArray(profiles.id, actorIds),
      })
    : [];
  const nameById = new Map(actors.map((a) => [a.id, a.fullName]));

  return rows.map((row) => ({
    ...row,
    actorName: row.actorUserId
      ? (nameById.get(row.actorUserId) ?? "Admin")
      : "Système",
  }));
}
