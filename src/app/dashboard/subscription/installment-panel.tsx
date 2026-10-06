"use client";

import { useState } from "react";
import { CalendarClock, PiggyBank } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { depositInstallmentAction } from "./actions";
import { PaydunyaSubscribeForm } from "./paydunya-subscribe-form";

export type InstallmentPlanView = {
  targetAmount: number;
  paidAmount: number;
  deadlineAt: string | null;
};

const fmt = (amount: number) => `${amount.toLocaleString("fr-FR")} F`;

// Paying the first subscription in several deposits ("cagnotte",
// services/subscriptions/installments.ts): the rules, the progress so far,
// and the form for the next deposit.
export function InstallmentPanel({
  price,
  plan,
  bounds,
  months,
  feeLabel,
  otherCountries = false,
}: {
  price: number;
  plan: InstallmentPlanView | null;
  bounds: { min: number; max: number };
  months: number;
  feeLabel: string | null;
  otherCountries?: boolean;
}) {
  const target = plan?.targetAmount ?? price;
  const paid = plan?.paidAmount ?? 0;
  const percent = Math.min(100, Math.round((paid / target) * 100));
  // A first deposit is suggested at 5 000 F; afterwards, what's left.
  const [amount, setAmount] = useState(
    String(paid > 0 ? bounds.max : Math.min(5000, bounds.max)),
  );
  const parsed = Number(amount);
  const valid =
    Number.isInteger(parsed) && parsed >= bounds.min && parsed <= bounds.max;
  const deadline = plan?.deadlineAt
    ? new Date(plan.deadlineAt).toLocaleDateString("fr-FR", {
        dateStyle: "long",
      })
    : null;

  return (
    <div className="space-y-4">
      <div className="border-border bg-muted/40 space-y-3 rounded-xl border p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <PiggyBank className="text-primary size-4" />
          {paid > 0 ? "Ta cagnotte" : "Payer en plusieurs fois"}
        </p>
        <div>
          <div className="text-muted-foreground mb-1.5 flex justify-between text-xs tabular-nums">
            <span>
              {fmt(paid)} versés sur {fmt(target)}
            </span>
            <span>{percent} %</span>
          </div>
          <div className="bg-muted h-2.5 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        {deadline ? (
          <p className="flex items-center gap-2 text-sm">
            <CalendarClock className="size-4 shrink-0 text-amber-600" />
            <span>
              Reste <strong>{fmt(target - paid)}</strong> à verser avant le{" "}
              <strong>{deadline}</strong>.
            </span>
          </p>
        ) : (
          <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
            <li>
              Verse ce que tu veux, quand tu veux, à partir de{" "}
              {fmt(Math.min(1000, target))}.
            </li>
            <li>
              Ton abonnement s&apos;active automatiquement dès que {fmt(target)}{" "}
              sont atteints.
            </li>
            <li>
              Tu as {months} mois après ton premier versement pour compléter.
              Sinon, ton inscription est annulée et tes versements te sont
              remboursés
              {feeLabel ? `, moins les frais de retrait (${feeLabel})` : ""}.
            </li>
          </ul>
        )}
      </div>

      {bounds.max === 0 ? (
        <p className="text-muted-foreground text-sm">
          Un versement est en cours de confirmation. Rechargez la page dans
          quelques minutes.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="installment-amount">Montant de ce versement</Label>
            <Input
              id="installment-amount"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
            />
            <p
              className={
                valid
                  ? "text-muted-foreground text-xs"
                  : "text-destructive text-xs"
              }
            >
              {bounds.min === bounds.max
                ? `Montant restant : ${fmt(bounds.max)}.`
                : `Entre ${fmt(bounds.min)} et ${fmt(bounds.max)}.`}
            </p>
          </div>
          {valid && (
            <PaydunyaSubscribeForm
              price={parsed}
              submitLabel="Verser"
              otherCountries={otherCountries}
              start={(country, operator, phone, otp, address) =>
                depositInstallmentAction(
                  parsed,
                  country,
                  operator,
                  phone,
                  otp,
                  address,
                )
              }
            />
          )}
        </>
      )}
    </div>
  );
}
