import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import {
  getBalance,
  listTransactions,
} from "@/repositories/financial-transactions";
import { listSubscriptionsForAmbassador } from "@/repositories/subscriptions";
import { requireUser } from "@/services/auth/current-user";
import { getSiteEnv } from "@/config/env.site";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReferralLinkCard } from "./referral-link-card";

const TYPE_LABEL: Record<string, string> = {
  DIRECT_COMMISSION: "Commission directe",
  LEVEL_1_BONUS: "Bonus fin de niveau 1",
  LEVEL_COMMISSION: "Commission de génération",
  DIRECT_SALE_COMMISSION: "Commission sur souscription directe",
  GENERATION_COMMISSION: "Commission de génération (volume)",
  COMMISSION_REVERSAL: "Commission annulée",
  REWARD: "Récompense en espèces",
  PAYMENT: "Paiement",
  REFUND: "Remboursement",
  WITHDRAWAL: "Retrait",
  ADJUSTMENT: "Ajustement",
  TRANSFER_SENT: "Transfert envoyé",
  TRANSFER_RECEIVED: "Transfert reçu",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  COMPLETED: "Terminé",
  REVERSED: "Annulé",
};

function formatXof(amount: number) {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${amount.toLocaleString("fr-FR")} F`;
}

export default async function CommissionsPage() {
  const { profile } = await requireUser();
  if (profile.status !== "ACTIVE") redirect("/dashboard");

  const [balance, transactions, ambassador] = await Promise.all([
    getBalance(db, profile.id),
    listTransactions(db, profile.id, 50),
    db.query.ambassadorProfiles.findFirst({
      where: eq(ambassadorProfiles.userId, profile.id),
    }),
  ]);
  const attributedSubscriptions = ambassador
    ? await listSubscriptionsForAmbassador(db, profile.id)
    : [];

  return (
    <div className="space-y-6">
      {ambassador && (
        <ReferralLinkCard
          url={`${getSiteEnv().SITE_URL}/r/${ambassador.referralCode}`}
          validDays={await getCurrentParameterValue(
            db,
            "attribution.cookie_days",
          )}
        />
      )}

      {/* The available balance first and large — it's what the member can
          withdraw or transfer now — the two totals beside it. */}
      <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr]">
        <div className="from-primary to-primary/75 text-primary-foreground relative overflow-hidden rounded-2xl bg-linear-to-br p-5 shadow-lg sm:p-6">
          <div
            aria-hidden="true"
            className="bg-brand-accent/30 absolute -top-10 -right-10 size-40 rounded-full blur-2xl"
          />
          <div className="relative">
            <p className="flex items-center gap-2 text-sm font-medium text-white/80">
              <Wallet className="size-4" />
              Solde disponible
            </p>
            <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">
              {balance.availableBalance.toLocaleString("fr-FR")}
              <span className="ml-1.5 text-2xl font-semibold text-white/80">
                F
              </span>
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/dashboard/withdrawals"
                className={cn(
                  buttonVariants({ size: "sm" }),
                  "bg-background text-foreground hover:bg-background/90",
                )}
              >
                <ArrowDownToLine className="size-4" />
                Retirer
              </Link>
              <Link
                href="/dashboard/transfer"
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white",
                )}
              >
                <ArrowLeftRight className="size-4" />
                Transférer
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
          <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ArrowDownToLine className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Total retiré</p>
              <p className="text-xl font-bold wrap-break-word tabular-nums">
                {balance.withdrawnBalance.toLocaleString("fr-FR")} F
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <TrendingUp className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">Gains cumulés</p>
              <p className="text-xl font-bold wrap-break-word tabular-nums">
                {balance.lifetimeEarnings.toLocaleString("fr-FR")} F
              </p>
            </div>
          </div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune transaction pour le moment.
        </p>
      ) : (
        <div className="divide-y rounded-xl border">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{TYPE_LABEL[tx.type] ?? tx.type}</p>
                <p className="text-muted-foreground text-xs">
                  {tx.createdAt.toLocaleDateString("fr-FR", {
                    dateStyle: "medium",
                  })}{" "}
                  · {STATUS_LABEL[tx.status] ?? tx.status}
                </p>
              </div>
              <span
                className={
                  tx.amount >= 0 ? "text-green-600" : "text-destructive"
                }
              >
                {formatXof(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {ambassador && (
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Mes souscriptions</h2>
          {attributedSubscriptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucune souscription apportée par votre lien pour le moment.
            </p>
          ) : (
            <div className="divide-y rounded-xl border">
              {attributedSubscriptions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">{s.buyerUsername}</p>
                    <p className="text-muted-foreground text-xs">
                      {s.createdAt.toLocaleDateString("fr-FR", {
                        dateStyle: "medium",
                      })}
                    </p>
                  </div>
                  <span>{s.businessVolume.toLocaleString("fr-FR")} pts</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
