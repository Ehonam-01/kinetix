import "server-only";
import type { Executor } from "@/db/executor";
import { auditLogs } from "@/db/schema/audit-logs";

// Called from inside the same transaction as the admin action it records
// (Executor, not db directly) — a log entry can never exist without the
// action having actually committed, and never fails to be written if the
// action commits.
export async function logAdminAction(
  tx: Executor,
  entry: {
    actorUserId: string;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.insert(auditLogs).values(entry);
}
