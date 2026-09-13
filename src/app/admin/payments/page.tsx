import { db } from "@/db/client";
import { listPayments } from "@/repositories/payments";
import { cn } from "@/lib/utils";

const METHOD_LABEL: Record<string, string> = {
  MOBILE_MONEY: "Mobile money",
  ADMIN_CREDIT: "Crédit admin",
  WALLET: "Solde interne",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmé",
  FAILED: "Échoué",
  CANCELLED: "Annulé",
  REFUNDED: "Remboursé",
};

export default async function AdminPaymentsPage() {
  const payments = await listPayments(db);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {payments.length} paiement(s)
      </p>

      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun paiement.</p>
      ) : (
        <div className="divide-y rounded-2xl border">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">{p.beneficiaryName}</p>
                <p className="text-muted-foreground text-xs">
                  {METHOD_LABEL[p.method] ?? p.method}
                  {p.payerName && ` · payé par ${p.payerName}`}
                  {p.grantedByName && ` · accordé par ${p.grantedByName}`}
                  {" · "}
                  {p.createdAt.toLocaleDateString("fr-FR", {
                    dateStyle: "medium",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span>{p.amount.toLocaleString("fr-FR")} F</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    p.status === "CONFIRMED" &&
                      "bg-green-600/10 text-green-600",
                    p.status === "PENDING" && "bg-muted text-muted-foreground",
                    (p.status === "FAILED" || p.status === "CANCELLED") &&
                      "bg-destructive/10 text-destructive",
                    p.status === "REFUNDED" && "bg-primary/10 text-primary",
                  )}
                >
                  {STATUS_LABEL[p.status] ?? p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
