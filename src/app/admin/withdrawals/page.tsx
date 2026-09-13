import { db } from "@/db/client";
import { listPendingWithdrawalRequestsForAdmin } from "@/repositories/withdrawals";
import { ReviewActions } from "./review-actions";

export default async function AdminWithdrawalsPage() {
  const requests = await listPendingWithdrawalRequestsForAdmin(db);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {requests.length} demande(s) en attente de validation. Le virement
        mobile money se fait manuellement, hors plateforme (aucune intégration
        de paiement sortant configurée) — cliquez « Marquer comme payé » une
        fois le virement effectué.
      </p>

      {requests.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune demande en attente.
        </p>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className="space-y-2 rounded-2xl border px-4 py-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {r.amount.toLocaleString("fr-FR")} F · {r.username}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Numéro : {r.payoutPhone} · Confirmé le{" "}
                    {(r.confirmedAt ?? r.createdAt).toLocaleDateString(
                      "fr-FR",
                      { dateStyle: "medium" },
                    )}
                  </p>
                </div>
              </div>
              <ReviewActions requestId={r.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
