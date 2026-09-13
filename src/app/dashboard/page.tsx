import { eq } from "drizzle-orm";
import Link from "next/link";
import {
  BookOpen,
  Gift,
  HandCoins,
  Layers,
  ReceiptText,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { db } from "@/db/client";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import { listCoursesForUser } from "@/repositories/courses";
import {
  getBalance,
  getBalanceHistory,
  getDirectSaleCommissionTotal,
} from "@/repositories/financial-transactions";
import { listLevelProgress } from "@/repositories/member-levels";
import { listMemberRewards } from "@/repositories/member-rewards";
import {
  listPurchasesForBuyer,
  listSalesForAmbassador,
} from "@/repositories/sales";
import { requireUser } from "@/services/auth/current-user";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import { BalanceEvolutionChart } from "@/components/balance-evolution-chart";

const PURCHASE_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmée",
  REFUNDED: "Remboursée",
};

// A plain customer never sees the MLM tree, commissions, generations,
// level, or ambassador balance (section 23 of the master prompt) — only
// once ambassador_profiles exists for them does this page show the fuller
// view (section 24). The account-detail summary (email/rôle/statut) moved
// to /dashboard/settings so it can also be edited from one place.
export default async function DashboardPage() {
  const { profile } = await requireUser();

  if (profile.status === "SUSPENDED") {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Compte suspendu</CardTitle>
          <CardDescription>
            Contactez le support pour plus d&apos;informations.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const ambassador = await db.query.ambassadorProfiles.findFirst({
    where: eq(ambassadorProfiles.userId, profile.id),
  });

  if (!ambassador) {
    const [courses, purchases] = await Promise.all([
      listCoursesForUser(db, profile.id),
      listPurchasesForBuyer(db, profile.id),
    ]);
    const accessibleCourseCount = courses.filter((c) => c.accessible).length;
    const recentPurchases = purchases.slice(0, 5);

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Bonjour, {profile.fullName}</h1>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={BookOpen}
            label="Cours accessibles"
            value={accessibleCourseCount}
            href="/dashboard/courses"
            color="emerald"
          />
          <StatCard
            icon={ReceiptText}
            label="Mes achats"
            value={purchases.length}
            href="/dashboard/purchases"
            color="blue"
          />
        </div>

        <Card className="from-primary to-primary/70 text-primary-foreground overflow-hidden border-none bg-linear-to-br">
          <CardHeader>
            <CardTitle className="text-primary-foreground flex items-center gap-2">
              <Sparkles className="size-4" />
              Devenir ambassadeur
            </CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Gratuit. Obtenez un lien de parrainage et gagnez des commissions
              sur les formations que vous recommandez.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard/become-ambassador"
              className={cn(
                buttonVariants(),
                "bg-background text-foreground hover:bg-background/90",
              )}
            >
              Rejoindre le programme
            </Link>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Achats récents</h2>
            {purchases.length > 5 && (
              <Link
                href="/dashboard/purchases"
                className="text-primary text-sm hover:underline"
              >
                Voir tout
              </Link>
            )}
          </div>
          {recentPurchases.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucun achat pour le moment.
            </p>
          ) : (
            <div className="divide-y rounded-2xl border">
              {recentPurchases.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{p.courseTitle}</p>
                    <p className="text-muted-foreground text-xs">
                      {p.createdAt.toLocaleDateString("fr-FR", {
                        dateStyle: "medium",
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span>{p.pricePaid.toLocaleString("fr-FR")} F</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        p.status === "CONFIRMED" &&
                          "bg-green-600/10 text-green-600",
                        p.status === "REFUNDED" && "bg-primary/10 text-primary",
                      )}
                    >
                      {PURCHASE_STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const [
    balance,
    balanceHistory,
    directCommissionTotal,
    levelProgress,
    courses,
    rewards,
    sales,
  ] = await Promise.all([
    getBalance(db, profile.id),
    getBalanceHistory(db, profile.id, 30),
    getDirectSaleCommissionTotal(db, profile.id),
    listLevelProgress(db, profile.id),
    listCoursesForUser(db, profile.id),
    listMemberRewards(db, profile.id),
    listSalesForAmbassador(db, profile.id),
  ]);

  const currentLevel = levelProgress
    .filter((l) => l.status !== "LOCKED")
    .at(-1);
  const accessibleCourseCount = courses.filter((c) => c.accessible).length;
  const eligibleRewardCount = rewards.filter(
    (r) => r.status === "ELIGIBLE",
  ).length;
  const totalTeamBv = levelProgress
    .flatMap((l) => l.generations)
    .reduce((sum, g) => sum + g.bvTotal, 0);
  const recentSales = sales.slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Bonjour, {profile.fullName}</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          icon={Wallet}
          label="Solde disponible"
          value={`${balance.availableBalance.toLocaleString("fr-FR")} F`}
          href="/dashboard/commissions"
          color="blue"
        />
        <StatCard
          icon={HandCoins}
          label="Commissions directes"
          value={`${directCommissionTotal.toLocaleString("fr-FR")} F`}
          href="/dashboard/commissions"
          color="cyan"
        />
        <StatCard
          icon={TrendingUp}
          label="BV total (équipe)"
          value={totalTeamBv.toLocaleString("fr-FR")}
          href="/dashboard/levels"
          color="rose"
        />
        <StatCard
          icon={Layers}
          label="Niveau actuel"
          value={currentLevel ? currentLevel.code : "—"}
          href="/dashboard/levels"
          color="violet"
        />
        <StatCard
          icon={BookOpen}
          label="Cours accessibles"
          value={accessibleCourseCount}
          href="/dashboard/courses"
          color="emerald"
        />
        <StatCard
          icon={Gift}
          label="Récompenses à réclamer"
          value={eligibleRewardCount}
          href="/dashboard/rewards"
          color="amber"
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">
              Évolution du solde (30 derniers jours)
            </CardTitle>
            <CardDescription>Solde cumulé, jour par jour</CardDescription>
          </div>
          <Link
            href="/dashboard/commissions"
            className="text-primary shrink-0 text-sm hover:underline"
          >
            Voir le détail
          </Link>
        </CardHeader>
        <CardContent>
          <BalanceEvolutionChart points={balanceHistory} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Ventes récentes</h2>
          {sales.length > 5 && (
            <Link
              href="/dashboard/commissions"
              className="text-primary text-sm hover:underline"
            >
              Voir tout
            </Link>
          )}
        </div>
        {recentSales.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune vente apportée par votre lien pour le moment.
          </p>
        ) : (
          <div className="divide-y rounded-2xl border">
            {recentSales.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{s.courseTitle}</p>
                  <p className="text-muted-foreground text-xs">
                    Acheté par {s.buyerUsername} ·{" "}
                    {s.createdAt.toLocaleDateString("fr-FR", {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span>{s.businessVolume.toLocaleString("fr-FR")} BV</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      s.status === "CONFIRMED" &&
                        "bg-green-600/10 text-green-600",
                      s.status === "REFUNDED" && "bg-primary/10 text-primary",
                    )}
                  >
                    {s.status === "CONFIRMED" ? "Confirmée" : "Remboursée"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
