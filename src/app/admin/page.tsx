import Link from "next/link";
import {
  Banknote,
  BookOpen,
  Clock,
  Coins,
  Gift,
  TriangleAlert,
  TrendingUp,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { db } from "@/db/client";
import { listMembers } from "@/repositories/admin-members";
import { listAllCoursesForAdmin } from "@/repositories/courses";
import { listAuditLogs } from "@/repositories/audit-logs";
import { listMembersInGracePeriod } from "@/repositories/subscriptions";
import { listAllMemberRewards } from "@/repositories/member-rewards";
import {
  getAdminOverviewStats,
  getRevenueHistory,
} from "@/repositories/admin-stats";
import { AdminRevenueChart } from "@/components/admin-revenue-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { AUDIT_ACTION_LABEL } from "./audit-action-labels";
import { requireAdmin } from "@/services/auth/current-user";

// Live financial data (chiffre d'affaires, commissions versées) must never
// be frozen at build time — force-dynamic also sidesteps the build-time
// static-generation attempt that was timing out at 60s once this page
// picked up two more DB round trips (getAdminOverviewStats/
// getRevenueHistory) on top of its existing queries.
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't
  // re-run on every navigation, so it can't be the only gate (Next.js
  // authentication guide, "Layouts and auth checks").
  await requireAdmin();
  const [
    members,
    courses,
    rewards,
    recentActivity,
    stats,
    revenueHistory,
    inGrace,
  ] = await Promise.all([
    listMembers(db),
    listAllCoursesForAdmin(db),
    listAllMemberRewards(db),
    listAuditLogs(db, 8),
    getAdminOverviewStats(db),
    getRevenueHistory(db, 30),
    listMembersInGracePeriod(db),
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
      {inGrace.length > 0 && (
        <Link
          href="/admin/subscriptions#grace"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm hover:bg-amber-500/15"
        >
          <span className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <TriangleAlert className="size-4 shrink-0 text-amber-600" />
            <span>
              <strong>{inGrace.length}</strong> compte(s) en période de grâce
              {inGrace[0].graceDaysLeft <= 3 &&
                ` — le plus urgent est désactivé dans ${inGrace[0].graceDaysLeft <= 1 ? "moins d'un jour" : `${inGrace[0].graceDaysLeft} jours`}`}
            </span>
          </span>
          <span className="font-medium text-amber-700 underline underline-offset-2 dark:text-amber-300">
            Voir et relancer
          </span>
        </Link>
      )}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Banknote}
          label="Chiffre d'affaires total"
          value={`${stats.totalRevenue.toLocaleString("fr-FR")} F`}
          href="/admin/subscriptions"
          color="emerald"
        />
        <StatCard
          icon={TrendingUp}
          label="Chiffre d'affaires (ce mois)"
          value={`${stats.revenueThisMonth.toLocaleString("fr-FR")} F`}
          href="/admin/subscriptions"
          color="blue"
        />
        <StatCard
          icon={Coins}
          label="Commissions versées"
          value={`${stats.totalCommissionsPaid.toLocaleString("fr-FR")} F`}
          href="/admin/commissions"
          color="rose"
        />
        <StatCard
          icon={UserPlus}
          label="Nouveaux abonnements (30j)"
          value={stats.newSubscriptionsThisMonth}
          href="/admin/subscriptions"
          color="cyan"
        />
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Chiffre d&apos;affaires — 30 derniers jours</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminRevenueChart points={revenueHistory} />
        </CardContent>
      </Card>

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
