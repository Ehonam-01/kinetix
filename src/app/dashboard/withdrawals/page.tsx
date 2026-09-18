import { Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { getBalance } from "@/repositories/financial-transactions";
import { getCurrentParameterValue } from "@/repositories/parameter-versions";
import { listWithdrawalRequestsForUser } from "@/repositories/withdrawals";
import { requireUser } from "@/services/auth/current-user";
import { cn } from "@/lib/utils";
import { WithdrawalForm } from "./withdrawal-form";

const STATUS_LABEL: Record<string, string> = {
  PENDING_OTP: "En attente de code",
  PENDING_REVIEW: "En attente de validation",
  PAID: "Payé",
  REJECTED: "Refusé",
  EXPIRED: "Expiré",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING_OTP: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-amber-500/10 text-amber-600",
  PAID: "bg-green-600/10 text-green-600",
  REJECTED: "bg-destructive/10 text-destructive",
  EXPIRED: "bg-muted text-muted-foreground",
};

export default async function WithdrawalsPage() {
  const { profile } = await requireUser();
  if (profile.status !== "ACTIVE") redirect("/dashboard");

  const [balance, minimumAmount, requests] = await Promise.all([
    getBalance(db, profile.id),
    getCurrentParameterValue(db, "withdrawal.minimum_amount"),
    listWithdrawalRequestsForUser(db, profile.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-2xl border bg-blue-50 p-5 dark:bg-blue-500/10">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
          <Wallet className="size-6" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Solde disponible
          </p>
          <p className="text-3xl font-bold wrap-break-word">
            {balance.availableBalance.toLocaleString("fr-FR")} F
          </p>
          {balance.pendingBalance > 0 && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              + {balance.pendingBalance.toLocaleString("fr-FR")} F en attente
              de traitement
            </p>
          )}
        </div>
      </div>

      <WithdrawalForm minimumAmount={minimumAmount} />

      <div className="space-y-3">
        <h2 className="text-lg font-medium">Mes demandes de retrait</h2>
        {requests.filter((r) => r.status !== "PENDING_OTP").length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune demande de retrait pour le moment.
          </p>
        ) : (
          <div className="divide-y rounded-xl border">
            {requests
              .filter((r) => r.status !== "PENDING_OTP")
              .map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {r.amount.toLocaleString("fr-FR")} F · {r.payoutPhone}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {r.createdAt.toLocaleDateString("fr-FR", {
                        dateStyle: "medium",
                      })}
                      {r.status === "REJECTED" && r.rejectionReason && (
                        <> · {r.rejectionReason}</>
                      )}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      STATUS_STYLE[r.status],
                    )}
                  >
                    {STATUS_LABEL[r.status] ?? r.status}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
