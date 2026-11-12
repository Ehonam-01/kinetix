"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MonerooSubscribeButton } from "./moneroo-subscribe-button";
import { PaydunyaSubscribeForm } from "./paydunya-subscribe-form";
import { SubscribeButton } from "./subscribe-button";
import { WalletSubscribeForm } from "./wallet-subscribe-form";
import {
  InstallmentPanel,
  type InstallmentBounds,
  type InstallmentPlanView,
} from "./installment-panel";

type Method = "MOBILE_MONEY" | "WALLET" | "INSTALLMENTS";

export function SubscriptionPanel({
  price,
  username,
  activeProvider,
  installments,
  otherCountries = false,
  workshopDiscount = false,
}: {
  price: number;
  username: string;
  activeProvider: string;
  // SasPay configured: "Autre pays / carte bancaire" on the PayDunya form.
  otherCountries?: boolean;
  // Offers the code a workshop participant received (paydunya-subscribe-form).
  workshopDiscount?: boolean;
  // Present only when this member may pay in several deposits (first
  // subscription, PayDunya active) — see page.tsx.
  installments?: {
    plan: InstallmentPlanView | null;
    bounds: InstallmentBounds;
    months: number;
    tranches: [number, number, number] | null;
  };
}) {
  // A member who already started a cagnotte lands back on it.
  const [method, setMethod] = useState<Method>(
    installments?.plan ? "INSTALLMENTS" : "MOBILE_MONEY",
  );
  // A payment in 3 times already started: only its rest can be paid.
  if (installments?.plan?.split && installments.plan.paidAmount > 0) {
    return (
      <InstallmentPanel
        price={price}
        otherCountries={otherCountries}
        {...installments}
      />
    );
  }
  const offerSplit =
    installments && (installments.plan || installments.tranches);
  const tabs: { value: Method; label: string }[] = [
    { value: "MOBILE_MONEY", label: "Mobile Money" },
    ...(offerSplit
      ? [
          {
            value: "INSTALLMENTS" as const,
            label:
              installments.plan?.split === false
                ? "En plusieurs fois"
                : "En 3 fois",
          },
        ]
      : []),
    { value: "WALLET", label: "Solde (wallet)" },
  ];

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "bg-muted grid gap-1 rounded-lg p-1",
          tabs.length === 3 ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setMethod(tab.value)}
            className={cn(
              "rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
              method === tab.value
                ? "bg-background shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {method === "INSTALLMENTS" && installments ? (
        <InstallmentPanel
          price={price}
          otherCountries={otherCountries}
          {...installments}
        />
      ) : method === "MOBILE_MONEY" ? (
        activeProvider === "PAYDUNYA" ? (
          <PaydunyaSubscribeForm
            price={price}
            otherCountries={otherCountries}
            workshopDiscount={workshopDiscount}
          />
        ) : activeProvider === "BICTORYS" ? (
          <SubscribeButton price={price} />
        ) : (
          <MonerooSubscribeButton price={price} />
        )
      ) : (
        <WalletSubscribeForm price={price} defaultUsername={username} />
      )}
    </div>
  );
}
