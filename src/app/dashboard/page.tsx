import { eq } from "drizzle-orm";
import Link from "next/link";
import {
  BookOpen,
  CalendarClock,
  Gift,
  HandCoins,
  Layers,
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
  getSubscriptionStatus,
  listSubscriptionsForAmbassador,
} from "@/repositories/subscriptions";
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
import { SubscriptionAlertBanner } from "@/components/subscription-alert-banner";

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
    const [courses, subscription] = await Promise.all([
      listCoursesForUser(db, profile.id),
      getSubscriptionStatus(db, profile.id),
    ]);
    const accessibleCourseCount = courses.filter((c) => c.accessible).length;

    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Bonjour, {profile.username}</h1>

        <SubscriptionAlertBanner status={subscription} />

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={BookOpen}
            label="Cours accessibles"
            value={accessibleCourseCount}
            href="/dashboard/courses"
            color="emerald"
          />
          <StatCard
            icon={CalendarClock}
            label="Abonnement"
            value={subscription.active ? "Actif" : "Inactif"}
            href="/dashboard/subscription"
            color="blue"
          />
        </div>

        {!subscription.active && (
          <Card className="from-primary to-primary/70 text-primary-foreground overflow-hidden border-none bg-linear-to-br">
            <CardHeader>
              <CardTitle className="text-primary-foreground flex items-center gap-2">
                <CalendarClock className="size-4" />
                Débloquez toutes les formations
              </CardTitle>
              <CardDescription className="text-primary-foreground/80">
                L&apos;abonnement annuel donne un accès illimité à toutes les
                formations de la plateforme.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/dashboard/subscription"
                className={cn(
                  buttonVariants(),
                  "bg-background text-foreground hover:bg-background/90",
                )}
              >
                Voir l&apos;abonnement
              </Link>
            </CardContent>
          </Card>
        )}

        <Card className="from-primary to-primary/70 text-primary-foreground overflow-hidden border-none bg-linear-to-br">
          <CardHeader>
            <CardTitle className="text-primary-foreground flex items-center gap-2">
              <Sparkles className="size-4" />
              Devenir ambassadeur
            </CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Gratuit. Obtenez un lien de parrainage et gagnez des commissions
              sur les abonnements que vous recommandez.
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
    subscriptionReferrals,
    subscription,
  ] = await Promise.all([
    getBalance(db, profile.id),
    getBalanceHistory(db, profile.id, 30),
    getDirectSaleCommissionTotal(db, profile.id),
    listLevelProgress(db, profile.id),
    listCoursesForUser(db, profile.id),
    listMemberRewards(db, profile.id),
    listSubscriptionsForAmbassador(db, profile.id),
    getSubscriptionStatus(db, profile.id),
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
  const recentReferrals = subscriptionReferrals.slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Bonjour, {profile.username}</h1>

      <SubscriptionAlertBanner status={subscription} />

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
          label="Points totaux (équipe)"
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
          <h2 className="text-lg font-medium">Souscriptions récentes</h2>
          {subscriptionReferrals.length > 5 && (
            <Link
              href="/dashboard/commissions"
              className="text-primary text-sm hover:underline"
            >
              Voir tout
            </Link>
          )}
        </div>
        {recentReferrals.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune souscription apportée par votre lien pour le moment.
          </p>
        ) : (
          <div className="divide-y rounded-2xl border">
            {recentReferrals.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">{r.buyerUsername}</p>
                  <p className="text-muted-foreground text-xs">
                    {r.createdAt.toLocaleDateString("fr-FR", {
                      dateStyle: "medium",
                    })}
                  </p>
                </div>
                <span>{r.businessVolume.toLocaleString("fr-FR")} pts</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
