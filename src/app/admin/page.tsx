import { BookOpen, Clock, Gift, UserCheck } from "lucide-react";
import { db } from "@/db/client";
import { listMembers } from "@/repositories/admin-members";
import { listAllCoursesForAdmin } from "@/repositories/courses";
import { listAuditLogs } from "@/repositories/audit-logs";
import { listAllMemberRewards } from "@/repositories/member-rewards";
import { StatCard } from "@/components/stat-card";
import { AUDIT_ACTION_LABEL } from "./audit-action-labels";

export default async function AdminOverviewPage() {
  const [members, courses, rewards, recentActivity] = await Promise.all([
    listMembers(db),
    listAllCoursesForAdmin(db),
    listAllMemberRewards(db),
    listAuditLogs(db, 8),
  ]);

  const activeMembers = members.filter((m) => m.status === "ACTIVE").length;
  const pendingMembers = members.filter(
    (m) => m.status === "PENDING_PAYMENT",
  ).length;
  const rewardsToProcess = rewards.filter(
    (r) => r.status === "CLAIMED" || r.status === "PROCESSING",
  ).length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={UserCheck}
          label="Membres actifs"
          value={activeMembers}
          href="/admin/members"
          color="blue"
        />
        <StatCard
          icon={Clock}
          label="En attente de paiement"
          value={pendingMembers}
          href="/admin/members"
          color="amber"
        />
        <StatCard
          icon={BookOpen}
          label="Cours publiés"
          value={courses.length}
          href="/admin/courses"
          color="emerald"
        />
        <StatCard
          icon={Gift}
          label="Récompenses à traiter"
          value={rewardsToProcess}
          href="/admin/rewards"
          color="violet"
        />
      </div>

      <div>
        <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
          Activité récente
        </h2>
        {recentActivity.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune action récente.
          </p>
        ) : (
          <div className="divide-y rounded-2xl border">
            {recentActivity.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {AUDIT_ACTION_LABEL[log.action] ?? log.action}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Par {log.actorName}
                  </p>
                </div>
                <span className="text-muted-foreground text-xs">
                  {log.createdAt.toLocaleString("fr-FR", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
