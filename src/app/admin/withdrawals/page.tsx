import { db } from "@/db/client";
import {
  listPendingWithdrawalRequestsForAdmin,
  listProcessingWithdrawalRequestsForAdmin,
} from "@/repositories/withdrawals";
import { CheckPayoutButton } from "./check-payout-button";
import { ReviewActions } from "./review-actions";
import { requireAdmin } from "@/services/auth/current-user";

export default async function AdminWithdrawalsPage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't
  // re-run on every navigation, so it can't be the only gate (Next.js
  // authentication guide, "Layouts and auth checks").
  await requireAdmin();
  const [requests, processing] = await Promise.all([
    listPendingWithdrawalRequestsForAdmin(db),
    listProcessingWithdrawalRequestsForAdmin(db),
  ]);

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-muted-foreground text-sm">
          {requests.length} demande(s) en attente de validation. « Déclencher le
          virement » envoie un virement PayDunya réel vers le numéro mobile
          money indiqué, depuis le solde de votre compte PayDunya — la demande
          passe automatiquement à « Payé » une fois le virement confirmé.
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
                      {r.feeAmount > 0 && (
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          · {r.feeAmount.toLocaleString("fr-FR")} F de frais ·{" "}
                          <strong className="text-foreground">
                            {(r.amount - r.feeAmount).toLocaleString("fr-FR")} F
                            à verser
                          </strong>
                        </span>
                      )}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Numéro : {r.payoutPhone}
                      {r.operator ? ` (${r.operator})` : ""}
                      {r.country ? ` · ${r.country}` : ""} · Confirmé le{" "}
                      {(r.confirmedAt ?? r.createdAt).toLocaleDateString(
                        "fr-FR",
                        { dateStyle: "medium" },
                      )}
                    </p>
                    {r.payoutFailureReason && (
                      <p className="text-destructive text-xs">
                        {r.payoutFailureReason}
                      </p>
                    )}
                  </div>
                </div>
                <ReviewActions requestId={r.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {processing.length > 0 && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {processing.length} virement(s) en cours — en attente de
            confirmation de l&apos;opérateur. « Vérifier le statut » interroge
            PayDunya sans jamais renvoyer de virement.
          </p>
          <div className="space-y-3">
            {processing.map((r) => (
              <div
                key={r.id}
                className="space-y-1 rounded-2xl border px-4 py-3 text-sm"
              >
                <p className="font-medium">
                  {r.amount.toLocaleString("fr-FR")} F · {r.username}
                  {r.feeAmount > 0 && (
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {r.feeAmount.toLocaleString("fr-FR")} F de frais ·{" "}
                      <strong className="text-foreground">
                        {(r.amount - r.feeAmount).toLocaleString("fr-FR")} F à
                        verser
                      </strong>
                    </span>
                  )}
                </p>
                <p className="text-muted-foreground text-xs">
                  Numéro : {r.payoutPhone}
                  {r.operator ? ` (${r.operator})` : ""}
                  {r.country ? ` · ${r.country}` : ""}
                </p>
                {r.payoutFailureReason && (
                  <p className="text-destructive text-xs">
                    {r.payoutFailureReason}
                  </p>
                )}
                <CheckPayoutButton requestId={r.id} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
