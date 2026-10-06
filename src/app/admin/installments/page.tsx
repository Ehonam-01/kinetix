import { requireAdmin } from "@/services/auth/current-user";
import { listInstallmentPlansForAdmin } from "@/services/subscriptions/installments";
import { MOBILE_MONEY_OPERATOR_OPTIONS } from "@/config/mobile-money-operators";
import {
  OTHER_COUNTRY,
  PAYDUNYA_COUNTRY_OPTIONS,
} from "@/config/paydunya-countries";
import { RefundButton } from "./refund-button";

const fmt = (amount: number) => `${amount.toLocaleString("fr-FR")} F`;
const fmtDate = (date: Date | null) =>
  date ? date.toLocaleDateString("fr-FR", { dateStyle: "medium" }) : "—";
const operatorLabel = (value: string | null | undefined) =>
  MOBILE_MONEY_OPERATOR_OPTIONS.find((o) => o.value === value)?.label ??
  value ??
  "—";
const countryLabel = (value: string | null | undefined) =>
  (value === OTHER_COUNTRY ? "Autre pays (SasPay)" : null) ??
  PAYDUNYA_COUNTRY_OPTIONS.find((c) => c.value === value)?.label ??
  value ??
  "—";

type Payout = {
  country?: string | null;
  operator?: string | null;
  phone?: string | null;
};

// Installment plans ("cagnottes", services/subscriptions/installments.ts):
// the refunds to send first, then the plans still in progress.
export default async function AdminInstallmentsPage() {
  // Re-checked here, not only in admin/layout.tsx: a layout isn't re-run on
  // every navigation, so it can't be the only gate.
  await requireAdmin();
  const rows = await listInstallmentPlansForAdmin();
  const toRefund = rows.filter(
    (r) => r.plan.status === "EXPIRED" && !r.plan.refundedAt,
  );
  const open = rows.filter((r) => r.plan.status === "OPEN");
  const refunded = rows.filter(
    (r) => r.plan.status === "EXPIRED" && r.plan.refundedAt,
  );

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="font-semibold">À rembourser ({toRefund.length})</h2>
        <p className="text-muted-foreground text-sm">
          Cagnottes non complétées dans le délai. Envoyez le montant net par
          mobile money au numéro indiqué, puis enregistrez-le ici.
        </p>
        {toRefund.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucun remboursement en attente.
          </p>
        ) : (
          <div className="divide-y rounded-2xl border">
            {toRefund.map(({ plan, fullName, username }) => {
              const payout = (plan.refundPayout ?? {}) as Payout;
              return (
                <div
                  key={plan.id}
                  className="flex flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium">
                      {fullName}{" "}
                      <span className="text-muted-foreground">
                        ({username})
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Versé {fmt(plan.paidAmount)} sur {fmt(plan.targetAmount)}{" "}
                      · expirée le {fmtDate(plan.expiredAt)}
                    </p>
                    <p>
                      À envoyer :{" "}
                      <strong className="tabular-nums">
                        {fmt(plan.refundAmount ?? 0)}
                      </strong>{" "}
                      <span className="text-muted-foreground text-xs">
                        ({fmt(plan.refundFee ?? 0)} de frais retenus)
                      </span>
                    </p>
                    <p className="text-xs">
                      {countryLabel(payout.country)} ·{" "}
                      {operatorLabel(payout.operator)} ·{" "}
                      <span className="font-medium select-all">
                        {payout.phone ?? "numéro inconnu"}
                      </span>
                    </p>
                  </div>
                  <RefundButton
                    planId={plan.id}
                    amount={plan.refundAmount ?? 0}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">En cours ({open.length})</h2>
        {open.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune cagnotte en cours.
          </p>
        ) : (
          <div className="divide-y rounded-2xl border">
            {open.map(({ plan, fullName, username }) => (
              <div
                key={plan.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <p className="font-medium">
                  {fullName}{" "}
                  <span className="text-muted-foreground">({username})</span>
                </p>
                <p className="text-muted-foreground tabular-nums">
                  {fmt(plan.paidAmount)} / {fmt(plan.targetAmount)} · échéance{" "}
                  {fmtDate(plan.deadlineAt)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {refunded.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Remboursées ({refunded.length})</h2>
          <div className="divide-y rounded-2xl border">
            {refunded.map(({ plan, fullName }) => (
              <div
                key={plan.id}
                className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
              >
                <p>{fullName}</p>
                <p className="text-muted-foreground tabular-nums">
                  {fmt(plan.refundAmount ?? 0)} le {fmtDate(plan.refundedAt)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
