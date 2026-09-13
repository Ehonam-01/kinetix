import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { ambassadorProfiles } from "@/db/schema/ambassador-profiles";
import {
  getBalance,
  listTransactions,
} from "@/repositories/financial-transactions";
import { listSalesForAmbassador } from "@/repositories/sales";
import { requireUser } from "@/services/auth/current-user";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";

const TYPE_LABEL: Record<string, string> = {
  DIRECT_COMMISSION: "Commission directe",
  LEVEL_1_BONUS: "Bonus fin de niveau 1",
  LEVEL_COMMISSION: "Commission de génération",
  DIRECT_SALE_COMMISSION: "Commission sur vente directe",
  GENERATION_COMMISSION: "Commission de génération (BV)",
  COMMISSION_REVERSAL: "Commission annulée",
  REWARD: "Récompense en espèces",
  PAYMENT: "Paiement",
  REFUND: "Remboursement",
  WITHDRAWAL: "Retrait",
  ADJUSTMENT: "Ajustement",
  TRANSFER_SENT: "Transfert envoyé",
  TRANSFER_RECEIVED: "Transfert reçu",
};

const SALE_STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmée",
  REFUNDED: "Remboursée",
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
  const attributedSales = ambassador
    ? await listSalesForAmbassador(db, profile.id)
    : [];

  return (
    <div className="space-y-6">
      {ambassador && (
        <Card size="sm">
          <CardContent className="space-y-1">
            <CardDescription>Mon lien de parrainage</CardDescription>
            <CardTitle className="text-sm font-mono font-normal break-all">
              /r/{ambassador.referralCode}
            </CardTitle>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card size="sm">
          <CardContent className="space-y-1">
            <CardDescription>Solde disponible</CardDescription>
            <CardTitle className="text-lg">
              {balance.availableBalance.toLocaleString("fr-FR")} F
            </CardTitle>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="space-y-1">
            <CardDescription>Total retiré</CardDescription>
            <CardTitle className="text-lg">
              {balance.withdrawnBalance.toLocaleString("fr-FR")} F
            </CardTitle>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardContent className="space-y-1">
            <CardDescription>Gains cumulés</CardDescription>
            <CardTitle className="text-lg">
              {balance.lifetimeEarnings.toLocaleString("fr-FR")} F
            </CardTitle>
          </CardContent>
        </Card>
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
          <h2 className="text-lg font-medium">Mes ventes</h2>
          {attributedSales.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Aucune vente apportée par votre lien pour le moment.
            </p>
          ) : (
            <div className="divide-y rounded-xl border">
              {attributedSales.map((s) => (
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
                        s.status === "REFUNDED" &&
                          "bg-primary/10 text-primary",
                      )}
                    >
                      {SALE_STATUS_LABEL[s.status] ?? s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
