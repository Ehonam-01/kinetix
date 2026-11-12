"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, PiggyBank } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { depositInstallmentAction } from "./actions";
import { PaydunyaSubscribeForm } from "./paydunya-subscribe-form";

export type InstallmentPlanView = {
  targetAmount: number;
  paidAmount: number;
  deadlineAt: string | null;
  // Payment in 3 times (lib/split-payment.ts); false: an older cagnotte.
  split: boolean;
  // The deadline has passed (worked out on the server).
  overdue: boolean;
};

export type InstallmentBounds = {
  min: number;
  max: number;
  // Payment in 3 times: the only amounts allowed now.
  choices: number[] | null;
};

const fmt = (amount: number) => `${amount.toLocaleString("fr-FR")} F`;

// Paying the first subscription in several deposits
// (services/subscriptions/installments.ts): the payment in 3 times, or an
// older free-deposit cagnotte still running.
export function InstallmentPanel({
  price,
  plan,
  bounds,
  months,
  tranches,
  otherCountries = false,
}: {
  price: number;
  plan: InstallmentPlanView | null;
  bounds: InstallmentBounds;
  months: number;
  tranches: [number, number, number] | null;
  otherCountries?: boolean;
}) {
  if (plan && !plan.split) {
    return (
      <CagnottePanel
        plan={plan}
        bounds={bounds}
        otherCountries={otherCountries}
      />
    );
  }
  return (
    <SplitPanel
      price={price}
      plan={plan}
      bounds={bounds}
      months={months}
      tranches={tranches}
      otherCountries={otherCountries}
    />
  );
}

function Progress({ paid, target }: { paid: number; target: number }) {
  const percent = Math.min(100, Math.round((paid / target) * 100));
  return (
    <div>
      <div className="text-muted-foreground mb-1.5 flex justify-between text-xs tabular-nums">
        <span>
          {fmt(paid)} payés sur {fmt(target)}
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
  );
}

function PayForm({
  amount,
  label,
  otherCountries,
}: {
  amount: number;
  label: string;
  otherCountries: boolean;
}) {
  return (
    <PaydunyaSubscribeForm
      price={amount}
      submitLabel={label}
      otherCountries={otherCountries}
      start={(country, operator, phone, otp, address) =>
        depositInstallmentAction(amount, country, operator, phone, otp, address)
      }
    />
  );
}

const IN_PROGRESS = (
  <p className="text-muted-foreground text-sm">
    Un paiement est en cours de confirmation. Rechargez la page dans quelques
    minutes.
  </p>
);

function SplitPanel({
  price,
  plan,
  bounds,
  months,
  tranches,
  otherCountries,
}: {
  price: number;
  plan: InstallmentPlanView | null;
  bounds: InstallmentBounds;
  months: number;
  tranches: [number, number, number] | null;
  otherCountries: boolean;
}) {
  const choices = bounds.choices ?? [];
  const [picked, setPicked] = useState(0);
  const amount = choices[Math.min(picked, choices.length - 1)];
  const target = plan?.targetAmount ?? price;
  const paid = plan?.paidAmount ?? 0;
  const deadline = plan?.deadlineAt ? new Date(plan.deadlineAt) : null;
  const overdue = !!plan?.overdue;
  const deadlineLabel = deadline?.toLocaleDateString("fr-FR", {
    dateStyle: "long",
  });

  if (!tranches) return null;

  return (
    <div className="space-y-4">
      <div className="border-border bg-muted/40 space-y-3 rounded-xl border p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <PiggyBank className="text-primary size-4" />
          {paid > 0 ? "Mon paiement en 3 fois" : "Payer en 3 fois"}
        </p>
        {paid > 0 ? (
          <>
            <Progress paid={paid} target={target} />
            {deadlineLabel && (
              <p
                className={cn(
                  "flex items-center gap-2 text-sm",
                  overdue && "text-destructive",
                )}
              >
                <CalendarClock
                  className={cn(
                    "size-4 shrink-0",
                    overdue ? "text-destructive" : "text-amber-600",
                  )}
                />
                <span>
                  Reste <strong>{fmt(target - paid)}</strong> à régler{" "}
                  {overdue ? "depuis le" : "avant le"}{" "}
                  <strong>{deadlineLabel}</strong>.
                </span>
              </p>
            )}
          </>
        ) : (
          <ol className="space-y-2 text-sm">
            <li className="flex gap-2">
              <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
              <span>
                <strong>{fmt(tranches[0])} aujourd&apos;hui</strong> : ton accès
                s&apos;ouvre tout de suite.
              </span>
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="text-primary mt-0.5 size-4 shrink-0" />
              <span>
                Puis <strong>{fmt(tranches[1])}</strong> et{" "}
                <strong>{fmt(tranches[2])}</strong>, quand tu veux, dans les{" "}
                {months} mois.
              </span>
            </li>
            <li className="text-muted-foreground pl-6 text-xs">
              Sans le solde au bout de {months} mois, l&apos;accès est suspendu
              jusqu&apos;au règlement.
            </li>
          </ol>
        )}
      </div>

      {choices.length === 0 ? (
        IN_PROGRESS
      ) : (
        <>
          {choices.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              {choices.map((choice, i) => (
                <button
                  key={choice}
                  type="button"
                  onClick={() => setPicked(i)}
                  aria-pressed={picked === i}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    picked === i
                      ? "border-primary bg-primary/5"
                      : "border-border",
                  )}
                >
                  <span className="block font-semibold tabular-nums">
                    {fmt(choice)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {i === choices.length - 1 ? "Tout régler" : "Une tranche"}
                  </span>
                </button>
              ))}
            </div>
          )}
          <PayForm
            key={amount}
            amount={amount}
            label={`Payer ${fmt(amount)}`}
            otherCountries={otherCountries}
          />
        </>
      )}
    </div>
  );
}

// An older plan, opened before the payment in 3 times: free deposits,
// access once the target is reached.
function CagnottePanel({
  plan,
  bounds,
  otherCountries,
}: {
  plan: InstallmentPlanView;
  bounds: InstallmentBounds;
  otherCountries: boolean;
}) {
  const [amount, setAmount] = useState(String(bounds.max));
  const parsed = Number(amount);
  const valid =
    Number.isInteger(parsed) && parsed >= bounds.min && parsed <= bounds.max;
  const deadline = plan.deadlineAt
    ? new Date(plan.deadlineAt).toLocaleDateString("fr-FR", {
        dateStyle: "long",
      })
    : null;

  return (
    <div className="space-y-4">
      <div className="border-border bg-muted/40 space-y-3 rounded-xl border p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <PiggyBank className="text-primary size-4" />
          Ta cagnotte
        </p>
        <Progress paid={plan.paidAmount} target={plan.targetAmount} />
        {deadline && (
          <p className="flex items-center gap-2 text-sm">
            <CalendarClock className="size-4 shrink-0 text-amber-600" />
            <span>
              Reste <strong>{fmt(plan.targetAmount - plan.paidAmount)}</strong>{" "}
              à verser avant le <strong>{deadline}</strong>. Ton abonnement
              s&apos;active dès que {fmt(plan.targetAmount)} sont atteints.
            </span>
          </p>
        )}
      </div>

      {bounds.max === 0 ? (
        IN_PROGRESS
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
            <PayForm
              amount={parsed}
              label="Verser"
              otherCountries={otherCountries}
            />
          )}
        </>
      )}
    </div>
  );
}
