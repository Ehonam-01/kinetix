import { db } from "@/db/client";
import { listTransfers } from "@/repositories/wallet-transfers";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  PENDING_OTP: "En attente de code",
  CONFIRMED: "Confirmé",
  EXPIRED: "Expiré",
};

export default async function AdminTransfersPage() {
  const transfers = await listTransfers(db);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {transfers.length} transfert(s) — lecture seule, vue de support/audit.
      </p>

      {transfers.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun transfert.</p>
      ) : (
        <div className="divide-y rounded-2xl border">
          {transfers.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {t.senderName} → {t.recipientName}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t.createdAt.toLocaleDateString("fr-FR", {
                    dateStyle: "medium",
                  })}
                  {t.confirmedAt &&
                    ` · confirmé le ${t.confirmedAt.toLocaleDateString("fr-FR", { dateStyle: "medium" })}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span>{t.amount.toLocaleString("fr-FR")} F</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    t.status === "CONFIRMED" &&
                      "bg-green-600/10 text-green-600",
                    t.status === "PENDING_OTP" &&
                      "bg-muted text-muted-foreground",
                    t.status === "EXPIRED" &&
                      "bg-destructive/10 text-destructive",
                  )}
                >
                  {STATUS_LABEL[t.status] ?? t.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
