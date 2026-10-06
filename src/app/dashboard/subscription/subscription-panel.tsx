"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MonerooSubscribeButton } from "./moneroo-subscribe-button";
import { PaydunyaSubscribeForm } from "./paydunya-subscribe-form";
import { SubscribeButton } from "./subscribe-button";
import { WalletSubscribeForm } from "./wallet-subscribe-form";
import {
  InstallmentPanel,
  type InstallmentPlanView,
} from "./installment-panel";

type Method = "MOBILE_MONEY" | "WALLET" | "INSTALLMENTS";

export function SubscriptionPanel({
  price,
  username,
  activeProvider,
  installments,
  otherCountries = false,
}: {
  price: number;
  username: string;
  activeProvider: string;
  // SasPay configured: "Autre pays / carte bancaire" on the PayDunya form.
  otherCountries?: boolean;
  // Present only when this member may pay in several deposits (first
  // subscription, PayDunya active) — see page.tsx.
  installments?: {
    plan: InstallmentPlanView | null;
    bounds: { min: number; max: number };
    months: number;
    feeLabel: string | null;
  };
}) {
  // A member who already started a cagnotte lands back on it.
  const [method, setMethod] = useState<Method>(
    installments?.plan ? "INSTALLMENTS" : "MOBILE_MONEY",
  );
  const tabs: { value: Method; label: string }[] = [
    { value: "MOBILE_MONEY", label: "Mobile Money" },
    ...(installments
      ? [{ value: "INSTALLMENTS" as const, label: "En plusieurs fois" }]
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
