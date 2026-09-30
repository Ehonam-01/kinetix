import { db } from "@/db/client";
import { listAuditLogs } from "@/repositories/audit-logs";
import { AUDIT_ACTION_LABEL } from "../audit-action-labels";
import { requireAdmin } from "@/services/auth/current-user";

export default async function AdminAuditLogsPage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't
  // re-run on every navigation, so it can't be the only gate (Next.js
  // authentication guide, "Layouts and auth checks").
  await requireAdmin();
  const logs = await listAuditLogs(db);

  if (logs.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Aucune action enregistrée.
      </p>
    );
  }

  return (
    <div className="divide-y rounded-2xl border">
      {logs.map((log) => (
        <div key={log.id} className="px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">
              {AUDIT_ACTION_LABEL[log.action] ?? log.action}
            </span>
            <span className="text-muted-foreground text-xs">
              {log.createdAt.toLocaleString("fr-FR", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            Par {log.actorName}
            {log.targetType && ` · ${log.targetType}`}
            {log.targetId && ` (${log.targetId})`}
          </p>
        </div>
      ))}
    </div>
  );
}
