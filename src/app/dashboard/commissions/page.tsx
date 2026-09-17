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
        <Card size="sm">
          <CardContent className="space-y-1">
            <CardDescription>Mon lien de parrainage</CardDescription>
            <CardTitle className="font-mono text-sm font-normal break-all">
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
