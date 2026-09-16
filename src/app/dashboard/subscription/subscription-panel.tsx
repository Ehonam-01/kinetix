"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SubscribeButton } from "./subscribe-button";
import { WalletSubscribeForm } from "./wallet-subscribe-form";

export function SubscriptionPanel({
  price,
  username,
}: {
  price: number;
  username: string;
}) {
  const [method, setMethod] = useState<"MOBILE_MONEY" | "WALLET">(
    "MOBILE_MONEY",
  );

  return (
    <div className="space-y-4">
      <div className="bg-muted grid grid-cols-2 gap-1 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setMethod("MOBILE_MONEY")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            method === "MOBILE_MONEY"
              ? "bg-background shadow-sm"
              : "text-muted-foreground",
          )}
        >
          Mobile Money
        </button>
        <button
          type="button"
          onClick={() => setMethod("WALLET")}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            method === "WALLET"
              ? "bg-background shadow-sm"
              : "text-muted-foreground",
          )}
        >
          Solde (wallet)
        </button>
      </div>

      {method === "MOBILE_MONEY" ? (
        <SubscribeButton price={price} />
      ) : (
        <WalletSubscribeForm price={price} defaultUsername={username} />
      )}
    </div>
  );
}
